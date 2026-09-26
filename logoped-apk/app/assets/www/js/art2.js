'use strict';
/* Дополнительные рисунки (72×72, стиль OpenMoji): игрушки, одежда, посуда, мебель, растения, грибы, рыбы, техника. */
(function () {
  var h = ART.h, C = ART.C, svg = h.svg, P = h.P, L = h.L, Ci = h.Ci, E = h.E, R = h.R, T = h.T;
  var SKIN = C.skin, WOOD = '#C08A4A', DWOOD = '#8A5A2B', METAL = '#B8C2CC', LEAF = C.dgreen, LLEAF = C.green;

  function add(id, fn) { ART.add(id, fn); }

  /* ---------- параметрические помощники ---------- */
  function tree(o) {
    var s = '';
    s += P(o.trunkPath || 'M32 40 L40 40 L42 66 L30 66 Z', o.trunk || C.brown);
    if (o.birch) s += L(33, 48, 37, 48, 2.2) + L(36, 55, 40, 55, 2.2) + L(32, 61, 35, 61, 2.2) + L(37, 44, 39, 44, 2);
    s += o.crown;
    if (o.extra) s += o.extra;
    return svg(s);
  }
  function mushroom(o) {
    var s = '';
    s += P('M' + (36 - o.sw) + ' 38 C' + (36 - o.sw) + ' 50 ' + (36 - o.sw - 2) + ' 60 ' + (36 - o.sw - 3) + ' 64 L' + (36 + o.sw + 3) + ' 64 C' + (36 + o.sw + 2) + ' 60 ' + (36 + o.sw) + ' 50 ' + (36 + o.sw) + ' 38 Z', o.stem || '#F4EFE4');
    if (o.scales) [[33, 46], [38, 50], [34, 55], [39, 58], [35, 61], [37, 43]].forEach(function (p) { s += L(p[0], p[1], p[0] + 2, p[1] - 1, 1.6); });
    if (o.ring) s += E(36, 44, o.sw + 4, 2.4, '#F4EFE4');
    if (o.volva) s += P('M' + (36 - o.sw - 6) + ' 64 C' + (36 - o.sw - 4) + ' 57 ' + (36 + o.sw + 4) + ' 57 ' + (36 + o.sw + 6) + ' 64 Z', '#F4EFE4');
    s += P(o.cap, o.capCol);
    if (o.spots) o.spots.forEach(function (p) { s += Ci(p[0], p[1], p[2], '#FFFFFF'); });
    return svg(s);
  }
  function flowerHead(cx, cy, n, rx, ry, petal, center, cr) {
    var s = '';
    for (var i = 0; i < n; i++) s += E(cx, cy - ry, rx, ry, petal, 0).replace('<ellipse', '<ellipse transform="rotate(' + (360 / n * i) + ' ' + cx + ' ' + cy + ')"').replace(/ transform="rotate\(0 [^"]+\)"/, '');
    return s + Ci(cx, cy, cr, center);
  }
  function stem(x1, y1, x2, y2) { return P('M' + x1 + ' ' + y1 + ' Q' + ((x1 + x2) / 2 + 3) + ' ' + ((y1 + y2) / 2) + ' ' + x2 + ' ' + y2, 'none', 3, LEAF) + P('M' + x1 + ' ' + y1 + ' Q' + ((x1 + x2) / 2 + 3) + ' ' + ((y1 + y2) / 2) + ' ' + x2 + ' ' + y2, 'none', 1); }
  function leaf(cx, cy, rx, ry, rot, col) { return E(cx, cy, rx, ry, col || LLEAF, rot); }
  function pot(extra) { return P('M22 50 L50 50 L47 68 L25 68 Z', '#D9744A') + R(20, 46, 32, 6, 2, '#C2603A') + (extra || ''); }
  function fish(o) {
    var s = '';
    s += P(o.tail, o.tailCol || o.body);
    if (o.fin) s += P(o.fin, o.finCol || o.body);
    s += P(o.shape, o.body);
    if (o.belly) s += o.belly;
    if (o.spots) o.spots.forEach(function (p) { s += E(p[0], p[1], p[2], p[2] * 0.7, o.spotCol || '#FFFFFF', 0, true); });
    if (o.stripes) s += o.stripes;
    s += Ci(o.eye[0], o.eye[1], 3.2, '#FFFFFF') + Ci(o.eye[0] - 0.5, o.eye[1], 1.4, '#000', true);
    if (o.extra) s += o.extra;
    return svg(s);
  }

  /* ---------- игрушки ---------- */
  add('kukla', function () {
    return svg(P('M30 56 L30 66 L34 66 L34 56 Z', SKIN) + P('M38 56 L38 66 L42 66 L42 56 Z', SKIN) + E(31, 66, 4, 2, C.dark) + E(41, 66, 4, 2, C.dark) +
      P('M31 30 L22 42 L25 45 L33 34 Z', SKIN) + P('M41 30 L50 42 L47 45 L39 34 Z', SKIN) +
      P('M36 27 L52 58 L20 58 Z', C.red) + P('M31 29 L36 34 L41 29', 'none', 2) + Ci(36, 41, 1.4, '#fff') + Ci(36, 47, 1.4, '#fff') +
      E(22, 22, 3.5, 8, C.dorange) + E(50, 22, 3.5, 8, C.dorange) +
      Ci(36, 17, 10, SKIN) + P('M26 16 C26 6 46 6 46 16 C42 11 30 11 26 16 Z', C.dorange) +
      Ci(32, 18, 1.4, '#000', true) + Ci(40, 18, 1.4, '#000', true) + P('M33 22 Q36 25 39 22', 'none', 1.6) + E(30, 21, 2, 1.2, C.pink, 0, true) + E(42, 21, 2, 1.2, C.pink, 0, true));
  });
  add('kubik', function () {
    return svg(P('M36 10 L60 21 L36 32 L12 21 Z', C.yellow) + P('M12 21 L36 32 L36 62 L12 51 Z', C.red) + P('M36 32 L60 21 L60 51 L36 62 Z', C.blue) +
      T('А', 24, 49, 17, '#000') + T('Б', 48, 49, 17, '#000'));
  });
  add('piramidka', function () {
    var s = R(33, 10, 6, 50, 3, WOOD) + R(14, 60, 44, 7, 3, WOOD);
    var rings = [[26, 54, C.red], [23, 47, C.orange], [20, 40, C.yellow], [17, 33, C.green], [14, 26, C.blue], [11, 19, C.purple]];
    rings.forEach(function (r) { s += E(36, r[1], r[0], 4.6, r[2]); });
    return svg(s + Ci(36, 11, 5, C.red));
  });
  add('yula', function () {
    return svg(R(34, 4, 4, 14, 2, C.dark) + P('M14 34 C14 22 24 16 36 16 C48 16 58 22 58 34 C58 46 44 56 36 66 C28 56 14 46 14 34 Z', C.red) +
      P('M16 30 C28 26 44 26 56 30', 'none', 2) + P('M15 38 C28 42 44 42 57 38', 'none', 2) + P('M18 30 L54 30 L55 38 L17 38 Z', C.yellow, 0.1) +
      P('M16 30 C28 26 44 26 56 30', 'none', 2) + P('M15 38 C28 42 44 42 57 38', 'none', 2) + Ci(26, 23, 2, '#fff', true));
  });
  add('nevalyashka', function () {
    return svg(Ci(36, 46, 18, C.red) + E(36, 50, 10, 11, '#FFFFFF') + Ci(36, 47, 2.5, C.red, true) + Ci(32, 53, 2, C.yellow, true) + Ci(40, 53, 2, C.yellow, true) +
      Ci(36, 23, 12, C.red) + Ci(36, 25, 8.5, SKIN) + Ci(33, 24, 1.3, '#000', true) + Ci(39, 24, 1.3, '#000', true) + P('M33 28 Q36 30.5 39 28', 'none', 1.5) +
      E(31, 27, 1.8, 1, C.pink, 0, true) + E(41, 27, 1.8, 1, C.pink, 0, true));
  });

  /* ---------- природа, погода ---------- */
  add('luzha', function () {
    return svg(P('M8 50 C8 42 22 40 32 42 C42 38 62 40 64 48 C66 56 50 60 36 59 C22 62 8 58 8 50 Z', C.lblue) + E(28, 48, 8, 2.5, '#FFFFFF', -5, true) +
      E(46, 50, 6, 2, 'none') + E(46, 50, 10, 3.5, 'none', 0) + P('M30 14 C30 14 26 20 26 23 C26 25.5 28 27 30 27 C32 27 34 25.5 34 23 C34 20 30 14 30 14 Z', C.blue) +
      P('M48 22 C48 22 45 27 45 29 C45 31 46.3 32 48 32 C49.7 32 51 31 51 29 C51 27 48 22 48 22 Z', C.blue));
  });
  add('sosulka', function () {
    return svg(P('M6 12 L66 12 L66 20 L6 20 Z', '#FFFFFF') + P('M6 12 C20 8 52 8 66 12', 'none', 2) +
      P('M14 20 L22 20 L18 60 Z', C.lblue) + P('M28 20 L38 20 L33 44 Z', C.lblue) + P('M44 20 L52 20 L48 66 Z', C.lblue) + P('M56 20 L63 20 L59 36 Z', C.lblue) +
      L(18, 25, 18, 40, 1.5, '#fff') + L(48, 25, 48, 44, 1.5, '#fff') + P('M48 68 C48 68 46.5 70 46.5 71 C46.5 72 49.5 72 49.5 71 C49.5 70 48 68 48 68 Z', C.blue, 1));
  });
  add('ruchey', function () {
    return svg(P('M4 62 C16 54 20 44 30 40 C40 36 44 26 54 20 C60 16 64 14 68 12 L68 22 C60 26 56 30 52 36 C46 44 40 48 34 52 C26 58 20 64 14 68 L4 68 Z', C.blue) +
      P('M14 58 C20 54 24 50 28 48', 'none', 1.6, '#fff') + P('M38 40 C42 36 46 32 50 28', 'none', 1.6, '#fff') +
      E(58, 38, 5, 3.5, C.gray) + E(12, 44, 6, 4, C.lgray) + E(44, 58, 5, 3, C.gray) + E(30, 22, 4, 3, C.lgray));
  });
  add('podsnezhnik', function () {
    return svg(P('M36 66 C36 50 38 36 44 26', 'none', 3, LEAF) + P('M36 66 C36 50 38 36 44 26', 'none', 1) +
      P('M30 66 C24 56 22 44 26 32 C30 42 32 54 34 66 Z', LLEAF) + P('M40 66 C48 54 52 44 50 34 C44 44 42 54 38 66 Z', LLEAF) +
      P('M44 26 C50 26 54 30 54 36', 'none', 2) +
      P('M50 36 C44 38 44 48 50 52 C56 48 56 38 50 36 Z', '#FFFFFF') + P('M50 36 C46 40 46 48 50 52', 'none', 1.4) + P('M50 36 C54 40 54 48 50 52', 'none', 1.4) +
      E(50, 36, 2.5, 1.6, LLEAF) + P('M36 18 L40 14 M52 16 L56 12 M18 24 L22 20', 'none', 1.5, C.lblue));
  });
  add('verba', function () {
    var s = P('M20 68 C24 50 30 34 40 8', 'none', 3, DWOOD) + P('M28 42 C36 38 44 32 52 20', 'none', 2.4, DWOOD) + P('M24 54 C18 48 14 40 12 30', 'none', 2.4, DWOOD);
    [[38, 14], [35, 24], [32, 34], [45, 28], [50, 22], [14, 34], [17, 42], [27, 50]].forEach(function (p) { s += E(p[0], p[1], 3.2, 4.8, '#E6E6E6', 25) + E(p[0], p[1] + 4, 1.8, 1.4, C.brown, 25, true); });
    return svg(s);
  });
  add('bereza', function () {
    return tree({
      trunk: '#FFFFFF', birch: true, trunkPath: 'M32 30 L39 30 L41 66 L30 66 Z',
      crown: P('M36 4 C24 4 16 14 16 26 C16 36 22 42 30 42 L42 42 C50 42 56 36 56 26 C56 14 48 4 36 4 Z', '#9BD35A') +
        P('M24 20 C22 28 22 36 24 42', 'none', 1.2) + P('M48 20 C50 28 50 36 48 42', 'none', 1.2) + P('M36 10 L36 30', 'none', 1.2)
    });
  });
  add('dub', function () {
    return tree({
      trunkPath: 'M30 38 L42 38 L46 66 L26 66 Z', trunk: C.dbrown,
      crown: P('M36 6 C26 6 20 12 18 18 C10 18 6 26 8 32 C4 38 10 46 18 44 C22 48 30 48 36 44 C42 48 50 48 54 44 C62 46 68 38 64 32 C66 26 62 18 54 18 C52 12 46 6 36 6 Z', LEAF),
      extra: E(24, 30, 2.4, 3.2, C.brown) + E(46, 26, 2.4, 3.2, C.brown) + E(38, 36, 2.4, 3.2, C.brown) + P('M22.5 27.5 L25.5 27.5', 'none', 1.6) + P('M44.5 23.5 L47.5 23.5', 'none', 1.6) + P('M36.5 33.5 L39.5 33.5', 'none', 1.6)
    });
  });
  add('klen', function () {
    var crown = P('M36 4 C24 6 16 14 16 26 C16 38 26 44 36 44 C46 44 56 38 56 26 C56 14 48 6 36 4 Z', C.orange) +
      P('M26 18 L28 24 L24 26 L30 28 L28 34 L34 30 L36 36 L38 30 L44 34 L42 28 L48 26 L44 24 L46 18 L40 22 L36 14 L32 22 Z', C.dorange, 1.4);
    return tree({ trunkPath: 'M32 40 L40 40 L42 66 L30 66 Z', crown: crown });
  });
  add('sosna', function () {
    return tree({
      trunk: '#C8743A', trunkPath: 'M33 18 L39 18 L41 66 L31 66 Z',
      extra: P('M36 40 L26 32', 'none', 2.4, '#C8743A') + P('M37 30 L48 24', 'none', 2.4, '#C8743A'),
      crown: E(36, 14, 20, 8, LEAF) + E(24, 30, 10, 5, LEAF) + E(49, 22, 10, 5, LEAF) + E(36, 9, 11, 5, '#6DB33F', 0)
    });
  });
  add('lipa', function () {
    return tree({
      trunkPath: 'M32 40 L40 40 L42 66 L30 66 Z',
      crown: P('M36 4 C22 4 12 14 12 26 C12 38 22 46 36 46 C50 46 60 38 60 26 C60 14 50 4 36 4 Z', '#A4D65E') +
        P('M28 24 C26 20 21 22 23 26 C24 29 28 31 28 31 C28 31 32 29 33 26 C35 22 30 20 28 24 Z', LEAF, 1.4) + P('M44 30 C42 26 37 28 39 32 C40 35 44 37 44 37 C44 37 48 35 49 32 C51 28 46 26 44 30 Z', LEAF, 1.4)
    });
  });
  add('zholud', function () {
    return svg(P('M36 8 C38 8 40 10 40 13', 'none', 2.4) + P('M22 26 C22 16 50 16 50 26 C50 30 22 30 22 26 Z', C.dbrown) +
      P('M26 24 L28 20 M32 24 L33 19 M38 24 L38 19 M44 24 L43 20', 'none', 1.4, '#fff') +
      P('M24 28 C24 46 30 58 36 64 C42 58 48 46 48 28 Z', C.dyellow) + P('M36 64 L36 67', 'none', 2) + P('M30 34 C30 42 32 50 35 56', 'none', 1.4, '#fff'));
  });

  /* ---------- грибы и ягоды ---------- */
  add('podosinovik', function () { return mushroom({ sw: 7, stem: '#F4EFE4', scales: true, cap: 'M14 40 C12 22 24 12 36 12 C48 12 60 22 58 40 Z', capCol: C.dorange }); });
  add('podberezovik', function () { return mushroom({ sw: 6, stem: '#F4EFE4', scales: true, cap: 'M16 40 C14 24 24 14 36 14 C48 14 58 24 56 40 Z', capCol: '#8A5A2B' }); });
  add('lisichka', function () {
    return svg(P('M30 64 C31 54 32 46 30 38 L42 38 C40 46 41 54 42 64 Z', C.dyellow) +
      P('M12 24 C20 30 30 34 36 40 C42 34 52 30 60 24 C58 18 50 14 36 16 C22 14 14 18 12 24 Z', '#F4AA41') +
      P('M20 26 L32 36 M28 25 L34 37 M44 25 L38 37 M52 26 L40 36', 'none', 1.3));
  });
  add('syroezhka', function () { return mushroom({ sw: 6, stem: '#FFFFFF', cap: 'M10 38 C10 30 20 24 36 24 C52 24 62 30 62 38 C54 40 18 40 10 38 Z', capCol: '#E8537A' }); });
  add('poganka', function () { return mushroom({ sw: 4, stem: '#FFFFFF', ring: true, volva: true, cap: 'M14 38 C12 22 24 14 36 14 C48 14 60 22 58 38 Z', capCol: '#DDE8C0' }); });
  add('malina', function () {
    var s = P('M36 12 C36 18 36 20 36 22', 'none', 2.4, LEAF) + P('M36 22 C28 14 16 16 12 24 C20 26 28 26 36 22 Z', LEAF) + P('M36 22 C44 14 56 16 60 24 C52 26 44 26 36 22 Z', LEAF);
    [[30, 32], [36, 30], [42, 32], [27, 39], [33, 38], [39, 38], [45, 39], [29, 46], [35, 45], [41, 46], [32, 52], [38, 52], [35, 58]].forEach(function (p) { s += Ci(p[0], p[1], 4.4, '#E0245E'); });
    return svg(s);
  });
  function sprig(col, r, pts, leaves) {
    var s = P('M10 60 C24 48 40 36 60 14', 'none', 2.6, DWOOD);
    (leaves || [[22, 42, -40], [34, 30, -40], [48, 20, -40]]).forEach(function (l) { s += leaf(l[0] + 8, l[1] + 4, 7, 3.5, l[2], LEAF); });
    pts.forEach(function (p) { s += L(p[0], p[1] - r, p[0] + 2, p[1] - r - 4, 1.2) + Ci(p[0], p[1], r, col) + Ci(p[0] - r / 3, p[1] - r / 3, r / 4, '#fff', true); });
    return svg(s);
  }
  add('brusnika', function () { return sprig('#D22F27', 3.8, [[20, 56], [27, 52], [22, 62], [30, 58], [37, 50], [16, 50]]); });
  add('klyukva', function () { return sprig('#B3162A', 5.2, [[22, 56], [34, 50], [28, 62], [44, 44]], [[16, 44, -40], [40, 26, -40]]); });
  add('smorodina', function () {
    var s = P('M36 6 C36 12 34 18 30 22', 'none', 2.4, LEAF) + P('M36 12 C44 4 58 6 62 14 C56 20 44 20 36 12 Z', LEAF) + P('M30 22 C30 34 36 46 40 60', 'none', 1.8, DWOOD);
    [[30, 28], [33, 36], [30, 42], [36, 44], [34, 51], [39, 55], [41, 62], [27, 35]].forEach(function (p) { s += Ci(p[0], p[1], 4.6, '#2B2440') + Ci(p[0] - 1.5, p[1] - 1.5, 1.1, '#fff', true); });
    return svg(s);
  });

  /* ---------- одежда ---------- */
  add('kurtka', function () {
    return svg(P('M24 14 L30 11 C31 17 41 17 42 11 L48 14 L60 26 L55 36 L50 31 L50 62 L22 62 L22 31 L17 36 L12 26 Z', C.blue) +
      P('M29 11 C29 4 43 4 43 11', 'none', 2) + P('M29 11 C30 6 42 6 43 11', C.blue) + L(36, 16, 36, 62, 2) + R(25, 44, 8, 7, 1, C.lblue) + R(39, 44, 8, 7, 1, C.lblue) +
      L(22, 56, 50, 56, 1.5));
  });
  add('sviter', function () {
    return svg(P('M26 12 C30 16 42 16 46 12 L58 18 L64 40 L56 42 L52 28 L52 62 L20 62 L20 28 L16 42 L8 40 L14 18 Z', C.red) +
      P('M22 36 L27 31 L32 36 L37 31 L42 36 L47 31 L50 34', 'none', 2, '#fff') + P('M22 44 L27 39 L32 44 L37 39 L42 44 L47 39 L50 42', 'none', 2, '#fff') +
      P('M20 58 L52 58', 'none', 1.5) + P('M26 12 C30 18 42 18 46 12', 'none', 2));
  });
  add('bryuki', function () {
    return svg(P('M20 8 L52 8 L56 64 L41 64 L36 28 L31 64 L16 64 Z', '#35507A') + L(20, 14, 52, 14, 1.5) + L(36, 8, 36, 28, 1.5) + P('M22 18 C26 22 30 22 31 18', 'none', 1.4) + P('M50 18 C46 22 42 22 41 18', 'none', 1.4));
  });
  add('yubka', function () {
    return svg(R(24, 12, 24, 6, 2, C.purple) + P('M24 18 L48 18 L60 58 L12 58 Z', C.pink) + L(30, 18, 24, 58, 1.4) + L(36, 18, 36, 58, 1.4) + L(42, 18, 48, 58, 1.4) + P('M12 58 C24 62 48 62 60 58', 'none', 1.6));
  });
  add('varezhki', function () {
    function mit(x, flip) {
      var k = flip ? -1 : 1, s = '';
      s += P('M' + x + ' 60 L' + (x + 16 * k) + ' 60 L' + (x + 16 * k) + ' 30 C' + (x + 16 * k) + ' 18 ' + x + ' 18 ' + x + ' 30 Z', C.red);
      s += P('M' + (x + (flip ? -16 : 16)) + ' 38 C' + (x + (flip ? -24 : 24)) + ' 34 ' + (x + (flip ? -25 : 25)) + ' 44 ' + (x + (flip ? -16 : 16)) + ' 48', C.red);
      s += R(flip ? x - 17 : x - 1, 56, 18, 8, 2, '#FFFFFF');
      s += Ci(x + 8 * k, 36, 2, '#fff', true) + Ci(x + 8 * k, 44, 2, '#fff', true);
      return s;
    }
    return svg(mit(8, false) + mit(64, true));
  });
  add('valenok', function () {
    return svg(P('M22 8 L42 8 L42 44 C42 48 46 50 54 51 C62 52 64 58 62 64 L20 64 C18 56 22 50 22 44 Z', '#8E8E8E') + R(20, 6, 24, 8, 2, '#BDBDBD') + P('M20 64 L62 64', 'none', 3) + Ci(30, 30, 2, '#fff', true) + Ci(34, 40, 2, '#fff', true));
  });
  add('shapka', function () {
    return svg(Ci(36, 12, 7, '#FFFFFF') + P('M12 50 C12 30 22 18 36 18 C50 18 60 30 60 50 Z', C.blue) + R(10, 46, 52, 12, 4, '#FFFFFF') +
      P('M18 38 L24 32 L30 38 L36 32 L42 38 L48 32 L54 38', 'none', 1.8, '#fff'));
  });
  add('panama', function () {
    return svg(E(36, 48, 30, 9, C.yellow) + P('M18 46 C18 30 24 20 36 20 C48 20 54 30 54 46 Z', C.yellow) + R(18, 38, 36, 6, 1, C.orange) + P('M18 46 C28 50 44 50 54 46', 'none', 2));
  });

  /* ---------- посуда, продукты ---------- */
  add('blyudce', function () { return svg(E(36, 44, 30, 12, '#FFFFFF') + E(36, 42, 18, 6, '#F3F6FB') + P('M8 44 C20 52 52 52 64 44', 'none', 2, C.blue) + Ci(22, 46, 1.5, C.blue, true) + Ci(50, 46, 1.5, C.blue, true)); });
  add('kastryulya', function () {
    return svg(P('M12 30 L4 30 L4 36 L12 36', '#6F8FB3') + P('M60 30 L68 30 L68 36 L60 36', '#6F8FB3') + P('M12 26 L60 26 L58 60 C58 64 14 64 14 60 Z', '#8FB0D6') +
      E(36, 26, 24, 5, '#B7CCE6') + P('M30 21 C30 17 42 17 42 21 Z', C.dark) + P('M18 38 L18 54', 'none', 2, '#fff'));
  });
  add('stakan', function () { return svg(P('M18 12 L54 12 L49 64 L23 64 Z', '#E6F4FB') + P('M20.5 34 L51.5 34 L49 64 L23 64 Z', C.lblue, 0.1) + P('M18 12 L54 12 L49 64 L23 64 Z', 'none') + L(26, 18, 28, 58, 2, '#fff')); });
  add('kruzhka', function () {
    return svg(P('M50 24 C62 24 62 46 50 46', 'none', 6) + P('M50 24 C62 24 62 46 50 46', 'none', 3, C.green) + R(14, 14, 38, 50, 5, C.green) +
      P('M33 40 C29 36 24 38 26 43 C28 47 33 50 33 50 C33 50 38 47 40 43 C42 38 37 36 33 40 Z', C.red));
  });
  add('polovnik', function () { return svg(P('M50 6 C56 6 58 10 54 14 L34 44', 'none', 5) + P('M50 6 C56 6 58 10 54 14 L34 44', 'none', 2.5, METAL) + P('M12 44 L50 44 C50 58 42 66 31 66 C20 66 12 58 12 44 Z', METAL) + P('M18 50 C20 56 26 60 32 60', 'none', 1.5, '#fff')); });
  add('saharnica', function () {
    return svg(P('M12 34 C4 34 4 46 14 46', 'none', 2.2) + P('M60 34 C68 34 68 46 58 46', 'none', 2.2) + P('M14 28 L58 28 C58 50 50 62 36 62 C22 62 14 50 14 28 Z', '#FFFFFF') +
      E(36, 28, 22, 5, '#FFFFFF') + P('M30 23 C30 18 42 18 42 23', '#FFFFFF') + Ci(36, 17, 3, C.blue) + P('M20 40 C26 46 46 46 52 40', 'none', 2, C.blue) + Ci(36, 52, 2.5, C.blue, true));
  });
  add('sahar', function () {
    function cube(x, y) { return P('M' + x + ' ' + y + ' L' + (x + 12) + ' ' + (y - 6) + ' L' + (x + 24) + ' ' + y + ' L' + (x + 12) + ' ' + (y + 6) + ' Z', '#FFFFFF') + P('M' + x + ' ' + y + ' L' + (x + 12) + ' ' + (y + 6) + ' L' + (x + 12) + ' ' + (y + 20) + ' L' + x + ' ' + (y + 14) + ' Z', '#E8EDF2') + P('M' + (x + 12) + ' ' + (y + 6) + ' L' + (x + 24) + ' ' + y + ' L' + (x + 24) + ' ' + (y + 14) + ' L' + (x + 12) + ' ' + (y + 20) + ' Z', '#D3DCE5'); }
    return svg(cube(10, 40) + cube(38, 40) + cube(24, 22));
  });
  add('kolbasa', function () {
    return svg(P('M8 40 C8 28 20 22 36 22 C52 22 64 28 64 40 C64 50 52 54 36 54 C20 54 8 50 8 40 Z', '#C0504D') + E(58, 38, 6, 12, '#F4B6B2') +
      Ci(56, 34, 1.4, '#fff', true) + Ci(60, 40, 1.4, '#fff', true) + Ci(56, 44, 1.2, '#fff', true) + P('M8 40 L2 36 M8 40 L2 44', 'none', 2) + P('M20 30 C26 28 34 28 40 29', 'none', 1.5, '#fff'));
  });

  /* ---------- праздник ---------- */
  add('snegurochka', function () {
    return svg(P('M36 30 L56 66 L16 66 Z', '#5B9BD5') + P('M36 30 L36 66', 'none', 3, '#fff') + P('M16 66 L56 66', 'none', 5, '#fff') + P('M16 66 L56 66', 'none', 1) +
      P('M29 34 L22 46 L25 48 L31 38 Z', '#5B9BD5') + P('M43 34 L50 46 L47 48 L41 38 Z', '#5B9BD5') +
      P('M44 20 C50 26 50 40 46 50 C44 44 44 30 42 24 Z', C.dyellow) +
      Ci(36, 21, 9.5, SKIN) + P('M26 18 C26 8 46 8 46 18 C44 14 28 14 26 18 Z', C.dyellow) +
      P('M24 14 C24 4 48 4 48 14 C42 10 30 10 24 14 Z', '#5B9BD5') + P('M24 14 C30 11 42 11 48 14', 'none', 2.4, '#fff') + Ci(36, 7, 2, '#fff') +
      Ci(32.5, 21, 1.3, '#000', true) + Ci(39.5, 21, 1.3, '#000', true) + P('M33 25 Q36 27.5 39 25', 'none', 1.4) + E(31, 24, 1.8, 1, C.pink, 0, true) + E(41, 24, 1.8, 1, C.pink, 0, true));
  });
  add('girlyanda', function () {
    var s = P('M4 18 C16 34 26 34 36 22 C46 10 56 12 68 26', 'none', 2);
    [[10, 25, C.red], [20, 31, C.yellow], [30, 28, C.green], [40, 18, C.blue], [50, 15, C.purple], [60, 18, C.orange]].forEach(function (b) {
      s += R(b[0] - 2, b[1], 4, 4, 1, C.dark, 1.4) + E(b[0], b[1] + 10, 4.5, 7, b[2]) + E(b[0] - 1.5, b[1] + 8, 1.2, 2, '#fff', 0, true);
    });
    return svg(s);
  });
  add('gvozdika', function () {
    return svg(P('M36 68 L36 34', 'none', 3, LEAF) + P('M36 68 L36 34', 'none', 1) + P('M36 56 C30 52 24 50 18 50', 'none', 2.2, LEAF) + P('M36 50 C42 46 48 44 54 44', 'none', 2.2, LEAF) +
      P('M30 34 L42 34 L40 28 L32 28 Z', LEAF) +
      P('M22 20 L26 12 L30 17 L34 9 L38 17 L42 9 L46 17 L50 12 L52 22 C48 30 26 30 22 20 Z', '#D22F27') + P('M26 20 L30 16 L34 21 L38 15 L42 21 L46 16', 'none', 1.3));
  });

  /* ---------- мебель ---------- */
  add('stol', function () { return svg(P('M6 26 L66 26 L62 34 L10 34 Z', WOOD) + R(12, 34, 6, 30, 1, DWOOD) + R(54, 34, 6, 30, 1, DWOOD) + R(24, 34, 4, 22, 1, WOOD) + R(44, 34, 4, 22, 1, WOOD)); });
  add('shkaf', function () {
    return svg(R(14, 10, 44, 52, 2, WOOD) + R(12, 6, 48, 6, 1, DWOOD) + L(36, 12, 36, 60, 2) + R(16, 62, 5, 5, 1, DWOOD) + R(51, 62, 5, 5, 1, DWOOD) +
      R(31, 32, 3, 8, 1.5, C.dark) + R(38, 32, 3, 8, 1.5, C.dark));
  });
  add('taburet', function () { return svg(P('M22 34 L18 66', 'none', 5, DWOOD) + P('M50 34 L54 66', 'none', 5, DWOOD) + P('M36 34 L36 62', 'none', 5, DWOOD) + P('M22 34 L18 66 M50 34 L54 66 M36 34 L36 62', 'none', 1) + L(22, 52, 50, 52, 3, DWOOD) + E(36, 30, 22, 7, WOOD)); });
  add('polka', function () {
    return svg(R(8, 44, 56, 6, 1, WOOD) + P('M14 50 L14 58 L20 50', WOOD) + P('M58 50 L58 58 L52 50', WOOD) +
      R(12, 20, 7, 24, 1, C.red) + R(19, 16, 8, 28, 1, C.blue) + R(27, 22, 6, 22, 1, C.green) + R(33, 18, 8, 26, 1, C.yellow) + P('M42 44 L50 22 L56 24 L48 44 Z', C.purple));
  });
  add('tumbochka', function () {
    return svg(R(14, 20, 44, 42, 2, WOOD) + R(12, 16, 48, 5, 1, DWOOD) + L(14, 34, 58, 34, 2) + R(33, 25, 6, 3, 1.5, C.dark) + R(46, 44, 3, 8, 1.5, C.dark) + R(16, 62, 5, 5, 1, DWOOD) + R(51, 62, 5, 5, 1, DWOOD));
  });

  /* ---------- животные ---------- */
  add('morzh', function () {
    return svg(P('M10 60 C8 44 18 30 34 28 C48 26 60 34 62 48 C64 58 58 64 46 64 L20 64 C14 64 10 62 10 60 Z', '#A87A5A') +
      P('M16 62 C12 66 6 66 4 62 C8 60 12 58 16 58 Z', '#8A5E44') + P('M56 62 C60 66 66 66 68 62 C64 60 60 58 56 58 Z', '#8A5E44') +
      Ci(34, 26, 13, '#A87A5A') + E(30, 32, 6, 4, '#C49A78') + E(38, 32, 6, 4, '#C49A78') +
      P('M29 34 L27 50 L31 35 Z', '#FFFFFF') + P('M39 34 L41 50 L37 35 Z', '#FFFFFF') + Ci(29, 22, 1.6, '#000', true) + Ci(39, 22, 1.6, '#000', true) +
      L(24, 32, 18, 31, 1) + L(24, 34, 18, 35, 1) + L(44, 32, 50, 31, 1) + L(44, 34, 50, 35, 1));
  });

  /* ---------- инструменты, техника ---------- */
  add('grabli', function () {
    var s = P('M36 4 L36 50', 'none', 4, WOOD) + P('M36 4 L36 50', 'none', 1) + R(10, 48, 52, 5, 1, METAL);
    for (var x = 13; x <= 59; x += 6.5) s += L(x, 53, x, 64, 2.4);
    return svg(s);
  });
  add('tank', function () {
    return svg(R(8, 46, 56, 14, 7, C.dark) + Ci(16, 53, 4, C.gray) + Ci(26, 53, 4, C.gray) + Ci(36, 53, 4, C.gray) + Ci(46, 53, 4, C.gray) + Ci(56, 53, 4, C.gray) +
      P('M10 46 L14 36 L58 36 L62 46 Z', '#5C7A3E') + P('M24 36 C24 26 44 26 46 36 Z', '#6E8F4A') + R(44, 28, 22, 4, 2, '#5C7A3E') +
      P('M32 29 L33.2 32 L36.4 32 L33.8 33.9 L34.8 37 L32 35.1 L29.2 37 L30.2 33.9 L27.6 32 L30.8 32 Z', C.red, 1));
  });
  add('podlodka', function () {
    return svg(P('M2 50 C12 46 20 48 30 46 C40 44 50 48 60 46 C64 45 68 46 70 47', 'none', 1.5, C.blue) +
      P('M6 44 C6 36 16 32 36 32 C56 32 66 36 66 44 C66 52 56 56 36 56 C16 56 6 52 6 44 Z', '#6B7F95') + P('M28 32 L30 20 L44 20 L46 32 Z', '#56697E') +
      P('M40 20 L40 10 L46 10', 'none', 2) + Ci(22, 44, 3, C.lblue) + Ci(36, 44, 3, C.lblue) + Ci(50, 44, 3, C.lblue) + P('M66 40 L70 36 L70 52 L66 48', '#56697E'));
  });
  add('binokl', function () {
    return svg(R(12, 22, 18, 36, 6, C.dark) + R(42, 22, 18, 36, 6, C.dark) + R(29, 30, 14, 10, 3, '#555') + E(21, 56, 8, 4, C.lblue) + E(51, 56, 8, 4, C.lblue) +
      R(14, 16, 14, 8, 3, '#555') + R(44, 16, 14, 8, 3, '#555'));
  });
  add('holodilnik', function () {
    return svg(R(16, 4, 40, 64, 5, '#F2F5F8') + L(16, 26, 56, 26, 2) + R(48, 10, 3, 10, 1.5, METAL) + R(48, 32, 3, 16, 1.5, METAL) + R(20, 66, 6, 4, 1, C.dark) + R(46, 66, 6, 4, 1, C.dark));
  });
  add('pylesos', function () {
    return svg(P('M40 46 C52 42 58 32 56 20 C55 14 50 10 44 10 L28 10', 'none', 4, C.dark) + P('M28 10 L14 56', 'none', 3, METAL) + P('M28 10 L14 56', 'none', 1) +
      R(4, 56, 22, 7, 3, C.dark) + P('M34 64 C30 64 28 58 32 52 C38 44 60 44 64 52 C68 58 64 64 60 64 Z', C.blue) + Ci(38, 64, 4, C.dark) + Ci(60, 64, 4, C.dark) + R(46, 48, 10, 4, 2, C.lblue));
  });
  add('utyug', function () {
    return svg(P('M40 56 C40 60 42 62 46 62', 'none', 2) + P('M6 48 C12 30 28 24 58 24 L62 48 Z', '#9EB6CE') + P('M4 48 L64 48 L64 54 L4 54 Z', METAL) +
      P('M30 24 C30 14 56 14 56 24', 'none', 5) + P('M30 24 C30 14 56 14 56 24', 'none', 2.4, C.red) + Ci(22, 38, 3, C.red) + P('M64 51 C68 51 70 56 70 62', 'none', 1.8));
  });
  add('fen', function () {
    return svg(P('M34 38 L42 38 L46 64 L36 64 Z', C.pink) + P('M20 20 L50 18 C58 18 62 22 62 28 C62 34 58 38 50 38 L20 36 Z', C.pink) + R(10, 20, 12, 16, 3, '#E67A94') +
      Ci(50, 28, 5, '#fff') + P('M2 22 L8 23 M1 28 L8 28 M2 34 L8 33', 'none', 1.8, C.blue));
  });
  add('lampa', function () {
    return svg(P('M22 10 L50 10 L58 32 L14 32 Z', C.yellow) + L(36, 32, 36, 56, 3) + E(36, 60, 16, 5, C.dark) + L(40, 36, 40, 44, 1.5) + Ci(40, 45, 1.6, C.dark, true));
  });
  add('mikrovolnovka', function () {
    return svg(R(6, 14, 60, 42, 4, '#E8ECF0') + R(12, 20, 36, 30, 3, C.dark) + E(26, 35, 8, 4, '#FFE08A') + R(52, 20, 10, 10, 2, '#fff') + Ci(57, 38, 3, '#fff') + Ci(57, 46, 3, '#fff') + R(10, 56, 6, 4, 1, C.dark) + R(56, 56, 6, 4, 1, C.dark));
  });
  add('leyka', function () {
    return svg(P('M44 36 L64 18 L66 22 L48 42', C.green) + R(62, 14, 8, 6, 2, C.green) + P('M20 28 C20 20 28 16 32 22', 'none', 3) +
      P('M12 30 L48 30 L46 64 L14 64 Z', C.green) + E(30, 30, 18, 4, '#7FB069') + Ci(66, 26, 1.4, C.blue, true) + Ci(68, 30, 1.4, C.blue, true) + Ci(64, 31, 1.4, C.blue, true));
  });
  add('gorshok', function () { return svg(P('M16 26 L56 26 L50 64 L22 64 Z', '#D9744A') + R(12, 20, 48, 8, 2, '#C2603A') + E(36, 24, 20, 3, C.dbrown) + P('M36 22 C36 14 40 10 46 8', 'none', 2.4, LEAF) + leaf(44, 11, 5, 2.5, -30, LLEAF)); });
  add('fialka', function () {
    var s = leaf(24, 44, 10, 6, 20, LEAF) + leaf(48, 44, 10, 6, -20, LEAF) + leaf(36, 40, 7, 9, 0, LEAF);
    [[28, 28], [44, 28], [36, 20]].forEach(function (p) { s += flowerHead(p[0], p[1], 5, 3.5, 4.5, '#8E5BC0', C.yellow, 2); });
    return svg(s + pot());
  });
  add('aloe', function () {
    var s = '';
    [[-35, 22], [-18, 14], [0, 10], [18, 14], [35, 22]].forEach(function (a) { s += '<g transform="rotate(' + a[0] + ' 36 50)">' + P('M32 50 L36 ' + a[1] + ' L40 50 Z', '#5FA86B') + '</g>'; });
    return svg(s + pot());
  });
  add('geran', function () {
    var s = leaf(22, 42, 9, 7, 0, LEAF) + leaf(50, 42, 9, 7, 0, LEAF) + leaf(36, 38, 8, 7, 0, LEAF) + P('M36 38 L36 20', 'none', 2, LEAF);
    [[31, 16], [36, 12], [41, 16], [34, 20], [39, 20], [36, 16]].forEach(function (p) { s += Ci(p[0], p[1], 3.6, C.red); });
    return svg(s + pot());
  });
  add('shchuka', function () {
    return fish({ body: '#7FA36B', shape: 'M4 36 C10 30 20 28 40 28 C54 28 60 32 62 36 C60 40 54 44 40 44 C20 44 10 42 4 36 Z',
      tail: 'M60 36 L70 26 L68 36 L70 46 Z', fin: 'M36 28 L44 22 L48 28 Z', eye: [13, 33], spots: [[24, 34, 2.2], [32, 38, 2], [42, 33, 2.2], [50, 38, 1.8], [30, 31, 1.6]], spotCol: '#E6EFC8',
      extra: P('M4 36 L10 37', 'none', 1.4) });
  });
  add('som', function () {
    return fish({ body: '#5C5A52', shape: 'M6 38 C6 30 16 26 30 28 C46 30 56 32 62 36 C56 42 44 46 30 46 C16 48 6 44 6 38 Z', tail: 'M60 36 L70 30 L70 44 Z',
      fin: 'M30 28 L36 22 L40 29 Z', eye: [14, 34], belly: P('M10 42 C20 46 40 46 56 40', 'none', 1.4, '#fff'),
      extra: P('M7 38 C2 42 2 48 4 52', 'none', 1.6) + P('M9 40 C6 46 8 50 10 54', 'none', 1.6) });
  });
  add('karas', function () {
    return fish({ body: '#D9A441', shape: 'M10 36 C10 22 24 16 38 18 C50 20 56 28 56 36 C56 44 50 52 38 54 C24 56 10 50 10 36 Z', tail: 'M54 36 L68 24 L66 36 L68 48 Z',
      fin: 'M30 18 L38 10 L44 20 Z', eye: [20, 32], stripes: P('M30 24 C28 30 28 42 30 48', 'none', 1.2) + P('M38 22 C36 30 36 42 38 50', 'none', 1.2) });
  });
  add('morzv', function () {
    var pts = [];
    for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 11 : 30; pts.push((36 + r * Math.cos(a)).toFixed(1) + ' ' + (38 + r * Math.sin(a)).toFixed(1)); }
    var s = P('M' + pts.join(' L') + ' Z', C.dorange);
    [[36, 20], [36, 28], [52, 34], [44, 37], [46, 52], [41, 45], [26, 52], [31, 45], [20, 34], [28, 37], [36, 38]].forEach(function (p) { s += Ci(p[0], p[1], 1.6, C.yellow, true); });
    return svg(s);
  });
  add('lunohod', function () {
    var s = P('M14 22 L58 22 L50 14 L22 14 Z', C.lblue) + R(12, 22, 48, 20, 3, '#C9CED6') + L(46, 22, 52, 6, 2) + Ci(52, 6, 3, C.red);
    [14, 25, 36, 47, 58].forEach(function (x) { s += Ci(x, 52, 6, C.dark) + Ci(x, 52, 2, METAL, true); });
    return svg(s + R(10, 40, 52, 6, 2, '#9AA3AE'));
  });
  add('muka', function () {
    return svg(P('M18 20 C14 30 12 50 16 64 L56 64 C60 50 58 30 54 20 Z', '#F3EAD7') + P('M18 20 C24 14 30 18 36 14 C42 18 48 14 54 20', 'none', 2) + P('M24 14 L30 20 M42 20 L48 14', 'none', 1.6) +
      T('МУКА', 36, 58, 9, '#000') + P('M36 50 L36 28', 'none', 2, C.dyellow) + E(32, 34, 2, 4, C.dyellow, -30) + E(40, 34, 2, 4, C.dyellow, 30) + E(32, 42, 2, 4, C.dyellow, -30) + E(40, 42, 2, 4, C.dyellow, 30) + E(36, 27, 2, 4, C.dyellow));
  });
  add('kombain', function () {
    return svg(R(4, 44, 22, 10, 2, C.yellow) + L(6, 44, 6, 54, 1.4) + L(10, 44, 10, 54, 1.4) + L(14, 44, 14, 54, 1.4) + L(18, 44, 18, 54, 1.4) + L(22, 44, 22, 54, 1.4) +
      R(24, 28, 40, 26, 3, C.red) + R(30, 16, 16, 14, 2, C.lblue) + R(52, 18, 6, 12, 1, C.red) + Ci(34, 58, 8, C.dark) + Ci(34, 58, 3, METAL) + Ci(58, 60, 6, C.dark) + Ci(58, 60, 2, METAL));
  });
  add('melnica', function () {
    var s = P('M26 66 L30 30 L42 30 L46 66 Z', '#E8D8B8') + P('M26 30 L36 20 L46 30 Z', C.dred) + R(33, 52, 6, 14, 1, C.dbrown) + Ci(36, 40, 2.6, C.dark);
    [0, 90, 180, 270].forEach(function (a) { s += '<g transform="rotate(' + (a + 20) + ' 36 26)">' + P('M34 26 L34 2 L42 4 L40 26 Z', '#F4EFE4') + L(36, 24, 36, 4, 1) + '</g>'; });
    return svg(s + Ci(36, 26, 3, C.dark));
  });
  add('strekoza', function () {
    return svg(E(22, 24, 13, 5, '#D8F0FB', -20) + E(22, 34, 13, 5, '#D8F0FB', 20) + E(50, 24, 13, 5, '#D8F0FB', 20) + E(50, 34, 13, 5, '#D8F0FB', -20) +
      P('M34 28 L38 28 L37.5 66 L34.5 66 Z', '#2E86AB') + E(36, 26, 5, 6, '#2E86AB') + Ci(33, 17, 4, C.green) + Ci(39, 17, 4, C.green) + Ci(33, 16, 1.4, '#000', true) + Ci(39, 16, 1.4, '#000', true));
  });
  add('uley', function () {
    return svg(P('M8 24 L36 8 L64 24 Z', C.dred) + R(12, 24, 48, 40, 2, C.yellow) + L(12, 36, 60, 36, 1.6) + L(12, 48, 60, 48, 1.6) + E(36, 56, 6, 3, C.dark) +
      E(56, 14, 4, 3, C.yellow) + L(54, 12, 54, 16, 1.3) + L(57, 11.5, 57, 16.5, 1.3) + E(56, 11, 3, 2, '#fff', -20));
  });
  add('muraveynik', function () {
    var s = P('M6 64 C12 40 24 22 36 20 C48 22 60 40 66 64 Z', '#A0703F');
    [[26, 40], [40, 32], [46, 48], [30, 54], [20, 58], [52, 58], [36, 44]].forEach(function (p) { s += L(p[0], p[1], p[0] + 4, p[1] - 2, 1.4, '#6A462F'); });
    [[16, 66], [58, 66], [36, 12]].forEach(function (p) { s += Ci(p[0], p[1] - 3, 1.8, C.dark, true) + Ci(p[0] + 3, p[1] - 3, 1.6, C.dark, true) + Ci(p[0] + 6, p[1] - 3, 1.8, C.dark, true); });
    return svg(s);
  });

  /* ---------- цветы ---------- */
  add('romashka', function () { return svg(stem(36, 66, 36, 34) + leaf(28, 54, 7, 2.6, 30) + leaf(44, 48, 7, 2.6, -30) + flowerHead(36, 26, 12, 3.6, 10, '#FFFFFF', C.yellow, 7)); });
  add('kolokolchik', function () {
    var s = P('M36 68 C36 50 38 30 34 10', 'none', 3, LEAF) + P('M36 68 C36 50 38 30 34 10', 'none', 1) + leaf(28, 58, 7, 2.6, 30);
    [[34, 12, 0], [44, 30, 15], [26, 40, -10]].forEach(function (b) {
      s += '<g transform="rotate(' + b[2] + ' ' + b[0] + ' ' + b[1] + ')">' + P('M' + b[0] + ' ' + b[1] + ' L' + b[0] + ' ' + (b[1] + 3), 'none', 1.6) +
        P('M' + (b[0] - 7) + ' ' + (b[1] + 16) + ' C' + (b[0] - 7) + ' ' + (b[1] + 6) + ' ' + (b[0] + 7) + ' ' + (b[1] + 6) + ' ' + (b[0] + 7) + ' ' + (b[1] + 16) + ' L' + (b[0] + 9) + ' ' + (b[1] + 19) + ' L' + (b[0] + 4) + ' ' + (b[1] + 17) + ' L' + b[0] + ' ' + (b[1] + 20) + ' L' + (b[0] - 4) + ' ' + (b[1] + 17) + ' L' + (b[0] - 9) + ' ' + (b[1] + 19) + ' Z', '#7FA7E0') + '</g>';
    });
    return svg(s);
  });
  add('vasilek', function () {
    var s = stem(36, 66, 36, 34) + leaf(28, 54, 8, 2, 30) + leaf(45, 50, 8, 2, -30);
    for (var i = 0; i < 8; i++) s += '<g transform="rotate(' + (i * 45) + ' 36 26)">' + P('M33 24 L36 8 L39 24 Z', '#3B6FD4') + P('M34 12 L36 8 L38 12', 'none', 1) + '</g>';
    return svg(s + Ci(36, 26, 5, '#5E3FA3'));
  });
  add('oduvanchik', function () {
    var s = stem(26, 66, 26, 36) + P('M20 66 C12 60 10 52 12 46 L16 50 L16 44 L20 50 L22 44 C24 52 24 60 22 66 Z', LEAF);
    s += flowerHead(26, 28, 16, 2.4, 8, C.yellow, C.dyellow, 4);
    s += P('M50 66 L50 40', 'none', 3, LEAF) + P('M50 66 L50 40', 'none', 1) + Ci(50, 30, 11, '#FFFFFF') + Ci(50, 30, 2.5, C.lgray, true);
    for (var i = 0; i < 10; i++) { var a = i * 36 * Math.PI / 180; s += L(50, 30, (50 + 10 * Math.cos(a)).toFixed(1), (30 + 10 * Math.sin(a)).toFixed(1), 1, C.gray); }
    return svg(s);
  });
  add('landysh', function () {
    var s = P('M20 66 C18 50 22 30 30 18', LEAF) + P('M20 66 C30 54 30 36 24 20 C16 36 16 54 20 66 Z', LLEAF) + P('M44 66 C54 52 54 36 46 22 C38 36 38 54 44 66 Z', LLEAF);
    s += P('M34 66 C34 44 40 24 56 16', 'none', 2.4, LEAF);
    [[40, 32], [44, 26], [49, 21], [54, 18], [37, 40]].forEach(function (b) { s += L(b[0], b[1], b[0] + 2, b[1] + 3, 1.2) + P('M' + (b[0] - 2) + ' ' + (b[1] + 8) + ' C' + (b[0] - 2) + ' ' + (b[1] + 2) + ' ' + (b[0] + 6) + ' ' + (b[1] + 2) + ' ' + (b[0] + 6) + ' ' + (b[1] + 8) + ' L' + (b[0] + 4) + ' ' + (b[1] + 7) + ' L' + (b[0] + 2) + ' ' + (b[1] + 9) + ' L' + b[0] + ' ' + (b[1] + 7) + ' Z', '#FFFFFF'); });
    return svg(s);
  });

  /* ---------- школа, музыка ---------- */
  add('penal', function () {
    return svg(P('M26 18 L30 4 L34 18 Z', C.yellow) + P('M36 18 L40 8 L44 18 Z', C.red) + R(8, 18, 56, 34, 10, C.blue) + L(14, 26, 58, 26, 1.6) + Ci(56, 26, 2.4, METAL) +
      P('M18 34 L54 34', 'none', 1.4, '#fff') + P('M18 40 L46 40', 'none', 1.4, '#fff'));
  });
  add('lastik', function () { return svg(P('M8 40 L40 16 L64 30 L32 56 Z', C.pink) + P('M8 40 L32 56 L32 62 L8 46 Z', '#E67A94') + P('M32 56 L64 30 L64 36 L32 62 Z', '#D46A85') + P('M24 28 L48 43', 'none', 1.5, '#fff') + P('M8 40 L20 31 L44 46 L32 56 Z', C.lblue)); });
  add('kley', function () { return svg(R(24, 6, 24, 12, 3, C.red) + R(22, 18, 28, 46, 4, '#FFFFFF') + R(22, 30, 28, 20, 0, C.yellow) + T('КЛЕЙ', 36, 44, 7.5, '#000') + L(26, 22, 26, 60, 1.6)); });
  add('balalayka', function () {
    return svg(R(33, 2, 6, 34, 2, DWOOD) + L(31, 6, 28, 5, 2) + L(41, 6, 44, 5, 2) + L(31, 12, 28, 11, 2) +
      P('M36 30 L64 64 L8 64 Z', '#E6A24A') + Ci(36, 50, 5, C.dark) + L(34.5, 4, 32, 60, 0.8) + L(36, 4, 36, 60, 0.8) + L(37.5, 4, 40, 60, 0.8) + R(26, 56, 20, 3, 1, C.dark));
  });
  add('buben', function () {
    var s = Ci(36, 36, 28, '#E6A24A') + Ci(36, 36, 22, '#F6E7C8');
    for (var i = 0; i < 6; i++) { var a = i * 60 * Math.PI / 180; s += E((36 + 25 * Math.cos(a)).toFixed(1), (36 + 25 * Math.sin(a)).toFixed(1), 4.5, 3, '#FCEA2B'); }
    return svg(s + P('M26 30 C30 26 42 26 46 30', 'none', 1.5, C.red) + P('M24 38 C30 44 42 44 48 38', 'none', 1.5, C.red));
  });
})();
