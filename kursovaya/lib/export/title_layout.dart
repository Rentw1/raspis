import 'dart:math' as math;
import 'dart:typed_data';

import 'package:pdf/pdf.dart';

import '../core/regulation.dart';
import 'doc_model.dart';
import 'pdf_text.dart';

enum TitleAlign { left, center, right }

class TitleRun {
  const TitleRun(this.text, {this.bold = false});
  final String text;
  final bool bold;
}

/// Строка (абзац) титульного листа или вертикальный отступ.
class TitleLine {
  TitleLine.text(this.runs, {required this.size, required this.spacing, this.align = TitleAlign.left, this.rightIndent = 0})
      : spacer = false,
        height = 0;

  TitleLine.gap(this.height)
      : spacer = true,
        runs = const [],
        size = 12,
        spacing = 1,
        align = TitleAlign.left,
        rightIndent = 0;

  final bool spacer;
  final List<TitleRun> runs;
  final double size;
  final double spacing;
  final TitleAlign align;
  final double rightIndent;

  /// Для отступа — высота; для текста вычисляется в [TitleLayout].
  double height;
  int lines = 1;
}

/// Измерение ширины текста по метрикам шрифта (Liberation Serif = Times New Roman).
class TitleMeasure {
  TitleMeasure(this._regular, this._bold);

  factory TitleMeasure.fromFonts(Uint8List regular, Uint8List bold) {
    final doc = PdfDocument();
    return TitleMeasure(PdfTtfFont(doc, ByteData.sublistView(regular)), PdfTtfFont(doc, ByteData.sublistView(bold)));
  }

  final PdfFont _regular;
  final PdfFont _bold;

  double width(String s, double size, {bool bold = false}) => (bold ? _bold : _regular).stringMetrics(s).advanceWidth * size;

  /// Число строк при переносе по словам (тот же алгоритм, что в PDF, — как в Word).
  int lineCount(List<TitleRun> runs, double size, double maxWidth) {
    final toks = tokenize(runs.map((r) => TextRun(r.text, bold: r.bold)).toList());
    if (toks.isEmpty) return 1;
    return breakLines(toks, maxWidth, maxWidth, (b) => width(' ', size, bold: b), (s, b) => width(s, size, bold: b)).length;
  }
}

/// Раскладка титульного листа по ПРИЛОЖЕНИЮ 4 регламента: высоты всех строк известны заранее,
/// гибкие отступы подбираются так, чтобы лист гарантированно помещался на одну страницу.
class TitleLayout {
  TitleLayout(this.lines);
  final List<TitleLine> lines;

  /// Правый отступ стиля «toc 1» из образца (909 twips).
  static const double tocRightIndent = 909 / 20;

  static TitleLayout compute(TitlePageData t, TitleMeasure m) {
    final width = Reg.contentWidthPt;
    TitleLine txt(List<TitleRun> runs, double size, double spacing, {TitleAlign align = TitleAlign.left, double right = 0}) =>
        TitleLine.text(runs, size: size, spacing: spacing, align: align, rightIndent: right);
    final p14 = Reg.linePitch(14, 1.0);
    final p14h = Reg.linePitch(14, 1.5);
    final spacerA = TitleLine.gap(0);
    final spacerB = TitleLine.gap(0);
    final spacerC = TitleLine.gap(0);
    final blankTopic = TitleLine.gap(p14h);
    final blankAfterTopic = TitleLine.gap(p14 * 2);
    final lines = <TitleLine>[
      txt([TitleRun(t.ministry, bold: true)], 12, 1.0, align: TitleAlign.center),
      txt([TitleRun(t.org1, bold: true)], 12, 1.0, align: TitleAlign.center),
      txt([TitleRun(t.org2, bold: true)], 12, 1.0, align: TitleAlign.center),
      spacerA,
      txt(const [TitleRun('КУРСОВАЯ РАБОТА', bold: true)], 14, 1.5, align: TitleAlign.center, right: tocRightIndent),
      txt(const [TitleRun('по дисциплине (междисциплинарному курсу)', bold: true)], 14, 1.5, align: TitleAlign.center, right: tocRightIndent),
      txt([TitleRun(t.discipline.isEmpty ? '____________________________________________' : t.discipline, bold: true)], 14, 1.5,
          align: TitleAlign.center, right: tocRightIndent),
      blankTopic,
      txt([const TitleRun('Тема: ', bold: true), TitleRun('«${t.topic}»', bold: true)], 14, 1.5),
      blankAfterTopic,
      txt([TitleRun(t.female ? 'выполнила:' : 'выполнил:', bold: true), TitleRun(' ${t.student}')], 14, 1.0),
      TitleLine.gap(Reg.linePitch(10, 1.0)),
      txt([const TitleRun('группа', bold: true), TitleRun(' ${t.group}    ${t.course} '), const TitleRun('курса,', bold: true)], 14, 1.5),
      txt([const TitleRun('специальность:', bold: true), TitleRun(' ${t.specialty}')], 14, 1.5),
      txt([TitleRun('руководитель: ${t.supervisor}', bold: true)], 14, 1.0),
      TitleLine.gap(p14),
      spacerB,
      txt(const [TitleRun(' Дата проверки:', bold: true)], 14, 1.5),
      txt(const [TitleRun(' Оценка с учётом защиты:', bold: true)], 14, 1.5),
      txt(const [TitleRun(' Члены комиссии:', bold: true)], 14, 1.5),
      spacerC,
      txt([TitleRun(t.yearLine, bold: true)], 14, 1.5, align: TitleAlign.center, right: tocRightIndent),
    ];
    var fixed = 0.0;
    for (final l in lines) {
      if (l.spacer) {
        fixed += l.height;
        continue;
      }
      l.lines = m.lineCount(l.runs, l.size, width - l.rightIndent);
      l.height = l.lines * Reg.linePitch(l.size, l.spacing);
      fixed += l.height;
    }
    // Запас на расхождения вёрстки Word/PDF — 1,5 строки.
    var free = Reg.contentHeightPt - fixed - 1.5 * p14h;
    if (free < 40) {
      // очень длинная тема: убираем пустые строки
      free += blankTopic.height + blankAfterTopic.height;
      blankTopic.height = 0;
      blankAfterTopic.height = 0;
    }
    free = math.max(0, free);
    spacerA.height = free * 0.32;
    spacerB.height = free * 0.52;
    spacerC.height = free * 0.16;
    return TitleLayout(lines);
  }
}
