'use strict';
/*
 * Собственные картинки в стиле OpenMoji (72×72, чёрный контур 2px, плоские цвета).
 * ART.color(id) → SVG-строка; ART.outline(svg) → контурная версия для раскраски.
 */
var ART = (function () {
  var ST = ' stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  var C = {
    red: '#EA5A47', dred: '#D22F27', green: '#B1CC33', dgreen: '#5C9E31', yellow: '#FCEA2B', dyellow: '#F1B31C',
    brown: '#A57939', dbrown: '#6A462F', lgray: '#D0CFCE', gray: '#9B9B9A', dark: '#3F3F3F', white: '#FFFFFF',
    orange: '#F4AA41', dorange: '#E27022', lblue: '#92D3F5', blue: '#61B2E4', dblue: '#1E50A0',
    pink: '#FFA7C0', purple: '#B399C8', dpurple: '#8967AA', beet: '#9E2A4B', skin: '#FADCBC', black: '#000000'
  };

  function svg(inner) { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72">' + inner + '</svg>'; }
  function P(d, fill, sw, stroke) {
    return '<path d="' + d + '" fill="' + (fill || 'none') + '" stroke="' + (stroke || '#000') + '" stroke-width="' + (sw || 2) +
      '" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  function F(d, fill) { return '<path d="' + d + '" fill="' + fill + '"/>'; }
  function L(x1, y1, x2, y2, w, col) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + (col || '#000') + '" stroke-width="' + (w || 2) + '" stroke-linecap="round"/>';
  }
  function Ci(cx, cy, r, fill, noStroke) { return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + (fill || 'none') + '"' + (noStroke ? '' : ST) + '/>'; }
  function E(cx, cy, rx, ry, fill, rot, noStroke) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + (fill || 'none') + '"' +
      (rot ? ' transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')"' : '') + (noStroke ? '' : ST) + '/>';
  }
  function eye(x, y, r) { return '<circle cx="' + x + '" cy="' + y + '" r="' + (r || 1.6) + '" fill="#000"/>'; }

  /* ---------- Птица на ветке (параметрический шаблон) ---------- */
  function bird(o) {
    var h = [];
    var body = 'cx="37" cy="41" rx="16" ry="' + (o.fat ? 13 : 12) + '" transform="rotate(18 37 41)"';
    if (o.pose === 'climb') {
      h.push(P('M50 2 L62 2 L62 70 L50 70 Z', C.brown), L(54, 14, 54, 22, 1.5), L(58, 40, 58, 50, 1.5));
      h.push('<g transform="rotate(-62 40 40) translate(2 0)">');
    } else if (o.branch !== false) {
      h.push(P('M4 57 Q36 53 68 56 L68 60 Q36 57.5 4 61 Z', C.brown));
      h.push(P('M52 56 Q57 50 62 49', 'none'));
      h.push(E(63, 48, 3.2, 2, C.green, -30));
    }
    var tails = {
      short: 'M47 44 L63 52 L60 57 L44 50 Z',
      long: 'M47 44 L71 62 L66 66 L43 50 Z',
      fork: 'M46 44 L69 49 L59 51.5 L66 59 L44 50 Z'
    };
    h.push(P(tails[o.tail || 'short'], o.tailCol || o.back));
    h.push(L(33, 50, 32, 57), L(39, 51, 39, 57), L(32, 57, 29, 58.5, 1.6), L(39, 57, 36, 58.5, 1.6));
    h.push('<clipPath id="bd"><ellipse ' + body + '/></clipPath>');
    h.push('<ellipse ' + body + ' fill="' + o.back + '"/>');
    h.push('<g clip-path="url(#bd)">' + E(29, 49, 15, 11, o.belly, 0, true) +
      (o.stripe ? F('M22 36 L26 36 L30 60 L25 60 Z', o.stripe) : '') +
      (o.bars ? [42, 46, 50, 54].map(function (y) { return '<path d="M16 ' + y + ' Q27 ' + (y - 2) + ' 40 ' + y + '" stroke="' + C.dark + '" stroke-width="1.3" fill="none"/>'; }).join('') : '') +
      (o.spots ? [[30, 36], [36, 40], [42, 37], [33, 45], [40, 46], [46, 43], [28, 42]].map(function (p) { return Ci(p[0], p[1], 0.9, '#fff', true); }).join('') : '') +
      (o.undertail ? E(48, 49, 5, 3.5, o.undertail, 20, true) : '') + '</g>');
    h.push(P('M33 35 C43 30 53 36 56 47 C48 47 40 44 33 35 Z', o.wing || o.back));
    if (o.wingBar) h.push('<path d="M39 37 C45 36 50 39 53 44" stroke="' + o.wingBar + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>');
    if (o.wingPatch) h.push(E(46, 40, 5, 2.4, o.wingPatch, 25));
    h.push('<ellipse ' + body + ' fill="none"' + ST + '/>');
    h.push('<clipPath id="hd"><circle cx="22" cy="28" r="9"/></clipPath>');
    h.push(Ci(22, 28, 9, o.head, true));
    h.push('<g clip-path="url(#hd)">' +
      (o.cap ? '<rect x="10" y="16" width="26" height="' + (o.capH || 8) + '" fill="' + o.cap + '"/>' : '') +
      (o.nape ? E(29, 25, 3.5, 3, o.nape, 0, true) : '') +
      (o.cheek ? E(22.5, 31, 5.2, 3.3, o.cheek, 0, true) : '') +
      (o.throat ? E(15, 34, 5.5, 4.2, o.throat, 0, true) : '') + '</g>');
    h.push(Ci(22, 28, 9, 'none'));
    if (o.eyeRing) h.push(Ci(19.5, 26.5, 2.6, o.eyeRing, true));
    h.push(eye(19.5, 26.5, 1.7));
    var beaks = { small: 'M14 27 L7.5 29.5 L14 31 Z', thick: 'M14.6 25.3 L7.2 29 L14.6 32.6 Z', long: 'M14 27.2 L1.5 29 L14 30.6 Z', mid: 'M14 26.8 L4.5 29.2 L14 31.2 Z' };
    h.push(P(beaks[o.beak || 'small'], o.beakCol || C.dark));
    if (o.pose === 'climb') h.push('</g>');
    return svg(h.join(''));
  }

  /* ---------- Голенастая птица (аист, журавль, цапля) ---------- */
  function wader(o) {
    var h = [];
    function leg(x1, x2) { return P('M' + x1 + ' 44 L' + (x1 + 2.4) + ' 44 L' + (x2 + 1.2) + ' 65 L' + (x2 - 1.2) + ' 65 Z', o.legs) + L(x2 - 1, 65.5, x2 - 6, 67, 1.6) + L(x2 - 1, 65.5, x2 + 3, 67.5, 1.6); }
    h.push(leg(40, 39), leg(46, 47));
    h.push(P('M56 36 C64 38 69 44 67 50 C62 47 58 44 52 42 Z', o.tail || o.wing));
    h.push(E(46, 37, 15, 9, o.body, -6));
    h.push(P('M38 31 C50 28 60 32 64 41 C56 43 47 41 38 36 Z', o.wing));
    var neck = o.sneck ? 'M36 34 C26 32 32 22 26 18 C23 16 22 15 22 14' : 'M35 34 C29 29 26 23 23 15';
    h.push('<path d="' + neck + '" stroke="#000" stroke-width="8.5" fill="none" stroke-linecap="round"/>');
    h.push('<path d="' + neck + '" stroke="' + o.neck + '" stroke-width="5" fill="none" stroke-linecap="round"/>');
    if (o.neckStripe) h.push('<path d="M31 30 C28 26 26 22 25 17" stroke="' + o.neckStripe + '" stroke-width="1.6" fill="none"/>');
    h.push(Ci(21, 13, 5.2, o.head));
    if (o.cap) h.push(Ci(21, 9.6, 2.2, o.cap, true));
    if (o.crest) h.push('<path d="M23 11 C28 9 31 10 34 12" stroke="#000" stroke-width="1.6" fill="none"/>');
    h.push(eye(19.5, 12.4, 1.3));
    h.push(P('M17 11.6 L2 14.8 L17 15.6 Z', o.beak));
    return svg(h.join(''));
  }

  /* ---------- Рисунки ---------- */
  var DRAW = {
    snegir: function () { return bird({ back: C.gray, belly: C.red, head: C.red, cap: C.dark, capH: 9.5, wing: C.dark, wingBar: '#FFFFFF', tailCol: C.dark, beak: 'thick', fat: true }); },
    sinica: function () { return bird({ back: C.green, belly: C.yellow, stripe: C.dark, head: C.dark, cheek: '#FFFFFF', wing: '#7F9FB8', tailCol: '#6E8BA1', beak: 'small' }); },
    vorona: function () { return bird({ back: C.gray, belly: C.lgray, head: C.dark, wing: C.dark, tailCol: C.dark, beak: 'mid', branch: true }); },
    soroka: function () { return bird({ back: C.dark, belly: '#FFFFFF', head: C.dark, wing: C.dark, wingPatch: '#FFFFFF', tailCol: C.dark, tail: 'long', beak: 'mid' }); },
    dyatel: function () { return bird({ back: C.dark, belly: '#FFFFFF', head: '#FFFFFF', cap: C.dark, capH: 7, nape: C.red, wing: C.dark, wingPatch: '#FFFFFF', tailCol: C.dark, undertail: C.red, beak: 'long', pose: 'climb' }); },
    lastochka: function () { return bird({ back: C.dblue, belly: '#FFFFFF', head: C.dblue, throat: C.dred, wing: C.dblue, tailCol: C.dblue, tail: 'fork', beak: 'small' }); },
    skvorec: function () { return bird({ back: C.dark, belly: C.dark, head: C.dark, wing: '#2F4F3A', tailCol: C.dark, beak: 'mid', beakCol: C.dyellow, spots: true }); },
    kukushka: function () { return bird({ back: C.gray, belly: '#FFFFFF', bars: true, head: C.gray, wing: '#7E7E7D', tailCol: C.gray, tail: 'long', beak: 'mid', eyeRing: C.dyellow }); },
    solovey: function () { return bird({ back: C.brown, belly: '#E8DCC8', head: C.brown, wing: '#8A6230', tailCol: '#B8672E', beak: 'small' }); },
    aist: function () { return wader({ body: '#FFFFFF', wing: C.dark, tail: C.dark, neck: '#FFFFFF', head: '#FFFFFF', beak: C.red, legs: C.red }); },
    zhuravl: function () { return wader({ body: C.lgray, wing: C.gray, tail: C.dark, neck: C.dark, neckStripe: '#FFFFFF', head: C.dark, cap: C.red, beak: C.gray, legs: C.dark }); },
    caplya: function () { return wader({ body: C.lgray, wing: C.gray, tail: C.gray, neck: '#FFFFFF', head: '#FFFFFF', crest: true, beak: C.dyellow, legs: C.dyellow, sneck: true }); },

    kapusta: function () {
      return svg(Ci(36, 40, 24, C.green) +
        P('M36 16 C28 24 26 36 30 50', 'none') + P('M36 16 C44 24 46 36 42 50', 'none') +
        P('M14 32 C22 30 28 34 30 42', 'none') + P('M58 32 C50 30 44 34 42 42', 'none') +
        P('M18 50 C24 54 30 56 36 56 C42 56 48 54 54 50', 'none') +
        P('M26 22 C31 26 34 31 35 37', 'none', 1.4) + P('M46 22 C41 26 38 31 37 37', 'none', 1.4) +
        E(36, 37, 7, 9, C.dgreen, 0) + L(36, 30, 36, 44, 1.2));
    },
    svekla: function () {
      return svg(P('M30 14 C26 8 22 6 18 8 C22 12 26 16 31 21 Z', C.dgreen) + P('M42 14 C46 8 50 6 54 8 C50 12 46 16 41 21 Z', C.dgreen) +
        P('M36 10 C34 14 34 18 36 22 C38 18 38 14 36 10 Z', C.dgreen) +
        L(30, 20, 20, 9, 1.2, C.beet) + L(42, 20, 52, 9, 1.2, C.beet) +
        P('M36 22 C50 22 56 32 52 44 C49 53 41 58 38 64 L36 70 L34 64 C31 58 23 53 20 44 C16 32 22 22 36 22 Z', C.beet) +
        P('M28 36 C30 34 33 34 35 35', 'none', 1.4) + P('M40 46 C42 44 44 44 46 45', 'none', 1.4));
    },
    rediska: function () {
      return svg(P('M30 22 C24 12 18 10 14 13 C19 18 24 22 31 26 Z', C.dgreen) + P('M42 22 C48 12 54 10 58 13 C53 18 48 22 41 26 Z', C.dgreen) +
        P('M36 14 C33 19 33 23 36 27 C39 23 39 19 36 14 Z', C.green) +
        Ci(36, 42, 15, C.red) + P('M31 54 C33 58 35 62 36 68 C37 62 39 58 41 54 C38 56 34 56 31 54 Z', '#FFFFFF') +
        P('M28 36 C30 33 33 32 36 32', 'none', 1.4, '#fff'));
    },
    kabachok: function () {
      return svg(P('M10 42 C10 30 26 26 44 24 C56 22 64 24 64 32 C64 40 54 46 40 49 C24 52 10 52 10 42 Z', '#8DBF3A') +
        P('M16 44 C28 42 44 38 58 31', 'none', 1.4) + P('M18 38 C30 35 44 32 56 28', 'none', 1.4) +
        P('M62 28 L68 24 L69 28 L64 32 Z', C.dgreen));
    },
    tykva: function () {
      return svg(P('M34 16 C33 12 34 8 38 6 L40 8 C38 10 37 13 38 17 Z', C.dgreen) +
        E(22, 41, 13, 20, C.dorange) + E(50, 41, 13, 20, C.dorange) + E(36, 41, 13, 21, C.orange) +
        P('M40 12 C46 8 52 10 54 14 C49 14 45 14 41 16 Z', C.green));
    },
    repa: function () {
      return svg(P('M30 22 C24 12 18 10 14 13 C19 18 24 22 31 26 Z', C.dgreen) + P('M42 22 C48 12 54 10 58 13 C53 18 48 22 41 26 Z', C.dgreen) +
        P('M36 14 C33 19 33 23 36 27 C39 23 39 19 36 14 Z', C.green) +
        P('M36 25 C52 25 58 36 55 46 C52 55 43 58 38 62 L36 69 L34 62 C29 58 20 55 17 46 C14 36 20 25 36 25 Z', C.dyellow) +
        P('M22 34 C28 32 44 32 50 34', 'none', 1.3) + E(36, 30, 10, 3.5, '#FFFFFF', 0, true));
    },
    sliva: function () {
      return svg(P('M36 14 C37 10 39 7 42 5', 'none') + P('M40 8 C46 4 54 6 56 12 C50 13 45 12 40 8 Z', C.green) +
        E(35, 40, 18, 23, C.dpurple, -8) + P('M33 18 C29 28 29 50 34 63', 'none', 1.4) +
        E(28, 30, 3, 7, C.purple, -8, true));
    },
    shishka: function () {
      var rows = '';
      for (var r = 0; r < 5; r++) {
        var y = 22 + r * 9, w = 12 - Math.abs(r - 2) * 2.2;
        rows += P('M' + (36 - w) + ' ' + y + ' Q' + (36 - w / 2) + ' ' + (y + 7) + ' 36 ' + (y + 3) + ' Q' + (36 + w / 2) + ' ' + (y + 7) + ' ' + (36 + w) + ' ' + y, 'none', 1.5);
      }
      return svg(P('M36 6 L36 14', 'none') + P('M36 13 C50 16 54 32 52 46 C50 58 42 66 36 66 C30 66 22 58 20 46 C18 32 22 16 36 13 Z', C.brown) + rows);
    },
    ryabina: function () {
      var leaves = '';
      [[20, 14], [16, 22], [24, 20], [12, 30], [22, 27]].forEach(function (p, i) { leaves += E(p[0], p[1], 5, 2.3, C.dgreen, -35 + i * 6); });
      var berries = '';
      [[40, 36], [48, 34], [44, 42], [52, 41], [36, 44], [42, 50], [50, 49], [56, 47], [46, 57], [38, 55], [54, 56], [60, 40]].forEach(function (p) { berries += Ci(p[0], p[1], 4.4, C.red); });
      return svg(P('M8 8 C20 16 32 24 44 34', 'none') + P('M28 22 C34 20 40 22 46 28', 'none', 1.5) + leaves + berries);
    },
    kormushka: function () {
      return svg(L(36, 2, 36, 12, 1.6) + P('M8 26 L36 10 L64 26 L58 30 L36 18 L14 30 Z', C.dred) +
        P('M16 28 L16 52 L20 52 L20 30 Z', C.brown) + P('M52 30 L52 52 L56 52 L56 28 Z', C.brown) +
        P('M8 52 L64 52 L62 60 L10 60 Z', C.brown) +
        [[24, 50], [30, 49], [36, 50], [42, 49], [48, 50], [27, 47], [39, 47], [45, 47]].map(function (p) { return E(p[0], p[1], 1.8, 1.1, C.dark, 20, true); }).join(''));
    },
    skvorechnik: function () {
      return svg(P('M33 60 L39 60 L39 71 L33 71 Z', C.brown) + P('M18 30 L54 30 L54 62 L18 62 Z', C.dyellow) +
        P('M12 32 L36 10 L60 32 L55 35 L36 18 L17 35 Z', C.dred) + Ci(36, 42, 6, C.dbrown) + L(36, 53, 36, 57, 3));
    },
    zayac: null
  };

  /* Перекраска картинок OpenMoji: {base, map} */
  var RECOLOR = {
    zayac: { base: '1F407', map: { '#fff': '#C8BBA6', '#3f3f3f': '#8F8576' } },
    pesec: { base: '1F98A', map: { '#E27022': '#E9ECEF' } }
  };

  function color(id) {
    var f = DRAW[id];
    return f ? f() : null;
  }

  /** Контур для раскраски: заливки → белый, цветные тонкие линии → чёрные, толстые («заливочные») → белые */
  function outline(svgText) {
    function isBlack(c) { c = c.toLowerCase(); return c === '#000' || c === '#000000' || c === 'black'; }
    return String(svgText).replace(/<(path|line|circle|ellipse|rect|polygon|polyline)\b[^>]*>/g, function (tag) {
      tag = tag.replace(/fill="([^"]+)"/, function (m, col) {
        return (col === 'none' || isBlack(col)) ? m : 'fill="#FFFFFF"';
      });
      var w = /stroke-width="([0-9.]+)"/.exec(tag);
      var width = w ? parseFloat(w[1]) : 1;
      tag = tag.replace(/stroke="([^"]+)"/, function (m, col) {
        if (col === 'none' || isBlack(col)) return m;
        return 'stroke="' + (width >= 4 ? '#FFFFFF' : '#000000') + '"';
      });
      return tag;
    });
  }

  function recolor(svgText, map) {
    var out = String(svgText);
    Object.keys(map).forEach(function (from) {
      var re = new RegExp('fill="' + from.replace('#', '#') + '"', 'gi');
      out = out.replace(re, 'fill="' + map[from] + '"');
    });
    return out;
  }

  function has(id) { return !!DRAW[id] || !!RECOLOR[id]; }

  function R(x, y, w, hh, rx, fill, sw) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + hh + '" rx="' + (rx || 0) + '" fill="' + (fill || 'none') + '" stroke="#000" stroke-width="' + (sw || 2) + '" stroke-linejoin="round"/>';
  }
  function T(txt, x, y, size, fill) {
    return '<text x="' + x + '" y="' + y + '" font-family="Arial, sans-serif" font-weight="700" font-size="' + size + '" text-anchor="middle" fill="' + (fill || '#000') + '">' + txt + '</text>';
  }
  function add(id, fn) { DRAW[id] = fn; }
  return {
    color: color, outline: outline, recolor: recolor, RECOLOR: RECOLOR, has: has, C: C, add: add,
    h: { svg: svg, P: P, F: F, L: L, Ci: Ci, E: E, R: R, T: T, eye: eye, bird: bird, wader: wader },
    ids: function () { return Object.keys(DRAW).filter(function (k) { return DRAW[k]; }).concat(Object.keys(RECOLOR)); }
  };
})();
