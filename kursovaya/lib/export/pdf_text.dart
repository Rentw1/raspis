import 'dart:math' as math;

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../core/regulation.dart';

/// Фрагмент текста одного начертания.
class TextRun {
  const TextRun(this.text, {this.bold = false});
  final String text;
  final bool bold;
}

/// Слово (или часть составного слова после дефиса/тире) для переноса строк.
class LayoutToken {
  LayoutToken(this.text, this.bold, this.spaces);
  String text;
  final bool bold;

  /// Сколько пробелов перед словом (растягиваются при выключке по ширине).
  final int spaces;
  double width = 0;
}

/// Место возможного переноса внутри слова: после дефиса или тире между буквами/цифрами (как в Word).
final RegExp _hyphenBreak = RegExp(r'(?<=[А-Яа-яЁёA-Za-z0-9][-–—])(?=[А-Яа-яЁёA-Za-z0-9«(])');

/// Разбиение на слова как в Word: по пробелам; после дефиса и тире внутри слова тоже можно
/// перенести строку. Неразрывные пробелы (U+00A0) не разрывают слово.
List<LayoutToken> tokenize(List<TextRun> runs) {
  final out = <LayoutToken>[];
  var pending = 0;
  for (final r in runs) {
    final parts = r.text.replaceAll('\n', ' ').replaceAll('\t', ' ').split(' ');
    for (var i = 0; i < parts.length; i++) {
      if (i > 0) pending++;
      final w = parts[i];
      if (w.isEmpty) continue;
      final pieces = w.split(_hyphenBreak);
      for (var k = 0; k < pieces.length; k++) {
        out.add(LayoutToken(pieces[k], r.bold, k == 0 && out.isNotEmpty ? pending : 0));
      }
      pending = 0;
    }
  }
  return out;
}

/// Жадный перенос строк (как в Word). Возвращает диапазоны [start, end) токенов.
/// Слово шире строки разбивается по символам.
List<(int, int)> breakLines(
  List<LayoutToken> toks,
  double firstWidth,
  double width,
  double Function(bool bold) spaceWidth,
  double Function(String text, bool bold) measure,
) {
  for (final t in toks) {
    t.width = measure(t.text, t.bold);
  }
  final lines = <(int, int)>[];
  var start = 0;
  var x = 0.0;
  var avail = firstWidth;
  var k = 0;
  while (k < toks.length) {
    final t = toks[k];
    final sp = k > start ? t.spaces * spaceWidth(t.bold) : 0.0;
    if (k > start && x + sp + t.width > avail + 0.01) {
      lines.add((start, k));
      start = k;
      x = 0;
      avail = width;
      continue;
    }
    if (k == start && t.width > avail + 0.01 && t.text.length > 1) {
      // аварийный перенос длинного слова (например, адреса сайта)
      var cut = 1;
      while (cut < t.text.length && measure(t.text.substring(0, cut + 1), t.bold) <= avail) {
        cut++;
      }
      final rest = LayoutToken(t.text.substring(cut), t.bold, 0);
      t.text = t.text.substring(0, cut);
      t.width = measure(t.text, t.bold);
      rest.width = measure(rest.text, rest.bold);
      toks.insert(k + 1, rest);
    }
    x += sp + toks[k].width;
    k++;
  }
  if (start < toks.length || lines.isEmpty) lines.add((start, toks.length));
  return lines;
}

enum TextAlignX { left, center, right, justify }

class LinesCtx extends pw.WidgetContext {
  int firstLine = 0;
  int lastLine = 0;

  @override
  void apply(LinesCtx other) {
    firstLine = other.firstLine;
    lastLine = other.lastLine;
  }

  @override
  pw.WidgetContext clone() => LinesCtx()..apply(this);
}

/// Абзац как в Word: каждая строка занимает «кегль × 1,15 × интервал», дополнительное
/// пространство — над текстом строки; отступ первой строки; выключка по ширине
/// (последняя строка — по левому краю); перенос на следующую страницу по строкам.
/// Пробелы не рисуются глифами — только смещением (обходит ошибку подмножества шрифта).
class JustifiedText extends pw.Widget with pw.SpanningWidget {
  JustifiedText(
    this.runs, {
    required this.regular,
    required this.bold,
    required this.size,
    this.spacing = Reg.bodyLineSpacing,
    this.firstIndent = 0,
    this.align = TextAlignX.justify,
    this.rightIndent = 0,
  });

  final List<TextRun> runs;
  final pw.Font regular;
  final pw.Font bold;
  final double size;
  final double spacing;
  final double firstIndent;
  final TextAlignX align;
  final double rightIndent;

  static const double ascent = 1825 / 2048;
  static const double descent = 443 / 2048;

  double get pitch => Reg.linePitch(size, spacing);
  double get _extraTop => pitch - size * (ascent + descent);

  final LinesCtx _ctx = LinesCtx();
  List<LayoutToken> _toks = const [];
  List<(int, int)> _lines = const [];
  double _width = -1;

  int get lineCount => _lines.length;

  @override
  bool get canSpan => true;

  @override
  bool get hasMoreWidgets => _ctx.lastLine < _lines.length;

  @override
  pw.WidgetContext saveContext() => _ctx;

  @override
  void restoreContext(LinesCtx context) {
    _ctx.apply(context);
    _ctx.firstLine = _ctx.lastLine;
  }

  void _ensureLines(pw.Context context, double width) {
    if (width == _width && _lines.isNotEmpty) return;
    _width = width;
    final fr = regular.getFont(context);
    final fb = bold.getFont(context);
    double measure(String s, bool b) => (b ? fb : fr).stringMetrics(s).advanceWidth * size;
    _toks = tokenize(runs);
    _lines = breakLines(_toks, width - firstIndent, width, (b) => measure(' ', b), measure);
  }

  @override
  void layout(pw.Context context, pw.BoxConstraints constraints, {bool parentUsesSize = false}) {
    final full = constraints.hasBoundedWidth ? constraints.maxWidth : Reg.contentWidthPt;
    _ensureLines(context, full - rightIndent);
    final avail = constraints.hasBoundedHeight ? constraints.maxHeight : double.infinity;
    final from = math.min(_ctx.firstLine, _lines.length);
    final remaining = _lines.length - from;
    final fit = avail.isInfinite ? remaining : math.min(remaining, ((avail + 0.01) / pitch).floor());
    _ctx.lastLine = from + math.max(0, fit);
    box = PdfRect(0, 0, full, (_ctx.lastLine - from) * pitch);
  }

  @override
  void paint(pw.Context context) {
    super.paint(context);
    final b = box!;
    if (b.height <= 0) return;
    final fr = regular.getFont(context);
    final fb = bold.getFont(context);
    double w(String s, bool bold) => (bold ? fb : fr).stringMetrics(s).advanceWidth * size;
    final canvas = context.canvas..setFillColor(PdfColors.black);
    final width = b.width - rightIndent;
    for (var i = _ctx.firstLine; i < _ctx.lastLine; i++) {
      final (s, e) = _lines[i];
      final top = b.top - (i - _ctx.firstLine) * pitch;
      final baseline = top - _extraTop - size * ascent;
      final isFirst = i == 0;
      final startX = b.left + (isFirst ? firstIndent : 0);
      final availW = width - (isFirst ? firstIndent : 0);
      var natural = 0.0;
      var spaces = 0;
      for (var k = s; k < e; k++) {
        if (k > s && _toks[k].spaces > 0) {
          natural += _toks[k].spaces * w(' ', _toks[k].bold);
          spaces += _toks[k].spaces;
        }
        natural += _toks[k].width;
      }
      final lastLine = i == _lines.length - 1;
      var x = startX;
      var extra = 0.0;
      switch (align) {
        case TextAlignX.left:
          break;
        case TextAlignX.right:
          x += availW - natural;
        case TextAlignX.center:
          x += (availW - natural) / 2;
        case TextAlignX.justify:
          if (!lastLine && spaces > 0 && natural < availW) extra = (availW - natural) / spaces;
      }
      for (var k = s; k < e; k++) {
        final t = _toks[k];
        if (k > s && t.spaces > 0) x += t.spaces * (w(' ', t.bold) + extra);
        drawToken(canvas, t.bold ? fb : fr, size, t.text, x, baseline);
        x += t.width;
      }
    }
  }

  /// Рисует слово; неразрывные и прочие пробелы внутри него — только смещением.
  static void drawToken(PdfGraphics canvas, PdfFont font, double size, String text, double x, double baseline) {
    var cx = x;
    final buf = StringBuffer();
    void flush() {
      if (buf.isEmpty) return;
      final s = buf.toString();
      canvas.drawString(font, size, s, cx, baseline);
      cx += font.stringMetrics(s).advanceWidth * size;
      buf.clear();
    }

    for (final r in text.runes) {
      if (r == 0xA0 || (r >= 0x2000 && r <= 0x200B) || r == 0x202F) {
        flush();
        cx += font.stringMetrics(String.fromCharCode(r)).advanceWidth * size;
      } else {
        buf.writeCharCode(r);
      }
    }
    flush();
  }
}
