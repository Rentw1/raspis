import 'dart:math' as math;

import 'package:flutter/foundation.dart';

import '../ai/ai_client.dart';
import '../ai/prompts.dart';
import '../core/json_utils.dart';
import '../core/regulation.dart';
import '../core/text_utils.dart';
import '../export/gost.dart';
import '../models/coursework.dart';
import '../models/source.dart';
import '../search/source_finder.dart';
import 'budget.dart';
import 'markup.dart';

enum GenStepState { pending, running, done, error, skipped }

class GenStepInfo {
  GenStepInfo(this.id, this.title);
  final String id;
  final String title;
}

/// Состояние генерации для интерфейса.
class GenProgress extends ChangeNotifier {
  bool running = false;
  String currentStep = '';
  String status = '';
  String live = '';
  final List<String> log = [];
  String? error;

  void setStatus(String s) {
    status = s;
    addLog(s);
  }

  void addLog(String s) {
    final t = DateTime.now();
    log.add('${two(t.hour)}:${two(t.minute)}:${two(t.second)}  $s');
    if (log.length > 300) log.removeRange(0, log.length - 300);
    notifyListeners();
  }

  void appendLive(String delta) {
    live += delta;
    if (live.length > 6000) live = live.substring(live.length - 5000);
    notifyListeners();
  }

  void clearLive() {
    live = '';
    notifyListeners();
  }

  void update() => notifyListeners();
}

/// Пошаговое написание курсовой: план → источники → факты → главы (частями) →
/// заключение → введение (после основной части, как требует регламент) → приложения → проверка.
class Generator {
  Generator({required this.cw, required this.ai, required this.finderFactory, required this.save, required this.progress});

  final Coursework cw;
  final AiClient ai;
  final SourceFinder Function(CancelToken cancel) finderFactory;
  final Future<void> Function() save;
  final GenProgress progress;

  CancelToken? _cancel;

  bool get isRunning => progress.running;

  static List<GenStepInfo> stepsFor(Coursework cw) {
    final n = cw.options.chapters;
    return [
      GenStepInfo('plan', 'План работы'),
      GenStepInfo('sources', 'Источники (интернет)'),
      if (cw.options.webFacts) GenStepInfo('facts', 'Факты для практической части'),
      for (var i = 1; i <= n; i++) GenStepInfo('chapter$i', 'Глава $i'),
      GenStepInfo('conclusion', 'Заключение'),
      GenStepInfo('introduction', 'Введение (после основной части)'),
      if (cw.options.appendices) GenStepInfo('appendices', 'Приложения'),
      GenStepInfo('finalize', 'Нумерация и ссылки'),
    ];
  }

  GenStepState stateOf(String id) {
    final s = cw.steps[id];
    return switch (s) {
      'done' => GenStepState.done,
      'error' => GenStepState.error,
      'skipped' => GenStepState.skipped,
      _ => progress.running && progress.currentStep == id ? GenStepState.running : GenStepState.pending,
    };
  }

  void stop() {
    _cancel?.cancel();
    progress.setStatus('Останавливаю…');
  }

  /// Сбросить шаг и все зависящие от него (для «Перегенерировать»).
  void resetFrom(String stepId) {
    final ids = stepsFor(cw).map((e) => e.id).toList();
    final i = ids.indexOf(stepId);
    if (i < 0) return;
    for (final id in ids.sublist(i)) {
      cw.steps.remove(id);
    }
    if (stepId == 'plan') {
      for (final s in cw.sections) {
        s.text = '';
        s.parts.clear();
        s.status = PartStatus.pending;
      }
      for (final a in cw.appendices) {
        a.text = '';
        a.status = PartStatus.pending;
      }
    }
  }

  /// Запуск (или продолжение) генерации.
  Future<void> run({Set<String>? only}) async {
    if (progress.running) return;
    progress.running = true;
    progress.error = null;
    progress.clearLive();
    final cancel = CancelToken();
    _cancel = cancel;
    progress.update();
    try {
      for (final st in stepsFor(cw)) {
        if (only != null && !only.contains(st.id)) continue;
        if (only == null && cw.steps[st.id] == 'done') continue;
        cancel.throwIfCancelled();
        progress.currentStep = st.id;
        progress.setStatus('▶ ${st.title}');
        progress.clearLive();
        try {
          await _runStep(st.id, cancel);
          cw.steps[st.id] = 'done';
        } on AiException catch (e) {
          if (e.kind == AiErrorKind.cancelled) rethrow;
          cw.steps[st.id] = 'error';
          progress.error = '${st.title}: ${e.message}';
          progress.addLog('✖ ${progress.error}');
          await save();
          return;
        }
        await save();
        progress.addLog('✔ ${st.title}');
      }
      progress.setStatus('Готово. Проверьте работу на вкладке «Проверка».');
    } on AiException catch (e) {
      if (e.kind == AiErrorKind.cancelled) {
        progress.setStatus('Остановлено. Нажмите «Продолжить», чтобы продолжить с того же места.');
      } else {
        progress.error = e.message;
      }
      await save();
    } catch (e, st) {
      debugPrint('generator error: $e\n$st');
      progress.error = 'Ошибка: $e';
      progress.addLog('✖ ${progress.error}');
      await save();
    } finally {
      progress.running = false;
      progress.currentStep = '';
      _cancel = null;
      progress.update();
    }
  }

  Future<void> _runStep(String id, CancelToken cancel) async {
    if (id == 'plan') return _plan(cancel);
    if (id == 'sources') return _sources(cancel);
    if (id == 'facts') return _facts(cancel);
    if (id.startsWith('chapter')) return _chapter(int.parse(id.substring(7)), cancel);
    if (id == 'conclusion') return _conclusion(cancel);
    if (id == 'introduction') return _introduction(cancel);
    if (id == 'appendices') return _appendices(cancel);
    if (id == 'finalize') return finalize();
  }

  void _status(String s) => progress.addLog(s);

  // ---------------- План ----------------

  Future<void> _plan(CancelToken cancel) async {
    if (cw.meta.topic.trim().length < 5) throw AiException('Укажите тему курсовой работы на вкладке «Данные».', kind: AiErrorKind.config);
    final j = await ai.chatJson(Prompts.jsonSystem, Prompts.planRequest(cw), temperature: 0.4, maxTokens: 3500, cancel: cancel, onStatus: _status, onDelta: progress.appendLive);
    if (j is! Map) throw AiException('ИИ не прислал план. Повторите попытку.', kind: AiErrorKind.format);
    cw.plan = parsePlan(Map<String, dynamic>.from(j), cw.options);
    syncSectionsWithPlan(cw);
  }

  static Plan parsePlan(Map<String, dynamic> j, GenOptions o) {
    final n = o.chapters;
    final chapters = <PlanChapter>[];
    for (final c in (j['chapters'] as List? ?? const []).whereType<Map>()) {
      final title = Reg.cleanHeading(jStr(c['title'], 200));
      if (title.length < 5) continue;
      chapters.add(PlanChapter(
        title: title,
        role: jStr(c['role']).toLowerCase().startsWith('theor') ? 'theory' : 'practice',
        points: jStrList(c['points'], max: 10, maxLen: 300),
        tables: o.tables ? jStrList(c['tables'], max: 3, maxLen: 200).map((t) => CaptionUtil.cleanCaption(t)).toList() : [],
      ));
    }
    if (chapters.length > n) chapters.removeRange(n, chapters.length);
    while (chapters.length < n) {
      final i = chapters.length;
      chapters.add(PlanChapter(
        title: i == 0 ? 'Теоретические основы исследования' : (i == 1 ? 'Анализ фактического материала по теме исследования' : 'Разработка рекомендаций по совершенствованию'),
        role: i == 0 ? 'theory' : 'practice',
      ));
    }
    // Регламент: первая глава — теоретическая, остальные — практические.
    for (var i = 0; i < chapters.length; i++) {
      chapters[i].role = i == 0 ? 'theory' : 'practice';
      if (chapters[i].points.length < 3) {
        chapters[i].points = i == 0
            ? ['понятие и сущность', 'классификация и виды', 'нормативное регулирование', 'факторы и условия', 'современные подходы и проблемы']
            : ['характеристика объекта анализа', 'анализ показателей в динамике', 'оценка структуры', 'выявленные проблемы', 'рекомендации'];
      }
    }
    // Таблицы: не больше заданного числа, приоритет практическим главам.
    var left = o.tables ? o.maxTables : 0;
    for (final c in [...chapters.skip(1), chapters.first]) {
      final keep = math.min(left, c.tables.length);
      c.tables = c.tables.take(keep).toList();
      left -= keep;
    }
    final apps = <PlanAppendix>[];
    if (o.appendices) {
      for (final a in (j['appendices'] as List? ?? const []).whereType<Map>()) {
        final t = Reg.cleanHeading(jStr(a['title'], 200));
        if (t.length < 4) continue;
        apps.add(PlanAppendix(title: t, content: jStr(a['content'], 400), chapter: (jInt(a['chapter']) ?? 2).clamp(1, n)));
      }
      while (apps.length < o.appendixCount) {
        apps.add(PlanAppendix(title: apps.isEmpty ? 'Исходные данные для анализа' : 'Дополнительные материалы по теме исследования', content: 'таблица исходных данных', chapter: n >= 2 ? 2 : 1));
      }
      if (apps.length > o.appendixCount) apps.removeRange(o.appendixCount, apps.length);
    }
    return Plan(
      object: jStr(j['object'], 400),
      subject: jStr(j['subject'], 400),
      goal: jStr(j['goal'], 500),
      tasks: jStrList(j['tasks'], max: 7, maxLen: 300),
      methods: jStrList(j['methods'], max: 8, maxLen: 120),
      keywords: jStrList(j['keywords'], max: 14, maxLen: 80),
      searchQueries: jStrList(j['search_queries'] ?? j['searchQueries'], max: 8, maxLen: 120),
      chapters: chapters,
      appendices: apps,
    );
  }

  /// Создаёт/обновляет разделы и приложения по плану.
  static void syncSectionsWithPlan(Coursework cw) {
    final plan = cw.plan;
    if (plan == null) return;
    final budget = Budget.compute(cw.options, sources: math.max(cw.selectedSources.length, cw.options.sourcesCount));
    Section ensure(SectionKind kind, int number) {
      final ex = cw.sections.where((s) => s.kind == kind && (kind != SectionKind.chapter || s.number == number)).firstOrNull;
      if (ex != null) return ex;
      final s = Section(id: newId('sec'), kind: kind, number: number);
      cw.sections.add(s);
      return s;
    }

    final intro = ensure(SectionKind.introduction, 0)..targetWords = budget.introWords;
    intro.title = 'Введение';
    for (var i = 0; i < plan.chapters.length; i++) {
      final s = ensure(SectionKind.chapter, i + 1);
      s.title = plan.chapters[i].title;
      s.role = plan.chapters[i].role;
      s.targetWords = budget.chapterWords[math.min(i, budget.chapterWords.length - 1)];
    }
    cw.sections.removeWhere((s) => s.kind == SectionKind.chapter && s.number > plan.chapters.length);
    ensure(SectionKind.conclusion, 0)
      ..targetWords = budget.conclusionWords
      ..title = 'Заключение';
    // приложения
    final apps = <Appendix>[];
    for (var i = 0; i < plan.appendices.length; i++) {
      final pa = plan.appendices[i];
      final ex = i < cw.appendices.length ? cw.appendices[i] : null;
      apps.add(Appendix(
        id: ex?.id ?? newId('app'),
        number: i + 1,
        title: pa.title,
        brief: pa.content,
        chapter: pa.chapter,
        text: ex != null && ex.title == pa.title ? ex.text : '',
        status: ex != null && ex.title == pa.title ? ex.status : PartStatus.pending,
      ));
    }
    cw.appendices = cw.options.appendices ? apps : [];
  }

  // ---------------- Источники ----------------

  Future<void> _sources(CancelToken cancel) async {
    final need = cw.options.sourcesCount;
    final finder = finderFactory(cancel);
    final haveSelected = cw.sources.where((s) => s.selected && s.type != SourceType.normative && s.type != SourceType.web).length;
    if (haveSelected < (need * 0.7).round()) {
      var picked = <Source>[];
      var candidates = <Source>[];
      if (cw.options.internetSources && finder.settings.anyLiterature) {
        progress.setStatus('Ищу литературу в интернете…');
        candidates = await finder.findLiterature(cw, progress: _status);
        picked = await finder.selectBest(cw, candidates, need - haveSelected, progress: _status);
      }
      if (picked.length < (need - haveSelected) * 0.5) {
        try {
          final extra = await finder.aiLiterature(cw, need - haveSelected - picked.length, progress: _status);
          picked.addAll(extra);
        } on AiException catch (e) {
          if (e.kind == AiErrorKind.cancelled) rethrow;
          _status('ИИ не смог предложить литературу: ${e.message}');
        }
      }
      final known = cw.sources.map((s) => s.dedupKey).toSet();
      for (final s in picked) {
        if (known.add(s.dedupKey)) cw.sources.add(s..selected = true);
      }
      // остальные найденные — в резерв (можно включить вручную на вкладке «Источники»)
      for (final s in candidates.take(40)) {
        if (known.add(s.dedupKey)) cw.sources.add(s..selected = false);
      }
    }
    if (cw.options.normativeActs && !cw.sources.any((s) => s.type == SourceType.normative)) {
      try {
        final acts = await finder.normativeActs(cw, progress: _status);
        cw.sources.addAll(acts.map((s) => s..selected = true));
      } on AiException catch (e) {
        if (e.kind == AiErrorKind.cancelled) rethrow;
        _status('Нормативные акты не подобраны: ${e.message}');
      }
    }
    if (cw.wikiContext.isEmpty) cw.wikiContext = await finder.referenceContext(cw, progress: _status);
    if (cw.selectedSources.isEmpty) {
      throw AiException('Не удалось подобрать ни одного источника. Проверьте интернет или добавьте литературу вручную на вкладке «Источники».', kind: AiErrorKind.config);
    }
    _status('Источников в списке литературы: ${cw.selectedSources.length}');
  }

  // ---------------- Факты ----------------

  Future<void> _facts(CancelToken cancel) async {
    final finder = finderFactory(cancel);
    progress.setStatus('Собираю фактический материал в интернете…');
    final (facts, webSources) = await finder.collectFacts(cw, progress: _status);
    cw.facts = facts;
    final known = cw.sources.map((s) => (s.url ?? s.dedupKey)).toSet();
    for (final s in webSources) {
      if (known.add(s.url ?? s.dedupKey)) cw.sources.add(s);
    }
    _status(facts.isEmpty ? 'Фактов в интернете не найдено — практическая часть опирается на ваши данные или условный пример.' : 'Собрано фактов: ${facts.length}');
  }

  String _factsText() {
    if (cw.facts.isEmpty) return '';
    final b = StringBuffer();
    for (final f in cw.facts.take(18)) {
      b.writeln('– ${f.text}${f.sourceTitle.isNotEmpty ? ' (${f.sourceTitle})' : (f.url.isNotEmpty ? ' (${Uri.tryParse(f.url)?.host ?? ''})' : '')}');
    }
    return b.toString();
  }

  // ---------------- Главы ----------------

  List<Source> get _ordered => Gost.ordered(cw.sources);

  int _tablesBefore(int chapterNumber) {
    var n = 0;
    for (final c in cw.chapters.where((c) => c.number < chapterNumber)) {
      n += Markup.parse(c.text).whereType<TableBlock>().length;
    }
    return n;
  }

  static List<List<String>> splitPoints(List<String> points, int parts) {
    final out = List.generate(parts, (_) => <String>[]);
    for (var i = 0; i < points.length; i++) {
      out[(i * parts / math.max(1, points.length)).floor().clamp(0, parts - 1)].add(points[i]);
    }
    return out;
  }

  Future<void> _chapter(int n, CancelToken cancel) async {
    final plan = cw.plan;
    if (plan == null) throw AiException('Сначала нужен план работы.', kind: AiErrorKind.config);
    final section = cw.chapters.firstWhere((s) => s.number == n, orElse: () => throw AiException('Глава $n не найдена в плане.', kind: AiErrorKind.config));
    final pc = plan.chapters[n - 1];
    final ordered = _ordered;
    final sourcesList = Prompts.sourcesForPrompt(ordered);
    final parts = Budget.partsFor(section.targetWords);
    final perPart = (section.targetWords / parts).round();
    final pointGroups = splitPoints(pc.points, parts);
    final firstTable = _tablesBefore(n) + 1;
    final appRefs = <(int, String)>[
      for (final a in cw.appendices.where((a) => a.chapter == n)) (a.number, a.title),
    ];
    section.status = PartStatus.running;
    if (section.parts.length > parts) section.parts.removeRange(parts, section.parts.length);
    for (var p = section.parts.length; p < parts; p++) {
      cancel.throwIfCancelled();
      progress.setStatus('Глава $n: часть ${p + 1} из $parts (≈$perPart слов)');
      final tables = <(int, String)>[];
      for (var t = 0; t < pc.tables.length; t++) {
        final part = pc.role == 'theory' ? math.min(parts - 1, 1) : math.min(parts - 1, t);
        if (part == p) tables.add((firstTable + t, pc.tables[t]));
      }
      final prompt = Prompts.chapterPartRequest(
        cw: cw,
        section: section,
        chapter: pc,
        part: p + 1,
        parts: parts,
        words: perPart,
        pointsHere: pointGroups[p],
        previousTail: _tail(section.parts.join('\n\n')),
        sourcesList: sourcesList,
        minCitations: pc.role == 'theory' ? 4 : 2,
        tables: tables,
        appendixRefs: p == parts - 1 ? appRefs : const [],
        last: p == parts - 1,
        facts: _factsText(),
        reference: cw.wikiContext,
      );
      final text = await _write(prompt, perPart, cancel, drop: [pc.title, section.heading]);
      section.parts.add(Markup.dropInvalidCitations(text, ordered.length));
      section.text = section.parts.join('\n\n');
      await save();
    }
    // Дописываем, если глава получилась заметно короче нужного.
    var extra = 0;
    while (wordCount(section.text) < section.targetWords * 0.85 && extra < 2) {
      cancel.throwIfCancelled();
      extra++;
      final missing = section.targetWords - wordCount(section.text);
      progress.setStatus('Глава $n короче нужного — дописываю ≈$missing слов');
      final prompt = Prompts.chapterPartRequest(
        cw: cw,
        section: section,
        chapter: pc,
        part: parts + extra,
        parts: parts + extra,
        words: missing,
        pointsHere: pc.points,
        previousTail: _tail(section.text),
        sourcesList: sourcesList,
        minCitations: 2,
        tables: const [],
        appendixRefs: const [],
        last: false,
        facts: _factsText(),
        reference: cw.wikiContext,
        continuation: true,
      );
      final text = await _write(prompt, missing, cancel, drop: [pc.title, section.heading]);
      // вставляем перед итоговым абзацем «Таким образом…»
      final paras = section.text.split(RegExp(r'\n\s*\n'));
      final lastIdx = paras.lastIndexWhere((p) => p.trim().startsWith('Таким образом'));
      final add = Markup.dropInvalidCitations(text, ordered.length);
      if (lastIdx > 0) {
        paras.insert(lastIdx, add);
      } else {
        paras.add(add);
      }
      section.text = paras.join('\n\n');
      section.parts = [section.text];
      await save();
    }
    section.text = Markup.renumberTables(section.text, firstTable).$1;
    section.status = PartStatus.done;
  }

  static String _tail(String text, [int chars = 1400]) {
    final t = text.trim();
    if (t.length <= chars) return t;
    final cut = t.substring(t.length - chars);
    final i = cut.indexOf('\n\n');
    return (i >= 0 && i < chars * 0.6 ? cut.substring(i + 2) : cut).trim();
  }

  /// Запрос текста у ИИ + очистка; при обрыве по длине — обрезка до последнего полного предложения.
  Future<String> _write(String prompt, int words, CancelToken cancel, {List<String> drop = const []}) async {
    progress.clearLive();
    final r = await ai.chatFull(
      const [ChatMessage.system(Prompts.writerSystem)] + [ChatMessage.user(prompt)],
      temperature: cw.options.creativity,
      maxTokens: (words * 3.2).round().clamp(2000, 8000),
      onDelta: progress.appendLive,
      onStatus: _status,
      cancel: cancel,
    );
    var text = Markup.cleanAiText(r.text, dropHeadings: drop);
    if (r.truncated) text = trimToSentence(text);
    if (wordCount(text) < math.min(120, words * 0.3)) {
      throw AiException('ИИ прислал слишком короткий текст (${wordCount(text)} слов). Повторите или выберите другую модель.', kind: AiErrorKind.empty);
    }
    cw.generatedBy = ai.label(r.provider);
    return text;
  }

  static String trimToSentence(String text) {
    final t = text.trimRight();
    final lines = t.split('\n');
    if (lines.isNotEmpty && lines.last.trim().startsWith('|')) return t;
    final i = t.lastIndexOf(RegExp(r'[.!?…»)](\s|$)'));
    return i > t.length * 0.5 ? t.substring(0, i + 1) : t;
  }

  // ---------------- Заключение и введение ----------------

  Future<void> _conclusion(CancelToken cancel) async {
    final s = cw.conclusion;
    if (s == null) throw AiException('Нет раздела «Заключение» — пересоставьте план.', kind: AiErrorKind.config);
    if (cw.chapters.any((c) => c.text.trim().isEmpty)) throw AiException('Сначала должны быть написаны все главы.', kind: AiErrorKind.config);
    progress.setStatus('Пишу заключение (≈${s.targetWords} слов)');
    s.status = PartStatus.running;
    s.text = await _write(Prompts.conclusionRequest(cw, words: s.targetWords), s.targetWords, cancel, drop: const ['Заключение']);
    s.parts = [s.text];
    s.status = PartStatus.done;
  }

  Future<void> _introduction(CancelToken cancel) async {
    final s = cw.introduction;
    if (s == null) throw AiException('Нет раздела «Введение» — пересоставьте план.', kind: AiErrorKind.config);
    if (cw.chapters.any((c) => c.text.trim().isEmpty)) {
      throw AiException('Введение пишется только после основной части: сначала сгенерируйте все главы.', kind: AiErrorKind.config);
    }
    final ordered = _ordered;
    progress.setStatus('Пишу введение (≈${s.targetWords} слов) — по готовой основной части');
    s.status = PartStatus.running;
    final text = await _write(
      Prompts.introductionRequest(cw, words: s.targetWords, sourcesList: Prompts.sourcesForPrompt(ordered, annotation: 120), sourcesCount: ordered.length, appendicesCount: cw.appendices.length),
      s.targetWords,
      cancel,
      drop: const ['Введение'],
    );
    s.text = Markup.dropInvalidCitations(text, ordered.length);
    s.parts = [s.text];
    s.status = PartStatus.done;
  }

  // ---------------- Приложения ----------------

  Future<void> _appendices(CancelToken cancel) async {
    for (final a in cw.appendices) {
      if (a.status == PartStatus.done && a.text.trim().isNotEmpty) continue;
      cancel.throwIfCancelled();
      progress.setStatus('Приложение ${a.number}: ${a.title}');
      a.status = PartStatus.running;
      progress.clearLive();
      final r = await ai.chatFull(
        const [ChatMessage.system(Prompts.writerSystem)] + [ChatMessage.user(Prompts.appendixRequest(cw, a))],
        temperature: 0.4,
        maxTokens: 3000,
        onDelta: progress.appendLive,
        onStatus: _status,
        cancel: cancel,
      );
      a.text = Markup.cleanAiText(r.text, dropHeadings: [a.title, 'Приложение ${a.number}']);
      a.status = a.text.trim().isEmpty ? PartStatus.error : PartStatus.done;
      await save();
    }
  }

  // ---------------- Завершение ----------------

  /// Сквозная нумерация таблиц, ссылки на приложения, удаление неверных ссылок на источники.
  Future<void> finalize() async {
    final max = Gost.ordered(cw.sources).length;
    var next = 1;
    for (final c in cw.chapters) {
      final (t, n) = Markup.renumberTables(c.text, next);
      c.text = Markup.dropInvalidCitations(t, max);
      next = n;
    }
    for (final s in [cw.introduction, cw.conclusion].whereType<Section>()) {
      s.text = Markup.dropInvalidCitations(s.text, max);
    }
    ensureAppendixReferences(cw);
  }

  /// Если на приложение нет ссылки в тексте — добавить её в соответствующую главу.
  static int ensureAppendixReferences(Coursework cw) {
    var added = 0;
    final all = cw.orderedSections.map((s) => s.text).join('\n');
    for (final a in cw.appendices) {
      final re = RegExp('приложени[еяюи]\\s+${a.number}(?!\\d)', caseSensitive: false);
      if (re.hasMatch(all)) continue;
      final ch = cw.chapters.where((c) => c.number == a.chapter).firstOrNull ?? cw.chapters.lastOrNull;
      if (ch == null || ch.text.trim().isEmpty) continue;
      final paras = ch.text.split(RegExp(r'\n\s*\n'));
      var idx = paras.lastIndexWhere((p) => !p.trim().startsWith('Таким образом') && !p.trim().startsWith('|') && !p.trim().startsWith('Таблица') && !p.trim().startsWith('–'));
      if (idx < 0) idx = paras.length - 1;
      paras[idx] = '${paras[idx].trimRight()} Подробные сведения приведены в приложении ${a.number} («${a.title}»).';
      ch.text = paras.join('\n\n');
      added++;
    }
    return added;
  }

  // ---------------- Правка разделов ----------------

  /// Перегенерировать один раздел (глава, введение, заключение).
  Future<void> regenerateSection(Section s) async {
    final id = switch (s.kind) {
      SectionKind.introduction => 'introduction',
      SectionKind.conclusion => 'conclusion',
      SectionKind.chapter => 'chapter${s.number}',
    };
    s.text = '';
    s.parts.clear();
    cw.steps.remove(id);
    await run(only: {id});
  }

  /// Расширить / сократить / перефразировать раздел.
  Future<void> rewriteSection(Section s, String mode) async {
    if (progress.running) return;
    progress.running = true;
    final cancel = CancelToken();
    _cancel = cancel;
    progress.clearLive();
    progress.setStatus(switch (mode) { 'extend' => 'Расширяю: ${s.shortName}', 'shorten' => 'Сокращаю: ${s.shortName}', _ => 'Перефразирую: ${s.shortName}' });
    try {
      final ordered = _ordered;
      final words = mode == 'extend' ? (s.words * 1.4).round() : (mode == 'shorten' ? (s.words * 0.7).round() : s.words);
      final text = await _write(Prompts.rewriteRequest(cw, s, mode, sourcesList: Prompts.sourcesForPrompt(ordered, withAnnotations: false)), words, cancel,
          drop: [s.title, s.heading]);
      s.text = Markup.dropInvalidCitations(text, ordered.length);
      s.parts = [s.text];
      if (s.kind == SectionKind.chapter) s.text = Markup.renumberTables(s.text, _tablesBefore(s.number) + 1).$1;
      await save();
      progress.setStatus('Готово: ${s.shortName}');
    } on AiException catch (e) {
      progress.error = e.message;
      progress.addLog('✖ ${e.message}');
    } finally {
      progress.running = false;
      _cancel = null;
      progress.update();
    }
  }

  /// Перефразировать абзац (для устранения дословных совпадений).
  Future<String> paraphrase(String paragraph) async {
    final r = await ai.chat([const ChatMessage.system(Prompts.writerSystem), ChatMessage.user(Prompts.paraphraseParagraph(paragraph))], temperature: 0.7, maxTokens: 1500);
    return Markup.cleanAiText(r);
  }
}
