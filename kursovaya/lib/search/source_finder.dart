import 'dart:async';

import '../ai/ai_client.dart';
import '../ai/prompts.dart';
import '../core/json_utils.dart';
import '../core/net.dart';
import '../core/text_utils.dart';
import '../models/coursework.dart';
import '../models/settings.dart';
import '../models/source.dart';
import 'literature_apis.dart';
import 'web_search.dart';

typedef Progress = void Function(String message);

class SourceTestResult {
  SourceTestResult(this.name, this.ok, this.message);
  final String name;
  final bool ok;
  final String message;
}

/// Поиск литературы, фактов и нормативных актов в интернете.
class SourceFinder {
  SourceFinder({required this.settings, required this.webKey, this.ai, this.cancel});

  final SearchSettings settings;

  /// Ключ выбранного веб-поисковика (Tavily/Brave).
  final String webKey;
  final AiClient? ai;
  final CancelToken? cancel;

  WebSearch get web => WebSearch(engine: settings.engine, key: webKey, searxngBase: settings.searxngBase);

  List<LiteratureApi> get _apis => [
        if (settings.cyberLeninka) CyberLeninkaApi(),
        if (settings.openAlex) OpenAlexApi(email: settings.contactEmail, onlyRussian: settings.onlyRussian),
        if (settings.googleBooks) GoogleBooksApi(onlyRussian: settings.onlyRussian),
        if (settings.crossref) CrossrefApi(email: settings.contactEmail, onlyRussian: settings.onlyRussian),
      ];

  static final RegExp _topicNoise = RegExp(
    r'(^|\s)(на примере|на материалах|по материалам|в условиях|в современных условиях)(?=\s|$).*$',
    caseSensitive: false,
  );
  static final RegExp _leadNoise = RegExp(
    r'^(анализ|совершенствование|особенности|роль|проблемы|организация|разработка|оценка|исследование|сравнительный анализ|'
    r'современные|основные|теоретические и практические аспекты|теоретические основы|актуальные вопросы|пути повышения|повышение)\s+',
    caseSensitive: false,
  );

  /// Ядро темы: без «на примере…», названий организаций в кавычках и вводных слов.
  static String topicCore(String topic) {
    var t = topic.replaceAll(RegExp(r'«[^»]*»|"[^"]*"'), ' ').replaceAll(_topicNoise, '');
    t = t.replaceAll(RegExp(r'[()\[\].,:;!?]'), ' ');
    t = collapseSpaces(t);
    for (var i = 0; i < 3; i++) {
      final n = t.replaceFirst(_leadNoise, '');
      if (n == t) break;
      t = n;
    }
    return collapseSpaces(t.replaceAll(RegExp(r'\s+(и|в|на|с|по|для|о|об)$', caseSensitive: false), ''));
  }

  static List<String> buildQueries(Coursework cw, {int max = 6}) {
    final topic = cw.meta.topic.trim();
    final core = topicCore(topic);
    final q = <String>[];
    void add(String s) {
      final v = collapseSpaces(s);
      if (v.length >= 4 && !q.any((e) => e.toLowerCase() == v.toLowerCase())) q.add(v);
    }

    add(core);
    for (final s in cw.plan?.searchQueries ?? const <String>[]) {
      add(s);
    }
    final w = core.split(' ');
    if (w.length > 4) add(w.take(4).join(' '));
    for (final k in (cw.plan?.keywords ?? const <String>[]).take(3)) {
      add(k);
    }
    final disc = cw.meta.discipline.replaceAll(RegExp(r'^(МДК|ОП|ПМ)\s*[\d.]*\s*', caseSensitive: false), '').trim();
    if (disc.isNotEmpty && q.length < max) add('$disc ${w.take(2).join(' ')}');
    return q.take(max).toList();
  }

  Future<T> _guard<T>(Future<T> Function() f, T fallback, Progress? progress, String what) async {
    try {
      return await f();
    } on NetException catch (e) {
      if (cancel?.isCancelled ?? false) rethrow;
      progress?.call('$what: ${e.message}');
      return fallback;
    } catch (e) {
      if (cancel?.isCancelled ?? false) rethrow;
      progress?.call('$what: $e');
      return fallback;
    }
  }

  // ---------------- Литература ----------------

  Future<List<Source>> findLiterature(Coursework cw, {Progress? progress}) async {
    final net = Net(cancel: cancel);
    try {
      final queries = buildQueries(cw);
      final fromYear = DateTime.now().year - cw.options.recentYears - 3;
      final found = <String, Source>{};
      for (final api in _apis) {
        for (var i = 0; i < queries.length && i < 4; i++) {
          cancel?.throwIfCancelled();
          progress?.call('${api.name}: «${queries[i]}»');
          final list = await _guard(() => api.search(net, queries[i], limit: 20, fromYear: fromYear), <Source>[], progress, api.name);
          for (final s in list) {
            _merge(found, s);
          }
          if (list.isEmpty && i == 0) break; // база недоступна или пусто — не тратим время
        }
      }
      final all = found.values.toList();
      final filtered = filterCandidates(cw, all);
      progress?.call('Найдено публикаций: ${all.length}, подходящих: ${filtered.length}');
      return filtered;
    } finally {
      net.close();
    }
  }

  static void _merge(Map<String, Source> found, Source s) {
    final k = s.dedupKey;
    final old = found[k];
    if (old == null) {
      found[k] = s;
      return;
    }
    // дополняем недостающие поля
    old.authors = old.authors.isEmpty ? s.authors : old.authors;
    old.container ??= s.container;
    old.publisher ??= s.publisher;
    old.year ??= s.year;
    old.pages ??= s.pages;
    old.pageCount ??= s.pageCount;
    old.volume ??= s.volume;
    old.issue ??= s.issue;
    old.url ??= s.url;
    if ((old.annotation ?? '').length < (s.annotation ?? '').length) old.annotation = s.annotation;
  }

  /// Фильтр по регламенту + оценка релевантности.
  static List<Source> filterCandidates(Coursework cw, List<Source> all) {
    final topicStems = keywordStems('${cw.meta.topic} ${(cw.plan?.keywords ?? const []).join(' ')}');
    final disciplineStems = keywordStems(cw.meta.discipline);
    final now = DateTime.now().year;
    final out = <Source>[];
    for (final s in all) {
      if (cw.options.excludeTextbooks && isForbiddenSource(s)) continue;
      if (s.title.length < 8) continue;
      if (s.authors.isEmpty && (s.publisher ?? '').isEmpty && (s.container ?? '').isEmpty) continue;
      final titleStems = keywordStems('${s.title} ${s.subtitle ?? ''}');
      final annStems = keywordStems(s.annotation ?? '');
      final hitTitle = titleStems.intersection(topicStems).length;
      final hitAnn = annStems.intersection(topicStems).length;
      final hitDisc = titleStems.intersection(disciplineStems).length;
      if (hitTitle == 0 && hitAnn < 2) continue;
      var score = hitTitle * 2.0 + hitAnn * 0.5 + hitDisc * 0.5;
      if (s.year != null) {
        final age = now - s.year!;
        score += age <= cw.options.recentYears ? 2.0 : (age <= cw.options.recentYears + 5 ? 0.5 : -1.0);
      } else {
        score -= 1.5;
      }
      if (s.type == SourceType.book) score += 0.8;
      if ((s.annotation ?? '').length > 100) score += 0.5;
      if ((s.pages ?? '').isNotEmpty || (s.pageCount ?? 0) > 0) score += 0.4;
      if (s.authors.isNotEmpty) score += 0.4;
      score += s.score;
      s.score = score;
      out.add(s);
    }
    out.sort((a, b) => b.score.compareTo(a.score));
    return out.take(80).toList();
  }

  /// ИИ отбирает самые подходящие публикации; без ИИ — по оценке релевантности.
  Future<List<Source>> selectBest(Coursework cw, List<Source> candidates, int need, {Progress? progress}) async {
    if (candidates.length <= need) return candidates;
    if (ai != null && await ai!.isReady()) {
      try {
        progress?.call('ИИ отбирает источники по теме…');
        final j = await ai!.chatJson(Prompts.jsonSystem, Prompts.selectSourcesRequest(cw, candidates.take(60).toList(), need),
            temperature: 0.1, maxTokens: 1500, cancel: cancel, onStatus: progress);
        final ids = jStrList(j is Map ? j['selected'] : j, max: need * 2);
        final byId = {for (final s in candidates) s.id: s};
        final picked = ids.map((id) => byId[id.trim()]).whereType<Source>().toSet().toList();
        if (picked.length >= (need * 0.6).round()) {
          for (final s in candidates) {
            if (picked.length >= need) break;
            if (!picked.contains(s)) picked.add(s);
          }
          return picked.take(need).toList();
        }
      } on AiException catch (e) {
        if (e.kind == AiErrorKind.cancelled) rethrow;
        progress?.call('Отбор ИИ не удался (${e.message}) — беру по релевантности.');
      }
    }
    // Без ИИ: баланс книг и статей
    final books = candidates.where((s) => s.type == SourceType.book).toList();
    final arts = candidates.where((s) => s.type != SourceType.book).toList();
    final wantBooks = (need * 0.35).round().clamp(0, books.length);
    return [...books.take(wantBooks), ...arts.take(need - wantBooks)].take(need).toList();
  }

  /// Источники, предложенные ИИ, когда интернет-поиск недоступен (помечаются как непроверенные).
  Future<List<Source>> aiLiterature(Coursework cw, int need, {Progress? progress}) async {
    if (ai == null) return [];
    progress?.call('Интернет-базы недоступны — ИИ предлагает литературу (нужно проверить)…');
    final j = await ai!.chatJson(Prompts.jsonSystem, Prompts.literatureFallbackRequest(cw, need), temperature: 0.2, maxTokens: 3500, cancel: cancel, onStatus: progress);
    final items = (j is Map ? j['items'] : j) as List? ?? const [];
    final out = <Source>[];
    for (final it in items.whereType<Map>()) {
      final title = jStr(it['title'], 300);
      if (title.length < 6) continue;
      final isBook = jStr(it['type']).toLowerCase().startsWith('book');
      final s = Source(
        id: newId('ai'),
        type: isBook ? SourceType.book : SourceType.article,
        title: title,
        authors: jStrList(it['authors'], max: 6, maxLen: 60).map((a) => parsePersonName(a).surnameInitials).toList(),
        container: isBook ? null : jStr(it['journal'], 200),
        city: isBook ? jStr(it['city'], 60) : null,
        publisher: isBook ? jStr(it['publisher'], 120) : null,
        year: jInt(it['year']),
        issue: jStr(it['issue'], 20),
        pages: isBook ? null : jStr(it['pages'], 20),
        pageCount: isBook ? jInt(it['page_count']) : null,
        origin: SourceOrigin.ai,
        verified: false,
        note: 'Предложен ИИ — проверьте, что издание существует',
      );
      if (cw.options.excludeTextbooks && isForbiddenSource(s)) continue;
      out.add(s);
    }
    return out;
  }

  // ---------------- Нормативные акты ----------------

  Future<List<Source>> normativeActs(Coursework cw, {Progress? progress}) async {
    if (ai == null) return [];
    progress?.call('Подбираю нормативные акты…');
    final j = await ai!.chatJson(Prompts.jsonSystem, Prompts.normativeRequest(cw), temperature: 0.1, maxTokens: 1500, cancel: cancel, onStatus: progress);
    final acts = (j is Map ? j['acts'] : j) as List? ?? const [];
    final out = <Source>[];
    for (final a in acts.whereType<Map>()) {
      final title = jStr(a['title'], 300);
      if (title.length < 4) continue;
      out.add(Source(
        id: newId('na'),
        type: SourceType.normative,
        title: title,
        docKind: jStr(a['kind'], 80),
        docDate: jStr(a['date'], 20),
        docNumber: jStr(a['number'], 40),
        origin: SourceOrigin.ai,
        verified: false,
        note: 'Реквизиты предложены ИИ',
      ));
    }
    if (!web.enabled || out.isEmpty) return out;
    final net = Net(cancel: cancel);
    try {
      for (final s in out) {
        cancel?.throwIfCancelled();
        final number = (s.docNumber ?? '').toLowerCase().replaceAll(RegExp(r'\s'), '');
        final q = '${s.docKind ?? ''} от ${s.docDate ?? ''} № ${s.docNumber ?? ''} ${s.title}'.trim();
        progress?.call('Проверяю: ${truncate(q, 80)}');
        final res = await _guard(() => web.search(net, q, limit: 6), <WebResult>[], progress, 'Проверка акта');
        for (final r in res) {
          final hay = '${r.title} ${r.snippet} ${r.url}'.toLowerCase().replaceAll(RegExp(r'\s'), '');
          if (number.isNotEmpty && hay.contains(number)) {
            s.verified = true;
            s.note = null;
            if (isReputableHost(r.host)) {
              s.url = r.url;
              s.accessed = DateTime.now();
              break;
            }
          }
        }
        if (!s.verified) s.note = 'Не подтверждён поиском — проверьте реквизиты';
      }
    } finally {
      net.close();
    }
    return out;
  }

  // ---------------- Факты для практической части ----------------

  Future<(List<WebFact>, List<Source>)> collectFacts(Coursework cw, {Progress? progress}) async {
    final facts = <WebFact>[];
    final sources = <Source>[];
    final core = topicCore(cw.meta.topic);
    final year = DateTime.now().year;
    final queries = <String>[
      '$core статистика $year',
      '$core показатели Росстат',
      for (final c in (cw.plan?.chapters ?? const <PlanChapter>[]).where((c) => c.role != 'theory').take(2)) '${c.title} данные',
      if (cw.meta.organization.trim().isNotEmpty) '${cw.meta.organization.trim()} $core',
    ];
    // Gemini с поиском Google — самый надёжный вариант, если подключён.
    if (ai != null && ai!.settings.useGeminiSearch && ai!.settings.provider == 'gemini' && await ai!.isReady('gemini')) {
      try {
        progress?.call('Gemini ищет факты в Google…');
        final g = await ai!.geminiSearch(
          'Найди в интернете актуальные (за последние 3 года) статистические данные, показатели и факты по теме «${cw.meta.topic}» '
          'для практической главы курсовой работы (Россия${cw.meta.organization.isNotEmpty ? ', организация: ${cw.meta.organization}' : ''}). '
          'Ответь списком из 10–15 пунктов, каждый — факт с числами и названием источника.',
          cancel: cancel,
        );
        for (final line in g.text.split('\n')) {
          final t = line.replaceFirst(RegExp(r'^\s*([-–*•]|\d+[.)])\s*'), '').replaceAll('**', '').trim();
          if (t.length > 30 && RegExp(r'\d').hasMatch(t)) facts.add(WebFact(text: t));
        }
        for (final l in g.links.take(8)) {
          sources.add(Source(
            id: newId('w'),
            type: SourceType.web,
            title: l.$1.isEmpty ? l.$2 : l.$1,
            siteName: l.$1,
            url: l.$2,
            origin: SourceOrigin.web,
            verified: true,
            selected: false,
            accessed: DateTime.now(),
          ));
        }
      } on AiException catch (e) {
        if (e.kind == AiErrorKind.cancelled) rethrow;
        progress?.call('Поиск Gemini не удался: ${e.message}');
      }
    }
    if (!web.enabled) return (facts, sources);
    final net = Net(cancel: cancel);
    try {
      final results = <String, WebResult>{};
      for (final q in queries.take(4)) {
        cancel?.throwIfCancelled();
        progress?.call('Поиск в интернете: «$q»');
        final res = await _guard(() => web.search(net, q, limit: 6), <WebResult>[], progress, 'Веб-поиск');
        for (final r in res) {
          results.putIfAbsent(r.url, () => r);
        }
      }
      if (results.isEmpty) return (facts, sources);
      final ranked = results.values.toList()
        ..sort((a, b) => (isReputableHost(b.host) ? 1 : 0).compareTo(isReputableHost(a.host) ? 1 : 0));
      final materials = StringBuffer();
      var read = 0;
      for (final r in ranked.take(8)) {
        cancel?.throwIfCancelled();
        var text = r.snippet;
        var title = r.title;
        if (settings.readPages && read < 4) {
          progress?.call('Читаю страницу: ${r.host}');
          final page = await _guard(() => PageReader.read(net, r.url, maxChars: 3500), ('', ''), progress, r.host);
          if (page.$2.length > text.length) {
            text = page.$2;
            read++;
          }
          if (page.$1.isNotEmpty) title = page.$1;
        }
        if (text.trim().isEmpty) continue;
        materials.writeln('[${r.url}] ${truncate(title, 150)}');
        materials.writeln(truncate(text, 3500));
        materials.writeln();
        sources.add(Source(
          id: newId('w'),
          type: SourceType.web,
          title: truncate(title.isEmpty ? r.host : title, 200),
          siteName: r.host,
          url: r.url,
          annotation: truncate(text, 600),
          origin: SourceOrigin.web,
          verified: true,
          selected: isReputableHost(r.host),
          accessed: DateTime.now(),
        ));
      }
      if (materials.isEmpty || ai == null) return (facts, sources);
      progress?.call('ИИ выписывает факты из найденных страниц…');
      try {
        final j = await ai!.chatJson(Prompts.jsonSystem, Prompts.factsRequest(cw, truncate(materials.toString(), 16000)),
            temperature: 0.1, maxTokens: 2500, cancel: cancel, onStatus: progress);
        final list = (j is Map ? j['facts'] : j) as List? ?? const [];
        for (final f in list.whereType<Map>()) {
          final t = jStr(f['text'], 500);
          if (t.length < 15) continue;
          facts.add(WebFact(text: t, url: jStr(f['url'], 400), sourceTitle: jStr(f['source'], 200)));
        }
      } on AiException catch (e) {
        if (e.kind == AiErrorKind.cancelled) rethrow;
        progress?.call('Не удалось выписать факты: ${e.message}');
        for (final s in sources.take(5)) {
          if ((s.annotation ?? '').isNotEmpty) facts.add(WebFact(text: truncate(s.annotation!, 400), url: s.url ?? '', sourceTitle: s.siteName ?? ''));
        }
      }
      // сайты, из которых реально взяты факты, отмечаем для списка литературы (если официальные)
      final usedUrls = facts.map((f) => f.url).where((u) => u.isNotEmpty).toSet();
      for (final s in sources) {
        if (usedUrls.contains(s.url) && isReputableHost(Uri.tryParse(s.url ?? '')?.host ?? '')) s.selected = true;
      }
      return (facts, sources);
    } finally {
      net.close();
    }
  }

  // ---------------- Справочный контекст ----------------

  Future<String> referenceContext(Coursework cw, {Progress? progress}) async {
    if (!settings.wikipedia) return '';
    final net = Net(cancel: cancel);
    try {
      progress?.call('Википедия: справочные сведения (в список литературы не входит)…');
      return await _guard(() => WikipediaApi.context(net, topicCore(cw.meta.topic)), '', progress, 'Википедия');
    } finally {
      net.close();
    }
  }

  // ---------------- Проверка подключения к источникам ----------------

  Future<List<SourceTestResult>> testAll() async {
    final net = Net(cancel: cancel);
    final out = <SourceTestResult>[];
    Future<void> t(String name, Future<int> Function() f) async {
      try {
        final n = await f();
        out.add(SourceTestResult(name, n > 0, n > 0 ? 'работает (найдено: $n)' : 'ответ пустой'));
      } on NetException catch (e) {
        out.add(SourceTestResult(name, false, e.message));
      } catch (e) {
        out.add(SourceTestResult(name, false, '$e'));
      }
    }

    try {
      const q = 'управление персоналом';
      final checks = <Future<void>>[
        if (settings.cyberLeninka) t(SourceOrigin.cyberLeninka, () async => (await CyberLeninkaApi().search(net, q, limit: 3)).length),
        if (settings.openAlex) t(SourceOrigin.openAlex, () async => (await OpenAlexApi(email: settings.contactEmail).search(net, q, limit: 3)).length),
        if (settings.googleBooks) t(SourceOrigin.googleBooks, () async => (await GoogleBooksApi().search(net, q, limit: 3)).length),
        if (settings.crossref) t(SourceOrigin.crossref, () async => (await CrossrefApi(email: settings.contactEmail).search(net, 'персонал', limit: 5)).length),
        if (settings.wikipedia) t('Википедия', () async => (await WikipediaApi.context(net, q, pages: 1, chars: 300)).isEmpty ? 0 : 1),
        if (web.enabled) t('Веб-поиск: ${settings.engine.label}', () async => (await web.search(net, q, limit: 3)).length),
      ];
      await Future.wait(checks);
      if (settings.engine != WebEngine.none && !web.enabled) {
        out.add(SourceTestResult('Веб-поиск', false, settings.engine.needsKey ? 'нужен ключ' : 'укажите адрес SearXNG'));
      }
    } finally {
      net.close();
    }
    return out;
  }
}
