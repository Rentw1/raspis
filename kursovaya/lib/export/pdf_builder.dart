import 'dart:math' as math;
import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../core/regulation.dart';
import '../models/coursework.dart';
import 'doc_model.dart';
import 'pdf_text.dart';
import 'table_geometry.dart';
import 'title_layout.dart';

/// Шрифты Liberation Serif (метрически совместим с Times New Roman: те же ширины знаков,
/// поэтому переносы строк и число страниц совпадают с документом Word).
class FontSet {
  FontSet({required this.regular, required this.bold, required this.italic, required this.boldItalic});
  final Uint8List regular;
  final Uint8List bold;
  final Uint8List italic;
  final Uint8List boldItalic;
}

/// Часть таблицы на странице (для «Продолжения таблицы» в Word).
class TablePart {
  TablePart(this.firstRow, this.lastRow, this.page);
  final int firstRow;
  final int lastRow;
  final int page;
}

class PdfBuildResult {
  PdfBuildResult(this.bytes, this.layout, this.tableParts);
  final Uint8List bytes;
  final LayoutInfo layout;
  final Map<String, List<TablePart>> tableParts;
}

class _Collector {
  final Map<String, (int, double)> marks = {};
  final Map<String, List<TablePart>> tables = {};
  int maxPage = 0;

  void mark(String id, int page, double y) {
    marks[id] = (page, y);
    maxPage = math.max(maxPage, page);
  }

  void table(String key, int first, int last, int page) {
    final list = tables.putIfAbsent(key, () => []);
    if (list.any((p) => p.page == page && p.firstRow == first)) return;
    list.add(TablePart(first, last, page));
    maxPage = math.max(maxPage, page);
  }

  Map<String, int> startPages() => {
        for (final e in marks.entries)
          if (e.key.startsWith('start:')) e.key.substring(6): e.value.$1,
      };
}

/// Нулевой по высоте маркер: запоминает страницу и положение (для оглавления и объёма разделов).
class _Marker extends pw.Widget {
  _Marker(this.id, this.collector);
  final String id;
  final _Collector collector;

  @override
  void layout(pw.Context context, pw.BoxConstraints constraints, {bool parentUsesSize = false}) {
    box = PdfRect(0, 0, constraints.hasBoundedWidth ? constraints.maxWidth : 0, 0);
  }

  @override
  void paint(pw.Context context) {
    super.paint(context);
    collector.mark(id, context.pageNumber, box!.bottom);
  }
}

class PdfBuilder {
  PdfBuilder(this.fonts) {
    _regular = pw.Font.ttf(ByteData.sublistView(fonts.regular));
    _bold = pw.Font.ttf(ByteData.sublistView(fonts.bold));
    _italic = pw.Font.ttf(ByteData.sublistView(fonts.italic));
    _boldItalic = pw.Font.ttf(ByteData.sublistView(fonts.boldItalic));
    _supported = supportedChars(fonts.regular);
  }

  final FontSet fonts;
  late final pw.Font _regular;
  late final pw.Font _bold;
  late final pw.Font _italic;
  late final pw.Font _boldItalic;
  late final Set<int> _supported;

  static PdfPageFormat get pageFormat => const PdfPageFormat(Reg.pageWidthPt, Reg.pageHeightPt);

  static pw.EdgeInsets get margins => pw.EdgeInsets.fromLTRB(Reg.marginLeftPt, Reg.marginTopPt, Reg.marginRightPt, Reg.marginBottomPt);

  /// Символы, которые есть в шрифте (остальные заменяются, чтобы PDF не ломался).
  static Set<int> supportedChars(Uint8List ttf) => TtfParser(ByteData.sublistView(ttf)).charToGlyphIndexMap.keys.toSet();

  String safe(String s) {
    final sb = StringBuffer();
    for (final r in s.runes) {
      if (r == 32 || _supported.contains(r)) {
        sb.writeCharCode(r);
      } else if (r == 9 || r == 10 || r == 13) {
        sb.write(' ');
      } else if (r == 0x2212) {
        sb.write('-');
      } else if (r >= 0x1F000 || (r >= 0x2600 && r <= 0x27BF) || r == 0xFE0F || r == 0x200D) {
        // эмодзи — убираем
      } else {
        sb.write('?');
      }
    }
    return sb.toString();
  }

  /// Для стандартных виджетов pdf (колонтитулы): без неразрывных пробелов.
  String _plain(String s) => safe(s).replaceAll(RegExp(r'[  -​ ]'), ' ');

  JustifiedText text(
    String s, {
    bool indent = true,
    TextAlignX align = TextAlignX.justify,
    double size = Reg.bodyFontPt,
    double spacing = Reg.bodyLineSpacing,
    bool bold = false,
    double rightIndent = 0,
  }) =>
      JustifiedText(
        [TextRun(safe(s), bold: bold)],
        regular: _regular,
        bold: _bold,
        size: size,
        spacing: spacing,
        firstIndent: indent ? Reg.firstLineIndentPt : 0,
        align: align,
        rightIndent: rightIndent,
      );

  pw.Widget heading(String s, {TextAlignX align = TextAlignX.center}) =>
      pw.Padding(padding: const pw.EdgeInsets.only(bottom: Reg.headingAfterPt), child: text(s, indent: false, align: align, bold: true));

  // ---------------- Сборка ----------------

  /// Проходы вёрстки: первый — узнать страницы разделов, следующие — с номерами в оглавлении.
  Future<PdfBuildResult> build(DocModel m) async {
    final c1 = _Collector();
    await _compose(m, c1, null).save();
    var pages = c1.startPages();
    var c = _Collector();
    var bytes = await _compose(m, c, pages).save();
    for (var i = 0; i < 2 && !_sameMap(pages, c.startPages()); i++) {
      pages = c.startPages();
      c = _Collector();
      bytes = await _compose(m, c, pages).save();
    }
    return PdfBuildResult(bytes, _layoutInfo(m, c), c.tables);
  }

  static bool _sameMap(Map<String, int> a, Map<String, int> b) => a.length == b.length && a.entries.every((e) => b[e.key] == e.value);

  LayoutInfo _layoutInfo(DocModel m, _Collector c) {
    final start = c.startPages();
    final volume = <String, double>{};
    final ch = Reg.contentHeightPt;
    for (final id in ['toc', ...m.parts.map((e) => e.id)]) {
      final s = c.marks['start:$id'];
      final e = c.marks['end:$id'];
      if (s == null || e == null) continue;
      volume[id] = (e.$1 - s.$1) + (s.$2 - e.$2) / ch;
    }
    final bibEnd = c.marks['end:bibliography']?.$1 ?? c.maxPage;
    return LayoutInfo(totalPages: c.maxPage, mainPages: bibEnd, startPage: start, volume: volume);
  }

  pw.Document _compose(DocModel m, _Collector c, Map<String, int>? pages) {
    final doc = pw.Document(
      title: m.docTitle,
      author: m.author,
      creator: 'Курсовая ЛТЭТ',
      subject: 'Курсовая работа',
      theme: pw.ThemeData.withFont(base: _regular, bold: _bold, italic: _italic, boldItalic: _boldItalic),
    );
    doc.addPage(pw.Page(
      pageTheme: pw.PageTheme(pageFormat: pageFormat, margin: margins),
      build: (ctx) => _titlePage(m.title),
    ));
    doc.addPage(pw.MultiPage(
      pageTheme: pw.PageTheme(
        pageFormat: pageFormat,
        margin: margins,
        buildForeground: (ctx) => _headerFooter(ctx, m.headerText),
      ),
      maxPages: 400,
      build: (ctx) => _body(m, c, pages),
    ));
    return doc;
  }

  pw.Widget _headerFooter(pw.Context ctx, String header) {
    final style = pw.TextStyle(font: _regular, fontSize: Reg.headerFooterFontPt, color: PdfColors.black);
    return pw.FullPage(
      ignoreMargins: true,
      child: pw.Stack(children: [
        pw.Positioned(
          left: Reg.marginLeftPt,
          top: Reg.headerDistanceMm * Reg.mm,
          child: pw.SizedBox(width: Reg.contentWidthPt, child: pw.Text(_plain(header.toUpperCase()), textAlign: pw.TextAlign.center, style: style)),
        ),
        pw.Positioned(
          left: Reg.marginLeftPt,
          bottom: Reg.footerDistanceMm * Reg.mm,
          child: pw.SizedBox(width: Reg.contentWidthPt, child: pw.Text('${ctx.pageNumber}', textAlign: pw.TextAlign.center, style: style)),
        ),
      ]),
    );
  }

  // ---------------- Титульный лист (ПРИЛОЖЕНИЕ 4) ----------------

  pw.Widget _titlePage(TitlePageData t) {
    final layout = TitleLayout.compute(t, TitleMeasure.fromFonts(fonts.regular, fonts.bold));
    final children = <pw.Widget>[];
    for (final line in layout.lines) {
      if (line.spacer) {
        if (line.height > 0) children.add(pw.SizedBox(height: line.height));
        continue;
      }
      children.add(JustifiedText(
        line.runs.map((r) => TextRun(safe(r.text), bold: r.bold)).toList(),
        regular: _regular,
        bold: _bold,
        size: line.size,
        spacing: line.spacing,
        align: switch (line.align) {
          TitleAlign.center => TextAlignX.center,
          TitleAlign.right => TextAlignX.right,
          TitleAlign.left => TextAlignX.left,
        },
        rightIndent: line.rightIndent,
      ));
    }
    return pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.stretch, mainAxisSize: pw.MainAxisSize.min, children: children);
  }

  // ---------------- Основной текст ----------------

  List<pw.Widget> _body(DocModel m, _Collector c, Map<String, int>? pages) {
    final out = <pw.Widget>[];
    out.add(_Marker('start:toc', c));
    out.add(heading(Reg.tocTitle));
    for (final p in m.parts) {
      out.add(_TocLine(
        text: safe(p.tocText),
        page: pages == null ? '00' : '${pages[p.id] ?? ''}',
        font: _regular,
        size: Reg.bodyFontPt,
        pitch: Reg.linePitch(Reg.bodyFontPt, Reg.bodyLineSpacing),
      ));
    }
    out.add(_Marker('end:toc', c));
    for (final p in m.parts) {
      out.add(pw.NewPage());
      out.add(_Marker('start:${p.id}', c));
      if (p.kind == PartKind.appendix) {
        out.add(text(p.appendixNumber == null ? Reg.appendixLabel : '${Reg.appendixLabel} ${p.appendixNumber}', indent: false, align: TextAlignX.right));
      }
      out.add(heading(p.heading));
      for (final it in p.items) {
        out.addAll(_item(it, c));
      }
      out.add(_Marker('end:${p.id}', c));
    }
    return out;
  }

  List<pw.Widget> _item(DocItem it, _Collector c) {
    switch (it) {
      case DocPara():
        return [text(it.text, indent: it.indent)];
      case DocListItem():
        return [text('${it.marker} ${it.text}')];
      case DocNote():
        return [text(it.text, indent: false, size: Reg.tableFontPt, spacing: Reg.tableLineSpacing, align: TextAlignX.left)];
      case DocBibItem():
        return [text('${it.number}. ${it.text}')];
      case DocSignature():
        return [_signature(it)];
      case DocTable():
        return [_DocTableWidget(table: it.table, builder: this, pageContentHeight: Reg.contentHeightPt, collector: c)];
    }
  }

  pw.Widget _signature(DocSignature s) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(top: 36),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Expanded(child: text('«____» ______________ ${s.year} г.', indent: false, spacing: 1.0, align: TextAlignX.left)),
          pw.Expanded(
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.stretch,
              children: [
                text('______________ / ${s.initialsName}', indent: false, spacing: 1.0, align: TextAlignX.center),
                text('(подпись автора)', indent: false, size: 10, spacing: 1.0, align: TextAlignX.center),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Строка оглавления: текст с переносом, точки-заполнители и номер страницы справа
/// (как правая табуляция с заполнителем в Word; справа оставлено место под номер).
class _TocLine extends pw.Widget {
  _TocLine({required this.text, required this.page, required this.font, required this.size, required this.pitch});

  final String text;
  final String page;
  final pw.Font font;
  final double size;
  final double pitch;

  /// Правый отступ стиля оглавления в Word (840 twips = 42 пт).
  static const double reserve = 42;
  List<LayoutToken> _toks = const [];
  List<(int, int)> _lines = const [];

  @override
  void layout(pw.Context context, pw.BoxConstraints constraints, {bool parentUsesSize = false}) {
    final f = font.getFont(context);
    double m(String s, bool b) => f.stringMetrics(s).advanceWidth * size;
    _toks = tokenize([TextRun(text)]);
    final w = constraints.maxWidth - reserve;
    _lines = breakLines(_toks, w, w, (b) => m(' ', b), m);
    box = PdfRect(0, 0, constraints.maxWidth, _lines.length * pitch);
  }

  @override
  void paint(pw.Context context) {
    super.paint(context);
    final f = font.getFont(context);
    double m(String s) => f.stringMetrics(s).advanceWidth * size;
    final canvas = context.canvas..setFillColor(PdfColors.black);
    final b = box!;
    final extraTop = pitch - size * (JustifiedText.ascent + JustifiedText.descent);
    for (var i = 0; i < _lines.length; i++) {
      final (s, e) = _lines[i];
      final baseline = b.top - i * pitch - extraTop - size * JustifiedText.ascent;
      var x = b.left;
      for (var k = s; k < e; k++) {
        if (k > s && _toks[k].spaces > 0) x += _toks[k].spaces * m(' ');
        JustifiedText.drawToken(canvas, f, size, _toks[k].text, x, baseline);
        x += _toks[k].width;
      }
      if (i == _lines.length - 1) {
        final numX = b.right - m(page);
        canvas.drawString(f, size, page, numX, baseline);
        final dotW = m('.');
        const step = 4.2;
        var dx = ((x + 3) / step).ceil() * step;
        while (dx + dotW < numX - 3) {
          canvas.drawString(f, size, '.', dx, baseline);
          dx += step;
        }
      }
    }
  }
}

class _TableCtx extends pw.WidgetContext {
  int firstRow = 0;
  int lastRow = 0;
  bool continued = false;

  @override
  void apply(_TableCtx other) {
    firstRow = other.firstRow;
    lastRow = other.lastRow;
    continued = other.continued;
  }

  @override
  pw.WidgetContext clone() => _TableCtx()..apply(this);
}

/// Таблица по регламенту: подпись «Таблица N — Название» над таблицей слева без абзацного отступа;
/// при переносе на следующую страницу — «Продолжение таблицы N» и повтор шапки,
/// нижняя граница у первой части не проводится. Таблица, помещающаяся на странице, не разрывается.
class _DocTableWidget extends pw.Widget with pw.SpanningWidget {
  _DocTableWidget({required this.table, required this.builder, required this.pageContentHeight, required this.collector});

  final NumberedTable table;
  final PdfBuilder builder;
  final double pageContentHeight;
  final _Collector collector;

  static const double padX = 5.4;
  static const double border = 0.5;

  final _TableCtx _ctx = _TableCtx();
  bool _laidOut = false;
  double _fullHeight = 0;
  List<double> _colW = const [];
  List<List<pw.Widget>> _cells = const [];
  List<double> _rowH = const [];
  pw.Widget? _caption;
  double _captionH = 0;

  int get _head => table.table.rows.length <= 1 ? 1 : math.max(1, math.min(table.table.headerRows, table.table.rows.length - 1));

  @override
  bool get canSpan => !_laidOut || _fullHeight > pageContentHeight - 1;

  @override
  bool get hasMoreWidgets => _ctx.lastRow < table.table.rows.length;

  @override
  pw.WidgetContext saveContext() => _ctx;

  @override
  void restoreContext(_TableCtx context) {
    _ctx.apply(context);
    if (_ctx.lastRow > _ctx.firstRow) _ctx.continued = true;
    _ctx.firstRow = _ctx.lastRow;
  }

  void _prepare(pw.Context context, double width) {
    final rows = table.table.rows;
    final cols = table.table.columns;
    if (_colW.length == cols && _cells.isNotEmpty) return;
    final font = builder._regular.getFont(context);
    _colW = columnWidths(rows.map((r) => r.map(builder.safe).toList()).toList(), cols, width,
        (s) => font.stringMetrics(s).advanceWidth * Reg.tableFontPt, padX: padX);
    final numericCol = numericColumns(rows, cols, _head);
    _cells = [
      for (var ri = 0; ri < rows.length; ri++)
        [
          for (var i = 0; i < cols; i++)
            builder.text(
              i < rows[ri].length ? rows[ri][i] : '',
              indent: false,
              size: Reg.tableFontPt,
              spacing: Reg.tableLineSpacing,
              align: ri < _head ? TextAlignX.center : (numericCol[i] ? TextAlignX.right : TextAlignX.left),
            ),
        ],
    ];
    _rowH = [
      for (final r in _cells)
        () {
          var h = 0.0;
          for (var i = 0; i < r.length; i++) {
            r[i].layout(context, pw.BoxConstraints(maxWidth: _colW[i] - 2 * padX), parentUsesSize: true);
            h = math.max(h, r[i].box!.height);
          }
          return h + border;
        }(),
    ];
  }

  pw.Widget _captionWidget(bool continued) {
    final t = continued
        ? 'Продолжение таблицы ${table.label}'
        : (table.table.title.isEmpty ? 'Таблица ${table.label}' : 'Таблица ${table.label} — ${table.table.title}');
    return builder.text(t, indent: false, align: TextAlignX.left);
  }

  @override
  void layout(pw.Context context, pw.BoxConstraints constraints, {bool parentUsesSize = false}) {
    final width = constraints.maxWidth;
    _prepare(context, width);
    final rows = table.table.rows;
    if (_ctx.firstRow < _head) {
      _ctx.firstRow = _head;
      _ctx.lastRow = _head;
    }
    _caption = _captionWidget(_ctx.continued);
    _caption!.layout(context, pw.BoxConstraints(maxWidth: width), parentUsesSize: true);
    _captionH = _caption!.box!.height;
    final headH = _rowH.take(_head).fold<double>(0, (a, b) => a + b);
    final fullCaption = _captionWidget(false)..layout(context, pw.BoxConstraints(maxWidth: width), parentUsesSize: true);
    _fullHeight = fullCaption.box!.height + _rowH.fold<double>(0, (a, b) => a + b);
    _laidOut = true;
    final avail = constraints.hasBoundedHeight ? constraints.maxHeight : double.infinity;
    var y = _captionH + headH;
    var last = _ctx.firstRow;
    while (last < rows.length && y + _rowH[last] <= avail + 0.01) {
      y += _rowH[last];
      last++;
    }
    final remaining = rows.length - _ctx.firstRow;
    final placed = last - _ctx.firstRow;
    final fullPage = avail >= pageContentHeight - 1;
    if (placed < math.min(2, remaining) && !fullPage) {
      // слишком мало строк помещается — эта часть целиком уходит на следующую страницу
      last = _ctx.firstRow;
      y = 0;
    } else if (placed == 0 && fullPage && remaining > 0) {
      last = _ctx.firstRow + 1;
      y = _captionH + headH + _rowH[_ctx.firstRow];
    }
    _ctx.lastRow = last;
    box = PdfRect(0, 0, width, y);
  }

  @override
  void paint(pw.Context context) {
    super.paint(context);
    final b = box!;
    if (b.height <= 0 || _ctx.lastRow <= _ctx.firstRow) return;
    collector.table(table.key, _ctx.firstRow, _ctx.lastRow, context.pageNumber);
    _caption!.box = PdfRect(b.left, b.top - _captionH, b.width, _captionH);
    _caption!.paint(context);
    final visible = [for (var i = 0; i < _head; i++) i, for (var i = _ctx.firstRow; i < _ctx.lastRow; i++) i];
    var top = b.top - _captionH;
    final tableTop = top;
    final right = b.left + _colW.fold<double>(0, (a, w) => a + w);
    final hLines = <double>[top];
    for (final ri in visible) {
      var x = b.left;
      for (var i = 0; i < _cells[ri].length; i++) {
        final cell = _cells[ri][i];
        cell.layout(context, pw.BoxConstraints(maxWidth: _colW[i] - 2 * padX), parentUsesSize: true);
        cell.box = PdfRect(x + padX, top - cell.box!.height, _colW[i] - 2 * padX, cell.box!.height);
        cell.paint(context);
        x += _colW[i];
      }
      top -= _rowH[ri];
      hLines.add(top);
    }
    final isLastPart = _ctx.lastRow >= table.table.rows.length;
    final canvas = context.canvas
      ..setStrokeColor(PdfColors.black)
      ..setLineWidth(border);
    for (var k = 0; k < hLines.length; k++) {
      if (k == hLines.length - 1 && !isLastPart) break; // у первой части нижнюю границу не проводят
      canvas
        ..moveTo(b.left, hLines[k])
        ..lineTo(right, hLines[k]);
    }
    var x = b.left;
    for (var i = 0; i <= _colW.length; i++) {
      canvas
        ..moveTo(x, tableTop)
        ..lineTo(x, top);
      if (i < _colW.length) x += _colW[i];
    }
    canvas.strokePath();
  }
}
