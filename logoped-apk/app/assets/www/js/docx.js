'use strict';
/*
 * Мини-генератор .docx (Office Open XML) без внешних библиотек.
 * Оформление по ГОСТ Р 7.0.97-2016 / ГОСТ 7.32-2017: Times New Roman 14, полуторный интервал,
 * абзацный отступ 1,25 см, поля 30/15/20/20 мм, нумерация страниц внизу по центру.
 */
var DOCX = (function () {
  /* ---------- ZIP (без сжатия) ---------- */
  var CRC = null;
  function crc32(b) {
    if (!CRC) {
      CRC = new Uint32Array(256);
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        CRC[n] = c >>> 0;
      }
    }
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < b.length; i++) crc = CRC[(crc ^ b[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  var enc = new TextEncoder();
  function zip(files) {
    var parts = [], central = [], offset = 0;
    var d = new Date(), dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint16(10, 0, true); c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
      c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true);
      c.setUint32(38, 0, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var cdSize = central.reduce(function (a, x) { return a + x.length; }, 0);
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(4, 0, true); e.setUint16(6, 0, true);
    e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true); e.setUint32(16, offset, true); e.setUint16(20, 0, true);
    var all = parts.concat(central, [new Uint8Array(e.buffer)]);
    var total = all.reduce(function (a, x) { return a + x.length; }, 0), out = new Uint8Array(total), pos = 0;
    all.forEach(function (x) { out.set(x, pos); pos += x.length; });
    return out;
  }

  /* ---------- XML ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var CM = 567;          // твипов в сантиметре
  var EMU_CM = 360000;   // EMU в сантиметре

  function Doc(opts) {
    this.o = opts || {};
    this.body = [];
    this.media = [];
    this.pid = 1;
    this.font = this.o.font || 'Times New Roman';
    this.size = this.o.size || 28; // полупункты: 14 pt
  }

  /** Фрагмент текста. o: {b, i, u, size, color, caps} */
  Doc.prototype.r = function (text, o) {
    o = o || {};
    var rp = '';
    if (o.b) rp += '<w:b/><w:bCs/>';
    if (o.i) rp += '<w:i/><w:iCs/>';
    if (o.u) rp += '<w:u w:val="single"/>';
    if (o.caps) rp += '<w:caps/>';
    if (o.color) rp += '<w:color w:val="' + o.color + '"/>';
    if (o.size) rp += '<w:sz w:val="' + o.size + '"/><w:szCs w:val="' + o.size + '"/>';
    var parts = String(text == null ? '' : text).split('\n');
    return parts.map(function (t, i) {
      return '<w:r>' + (rp ? '<w:rPr>' + rp + '</w:rPr>' : '') + (i > 0 ? '<w:br/>' : '') + '<w:t xml:space="preserve">' + esc(t) + '</w:t></w:r>';
    }).join('');
  };

  /** Абзац. runs: строка или массив [текст, опции] / готовый XML (o.raw). o: {align, indent, hanging, left, before, after, line, keepNext, style, pageBreak, size, b, i} */
  Doc.prototype.pXml = function (runs, o) {
    o = o || {};
    var self = this;
    var pp = '';
    if (o.style) pp += '<w:pStyle w:val="' + o.style + '"/>';
    if (o.keepNext) pp += '<w:keepNext/>';
    if (o.keepLines) pp += '<w:keepLines/>';
    if (o.pageBreak) pp += '<w:pageBreakBefore/>';
    if (o.before != null || o.after != null || o.line != null) {
      pp += '<w:spacing' + (o.before != null ? ' w:before="' + o.before + '"' : '') + (o.after != null ? ' w:after="' + o.after + '"' : '') +
        (o.line != null ? ' w:line="' + o.line + '" w:lineRule="auto"' : '') + '/>';
    }
    if (o.indent != null || o.left != null || o.hanging != null || o.right != null) {
      pp += '<w:ind' + (o.left != null ? ' w:left="' + o.left + '"' : '') + (o.right != null ? ' w:right="' + o.right + '"' : '') +
        (o.hanging != null ? ' w:hanging="' + o.hanging + '"' : (o.indent != null ? ' w:firstLine="' + o.indent + '"' : '')) + '/>';
    }
    if (o.align) pp += '<w:jc w:val="' + o.align + '"/>';
    if (o.shade) pp += '<w:shd w:val="clear" w:color="auto" w:fill="' + o.shade + '"/>';
    if (o.border) pp += '<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="4" w:color="' + o.border + '"/></w:pBdr>';
    var content;
    if (o.raw) content = runs;
    else if (typeof runs === 'string') content = this.r(runs, { b: o.b, i: o.i, size: o.size, color: o.color, caps: o.caps });
    else content = (runs || []).map(function (x) { return typeof x === 'string' ? self.r(x, { size: o.size }) : self.r(x[0], Object.assign({ size: o.size }, x[1] || {})); }).join('');
    return '<w:p>' + (pp ? '<w:pPr>' + pp + '</w:pPr>' : '') + content + '</w:p>';
  };
  Doc.prototype.p = function (runs, o) { this.body.push(this.pXml(runs, o)); return this; };

  Doc.prototype.h = function (text, o) {
    o = o || {};
    this.p(text, Object.assign({ style: o.level === 2 ? 'Heading2' : 'Heading1', keepNext: true }, o));
    return this;
  };

  Doc.prototype.pageBreak = function () { this.body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>'); return this; };

  /** Картинка (PNG-байты), ширина в см; возвращает XML фрагмента */
  Doc.prototype.imgRun = function (png, wCm, hCm) {
    var id = this.media.length + 1;
    var rid = 'rIdImg' + id;
    this.media.push({ name: 'media/image' + id + '.png', data: png, rid: rid });
    var cx = Math.round(wCm * EMU_CM), cy = Math.round(hCm * EMU_CM), pid = this.pid++;
    return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/>' +
      '<wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="' + pid + '" name="Рисунок ' + pid + '"/>' +
      '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
      '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>' +
      '<pic:nvPicPr><pic:cNvPr id="' + pid + '" name="image' + id + '.png"/><pic:cNvPicPr/></pic:nvPicPr>' +
      '<pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
      '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
      '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
  };

  /**
   * Таблица. rows: массив строк; ячейка — строка, массив абзацев-строк, или {xml}/{text, b, i, shade, align, span}.
   * o: {widths (см), header (кол-во строк-шапок), size, headShade, borderColor, cantSplit, layoutPct}
   */
  Doc.prototype.tableXml = function (rows, o) {
    o = o || {};
    var self = this;
    var widths = o.widths.map(function (cm) { return Math.round(cm * CM); });
    var size = o.size || 24;
    var bc = o.borderColor || '000000';
    var bw = o.borderSize || 4;
    var borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function (s) {
      return '<w:' + s + ' w:val="' + (o.noBorders ? 'nil' : 'single') + '" w:sz="' + bw + '" w:space="0" w:color="' + bc + '"/>';
    }).join('');
    var x = '<w:tbl><w:tblPr><w:tblW w:w="' + widths.reduce(function (a, b) { return a + b; }, 0) + '" w:type="dxa"/>' +
      (o.center ? '<w:jc w:val="center"/>' : '') +
      '<w:tblBorders>' + borders + '</w:tblBorders><w:tblLayout w:type="fixed"/>' +
      '<w:tblCellMar><w:top w:w="' + (o.padV || 40) + '" w:type="dxa"/><w:left w:w="' + (o.padH || 90) + '" w:type="dxa"/><w:bottom w:w="' + (o.padV || 40) + '" w:type="dxa"/><w:right w:w="' + (o.padH || 90) + '" w:type="dxa"/></w:tblCellMar>' +
      '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid>' +
      widths.map(function (w) { return '<w:gridCol w:w="' + w + '"/>'; }).join('') + '</w:tblGrid>';
    rows.forEach(function (row, ri) {
      var isHead = ri < (o.header || 0);
      x += '<w:tr><w:trPr>' + (isHead ? '<w:tblHeader/>' : '') + (o.cantSplit || isHead ? '<w:cantSplit/>' : '') + '</w:trPr>';
      var col = 0;
      row.forEach(function (cell) {
        var c = (cell && typeof cell === 'object' && !Array.isArray(cell)) ? cell : { text: cell };
        var span = c.span || 1;
        var w = widths.slice(col, col + span).reduce(function (a, b) { return a + b; }, 0);
        col += span;
        var shade = c.shade || (isHead ? (o.headShade || 'D9D9D9') : (o.zebra && ri % 2 === 0 ? o.zebra : null));
        x += '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>' + (span > 1 ? '<w:gridSpan w:val="' + span + '"/>' : '') +
          (shade ? '<w:shd w:val="clear" w:color="auto" w:fill="' + shade + '"/>' : '') + (c.vAlign ? '<w:vAlign w:val="' + c.vAlign + '"/>' : '') + '</w:tcPr>';
        if (c.xml) x += c.xml;
        else {
          var paras = Array.isArray(c.text) ? c.text : [c.text == null ? '' : c.text];
          paras.forEach(function (pt) {
            var runs = typeof pt === 'string' ? [[pt, { b: c.b || isHead, i: c.i, size: size, color: c.color || (isHead ? o.headColor : null) }]] : pt;
            x += self.pXml(runs.map(function (r) { return typeof r === 'string' ? [r, { size: size }] : [r[0], Object.assign({ size: size }, r[1] || {})]; }),
              { style: 'TableText', align: c.align || (isHead ? 'center' : 'left'), keepNext: !!c.keepNext });
          });
        }
        x += '</w:tc>';
      });
      x += '</w:tr>';
    });
    x += '</w:tbl>';
    return x;
  };
  Doc.prototype.table = function (rows, o) { this.body.push(this.tableXml(rows, o)); this.body.push(this.pXml('', { after: 0, line: 240, size: 8 })); return this; };

  /** Конец раздела: o = {landscape, margins: [top, right, bottom, left] в см, titlePg, footer} */
  function sectPr(o) {
    o = o || {};
    var land = !!o.landscape;
    var w = land ? 16838 : 11906, h = land ? 11906 : 16838;
    var m = (o.margins || [2, 1.5, 2, 3]).map(function (cm) { return Math.round(cm * CM); });
    return '<w:sectPr>' + (o.footer !== false ? '<w:footerReference w:type="default" r:id="rIdFooter1"/>' : '') +
      '<w:pgSz w:w="' + w + '" w:h="' + h + '"' + (land ? ' w:orient="landscape"' : '') + '/>' +
      '<w:pgMar w:top="' + m[0] + '" w:right="' + m[1] + '" w:bottom="' + m[2] + '" w:left="' + m[3] + '" w:header="709" w:footer="567" w:gutter="0"/>' +
      '<w:cols w:space="708"/>' + (o.titlePg ? '<w:titlePg/>' : '') + '<w:docGrid w:linePitch="360"/></w:sectPr>';
  }
  Doc.prototype.endSection = function (o) { this.body.push('<w:p><w:pPr>' + sectPr(o) + '</w:pPr></w:p>'); return this; };

  Doc.prototype.build = function (meta, lastSect) {
    meta = meta || {};
    var font = esc(this.font), sz = this.size;
    var NS = 'xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" ' +
      'xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
      'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" ' +
      'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" ' +
      'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" ' +
      'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
    var document = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ' + NS + '><w:body>' +
      this.body.join('') + sectPr(lastSect) + '</w:body></w:document>';

    var styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="' + font + '" w:hAnsi="' + font + '" w:cs="' + font + '" w:eastAsia="' + font + '"/>' +
      '<w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/><w:lang w:val="ru-RU" w:eastAsia="ru-RU" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto"/><w:ind w:firstLine="709"/><w:jc w:val="both"/></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
      '<w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="240" w:after="120" w:line="360" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="center"/><w:outlineLvl w:val="0"/></w:pPr>' +
      '<w:rPr><w:b/><w:bCs/><w:caps/><w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
      '<w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="200" w:after="60" w:line="360" w:lineRule="auto"/><w:ind w:firstLine="709"/><w:jc w:val="left"/><w:outlineLvl w:val="1"/></w:pPr>' +
      '<w:rPr><w:b/><w:bCs/><w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:customStyle="1" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/><w:qFormat/>' +
      '<w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr><w:rPr><w:sz w:val="24"/></w:rPr></w:style>' +
      '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>' +
      '</w:styles>';

    var footer = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<w:p><w:pPr><w:pStyle w:val="Footer"/><w:spacing w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>' +
      '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>';

    var settings = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:zoom w:percent="100"/><w:defaultTabStop w:val="709"/><w:characterSpacingControl w:val="doNotCompress"/>' +
      '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>' +
      '<w:themeFontLang w:val="ru-RU"/></w:settings>';

    var fontTable = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:font w:name="Times New Roman"><w:panose1 w:val="02020603050405020304"/><w:charset w:val="CC"/><w:family w:val="roman"/><w:pitch w:val="variable"/></w:font>' +
      '<w:font w:name="Calibri"><w:charset w:val="CC"/><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font></w:fonts>';

    var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
      '<Relationship Id="rIdFonts" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>' +
      '<Relationship Id="rIdFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' +
      this.media.map(function (m) { return '<Relationship Id="' + m.rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="' + m.name + '"/>'; }).join('') +
      '</Relationships>';

    var now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    var core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
      'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>' + esc(meta.title || '') + '</dc:title><dc:subject>' + esc(meta.subject || '') + '</dc:subject><dc:creator>' + esc(meta.author || '') + '</dc:creator>' +
      '<cp:keywords>' + esc(meta.keywords || '') + '</cp:keywords><dc:language>ru-RU</dc:language>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified></cp:coreProperties>';
    var app = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Конструктор занятий</Application></Properties>';

    var ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="png" ContentType="image/png"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
      '<Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>' +
      '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>';
    var rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>';

    var files = [
      { name: '[Content_Types].xml', data: ct }, { name: '_rels/.rels', data: rootRels },
      { name: 'docProps/core.xml', data: core }, { name: 'docProps/app.xml', data: app },
      { name: 'word/document.xml', data: document }, { name: 'word/styles.xml', data: styles },
      { name: 'word/settings.xml', data: settings }, { name: 'word/fontTable.xml', data: fontTable },
      { name: 'word/footer1.xml', data: footer }, { name: 'word/_rels/document.xml.rels', data: rels }
    ];
    this.media.forEach(function (m) { files.push({ name: 'word/' + m.name, data: m.data }); });
    return zip(files);
  };

  return { Doc: Doc, zip: zip, esc: esc, CM: CM };
})();
