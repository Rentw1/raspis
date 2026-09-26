'use strict';
/*
 * Картинки: OpenMoji (img/c — цвет, img/b — контур), свои рисунки (ART),
 * пользовательские замены (ARASAAC, фото из галереи) с сохранением в IndexedDB.
 * Примитивы рисования на canvas для заданий.
 */
var IMG = (function () {
  var BASE = 'img/';
  var textCache = {}, imgCache = {}, overrides = {};

  /* ---------- IndexedDB: сохранённые замены картинок ---------- */
  var idb = null;
  function openDb() {
    if (idb) return idb;
    idb = new Promise(function (res) {
      try {
        var rq = indexedDB.open('logoped', 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore('pics'); };
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = function () { res(null); };
      } catch (e) { res(null); }
    });
    return idb;
  }
  function dbPut(key, val) {
    return openDb().then(function (db) {
      if (!db) return;
      return new Promise(function (res) {
        try {
          var tx = db.transaction('pics', 'readwrite');
          if (val === null) tx.objectStore('pics').delete(key); else tx.objectStore('pics').put(val, key);
          tx.oncomplete = res; tx.onerror = res;
        } catch (e) { res(); }
      });
    });
  }
  function dbAll() {
    return openDb().then(function (db) {
      if (!db) return {};
      return new Promise(function (res) {
        var out = {};
        try {
          var tx = db.transaction('pics', 'readonly');
          var st = tx.objectStore('pics');
          var rq = st.openCursor();
          rq.onsuccess = function () {
            var c = rq.result;
            if (c) { out[c.key] = c.value; c.continue(); } else res(out);
          };
          rq.onerror = function () { res(out); };
        } catch (e) { res(out); }
      });
    });
  }

  function loadOverrides() {
    return dbAll().then(function (all) {
      Object.keys(all).forEach(function (k) { overrides[k] = all[k]; });
      return overrides;
    });
  }

  /** Замена картинки слова: {c: dataURL, b: dataURL|null, src, credit} */
  function setOverride(word, val, persist) {
    Object.keys(imgCache).forEach(function (k) { if (k.indexOf('w|' + word + '|') === 0) delete imgCache[k]; });
    if (val) overrides[word] = val; else delete overrides[word];
    if (persist !== false) return dbPut(word, val || null);
    return Promise.resolve();
  }
  function getOverride(word) { return overrides[word] || null; }

  /* ---------- загрузка ---------- */
  function fetchText(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('Нет файла ' + url); return r.text(); });
  }

  function svgText(code, variant) {
    var v = variant === 'b' ? 'b' : 'c';
    var key = code + '|' + v;
    if (textCache[key]) return textCache[key];
    var p;
    if (code.indexOf('x:') === 0) {
      var id = code.slice(2), rc = ART.RECOLOR[id];
      if (rc) {
        p = v === 'b' ? fetchText(BASE + 'b/' + rc.base + '.svg') : fetchText(BASE + 'c/' + rc.base + '.svg').then(function (t) { return ART.recolor(t, rc.map); });
      } else {
        var s = ART.color(id);
        p = s ? Promise.resolve(v === 'b' ? ART.outline(s) : s) : Promise.reject(new Error('Нет рисунка ' + id));
      }
    } else {
      p = fetchText(BASE + v + '/' + code + '.svg');
    }
    textCache[key] = p;
    p.catch(function () { delete textCache[key]; });
    return p;
  }

  function loadImage(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { rej(new Error('Не удалось загрузить картинку')); };
      im.src = src;
    });
  }

  function fromSvg(text) {
    // размер 512 — чтобы растровые копии были чёткими при печати
    var t = String(text).replace('<svg ', '<svg width="512" height="512" ');
    return loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(t));
  }

  function code(codeStr, variant) {
    var key = 'c|' + codeStr + '|' + variant;
    if (!imgCache[key]) {
      imgCache[key] = svgText(codeStr, variant).then(fromSvg);
      imgCache[key].catch(function () { delete imgCache[key]; });
    }
    return imgCache[key];
  }

  /** Картинка слова. variant: 'c' — цвет, 'b' — контур */
  function word(e, variant) {
    if (typeof e === 'string') e = DB.word(e);
    if (!e) return Promise.resolve(null);
    var v = variant === 'b' ? 'b' : 'c';
    var key = 'w|' + e.w + '|' + v;
    if (imgCache[key]) return imgCache[key];
    var ov = overrides[e.w] || (e.of ? overrides[e.of] : null);
    var p;
    if (ov && (ov[v] || ov.c)) {
      p = loadImage(ov[v] || ov.c);
    } else {
      var io = DB.imageOf(e);
      p = io && io.img ? code(io.img, v) : Promise.resolve(null);
    }
    p = p.catch(function () { return null; });
    imgCache[key] = p;
    return p;
  }

  /** Есть ли у слова своя картинка (без интернета) */
  function hasPicture(e) {
    if (typeof e === 'string') e = DB.word(e);
    if (!e) return false;
    if (overrides[e.w] || (e.of && overrides[e.of])) return true;
    var io = DB.imageOf(e);
    if (!io || !io.img) return false;
    if (io.img.indexOf('x:') === 0) return ART.has(io.img.slice(2));
    return !!(window.OM_CODES ? OM_CODES[io.img] : true);
  }

  /* ---------- рисование ---------- */
  var FONT = '"Roboto", "Noto Sans", "Segoe UI", Arial, sans-serif';

  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.round(w); c.height = Math.round(h);
    var g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.lineCap = 'round'; g.lineJoin = 'round';
    return c;
  }

  /** Рисует картинку, вписывая в прямоугольник. o: {scale, silhouette, gray, alpha, multiply, flip} */
  function draw(g, im, x, y, w, h, o) {
    o = o || {};
    if (!im) {
      g.save();
      roundRect(g, x + w * 0.1, y + h * 0.1, w * 0.8, h * 0.8, 18, '#b9bdd6', '#f4f5fb', [10, 8]);
      text(g, o.label || '?', x + w / 2, y + h / 2 + 12, Math.min(40, w / 5), { align: 'center', color: '#6b6f8a', bold: true, maxWidth: w * 0.75 });
      g.restore();
      return;
    }
    var s = (o.scale || 1);
    var iw = im.naturalWidth || im.width || 512, ih = im.naturalHeight || im.height || 512;
    var k = Math.min(w / iw, h / ih) * s;
    var dw = iw * k, dh = ih * k;
    var dx = x + (w - dw) / 2, dy = y + (h - dh) / 2 + (o.alignBottom ? (h - dh) / 2 : 0);
    g.save();
    if (o.alpha != null) g.globalAlpha = o.alpha;
    if (o.multiply) g.globalCompositeOperation = 'multiply';
    if (o.flip) { g.translate(dx + dw / 2, 0); g.scale(-1, 1); g.translate(-(dx + dw / 2), 0); }
    if (o.silhouette || o.gray) {
      var off = document.createElement('canvas');
      off.width = Math.max(1, Math.round(dw)); off.height = Math.max(1, Math.round(dh));
      var og = off.getContext('2d');
      og.drawImage(im, 0, 0, off.width, off.height);
      if (o.silhouette) {
        og.globalCompositeOperation = 'source-in';
        og.fillStyle = o.silhouette === true ? '#2b2b33' : o.silhouette;
        og.fillRect(0, 0, off.width, off.height);
      } else {
        try {
          var d = og.getImageData(0, 0, off.width, off.height), px = d.data;
          for (var i = 0; i < px.length; i += 4) {
            var l = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
            px[i] = px[i + 1] = px[i + 2] = l;
          }
          og.putImageData(d, 0, 0);
        } catch (e) { /* tainted — рисуем как есть */ }
      }
      g.drawImage(off, dx, dy, dw, dh);
    } else {
      g.drawImage(im, dx, dy, dw, dh);
    }
    g.restore();
  }

  function roundRect(g, x, y, w, h, r, stroke, fill, dash, lw) {
    g.save();
    g.beginPath();
    r = Math.min(r, w / 2, h / 2);
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) {
      g.strokeStyle = stroke; g.lineWidth = lw || 4;
      if (dash) g.setLineDash(dash);
      g.stroke();
    }
    g.restore();
  }

  function text(g, str, x, y, size, o) {
    o = o || {};
    g.save();
    g.fillStyle = o.color || '#1d1f2e';
    g.textAlign = o.align || 'left';
    g.textBaseline = o.baseline || 'alphabetic';
    var fs = size;
    g.font = (o.italic ? 'italic ' : '') + (o.bold ? '700 ' : '400 ') + fs + 'px ' + (o.serif ? '"Times New Roman", "Noto Serif", serif' : FONT);
    if (o.maxWidth) {
      while (g.measureText(str).width > o.maxWidth && fs > 12) {
        fs -= 2;
        g.font = (o.italic ? 'italic ' : '') + (o.bold ? '700 ' : '400 ') + fs + 'px ' + (o.serif ? '"Times New Roman", serif' : FONT);
      }
    }
    g.fillText(str, x, y);
    g.restore();
    return fs;
  }

  /** Перенос текста по словам; возвращает высоту */
  function wrap(g, str, x, y, maxW, size, lh, o) {
    o = o || {};
    g.save();
    g.font = (o.bold ? '700 ' : '400 ') + size + 'px ' + FONT;
    var words = String(str).split(/\s+/), line = '', yy = y, lines = [];
    words.forEach(function (w) {
      var t = line ? line + ' ' + w : w;
      if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    });
    if (line) lines.push(line);
    g.restore();
    lines.forEach(function (ln) { text(g, ln, x, yy, size, o); yy += lh; });
    return lines.length * lh;
  }

  function line(g, x1, y1, x2, y2, w, col, dash) {
    g.save();
    g.strokeStyle = col || '#1d1f2e';
    g.lineWidth = w || 4;
    g.lineCap = 'round';
    if (dash) g.setLineDash(dash);
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.restore();
  }

  function circle(g, x, y, r, stroke, fill, lw) {
    g.save();
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 4; g.stroke(); }
    g.restore();
  }

  function toPngBytes(cv) {
    var url = cv.toDataURL('image/png');
    return U.bytesFromB64(url.slice(url.indexOf(',') + 1));
  }

  /** Сжатие пользовательской картинки до 640px (JPEG/PNG → dataURL) */
  function normalizeDataUrl(src, maxSide) {
    maxSide = maxSide || 640;
    return loadImage(src).then(function (im) {
      var iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
      var k = Math.min(1, maxSide / Math.max(iw, ih));
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(iw * k)); c.height = Math.max(1, Math.round(ih * k));
      var g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(im, 0, 0, c.width, c.height);
      return c.toDataURL('image/png');
    });
  }

  return {
    loadOverrides: loadOverrides, setOverride: setOverride, getOverride: getOverride, overrides: overrides,
    svgText: svgText, code: code, word: word, hasPicture: hasPicture, loadImage: loadImage,
    canvas: canvas, draw: draw, roundRect: roundRect, text: text, wrap: wrap, line: line, circle: circle,
    toPngBytes: toPngBytes, normalizeDataUrl: normalizeDataUrl, FONT: FONT
  };
})();
