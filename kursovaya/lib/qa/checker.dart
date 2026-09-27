import 'dart:convert';
import 'dart:typed_data';

import 'package:archive/archive.dart';

import '../core/regulation.dart';
import '../core/text_utils.dart';
import '../export/gost.dart';
import '../gen/generator.dart';
import '../gen/markup.dart';
import '../models/coursework.dart';
import '../models/settings.dart';
import '../models/source.dart';
import '../search/literature_apis.dart';

enum CheckLevel { ok, info, warn, fail }

enum CheckGroup { structure, volume, formatting, sources, content }

extension CheckGroupX on CheckGroup {
  String get label => switch (this) {
        CheckGroup.structure => 'Структура работы',
        CheckGroup.volume => 'Объём',
        CheckGroup.formatting => 'Оформление',
        CheckGroup.sources => 'Ссылки и источники',
        CheckGroup.content => 'Содержание',
      };
}

class CheckItem {
  CheckItem(this.id, this.group, this.level, this.title, this.detail, {this.fix, this.fixLabel, this.aiFix = false});
  final String id;
  final CheckGroup group;
  final CheckLevel level;
  final String title;
  final String detail;

  /// Идентификатор автоисправления.
  final String? fix;
  final String? fixLabel;

  /// Исправление требует ИИ (выполняет интерфейс через генератор).
  final bool aiFix;
}

class QaReport {
  QaReport(this.items, {this.layout});
  final List<CheckItem> items;
  final LayoutInfo? layout;
  final DateTime at = DateTime.now();

  int get fails => items.where((i) => i.level == CheckLevel.fail).length;
  int get warnings => items.where((i) => i.level == CheckLevel.warn).length;

  /// Прогноз оценки по критериям п. 6 регламента.
  String get grade {
    if (fails > 0) return 'неудовлетворительно';
    if (warnings <= 1) return 'отлично';
    if (warnings <= 4) return 'хорошо';
    return 'удовлетворительно';
  }

  String get gradeNote => fails > 0
      ? 'Есть нарушения, при которых по п. 6.2 регламента работа оценивается только «неудовлетворительно». Исправьте их перед сдачей.'
      : (warnings == 0 ? 'Нарушений не найдено.' : 'Критических нарушений нет; замечания снижают оценку — исправьте их.');

  List<CheckItem> get blocking => items.where((i) => i.level == CheckLevel.fail).toList();
}

/// Проверка курсовой по чек-листу негативных критериев техникума.
class QaChecker {
  QaChecker._();

  static final RegExp _aiPhrase = RegExp(r'как (языковая модель|искусственный интеллект|ИИ-ассистент)|я не могу|chatgpt|openai|нейросеть сгенерировала', caseSensitive: false);
  static final RegExp _markdown = RegExp(r'\*\*|^#{1,6}\s|```|<think>|^\s*---\s*$', multiLine: true);
  static final RegExp _subheading = RegExp(r'^\s*\d+\.\d+\.?\s+[А-ЯЁ][^.!?]{3,120}$', multiLine: true);

  static QaReport check(Coursework cw, {LayoutInfo? layout, Uint8List? docx, InstitutionSettings? inst}) {
    final items = <CheckItem>[];
    void add(String id, CheckGroup g, CheckLevel l, String t, String d, {String? fix, String? fixLabel, bool aiFix = false}) =>
        items.add(CheckItem(id, g, l, t, d, fix: fix, fixLabel: fixLabel, aiFix: aiFix));

    final intro = cw.introduction;
    final concl = cw.conclusion;
    final chapters = cw.chapters;
    final ordered = Gost.ordered(cw.sources);

    // ---------------- Структура ----------------
    final missing = cw.meta.missingForTitle;
    add('title', CheckGroup.structure, missing.isEmpty ? CheckLevel.ok : CheckLevel.fail, 'Титульный лист (ПРИЛОЖЕНИЕ 4)',
        missing.isEmpty ? 'Все данные титульного листа заполнены.' : 'Не заполнено: ${missing.join(', ')}. Заполните на вкладке «Данные».');

    final introWords = intro?.words ?? 0;
    add('intro', CheckGroup.structure, introWords == 0 ? CheckLevel.fail : (introWords < 300 ? CheckLevel.warn : CheckLevel.ok), 'Введение',
        introWords == 0 ? 'Введение отсутствует — это отдельный обязательный структурный элемент.' : 'Слов: $introWords.',
        fix: introWords == 0 ? 'gen:introduction' : null, fixLabel: 'Написать введение', aiFix: true);

    final filled = chapters.where((c) => c.words > 0).toList();
    add('chapters', CheckGroup.structure, filled.length >= Reg.minChapters && filled.length <= Reg.maxChapters ? CheckLevel.ok : CheckLevel.fail,
        'Основная часть: 2–3 главы', 'Глав с текстом: ${filled.length}${chapters.length != filled.length ? ' из ${chapters.length}' : ''}.');
    for (final c in chapters) {
      if (c.words == 0) {
        add('chapter_empty_${c.number}', CheckGroup.structure, CheckLevel.fail, 'Глава ${c.number} пустая', 'В главе нет текста.',
            fix: 'gen:chapter${c.number}', fixLabel: 'Написать главу', aiFix: true);
      } else if (c.targetWords > 0 && c.words < c.targetWords * 0.5) {
        add('chapter_short_${c.number}', CheckGroup.structure, CheckLevel.warn, 'Глава ${c.number} слишком короткая',
            'Слов: ${c.words} при плане ≈${c.targetWords}.', fix: 'ai:extend:${c.id}', fixLabel: 'Дописать (ИИ)', aiFix: true);
      }
    }
    final subheads = chapters.where((c) => _subheading.hasMatch(c.text)).map((c) => c.number).toList();
    add('no_paragraphs', CheckGroup.structure, subheads.isEmpty ? CheckLevel.ok : CheckLevel.warn, 'Главы без мелких параграфов',
        subheads.isEmpty ? 'Подзаголовков-параграфов внутри глав нет.' : 'В главах ${subheads.join(', ')} найдены подзаголовки вида «1.1 …».',
        fix: subheads.isEmpty ? null : 'remove_subheadings', fixLabel: 'Убрать подзаголовки');
    if (cw.plan != null && chapters.isNotEmpty) {
      final ok = chapters.first.role == 'theory' && chapters.skip(1).every((c) => c.role != 'theory');
      add('roles', CheckGroup.structure, ok ? CheckLevel.ok : CheckLevel.warn, 'Первая глава — теоретическая, остальные — практические',
          ok ? 'Соответствует регламенту.' : 'Порядок глав не соответствует регламенту.');
    }
    final conclWords = concl?.words ?? 0;
    add('conclusion', CheckGroup.structure, conclWords == 0 ? CheckLevel.fail : (conclWords < 300 ? CheckLevel.warn : CheckLevel.ok), 'Заключение',
        conclWords == 0 ? 'Заключение отсутствует.' : 'Слов: $conclWords.', fix: conclWords == 0 ? 'gen:conclusion' : null, fixLabel: 'Написать заключение', aiFix: true);
    add('bibliography', CheckGroup.structure, ordered.isEmpty ? CheckLevel.fail : (ordered.length < 10 ? CheckLevel.warn : CheckLevel.ok), 'Список литературы',
        ordered.isEmpty ? 'Список литературы пуст.' : 'Источников: ${ordered.length}${ordered.length < 10 ? ' — рекомендуется не менее 10–15' : ''}.');
    final apps = cw.appendices.where((a) => a.text.trim().isNotEmpty).length;
    add('appendices', CheckGroup.structure, apps == 0 ? CheckLevel.fail : CheckLevel.ok, 'Приложения',
        apps == 0 ? 'Приложений нет, а по п. 4.6 регламента они обязательны.' : 'Приложений: $apps.',
        fix: apps == 0 ? 'enable_appendices' : null, fixLabel: 'Добавить приложения', aiFix: true);

    // ---------------- Объём ----------------
    if (layout == null) {
      add('volume', CheckGroup.volume, CheckLevel.info, 'Объём 15–30 страниц', 'Нажмите «Проверить», чтобы свёрстать документ и посчитать страницы.');
    } else {
      final pages = layout.mainPages;
      add('volume', CheckGroup.volume, pages >= Reg.minPages && pages <= Reg.maxPages ? CheckLevel.ok : CheckLevel.fail, 'Объём 15–30 страниц (без приложений)',
          'Страниц без приложений: $pages (всего с приложениями: ${layout.totalPages}).',
          fix: pages < Reg.minPages ? 'ai:extend:all' : (pages > Reg.maxPages ? 'ai:shorten:all' : null),
          fixLabel: pages < Reg.minPages ? 'Расширить главы (ИИ)' : 'Сократить главы (ИИ)',
          aiFix: true);
      final iv = layout.volume['introduction'];
      if (iv != null) {
        final ok = iv >= Reg.introMinPages - 0.25 && iv <= Reg.introMaxPages + 0.3;
        add('intro_volume', CheckGroup.volume, ok ? CheckLevel.ok : CheckLevel.warn, 'Введение: 2–2,5 страницы', 'Объём введения: ${iv.toStringAsFixed(1)} стр.',
            fix: ok ? null : (iv < Reg.introMinPages ? 'ai:extend:${intro?.id}' : 'ai:shorten:${intro?.id}'),
            fixLabel: iv < Reg.introMinPages ? 'Расширить (ИИ)' : 'Сократить (ИИ)',
            aiFix: true);
        final cv = layout.volume['conclusion'];
        if (cv != null && iv > 0) {
          final r = cv / iv;
          final okc = r >= 0.7 && r <= 1.45;
          add('conclusion_volume', CheckGroup.volume, okc ? CheckLevel.ok : CheckLevel.warn, 'Заключение ≈ по объёму введения',
              'Заключение: ${cv.toStringAsFixed(1)} стр., введение: ${iv.toStringAsFixed(1)} стр.',
              fix: okc ? null : (r < 0.7 ? 'ai:extend:${concl?.id}' : 'ai:shorten:${concl?.id}'), fixLabel: r < 0.7 ? 'Расширить (ИИ)' : 'Сократить (ИИ)', aiFix: true);
        }
      }
      final vols = chapters.map((c) => layout.volume['chapter${c.number}'] ?? 0).where((v) => v > 0).toList();
      if (vols.length >= 2) {
        final mx = vols.reduce((a, b) => a > b ? a : b), mn = vols.reduce((a, b) => a < b ? a : b);
        final ok = mn > 0 && mx / mn <= 2.0;
        add('proportion', CheckGroup.volume, ok ? CheckLevel.ok : CheckLevel.warn, 'Главы соразмерны по объёму',
            'Объём глав: ${vols.map((v) => v.toStringAsFixed(1)).join(' / ')} стр.');
      }
    }

    // ---------------- Оформление ----------------
    if (docx != null) {
      final problems = verifyDocx(docx, inst ?? InstitutionSettings());
      add('docx', CheckGroup.formatting, problems.isEmpty ? CheckLevel.ok : CheckLevel.fail, 'Сверка оформления файла Word',
          problems.isEmpty
              ? 'А4; поля 30/10/20/20 мм; Times New Roman 14; интервал 1,5 (в таблицах 1,0); выравнивание по ширине; колонтитул со 2-й страницы; номер страницы внизу по центру; на титульном номер не ставится.'
              : problems.join('; '));
    }
    final badHeadings = <String>[
      for (final c in chapters)
        if (c.title.trim() != Reg.cleanHeading(c.title)) 'Глава ${c.number}',
      for (final a in cw.appendices)
        if (a.title.trim() != Reg.cleanHeading(a.title)) 'Приложение ${a.number}',
    ];
    add('headings', CheckGroup.formatting, badHeadings.isEmpty ? CheckLevel.ok : CheckLevel.warn, 'Заголовки без точки в конце, по центру, без переносов',
        badHeadings.isEmpty ? 'Заголовки оформлены по регламенту; каждая структурная часть начинается с новой страницы.' : 'Точка или лишние знаки в заголовках: ${badHeadings.join(', ')}.',
        fix: badHeadings.isEmpty ? null : 'headings', fixLabel: 'Исправить заголовки');

    final allText = cw.orderedSections.map((s) => s.text).join('\n\n');
    final tableIssues = <String>[];
    final captionIssues = <String>[];
    var expected = 1;
    var numberingOk = true;
    for (final c in chapters) {
      final blocks = Markup.parse(c.text);
      final before = StringBuffer();
      for (final b in blocks) {
        if (b is TableBlock) {
          if (b.title.trim().isEmpty) captionIssues.add('таблица $expected');
          if (b.number != null && b.number != '$expected') numberingOk = false;
          final ref = RegExp('(таблиц[аеуыи]|табл\\.)[\\s\\u00A0]+$expected(?!\\d|[.,]\\d)', caseSensitive: false);
          if (!ref.hasMatch(before.toString())) tableIssues.add('$expected');
          expected++;
        } else if (b is ParaBlock) {
          before.writeln(b.text);
        } else if (b is ListItemBlock) {
          before.writeln(b.text);
        }
      }
    }
    final tablesTotal = expected - 1;
    if (tablesTotal > 0) {
      add('tables_numbering', CheckGroup.formatting, numberingOk ? CheckLevel.ok : CheckLevel.warn, 'Сквозная нумерация таблиц',
          numberingOk ? 'Таблиц: $tablesTotal, нумерация сквозная.' : 'Номера таблиц в тексте не по порядку.', fix: numberingOk ? null : 'renumber_tables', fixLabel: 'Перенумеровать');
      add('tables_refs', CheckGroup.formatting, tableIssues.isEmpty ? CheckLevel.ok : CheckLevel.warn, 'Таблицы — сразу после первого упоминания',
          tableIssues.isEmpty ? 'На каждую таблицу есть ссылка в тексте перед ней.' : 'Нет ссылки в тексте перед таблицами: ${tableIssues.join(', ')}.',
          fix: tableIssues.isEmpty ? null : 'table_refs', fixLabel: 'Добавить ссылки');
      add('tables_captions', CheckGroup.formatting, captionIssues.isEmpty ? CheckLevel.ok : CheckLevel.warn, 'Название таблицы: «Таблица N — Название» слева над таблицей',
          captionIssues.isEmpty ? 'У всех таблиц есть названия.' : 'Нет названия: ${captionIssues.join(', ')}. Допишите «Таблица N — …» в тексте раздела.');
    } else if (cw.options.tables) {
      add('tables_none', CheckGroup.formatting, CheckLevel.info, 'Таблицы', 'В основной части нет таблиц. Для практической главы таблицы с расчётами желательны.');
    }
    final unrefApps = <int>[];
    for (final a in cw.appendices) {
      if (!RegExp('приложени[еяюи][\\s\\u00A0]+${a.number}(?!\\d)', caseSensitive: false).hasMatch(allText) &&
          !(cw.appendices.length == 1 && RegExp(r'приложени[еяюи]', caseSensitive: false).hasMatch(allText))) {
        unrefApps.add(a.number);
      }
    }
    if (cw.appendices.isNotEmpty) {
      add('appendix_refs', CheckGroup.formatting, unrefApps.isEmpty ? CheckLevel.ok : CheckLevel.warn, 'Ссылки на приложения в тексте',
          unrefApps.isEmpty ? 'На все приложения есть ссылки; каждое начинается с нового листа с надписью «Приложение N» справа.' : 'Нет ссылок на приложения: ${unrefApps.join(', ')}.',
          fix: unrefApps.isEmpty ? null : 'appendix_refs', fixLabel: 'Добавить ссылки');
    }
    final md = cw.orderedSections.where((s) => _markdown.hasMatch(s.text)).map((s) => s.shortName).toList();
    add('markdown', CheckGroup.formatting, md.isEmpty ? CheckLevel.ok : CheckLevel.warn, 'Нет служебной разметки',
        md.isEmpty ? 'Символов разметки (**, #) нет.' : 'Разметка в разделах: ${md.join(', ')}.', fix: md.isEmpty ? null : 'clean', fixLabel: 'Очистить');

    // ---------------- Ссылки и источники ----------------
    final cites = Markup.citedNumbers(allText);
    final invalid = cites.where((n) => n < 1 || n > ordered.length).toSet();
    add('citations', CheckGroup.sources, cites.isEmpty ? CheckLevel.fail : (cites.length < 8 ? CheckLevel.warn : CheckLevel.ok), 'Ссылки на источники в тексте',
        cites.isEmpty ? 'В работе нет ссылок на источники — по п. 6.2 это основание для «неудовлетворительно».' : 'Ссылок в тексте: ${cites.length}.',
        fix: cites.isEmpty && chapters.isNotEmpty ? 'ai:paraphrase_cite' : null, fixLabel: 'Добавить ссылки (ИИ)', aiFix: true);
    if (invalid.isNotEmpty) {
      add('citations_invalid', CheckGroup.sources, CheckLevel.fail, 'Ссылки на несуществующие источники', 'Номера вне списка литературы: ${invalid.join(', ')}.',
          fix: 'drop_invalid', fixLabel: 'Удалить неверные ссылки');
    }
    for (final c in chapters.where((c) => c.words > 0)) {
      final n = Markup.citedNumbers(c.text).length;
      final need = c.role == 'theory' ? 4 : 2;
      if (n < need) {
        add('cites_ch${c.number}', CheckGroup.sources, CheckLevel.warn, 'Мало ссылок в главе ${c.number}', 'Ссылок: $n (желательно не менее $need).',
            fix: 'ai:extend:${c.id}', fixLabel: 'Дописать со ссылками (ИИ)', aiFix: true);
      }
    }
    if (intro != null && intro.words > 0 && Markup.citedNumbers(intro.text).length < 2) {
      add('intro_review', CheckGroup.sources, CheckLevel.warn, 'Краткий обзор литературы во введении', 'Во введении мало ссылок на источники (нужен краткий обзор литературы).',
          fix: 'gen:introduction', fixLabel: 'Переписать введение (ИИ)', aiFix: true);
    }
    final uncited = <int>[];
    for (var i = 0; i < ordered.length; i++) {
      if (!cites.contains(i + 1)) uncited.add(i + 1);
    }
    if (uncited.isNotEmpty && ordered.isNotEmpty) {
      add('uncited', CheckGroup.sources, CheckLevel.info, 'Источники без ссылок', 'На источники ${uncited.take(15).join(', ')}${uncited.length > 15 ? '…' : ''} нет ссылок (допускается — это прочитанная литература).');
    }
    final forbidden = ordered.where(isForbiddenSource).toList();
    add('forbidden', CheckGroup.sources, forbidden.isEmpty ? CheckLevel.ok : CheckLevel.warn, 'Без учебников, энциклопедий и газет',
        forbidden.isEmpty ? 'Только профильные книги, статьи и нормативные акты.' : 'Похоже на учебник/энциклопедию/газету: ${forbidden.map((s) => truncate(s.title, 50)).join('; ')}.',
        fix: forbidden.isEmpty ? null : 'drop_forbidden', fixLabel: 'Убрать из списка');
    final unverified = ordered.where((s) => !s.verified && s.origin != SourceOrigin.manual).toList();
    if (unverified.isNotEmpty) {
      add('unverified', CheckGroup.sources, CheckLevel.warn, 'Источники не подтверждены базами',
          '${unverified.length} ${plural(unverified.length, 'источник предложен', 'источника предложены', 'источников предложены')} ИИ — проверьте, что они существуют (вкладка «Источники»).');
    }
    final now = DateTime.now().year;
    final withYear = ordered.where((s) => s.year != null && s.type != SourceType.normative && s.type != SourceType.web).toList();
    if (withYear.isNotEmpty) {
      final recent = withYear.where((s) => now - s.year! <= cw.options.recentYears).length;
      final share = recent / withYear.length;
      add('recency', CheckGroup.sources, share >= 0.5 ? CheckLevel.ok : CheckLevel.info, 'Актуальность литературы',
          'Изданий за последние ${cw.options.recentYears} лет: $recent из ${withYear.length}.');
    }
    add('alphabet', CheckGroup.sources, CheckLevel.ok, 'Список по алфавиту (ГОСТ 7.1-2003)', 'Список сортируется автоматически, описания — по ГОСТ 7.1-2003.');

    // ---------------- Содержание ----------------
    final aiHits = cw.orderedSections.where((s) => _aiPhrase.hasMatch(s.text)).map((s) => s.shortName).toList();
    if (aiHits.isNotEmpty) {
      add('ai_phrases', CheckGroup.content, CheckLevel.fail, 'Служебные фразы ИИ в тексте', 'Найдены в: ${aiHits.join(', ')}.', fix: 'remove_ai_phrases', fixLabel: 'Удалить');
    }
    if (intro != null && intro.words > 0) {
      final t = intro.text.toLowerCase();
      final need = {'актуальн': 'актуальность', 'объект': 'объект исследования', 'предмет': 'предмет исследования', 'цел': 'цель', 'задач': 'задачи', 'метод': 'методы исследования'};
      final miss = need.entries.where((e) => !t.contains(e.key)).map((e) => e.value).toList();
      add('intro_elements', CheckGroup.content, miss.isEmpty ? CheckLevel.ok : CheckLevel.warn, 'Элементы введения',
          miss.isEmpty ? 'Есть актуальность, объект, предмет, цель, задачи, методы.' : 'Во введении не найдено: ${miss.join(', ')}.',
          fix: miss.isEmpty ? null : 'gen:introduction', fixLabel: 'Переписать введение (ИИ)', aiFix: true);
    }
    final topicStems = keywordStems(cw.meta.topic).where((s) => s.length > 3).toSet();
    if (topicStems.isNotEmpty && allText.isNotEmpty) {
      final textStems = keywordStems(allText);
      final cover = topicStems.intersection(textStems).length / topicStems.length;
      add('relevance', CheckGroup.content, cover >= 0.6 ? CheckLevel.ok : CheckLevel.warn, 'Соответствие содержания теме',
          'Ключевые слова темы встречаются в тексте на ${(cover * 100).round()}%.');
    }
    // дословные совпадения с источниками (признак плагиата)
    final corpus = <String>[
      for (final s in cw.sources)
        if ((s.annotation ?? '').length > 80) s.annotation!,
      for (final f in cw.facts) f.text,
      if (cw.wikiContext.isNotEmpty) cw.wikiContext,
    ];
    final corpusSh = <String>{for (final c in corpus) ...shingles(c)};
    final copied = <String>[];
    final seen = <Set<String>>[];
    final dups = <String>[];
    for (final s in cw.orderedSections) {
      for (final p in s.text.split(RegExp(r'\n\s*\n'))) {
        if (p.trim().startsWith('|') || wordCount(p) < 25) continue;
        final sh = shingles(p);
        if (corpusSh.isNotEmpty && containment(sh, corpusSh) > 0.3) copied.add('${s.shortName}: «${truncate(p.trim(), 50)}»');
        if (seen.any((o) => jaccard(o, sh) > 0.6)) dups.add('${s.shortName}: «${truncate(p.trim(), 50)}»');
        seen.add(sh);
      }
    }
    add('plagiarism', CheckGroup.content, copied.isEmpty ? CheckLevel.ok : CheckLevel.warn, 'Нет дословных заимствований',
        copied.isEmpty ? 'Дословных совпадений с найденными источниками не обнаружено.' : 'Похоже на дословное заимствование (${copied.length}): ${copied.take(3).join('; ')}',
        fix: copied.isEmpty ? null : 'ai:paraphrase_copied', fixLabel: 'Перефразировать (ИИ)', aiFix: true);
    add('duplicates', CheckGroup.content, dups.isEmpty ? CheckLevel.ok : CheckLevel.warn, 'Нет повторов',
        dups.isEmpty ? 'Повторяющихся абзацев нет.' : 'Повторы (${dups.length}): ${dups.take(3).join('; ')}', fix: dups.isEmpty ? null : 'remove_duplicates', fixLabel: 'Удалить повторы');
    final latin = cyrillicRatio(allText);
    if (allText.length > 500 && latin < 0.9) {
      add('latin', CheckGroup.content, CheckLevel.warn, 'Текст на русском языке', 'Много латиницы в тексте (${((1 - latin) * 100).round()}% букв).');
    }
    return QaReport(items, layout: layout);
  }

  /// Самопроверка сформированного .docx: поля, шрифт, интервалы, колонтитулы.
  static List<String> verifyDocx(Uint8List docx, InstitutionSettings inst) {
    final problems = <String>[];
    try {
      final zip = ZipDecoder().decodeBytes(docx);
      String file(String n) {
        final f = zip.findFile(n);
        return f == null ? '' : utf8.decode(f.content as List<int>);
      }

      final doc = file('word/document.xml');
      final styles = file('word/styles.xml');
      if (!doc.contains('<w:pgSz w:w="${Reg.pageWidthTw}" w:h="${Reg.pageHeightTw}"/>')) problems.add('формат листа не А4');
      if (!doc.contains('w:top="${Reg.marginTopTw}" w:right="${Reg.marginRightTw}" w:bottom="${Reg.marginBottomTw}" w:left="${Reg.marginLeftTw}"')) {
        problems.add('поля не 30/10/20/20 мм');
      }
      if (!doc.contains('<w:titlePg/>')) problems.add('на титульном листе будет номер страницы');
      if (!styles.contains('w:ascii="${Reg.fontName}"')) problems.add('шрифт не Times New Roman');
      if (!styles.contains('<w:sz w:val="28"/>')) problems.add('кегль не 14');
      if (!styles.contains('w:line="360" w:lineRule="auto"')) problems.add('интервал не 1,5');
      if (!styles.contains('<w:jc w:val="both"/>')) problems.add('нет выравнивания по ширине');
      if (!file('word/header1.xml').contains(DocxEsc.esc(inst.headerText.toUpperCase()))) problems.add('нет верхнего колонтитула');
      if (!file('word/footer1.xml').contains(' PAGE ')) problems.add('нет номера страницы');
      if (file('word/settings.xml').contains('<w:autoHyphenation w:val="true"/>')) problems.add('включены автопереносы');
    } catch (e) {
      problems.add('файл Word повреждён: $e');
    }
    return problems;
  }

  // ---------------- Автоисправления без ИИ ----------------

  /// Возвращает описание сделанного или null, если исправление требует ИИ / неизвестно.
  static String? applyFix(String fix, Coursework cw) {
    switch (fix) {
      case 'headings':
        for (final c in cw.chapters) {
          c.title = Reg.cleanHeading(c.title);
        }
        for (final a in cw.appendices) {
          a.title = Reg.cleanHeading(a.title);
        }
        if (cw.plan != null) {
          for (final pc in cw.plan!.chapters) {
            pc.title = Reg.cleanHeading(pc.title);
          }
        }
        return 'Заголовки исправлены.';
      case 'renumber_tables':
        var next = 1;
        for (final c in cw.chapters) {
          final (t, n) = Markup.renumberTables(c.text, next);
          c.text = t;
          next = n;
        }
        return 'Таблицы перенумерованы.';
      case 'table_refs':
        var added = 0;
        var n = 1;
        for (final c in cw.chapters) {
          final lines = c.text.split('\n');
          final out = <String>[];
          for (var i = 0; i < lines.length; i++) {
            final m = Markup.tableCaption.firstMatch(lines[i].trim());
            final isTable = m != null && i + 1 < lines.length && lines.skip(i + 1).firstWhere((l) => l.trim().isNotEmpty, orElse: () => '').trim().startsWith('|');
            if (isTable) {
              final prevText = out.join('\n');
              final ref = RegExp('(таблиц[аеуыи]|табл\\.)[\\s\\u00A0]+$n(?!\\d|[.,]\\d)', caseSensitive: false);
              if (!ref.hasMatch(prevText)) {
                // добавляем ссылку в последний абзац перед таблицей
                var j = out.length - 1;
                while (j >= 0 && out[j].trim().isEmpty) {
                  j--;
                }
                if (j >= 0 && !out[j].trim().startsWith('|') && !out[j].trim().startsWith('–')) {
                  out[j] = '${out[j].trimRight()} Данные представлены в таблице $n.';
                } else {
                  out.add('Данные представлены в таблице $n.');
                  out.add('');
                }
                added++;
              }
              n++;
            }
            out.add(lines[i]);
          }
          c.text = out.join('\n');
        }
        return 'Добавлено ссылок на таблицы: $added.';
      case 'appendix_refs':
        final added = Generator.ensureAppendixReferences(cw);
        return 'Добавлено ссылок на приложения: $added.';
      case 'clean':
        for (final s in cw.orderedSections) {
          s.text = Markup.cleanAiText(s.text);
        }
        for (final a in cw.appendices) {
          a.text = Markup.cleanAiText(a.text);
        }
        return 'Разметка удалена.';
      case 'remove_ai_phrases':
        for (final s in cw.orderedSections) {
          s.text = Markup.removePhrases(s.text).replaceAll(RegExp(r'[^.!?\n]*(chatgpt|openai|нейросеть сгенерировала)[^.!?\n]*[.!?]\s*', caseSensitive: false), '');
        }
        return 'Служебные фразы удалены.';
      case 'drop_invalid':
        final max = Gost.ordered(cw.sources).length;
        for (final s in cw.orderedSections) {
          s.text = Markup.dropInvalidCitations(s.text, max);
        }
        return 'Неверные ссылки удалены.';
      case 'drop_forbidden':
        final before = Gost.ordered(cw.sources);
        for (final s in cw.sources) {
          if (s.selected && isForbiddenSource(s)) s.selected = false;
        }
        renumberAfterSourceChange(cw, before);
        return 'Учебные и справочные издания убраны из списка.';
      case 'remove_duplicates':
        var removed = 0;
        final seen = <Set<String>>[];
        for (final s in cw.orderedSections) {
          final paras = s.text.split(RegExp(r'\n\s*\n'));
          final keep = <String>[];
          for (final p in paras) {
            if (wordCount(p) >= 25 && !p.trim().startsWith('|')) {
              final sh = shingles(p);
              if (seen.any((o) => jaccard(o, sh) > 0.6)) {
                removed++;
                continue;
              }
              seen.add(sh);
            }
            keep.add(p);
          }
          s.text = keep.join('\n\n');
        }
        return 'Удалено повторов: $removed.';
      case 'remove_subheadings':
        for (final c in cw.chapters) {
          c.text = c.text.replaceAll(_subheading, '').replaceAll(RegExp(r'\n{3,}'), '\n\n').trim();
        }
        return 'Подзаголовки удалены.';
    }
    return null;
  }

  /// После изменения списка литературы: перенумеровать ссылки в тексте.
  static void renumberAfterSourceChange(Coursework cw, List<Source> before) {
    final after = Gost.ordered(cw.sources);
    final idx = {for (var i = 0; i < after.length; i++) after[i].id: i + 1};
    final map = <int, int>{};
    for (var i = 0; i < before.length; i++) {
      final n = idx[before[i].id];
      if (n != null) map[i + 1] = n;
    }
    final identity = map.length == before.length && map.entries.every((e) => e.key == e.value);
    if (identity) return;
    for (final s in cw.orderedSections) {
      s.text = Markup.renumberCitations(s.text, map);
    }
  }
}

/// Экранирование как в DocxBuilder (для сверки текста колонтитула).
class DocxEsc {
  static String esc(String s) => xmlSafe(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
