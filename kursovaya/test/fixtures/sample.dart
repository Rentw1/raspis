import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:kursovaya/export/pdf_builder.dart';
import 'package:kursovaya/models/coursework.dart';
import 'package:kursovaya/models/source.dart';

const _sentences = [
  'Оборотные активы организации представляют собой совокупность денежных средств, запасов и дебиторской задолженности, обеспечивающих непрерывность производственного цикла',
  'Эффективное управление оборотным капиталом позволяет сократить потребность в краткосрочных заимствованиях и повысить платёжеспособность предприятия',
  'В современной экономической литературе выделяют несколько подходов к определению сущности оборотного капитала',
  'Нормативное регулирование учёта запасов осуществляется в соответствии с федеральным стандартом бухгалтерского учёта',
  'Анализ динамики показателей за три года показывает устойчивую тенденцию к увеличению выручки при одновременном росте дебиторской задолженности',
  'Коэффициент оборачиваемости запасов снизился, что свидетельствует о замедлении их использования в производственном процессе',
  'Для повышения эффективности использования оборотных средств целесообразно внедрить систему нормирования запасов и контроль сроков погашения задолженности',
  'Структура оборотных активов характеризуется преобладанием запасов, доля которых превышает половину общей величины',
  'Сравнение фактических значений с нормативными позволяет выявить отклонения и определить резервы улучшения финансового положения',
  'Результаты расчётов свидетельствуют о необходимости пересмотра кредитной политики организации в отношении покупателей',
];

String _para(Random r, int sentences) => List.generate(sentences, (i) => '${_sentences[r.nextInt(_sentences.length)]}${i == 1 ? ' [${r.nextInt(8) + 1}, с. ${r.nextInt(200) + 10}]' : ''}.').join(' ');

String _chapterText(Random r, int paragraphs, {bool table = false, int tableNo = 1, int tableRows = 6}) {
  final b = StringBuffer();
  for (var i = 0; i < paragraphs; i++) {
    b.writeln(_para(r, 4 + r.nextInt(3)));
    b.writeln();
    if (i == 2) {
      b.writeln('Основными элементами системы являются:');
      b.writeln('– денежные средства и их эквиваленты;');
      b.writeln('– запасы сырья, материалов и готовой продукции;');
      b.writeln('– дебиторская задолженность покупателей и заказчиков.');
      b.writeln();
    }
    if (table && i == 3) {
      b.writeln('Динамика показателей представлена в таблице $tableNo.');
      b.writeln();
      b.writeln('Таблица $tableNo — Динамика показателей оборотных активов организации за 2023–2025 гг.');
      b.writeln('| Показатель | 2023 г., тыс. руб. | 2024 г., тыс. руб. | 2025 г., тыс. руб. | Темп роста, % |');
      b.writeln('|---|---|---|---|---|');
      for (var k = 0; k < tableRows; k++) {
        b.writeln('| Показатель номер ${k + 1} | ${1000 + k * 37},0 | ${1100 + k * 41},5 | ${1250 + k * 29},2 | ${(100 + k * 1.7).toStringAsFixed(1)} |');
      }
      b.writeln();
    }
  }
  b.write('Таким образом, ${_sentences[0].toLowerCase()}.');
  return b.toString();
}

Coursework sampleCoursework({int chapterParas = 26, int bigTableRows = 6, int appendixRows = 14, int appendices = 2}) {
  final r = Random(42);
  final cw = Coursework(id: 'test');
  cw.meta
    ..topic = 'Анализ эффективности использования оборотных активов организации на примере ООО «Ромашка»'
    ..studentName = 'Иванова Анна Сергеевна'
    ..group = '21-ЭБУ'
    ..course = 3
    ..specialty = '38.02.01 Экономика и бухгалтерский учет (по отраслям)'
    ..discipline = 'МДК 04.02 Основы анализа бухгалтерской отчетности'
    ..supervisor = 'Петрова Е. В.'
    ..academicYear = '2026-2027';
  cw.options.appendixCount = appendices;
  cw.sections.addAll([
    Section(id: 'i', kind: SectionKind.introduction, text: [
      _para(r, 6),
      _para(r, 5),
      'Объект исследования – оборотные активы коммерческой организации.',
      'Предмет исследования – эффективность использования оборотных активов.',
      'Цель работы – проанализировать эффективность использования оборотных активов и разработать рекомендации.',
      'Для достижения цели поставлены следующие задачи:\n– изучить теоретические основы;\n– проанализировать показатели;\n– разработать рекомендации.',
      'Методы исследования: анализ, синтез, сравнение, горизонтальный и вертикальный анализ.',
      _para(r, 4),
      'Структура работы: курсовая работа состоит из введения, двух глав, заключения, списка литературы из 12 источников и 2 приложений.',
    ].join('\n\n')),
    Section(id: 'c1', kind: SectionKind.chapter, number: 1, title: 'Теоретические основы управления оборотными активами организации', role: 'theory', text: _chapterText(r, chapterParas)),
    Section(id: 'c2', kind: SectionKind.chapter, number: 2, title: 'Анализ эффективности использования оборотных активов ООО «Ромашка»', role: 'practice',
        text: _chapterText(r, chapterParas, table: true, tableNo: 1, tableRows: bigTableRows)),
    Section(id: 'z', kind: SectionKind.conclusion, text: List.generate(7, (_) => _para(r, 5)).join('\n\n')),
  ]);
  for (var i = 0; i < 12; i++) {
    cw.sources.add(Source(
      id: 's$i',
      type: i.isEven ? SourceType.article : SourceType.book,
      title: i.isEven ? 'Управление оборотным капиталом предприятия: проблемы и решения $i' : 'Финансовый анализ деятельности организации $i',
      authors: ['Смирнов А. В.', if (i % 3 == 0) 'Кузнецова Е. П.'],
      container: i.isEven ? 'Вестник экономики и управления' : null,
      city: i.isEven ? null : 'Москва',
      publisher: i.isEven ? null : 'Юрайт',
      year: 2020 + i % 6,
      issue: i.isEven ? '${i + 1}' : null,
      pages: i.isEven ? '${10 + i}–${20 + i}' : null,
      pageCount: i.isEven ? null : 240 + i,
      origin: SourceOrigin.openAlex,
      verified: true,
    ));
  }
  cw.sources.add(Source(id: 'n1', type: SourceType.normative, title: 'О бухгалтерском учете', docKind: 'федер. закон', docDate: '06.12.2011', docNumber: '402-ФЗ', origin: SourceOrigin.ai));
  for (var a = 1; a <= appendices; a++) {
    final rows = List.generate(appendixRows, (k) => '| Статья баланса ${k + 1} | ${500 + k * 13} | ${520 + k * 11} |').join('\n');
    cw.appendices.add(Appendix(
      id: 'a$a',
      number: a,
      title: a == 1 ? 'Бухгалтерский баланс ООО «Ромашка» за 2023–2025 гг.' : 'Анкета для опроса сотрудников',
      text: 'Таблица $a.1 — Исходные данные\n| Показатель | 2024 г. | 2025 г. |\n|---|---|---|\n$rows',
      status: PartStatus.done,
    ));
  }
  return cw;
}

FontSet loadTestFonts() {
  Uint8List f(String n) => File('assets/fonts/$n').readAsBytesSync();
  return FontSet(
    regular: f('LiberationSerif-Regular.ttf'),
    bold: f('LiberationSerif-Bold.ttf'),
    italic: f('LiberationSerif-Italic.ttf'),
    boldItalic: f('LiberationSerif-BoldItalic.ttf'),
  );
}
