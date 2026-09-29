import 'dart:convert';
import 'dart:typed_data';

import 'package:archive/archive.dart';

import '../core/regulation.dart';
import '../core/text_utils.dart';
import '../models/coursework.dart';
import 'doc_model.dart';
import 'pdf_builder.dart' show TablePart;
import 'table_geometry.dart';
import 'title_layout.dart';

/// Документ Word (.docx) строго по регламенту: А4, поля 30/10/20/20 мм, Times New Roman 14,
/// интервал 1,5 (в таблицах — 1,0), выравнивание по ширине, абзацный отступ 1,25 см,
/// заголовки по центру без точки и переносов, каждая структурная часть с новой страницы,
/// верхний колонтитул со 2-й страницы, номер страницы внизу по центру (на титульном не ставится).
class DocxBuilder {
  DocxBuilder(this.measure);

  /// Метрики шрифта для раскладки титульного листа и ширин столбцов (как в PDF).
  final TitleMeasure measure;

  static const String _w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  static const String _r = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

  static String esc(String s) => xmlSafe(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

  static String run(String text, {bool bold = false, int? halfPoints, bool vanish = false}) {
    final rpr = <String>[
      if (bold) '<w:b/><w:bCs/>',
      if (vanish) '<w:vanish/>',
      if (halfPoints != null) '<w:sz w:val="$halfPoints"/><w:szCs w:val="$halfPoints"/>',
    ].join();
    return '<w:r>${rpr.isEmpty ? '' : '<w:rPr>$rpr</w:rPr>'}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>';
  }

  static String para(String runs, {String? style, String extraPPr = ''}) =>
      '<w:p><w:pPr>${style == null ? '' : '<w:pStyle w:val="$style"/>'}$extraPPr</w:pPr>$runs</w:p>';

  Uint8List build(DocModel m, {LayoutInfo? layout, Map<String, List<TablePart>> tableParts = const {}}) {
    final body = StringBuffer();
    _titlePage(body, m.title);
    _toc(body, m, layout);
    for (final p in m.parts) {
      _part(body, p, tableParts);
    }
    body.write(_sectPr());
    final document = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="$_w" xmlns:r="$_r"><w:body>$body</w:body></w:document>';
    final files = <String, String>{
      '[Content_Types].xml': _contentTypes(),
      '_rels/.rels': _rootRels(),
      'docProps/core.xml': _core(m),
      'docProps/app.xml': _app(layout),
      'word/document.xml': document,
      'word/_rels/document.xml.rels': _docRels(),
      'word/styles.xml': _styles(),
      'word/settings.xml': _settings(),
      'word/fontTable.xml': _fontTable(),
      'word/header1.xml': _header(m.headerText.toUpperCase()),
      'word/header2.xml': _header(''),
      'word/footer1.xml': _footer(true),
      'word/footer2.xml': _footer(false),
    };
    final archive = Archive();
    files.forEach((name, content) => archive.addFile(ArchiveFile.bytes(name, utf8.encode(content))));
    return ZipEncoder().encodeBytes(archive);
  }

  // ---------------- Титульный лист ----------------

  void _titlePage(StringBuffer b, TitlePageData t) {
    final layout = TitleLayout.compute(t, measure);
    for (final l in layout.lines) {
      if (l.spacer) {
        final tw = (l.height * 20).round();
        if (tw <= 0) continue;
        b.write(para('', style: 'TitlePage', extraPPr: '<w:spacing w:before="0" w:after="0" w:line="$tw" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr>'));
        continue;
      }
      final hp = (l.size * 2).round();
      final jc = switch (l.align) { TitleAlign.center => 'center', TitleAlign.right => 'right', TitleAlign.left => 'left' };
      final line = (240 * l.spacing).round();
      final right = (l.rightIndent * 20).round();
      final ppr = '<w:spacing w:before="0" w:after="0" w:line="$line" w:lineRule="auto"/><w:ind w:firstLine="0" w:right="$right"/><w:jc w:val="$jc"/>'
          '<w:rPr><w:sz w:val="$hp"/><w:szCs w:val="$hp"/></w:rPr>';
      b.write(para(l.runs.map((r) => run(r.text, bold: r.bold, halfPoints: hp)).join(), style: 'TitlePage', extraPPr: ppr));
    }
  }

  // ---------------- Содержание ----------------

  void _toc(StringBuffer b, DocModel m, LayoutInfo? layout) {
    b.write(para(run(Reg.tocTitle), style: 'TOCHeading'));
    final entries = m.parts;
    for (var i = 0; i < entries.length; i++) {
      final p = entries[i];
      final page = layout?.startPage[p.id]?.toString() ?? '';
      final sb = StringBuffer();
      if (i == 0) {
        sb.write('<w:r><w:fldChar w:fldCharType="begin"/></w:r>'
            '<w:r><w:instrText xml:space="preserve"> TOC \\o "1-1" \\f \\u </w:instrText></w:r>'
            '<w:r><w:fldChar w:fldCharType="separate"/></w:r>');
      }
      sb.write(run(p.tocText));
      sb.write('<w:r><w:tab/></w:r>');
      sb.write(run(page));
      if (i == entries.length - 1) sb.write('<w:r><w:fldChar w:fldCharType="end"/></w:r>');
      b.write(para(sb.toString(), style: 'TOC1'));
    }
  }

  // ---------------- Структурные части ----------------

  void _part(StringBuffer b, DocPart p, Map<String, List<TablePart>> tableParts) {
    if (p.kind == PartKind.appendix) {
      final label = p.appendixNumber == null ? Reg.appendixLabel : '${Reg.appendixLabel} ${p.appendixNumber}';
      // Поле TC — чтобы при обновлении оглавления в Word приложение попало в него с названием.
      final tc = '<w:r><w:rPr><w:vanish/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>'
          '<w:r><w:rPr><w:vanish/></w:rPr><w:instrText xml:space="preserve"> TC "${esc(p.tocText)}" \\l 1 </w:instrText></w:r>'
          '<w:r><w:rPr><w:vanish/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>';
      b.write(para('$tc${run(label)}', style: 'AppendixLabel'));
      b.write(para(run(p.heading), style: 'AppendixTitle'));
    } else {
      b.write(para(run(p.heading), style: 'Heading1'));
    }
    for (final it in p.items) {
      switch (it) {
        case DocPara():
          b.write(para(run(it.text), extraPPr: it.indent ? '' : '<w:ind w:firstLine="0"/>'));
        case DocListItem():
          b.write(para(run('${it.marker} ${it.text}')));
        case DocNote():
          b.write(para(run(it.text), style: 'TableText'));
        case DocBibItem():
          b.write(para(run('${it.number}. ${it.text}')));
        case DocSignature():
          _signature(b, it);
        case DocTable():
          _table(b, it.table, tableParts[it.table.key]);
      }
    }
  }

  void _signature(StringBuffer b, DocSignature s) {
    b.write(para('', extraPPr: '<w:spacing w:before="0" w:after="0" w:line="720" w:lineRule="exact"/>'));
    final half = Reg.contentWidthTw ~/ 2;
    String cell(String content, int w) => '<w:tc><w:tcPr><w:tcW w:w="$w" w:type="dxa"/></w:tcPr>$content</w:tc>';
    const single = '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/>';
    b.write('<w:tbl><w:tblPr><w:tblW w:w="${Reg.contentWidthTw}" w:type="dxa"/><w:tblLayout w:type="fixed"/>'
        '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>'
        '<w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr>'
        '<w:tblGrid><w:gridCol w:w="$half"/><w:gridCol w:w="${Reg.contentWidthTw - half}"/></w:tblGrid>'
        '<w:tr><w:trPr><w:cantSplit/></w:trPr>'
        '${cell(para(run('«____» ______________ ${s.year} г.'), extraPPr: '$single<w:jc w:val="left"/>'), half)}'
        '${cell(para(run('______________ / ${s.initialsName}'), extraPPr: '$single<w:jc w:val="center"/>') + para(run('(подпись автора)', halfPoints: 20), extraPPr: '$single<w:jc w:val="center"/>'), Reg.contentWidthTw - half)}'
        '</w:tr></w:tbl>');
  }

  // ---------------- Таблицы ----------------

  void _table(StringBuffer b, NumberedTable t, List<TablePart>? parts) {
    final rows = t.table.rows;
    if (rows.isEmpty) return;
    final cols = t.table.columns;
    final head = rows.length > 1 ? t.table.headerRows.clamp(1, rows.length - 1) : 1;
    final widthsPt = columnWidths(rows, cols, Reg.contentWidthPt, (s) => measure.width(s, Reg.tableFontPt), padX: 5.4);
    final widths = widthsPt.map((w) => (w * 20).round()).toList();
    final diff = Reg.contentWidthTw - widths.fold<int>(0, (a, w) => a + w);
    if (widths.isNotEmpty) widths[widths.length - 1] += diff;
    final numeric = numericColumns(rows, cols, head);
    final caption = t.table.title.isEmpty ? 'Таблица ${t.label}' : 'Таблица ${t.label} — ${t.table.title}';
    b.write(para(run(caption), style: 'TableCaption'));

    // Разбиение по страницам — как в PDF-вёрстке (метрики шрифтов совпадают).
    final ranges = <(int, int)>[];
    final sorted = [...?parts]..sort((a, c) => a.firstRow.compareTo(c.firstRow));
    if (sorted.length > 1) {
      for (var i = 0; i < sorted.length; i++) {
        var from = i == 0 ? head : ranges.last.$2;
        var to = i == sorted.length - 1 ? rows.length : sorted[i].lastRow;
        // запас в одну строку, чтобы Word гарантированно уместил часть на странице
        if (i < sorted.length - 1 && to - from > 2) to -= 1;
        if (from < head) from = head;
        ranges.add((from, to));
      }
    } else {
      ranges.add((head, rows.length));
    }
    for (var pi = 0; pi < ranges.length; pi++) {
      final (from, to) = ranges[pi];
      if (pi > 0) {
        b.write(para(run('Продолжение таблицы ${t.label}'), style: 'TableCaption', extraPPr: '<w:pageBreakBefore/>'));
      }
      final isLastPart = pi == ranges.length - 1;
      final keepTogether = ranges.length == 1;
      b.write('<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="${Reg.contentWidthTw}" w:type="dxa"/><w:tblLayout w:type="fixed"/>'
          '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid>');
      for (final w in widths) {
        b.write('<w:gridCol w:w="$w"/>');
      }
      b.write('</w:tblGrid>');
      final visible = [for (var i = 0; i < head; i++) i, for (var i = from; i < to; i++) i];
      for (var k = 0; k < visible.length; k++) {
        final ri = visible[k];
        final isHead = ri < head;
        final lastRow = k == visible.length - 1;
        b.write('<w:tr><w:trPr><w:cantSplit/>${isHead ? '<w:tblHeader/>' : ''}</w:trPr>');
        for (var ci = 0; ci < cols; ci++) {
          final text = ci < rows[ri].length ? rows[ri][ci] : '';
          final jc = isHead ? 'center' : (numeric[ci] ? 'right' : 'left');
          final noBottom = lastRow && !isLastPart ? '<w:tcBorders><w:bottom w:val="nil"/></w:tcBorders>' : '';
          final keep = keepTogether && !lastRow ? '<w:keepNext/>' : '';
          b.write('<w:tc><w:tcPr><w:tcW w:w="${widths[ci]}" w:type="dxa"/>$noBottom</w:tcPr>'
              '${para(run(text), style: 'TableText', extraPPr: '$keep<w:jc w:val="$jc"/>')}</w:tc>');
        }
        b.write('</w:tr>');
      }
      b.write('</w:tbl>');
    }
    // пустой абзац после таблицы не нужен: следующий абзац начинается с интервала 1,5
  }

  // ---------------- Раздел, стили, служебные части ----------------

  String _sectPr() => '<w:sectPr>'
      '<w:headerReference w:type="default" r:id="rId4"/>'
      '<w:headerReference w:type="first" r:id="rId5"/>'
      '<w:footerReference w:type="default" r:id="rId6"/>'
      '<w:footerReference w:type="first" r:id="rId7"/>'
      '<w:pgSz w:w="${Reg.pageWidthTw}" w:h="${Reg.pageHeightTw}"/>'
      '<w:pgMar w:top="${Reg.marginTopTw}" w:right="${Reg.marginRightTw}" w:bottom="${Reg.marginBottomTw}" w:left="${Reg.marginLeftTw}" '
      'w:header="${Reg.headerDistanceTw}" w:footer="${Reg.footerDistanceTw}" w:gutter="0"/>'
      '<w:pgNumType w:start="1"/>'
      '<w:cols w:space="708"/>'
      '<w:titlePg/>'
      '<w:docGrid w:linePitch="360"/>'
      '</w:sectPr>';

  static String _rFonts() =>
      '<w:rFonts w:ascii="${Reg.fontName}" w:hAnsi="${Reg.fontName}" w:eastAsia="${Reg.fontName}" w:cs="${Reg.fontName}"/>';

  String _styles() {
    final ind = Reg.firstLineIndentTw;
    final after = (Reg.headingAfterPt * 20).round();
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:styles xmlns:w="$_w">'
        '<w:docDefaults><w:rPrDefault><w:rPr>${_rFonts()}<w:sz w:val="28"/><w:szCs w:val="28"/><w:lang w:val="ru-RU" w:eastAsia="ru-RU" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>'
        '<w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/>'
        '<w:pPr><w:widowControl w:val="0"/><w:spacing w:before="0" w:after="0" w:line="360" w:lineRule="auto"/><w:ind w:firstLine="$ind"/><w:jc w:val="both"/></w:pPr>'
        '<w:rPr>${_rFonts()}<w:color w:val="000000"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:lang w:val="ru-RU"/></w:rPr></w:style>'
        '<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/></w:style>'
        '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>'
        '<w:pPr><w:keepNext/><w:keepLines/><w:pageBreakBefore/><w:suppressAutoHyphens/><w:spacing w:before="0" w:after="$after" w:line="360" w:lineRule="auto"/>'
        '<w:ind w:firstLine="0"/><w:jc w:val="center"/><w:outlineLvl w:val="0"/></w:pPr>'
        '<w:rPr><w:b/><w:bCs/><w:u w:val="none"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>'
        '<w:style w:type="paragraph" w:styleId="TOCHeading"><w:name w:val="TOC Heading"/><w:basedOn w:val="Heading1"/><w:next w:val="Normal"/><w:uiPriority w:val="39"/>'
        '<w:pPr><w:outlineLvl w:val="9"/></w:pPr></w:style>'
        '<w:style w:type="paragraph" w:styleId="TOC1"><w:name w:val="toc 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="39"/>'
        '<w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${Reg.contentWidthTw}"/></w:tabs><w:spacing w:before="0" w:after="0" w:line="360" w:lineRule="auto"/>'
        '<w:ind w:firstLine="0" w:right="840"/><w:jc w:val="left"/></w:pPr></w:style>'
        '<w:style w:type="paragraph" w:styleId="AppendixLabel"><w:name w:val="Appendix Label"/><w:basedOn w:val="Normal"/><w:next w:val="AppendixTitle"/>'
        '<w:pPr><w:keepNext/><w:pageBreakBefore/><w:ind w:firstLine="0"/><w:jc w:val="right"/></w:pPr></w:style>'
        '<w:style w:type="paragraph" w:styleId="AppendixTitle"><w:name w:val="Appendix Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>'
        '<w:pPr><w:keepNext/><w:keepLines/><w:suppressAutoHyphens/><w:spacing w:before="0" w:after="$after" w:line="360" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr>'
        '<w:rPr><w:b/><w:bCs/></w:rPr></w:style>'
        '<w:style w:type="paragraph" w:styleId="TableCaption"><w:name w:val="Table Caption"/><w:basedOn w:val="Normal"/><w:next w:val="TableText"/>'
        '<w:pPr><w:keepNext/><w:ind w:firstLine="0"/><w:jc w:val="left"/></w:pPr></w:style>'
        '<w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/>'
        '<w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="left"/></w:pPr>'
        '<w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>'
        '<w:style w:type="paragraph" w:styleId="TitlePage"><w:name w:val="Title Page Text"/><w:basedOn w:val="Normal"/>'
        '<w:pPr><w:ind w:firstLine="0"/><w:jc w:val="left"/></w:pPr></w:style>'
        '<w:style w:type="paragraph" w:styleId="Header"><w:name w:val="header"/><w:basedOn w:val="Normal"/>'
        '<w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr>'
        '<w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>'
        '<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/>'
        '<w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr>'
        '<w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>'
        '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/>'
        '<w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/>'
        '<w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>'
        '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="TableNormal"/><w:uiPriority w:val="39"/>'
        '<w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
        '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
        '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tblBorders></w:tblPr></w:style>'
        '</w:styles>';
  }

  String _settings() => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      '<w:settings xmlns:w="$_w"><w:zoom w:percent="100"/><w:defaultTabStop w:val="709"/>'
      '<w:autoHyphenation w:val="false"/><w:characterSpacingControl w:val="doNotCompress"/>'
      '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>'
      '<w:themeFontLang w:val="ru-RU"/><w:decimalSymbol w:val=","/><w:listSeparator w:val=";"/></w:settings>';

  String _fontTable() => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      '<w:fonts xmlns:w="$_w"><w:font w:name="${Reg.fontName}"><w:panose1 w:val="02020603050405020304"/><w:charset w:val="CC"/>'
      '<w:family w:val="roman"/><w:pitch w:val="variable"/></w:font></w:fonts>';

  String _header(String text) => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      '<w:hdr xmlns:w="$_w" xmlns:r="$_r">${para(text.isEmpty ? '' : run(text), style: 'Header')}</w:hdr>';

  String _footer(bool withNumber) => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      '<w:ftr xmlns:w="$_w" xmlns:r="$_r">${para(withNumber ? '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>'
          '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>2</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>' : '', style: 'Footer')}</w:ftr>';

  String _contentTypes() => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      '<Default Extension="xml" ContentType="application/xml"/>'
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
      '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>'
      '<Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>'
      '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>'
      '<Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>'
      '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
      '<Override PartName="/word/footer2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
      '</Types>';

  String _rootRels() => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
      '</Relationships>';

  String _docRels() {
    const t = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="$t/styles" Target="styles.xml"/>'
        '<Relationship Id="rId2" Type="$t/settings" Target="settings.xml"/>'
        '<Relationship Id="rId3" Type="$t/fontTable" Target="fontTable.xml"/>'
        '<Relationship Id="rId4" Type="$t/header" Target="header1.xml"/>'
        '<Relationship Id="rId5" Type="$t/header" Target="header2.xml"/>'
        '<Relationship Id="rId6" Type="$t/footer" Target="footer1.xml"/>'
        '<Relationship Id="rId7" Type="$t/footer" Target="footer2.xml"/>'
        '</Relationships>';
  }

  String _core(DocModel m) {
    final now = DateTime.now().toUtc().toIso8601String().split('.').first;
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" '
        'xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        '<dc:title>${esc(m.docTitle)}</dc:title><dc:subject>Курсовая работа</dc:subject><dc:creator>${esc(m.author)}</dc:creator>'
        '<cp:lastModifiedBy>${esc(m.author)}</cp:lastModifiedBy><dc:language>ru-RU</dc:language>'
        '<dcterms:created xsi:type="dcterms:W3CDTF">${now}Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}Z</dcterms:modified>'
        '</cp:coreProperties>';
  }

  String _app(LayoutInfo? layout) => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
      'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
      '<Application>Курсовая ЛТЭТ</Application>${layout == null ? '' : '<Pages>${layout.totalPages}</Pages>'}<DocSecurity>0</DocSecurity></Properties>';
}
