'use strict';
/*
 * Генераторы заданий рабочего листа. Каждое задание строится ТОЛЬКО из слов выбранной
 * лексической темы (или парных тем для классификации), а картинка рисуется из тех же слов,
 * которые названы в тексте задания — поэтому текст, картинка и тема всегда совпадают.
 */
var TASKS = (function () {
  var W = 1600;
  var INK = '#1d1f2e', MUTED = '#6b6f8a', FRAME = '#c9cce0', ACCENT = '#4338CA';

  function E(w) { return typeof w === 'string' ? DB.word(w) : w; }
  function withPic(list) { return list.map(E).filter(function (e) { return e && IMG.hasPicture(e); }); }
  function single(e) { return e.w.indexOf(' ') < 0; }
  function cap(s) { return U.cap(s); }
  function soundName(id) { return PH.BY_ID[id] ? PH.BY_ID[id].name : '[' + id + ']'; }

  function themeWords(th) { return th ? withPic(th.words) : []; }
  function contrastWords(th, exclude) {
    var out = [];
    (th.contrast || []).forEach(function (id) {
      var ct = DB.byId[id];
      if (!ct) return;
      themeWords(ct).forEach(function (e) {
        if (exclude.indexOf(e.w) < 0 && th.words.indexOf(e.w) < 0 && (th.extra || []).indexOf(e.w) < 0) out.push({ e: e, theme: ct });
      });
    });
    return out;
  }

  /** Подпись под картинкой */
  function caption(g, e, x, y, w, L, size) {
    if (!L.captions) return;
    IMG.text(g, e.w, x + w / 2, y, size || 34, { align: 'center', color: MUTED, maxWidth: w - 8 });
  }

  function header(g, n, str) {
    // номер-кружок не рисуем на картинке — он в тексте документа; оставлено для совместимости
  }

  /* ---------- общие раскладки ---------- */

  /** Сетка картинок с подписями */
  function drawGrid(L, items, cols, o) {
    o = o || {};
    var rows = Math.ceil(items.length / cols);
    var cw = W / cols, pic = Math.min(cw * 0.72, o.pic || 300);
    var rh = pic + (L.captions ? 70 : 30) + (o.extraH || 0);
    var H = rows * rh + 30;
    return {
      h: H,
      draw: function (cv) {
        var g = cv.getContext('2d');
        return Promise.all(items.map(function (it) { return IMG.word(it.e || it, o.variant || 'c'); })).then(function (ims) {
          items.forEach(function (it, i) {
            var e = it.e || it;
            var r = Math.floor(i / cols), c = i % cols;
            var x = c * cw, y = 15 + r * rh;
            IMG.roundRect(g, x + 12, y, cw - 24, rh - 14, 28, FRAME, '#fff', null, 3);
            var io = DB.imageOf(e);
            IMG.draw(g, ims[i], x + (cw - pic) / 2, y + 12, pic, pic, { scale: io && io.small ? 0.72 : 1, label: e.w, silhouette: o.silhouette });
            caption(g, e, x, y + pic + 52, cw, L);
            if (o.cell) o.cell(g, it, x, y + pic + (L.captions ? 62 : 22), cw, i);
          });
        });
      }
    };
  }

  /** «Соедини линией»: левая колонка — правая колонка (перемешана) */
  function drawConnect(L, left, right, o) {
    o = o || {};
    var n = Math.max(left.length, right.length);
    var pic = o.pic || 170, rh = pic + (L.captions ? 56 : 24);
    var H = n * rh + 30;
    return {
      h: H,
      draw: function (cv) {
        var g = cv.getContext('2d');
        var all = left.concat(right);
        return Promise.all(all.map(function (it) { return IMG.word(it.e, it.variant || 'c'); })).then(function (ims) {
          function col(list, offset, xPic, xDot, side) {
            var top = 15 + (n - list.length) * rh / 2;
            list.forEach(function (it, i) {
              var y = top + i * rh;
              IMG.roundRect(g, xPic - 14, y, pic + 28, rh - 12, 24, FRAME, '#fff', null, 3);
              var io = DB.imageOf(it.e);
              var sc = it.scale || (io && io.small ? 0.7 : 1);
              IMG.draw(g, ims[offset + i], xPic, y + 8, pic, pic, { scale: sc, silhouette: it.sil, label: it.e.w });
              if (!it.noCap) caption(g, it.e, xPic - 14, y + pic + 40, pic + 28, L, 30);
              IMG.circle(g, xDot, y + (rh - 12) / 2, 13, INK, '#fff', 4);
            });
          }
          col(left, 0, 70, 330, 'l');
          col(right, left.length, W - 70 - pic, W - 330, 'r');
          if (o.middle) o.middle(g, H);
        });
      }
    };
  }

  /* ---------- генераторы ---------- */
  var G = {};

  G.name = function (L) {
    var n = L.age === '4' ? 6 : 8;
    var items = L.words.slice(0, n);
    if (items.length < 4) return null;
    var cols = items.length <= 6 ? 3 : 4;
    var lay = drawGrid(L, items, cols, { pic: cols === 3 ? 300 : 280 });
    var a = items[0], b = items[Math.min(2, items.length - 1)];
    return {
      type: 'name', title: 'Назови и покажи', area: 'Словарь',
      goal: 'активизировать предметный словарь по теме, закрепить обобщающее понятие «' + L.theme.cat[1] + '»',
      instr: 'Рассмотри картинки. Назови каждую. Покажи, где ' + a.w + ', а где ' + b.w + '. Как можно назвать их одним словом?',
      note: U.cap(items.map(function (e) { return e.w; }).join(', ')) + ' — это ' + L.theme.cat[1] + '.',
      words: items, h: lay.h, draw: lay.draw,
      play: { name: 'Назови картинку', lines: [['Логопед', 'Посмотрите на картинки. Назовите, кого (что) вы видите.'], ['Дети', U.cap(items.map(function (e) { return e.w; }).join(', ')) + '.'], ['Логопед', 'Как назвать их одним словом?'], ['Дети', U.cap(L.theme.cat[1]) + '.']] }
    };
  };

  G.odd = function (L) {
    var base = L.words.filter(function (e) { return !e.of; });
    var others = contrastWords(L.theme, base.map(function (e) { return e.w; }));
    if (base.length < 3 || !others.length) return null;
    var rowsN = L.age === '4' ? 1 : 2;
    var rows = [], used = {};
    var extras = U.shuffle(others, L.rnd);
    for (var r = 0; r < rowsN && r < extras.length; r++) {
      var three = U.sample(base.filter(function (e) { return !used[e.w] || base.length < 6; }), 3, L.rnd);
      three.forEach(function (e) { used[e.w] = 1; });
      var odd = extras[r];
      var pos = Math.floor(L.rnd() * 4);
      var row = three.slice(); row.splice(pos, 0, odd.e);
      rows.push({ row: row, odd: odd });
    }
    var pic = 250, rh = pic + (L.captions ? 76 : 40);
    var H = rows.length * rh + 30;
    return {
      type: 'odd', title: 'Четвёртый лишний', area: 'Классификация',
      goal: 'учить классифицировать предметы, употреблять обобщающие слова, развивать логическое мышление',
      instr: 'Назови картинки. Какая картинка лишняя? Зачеркни её и объясни почему.',
      note: rows.map(function (r) { return DB.extraAdj(r.odd.e.g) + ' ' + r.odd.e.w + ': это ' + r.odd.theme.cat[0] + ', а остальные — ' + L.theme.cat[1] + '.'; }).join(' '),
      words: base, h: H,
      draw: function (cv) {
        var g = cv.getContext('2d');
        var flat = [];
        rows.forEach(function (r) { flat = flat.concat(r.row); });
        return Promise.all(flat.map(function (e) { return IMG.word(e, 'c'); })).then(function (ims) {
          rows.forEach(function (r, ri) {
            var y = 15 + ri * rh;
            IMG.roundRect(g, 20, y, W - 40, rh - 16, 30, FRAME, '#fff', null, 3);
            r.row.forEach(function (e, i) {
              var x = 40 + i * ((W - 80) / 4);
              var cw = (W - 80) / 4;
              IMG.draw(g, ims[ri * 4 + i], x + (cw - pic) / 2, y + 10, pic, pic, { label: e.w, scale: DB.imageOf(e).small ? 0.75 : 1 });
              caption(g, e, x, y + pic + 50, cw, L);
            });
          });
        });
      },
      play: { name: 'Четвёртый лишний', lines: rows.map(function (r) {
        return ['Логопед', 'Послушайте и скажите, кто (что) лишний: ' + r.row.map(function (e) { return e.w; }).join(', ') + '.'];
      }).concat(rows.map(function (r) { return ['Дети', DB.extraAdj(r.odd.e.g) + ' ' + r.odd.e.w + ', потому что это ' + r.odd.theme.cat[0] + ', а остальные — ' + L.theme.cat[1] + '.']; })) }
    };
  };

  G.many = function (L) {
    var list = L.words.filter(function (e) { return !e.noCount && e.pl && e.gp; });
    var n = L.age === '4' ? 3 : 4;
    if (list.length < 3) return null;
    var items = list.slice(0, n);
    var rh = 230;
    var H = items.length * rh + 20;
    return {
      type: 'many', title: 'Один — много', area: 'Грамматика',
      goal: 'упражнять в образовании существительных множественного числа в именительном и родительном падежах',
      instr: 'Назови: ' + (items[0].anim ? 'один — много' : 'один предмет — много предметов') + '. Образец: «' + items[0].w + ' — ' + items[0].pl + ' — много ' + items[0].gp + '».',
      note: items.map(function (e) { return e.w + ' — ' + e.pl + ' — много ' + e.gp; }).join('; ') + '.',
      words: items, h: H,
      draw: function (cv) {
        var g = cv.getContext('2d');
        return Promise.all(items.map(function (e) { return IMG.word(e, 'c'); })).then(function (ims) {
          items.forEach(function (e, i) {
            var y = 10 + i * rh;
            var sm = DB.imageOf(e).small ? 0.75 : 1;
            IMG.roundRect(g, 20, y, 300, rh - 20, 26, FRAME, '#fff', null, 3);
            IMG.draw(g, ims[i], 50, y + 8, 240, 160, { scale: sm, label: e.w });
            caption(g, e, 20, y + rh - 32, 300, L, 30);
            // стрелка
            IMG.line(g, 360, y + rh / 2 - 10, 470, y + rh / 2 - 10, 6, ACCENT);
            IMG.line(g, 470, y + rh / 2 - 10, 445, y + rh / 2 - 30, 6, ACCENT);
            IMG.line(g, 470, y + rh / 2 - 10, 445, y + rh / 2 + 10, 6, ACCENT);
            IMG.roundRect(g, 510, y, 620, rh - 20, 26, FRAME, '#fff', null, 3);
            for (var k = 0; k < 4; k++) IMG.draw(g, ims[i], 530 + k * 145, y + 18 + (k % 2) * 16, 150, 140, { scale: sm });
            if (L.captions) IMG.text(g, e.pl, 820, y + rh - 32, 30, { align: 'center', color: MUTED });
            IMG.roundRect(g, 1170, y, 410, rh - 20, 26, FRAME, '#f7f7fc', [12, 10], 3);
            IMG.text(g, 'много…', 1375, y + rh / 2 + 2, 40, { align: 'center', color: MUTED, italic: true });
          });
        });
      },
      play: { name: 'Один — много', lines: [['Логопед', 'Я назову один предмет, а вы — много. ' + items.map(function (e) { return cap(e.w) + '…'; }).join(' ')], ['Дети', items.map(function (e) { return cap(e.pl) + '. Много ' + e.gp + '.'; }).join(' ')]] }
    };
  };

  G.count = function (L) {
    var list = L.words.filter(function (e) { return !e.noCount && e.gs && e.gp; });
    if (list.length < 2) return null;
    var items = list.slice(0, 4);
    while (items.length < 4 && list.length) items.push(list[items.length % list.length]);
    var nums = U.shuffle([2, 3, 4, 5], L.rnd);
    if (L.age === '4') nums = U.shuffle([1, 2, 3, 4], L.rnd);
    var cw = W / 2, ch = 430;
    var H = 2 * ch + 20;
    return {
      type: 'count', title: 'Посчитай', area: 'Грамматика',
      goal: 'упражнять в согласовании числительных с существительными, развивать навыки счёта',
      instr: 'Посчитай картинки в каждой рамке и обведи нужную цифру. Скажи правильно: «' + cap(DB.count(items[0], 1)) + ', ' + DB.count(items[0], 2) + ', … ' + DB.count(items[0], 5) + '».',
      note: cap(items.map(function (e, i) { return DB.count(e, nums[i]); }).join('; ')) + '.',
      words: items, h: H,
      draw: function (cv) {
        var g = cv.getContext('2d');
        return Promise.all(items.map(function (e) { return IMG.word(e, 'c'); })).then(function (ims) {
          items.forEach(function (e, i) {
            var x = (i % 2) * cw, y = 10 + Math.floor(i / 2) * ch;
            IMG.roundRect(g, x + 14, y, cw - 28, ch - 24, 30, FRAME, '#fff', null, 3);
            var n = nums[i];
            var sz = 150, perRow = n <= 3 ? n : 3;
            for (var k = 0; k < n; k++) {
              var row = Math.floor(k / perRow), c = k % perRow;
              var inRow = Math.min(perRow, n - row * perRow);
              var startX = x + (cw - inRow * sz) / 2;
              IMG.draw(g, ims[i], startX + c * sz, y + 16 + row * 150, sz - 8, 140, { scale: DB.imageOf(e).small ? 0.75 : 1, label: e.w });
            }
            for (var d = 1; d <= 5; d++) {
              var dx = x + cw / 2 + (d - 3) * 92, dy = y + ch - 70;
              IMG.circle(g, dx, dy, 36, FRAME, '#fff', 3);
              IMG.text(g, String(d), dx, dy + 15, 42, { align: 'center', bold: true, color: INK });
            }
          });
        });
      },
      play: { name: 'Посчитай', lines: [['Логопед', 'Давайте посчитаем. ' + items.slice(0, 2).map(function (e) { return 'Сколько здесь: ' + e.gp + '?'; }).join(' ')], ['Дети', items.slice(0, 2).map(function (e) { return cap(DB.count(e, 1)) + ', ' + DB.count(e, 2) + ', ' + DB.count(e, 3) + ', ' + DB.count(e, 4) + ', ' + DB.count(e, 5) + '.'; }).join(' ')]] }
    };
  };

  G.dim = function (L) {
    var list = L.words.filter(function (e) { return e.dim && e.dim !== e.w; });
    if (list.length < 3) return null;
    var items = list.slice(0, L.age === '4' ? 3 : 4);
    var cols = 2, rows = Math.ceil(items.length / cols), cw = W / 2, rh = 300;
    return {
      type: 'dim', title: 'Назови ласково', area: 'Словообразование',
      goal: 'упражнять в образовании существительных с уменьшительно-ласкательными суффиксами',
      instr: (items[0].anim ? 'Назови ласково.' : 'Большой предмет — маленький предмет. Назови ласково.') + ' Образец: «' + items[0].w + ' — ' + items[0].dim + '».',
      note: items.map(function (e) { return e.w + ' — ' + e.dim; }).join('; ') + '.',
      words: items, h: rows * rh + 20,
      draw: function (cv) {
        var g = cv.getContext('2d');
        return Promise.all(items.map(function (e) { return IMG.word(e, 'c'); })).then(function (ims) {
          items.forEach(function (e, i) {
            var x = (i % 2) * cw, y = 10 + Math.floor(i / 2) * rh;
            IMG.roundRect(g, x + 14, y, cw - 28, rh - 20, 28, FRAME, '#fff', null, 3);
            IMG.draw(g, ims[i], x + 40, y + 14, 250, 210, { label: e.w });
            IMG.draw(g, ims[i], x + 420, y + 90, 200, 140, { scale: 0.62, label: e.dim, alignBottom: true });
            if (L.captions) {
              IMG.text(g, e.w, x + 165, y + rh - 44, 30, { align: 'center', color: MUTED });
              IMG.text(g, e.dim, x + 520, y + rh - 44, 30, { align: 'center', color: MUTED });
            }
          });
        });
      },
      play: { name: 'Назови ласково', lines: [['Логопед', 'Я называю большой предмет, а вы — маленький, ласково. ' + cap(items[0].w) + '…'], ['Дети', items.map(function (e) { return cap(e.dim) + '.'; }).join(' ')]] }
    };
  };

  function pairTask(L, key, type) {
    var pr = L.theme.pairs && L.theme.pairs[key];
    if (!pr) return null;
    var sel = L.words.map(function (e) { return e.w; });
    var items = pr.items.filter(function (p) { return IMG.hasPicture(p[0]) && IMG.hasPicture(p[1]); });
    var inSel = items.filter(function (p) { return sel.indexOf(p[0]) >= 0; });
    if (inSel.length >= 3) items = inSel;
    var n = L.age === '4' ? 3 : (L.age === '5' ? 4 : 5);
    items = items.slice(0, n);
    if (items.length < 2) return null;
    var left = items.map(function (p) { return { e: E(p[0]) }; });
    var right = U.shuffle(items.map(function (p) { return { e: E(p[1]) }; }), L.rnd);
    var lay = drawConnect(L, left, right, {});
    var isBaby = key === 'baby';
    var note = isBaby
      ? items.map(function (p) { var b = E(p[1]); return 'у ' + E(p[0]).gs + ' — ' + b.w + (b.pl ? ' (' + b.pl + ')' : ''); }).join('; ') + '.'
      : items.map(function (p) { return p[2] || (cap(p[0]) + ' — ' + p[1]); }).join(' ');
    return {
      type: type, title: pr.name, area: isBaby ? 'Словообразование' : 'Связи и отношения',
      goal: isBaby ? 'упражнять в образовании названий детёнышей животных' : 'расширять представления о связях в природе и быту, учить составлять простые предложения',
      instr: pr.q + (isBaby ? ' Скажи: «У ' + E(items[0][0]).gs + ' — ' + items[0][1] + '».' : ' Составь предложение про каждую пару.'),
      note: note, words: left.map(function (x) { return x.e; }), h: lay.h, draw: lay.draw,
      play: { name: pr.name, lines: isBaby
        ? [['Логопед', 'Назовите маму и её детёныша. У ' + E(items[0][0]).gs + ' — …'], ['Дети', items.map(function (p) { return 'У ' + E(p[0]).gs + ' — ' + p[1] + '.'; }).join(' ')]]
        : [['Логопед', pr.q], ['Дети', items.map(function (p) { return p[2] || ''; }).join(' ')]] }
    };
  }
  G.baby = function (L) { return pairTask(L, 'baby', 'baby'); };
  G.food = function (L) { return pairTask(L, 'food', 'food'); };
  G.home = function (L) { return pairTask(L, 'home', 'home'); };
  G.tool = function (L) { return pairTask(L, 'tool', 'tool'); };

  G.groups = function (L) {
    var gr = L.theme.groups;
    if (!gr) return null;
    var sets = gr.sets.map(function (s) {
      var list;
      if (Array.isArray(s[2])) list = withPic(s[2]);
      else if (s[2] === 'self') list = L.words.slice();
      else list = themeWords(DB.byId[s[2]]);
      return { label: s[0], icon: s[1], list: list };
    });
    if (sets.some(function (s) { return s.list.length < 2; })) return null;
    var per = L.age === '4' ? 3 : 4;
    var pool = [];
    var chosen = sets.map(function (s) { return U.sample(s.list.filter(function (e) { return !e.of; }), per, L.rnd); });
    // исключаем слова, которые есть в обеих группах
    chosen[1] = chosen[1].filter(function (e) { return chosen[0].indexOf(e) < 0 && sets[0].list.indexOf(e) < 0; });
    chosen.forEach(function (c) { pool = pool.concat(c); });
    pool = U.shuffle(pool, L.rnd);
    var cols = Math.min(pool.length, per * 2 <= 6 ? 3 : 4), rows = Math.ceil(pool.length / cols);
    var cw = W / cols, pic = 200, rh = pic + (L.captions ? 60 : 30);
    var H = rows * rh + 330;
    return {
      type: 'groups', title: gr.name, area: 'Классификация',
      goal: 'учить классифицировать предметы по существенному признаку, употреблять обобщающие слова',
      instr: gr.q,
      note: sets.map(function (s, i) { return s.label + ': ' + chosen[i].map(function (e) { return e.w; }).join(', '); }).join('. ') + '.',
      words: chosen[0], h: H,
      draw: function (cv) {
        var g = cv.getContext('2d');
        return Promise.all(pool.map(function (e) { return IMG.word(e, 'c'); }).concat(sets.map(function (s) { return IMG.code(s.icon, 'c').catch(function () { return null; }); }))).then(function (ims) {
          pool.forEach(function (e, i) {
            var r = Math.floor(i / cols), c = i % cols, x = c * cw, y = 10 + r * rh;
            IMG.roundRect(g, x + 14, y, cw - 28, rh - 14, 24, FRAME, '#fff', null, 3);
            IMG.draw(g, ims[i], x + (cw - pic) / 2, y + 6, pic, pic, { label: e.w });
            caption(g, e, x, y + pic + 44, cw, L, 28);
          });
          var by = rows * rh + 40;
          sets.forEach(function (s, i) {
            var bx = i === 0 ? 120 : W / 2 + 80, bw = W / 2 - 200;
            IMG.roundRect(g, bx, by, bw, 260, 40, ACCENT, '#eef0ff', null, 5);
            IMG.draw(g, ims[pool.length + i], bx + 20, by + 20, 220, 220, { label: s.label });
            IMG.text(g, s.label, bx + 260 + (bw - 260) / 2, by + 145, 44, { align: 'center', bold: true, color: ACCENT, maxWidth: bw - 280 });
          });
        });
      },
      play: { name: gr.name, lines: [['Логопед', gr.q], ['Дети', sets.map(function (s, i) { return U.cap(chosen[i].map(function (e) { return e.w; }).join(', ')) + ' — ' + s.label.toLowerCase() + '.'; }).join(' ')]] }
    };
  };

  function soundCandidates(L, id) {
    var pool = L.words.concat(withPic(L.theme.extra || []));
    var seen = {};
    return pool.filter(function (e) {
      if (seen[e.w]) return false; seen[e.w] = 1;
      return single(e) && PH.has(e.w, id);
    });
  }

  G.sound = function (L) {
    if (!L.sound) return null;
    var list = soundCandidates(L, L.sound).filter(function (e) { return PH.positions(e.w, L.sound).pos.length === 1; });
    if (list.length < 3) return null;
    var n = L.age === '4' ? 3 : (list.length >= 6 ? 6 : list.length >= 4 ? 4 : 3);
    var items = list.slice(0, n);
    var cols = items.length <= 3 ? 3 : (items.length === 4 ? 4 : 3);
    var lay = drawGrid(L, items, cols, {
      pic: 240, extraH: 110,
      cell: function (g, e, x, y, cw) {
        var bw = 110, bx = x + (cw - bw * 3) / 2;
        for (var k = 0; k < 3; k++) IMG.roundRect(g, bx + k * bw, y, bw, 80, 10, INK, '#fff', null, 4);
      }
    });
    var nm = soundName(L.sound);
    return {
      type: 'sound', title: 'Где спрятался звук ' + nm + '?', area: 'Фонематический анализ',
      goal: 'учить определять место звука ' + nm + ' в слове (начало, середина, конец)',
      instr: 'Назови картинку. Где слышится звук ' + nm + ' — в начале, в середине или в конце слова? Закрась нужную клеточку на схеме.',
      note: items.map(function (e) { return e.w + ' — ' + PH.positions(e.w, L.sound).pos[0]; }).join('; ') + '.',
      words: items, h: lay.h, draw: lay.draw,
      play: { name: 'Где спрятался звук?', lines: [['Логопед', 'Назовите картинку и скажите, где спрятался звук ' + nm + ': в начале, в середине или в конце слова.'], ['Дети', items.map(function (e) { return cap(e.w) + ' — звук ' + nm + ' ' + { 'начало': 'в начале', 'середина': 'в середине', 'конец': 'в конце' }[PH.positions(e.w, L.sound).pos[0]] + ' слова.'; }).join(' ')]] }
    };
  };

  G.hear = function (L) {
    if (!L.sound) return null;
    var yes = soundCandidates(L, L.sound);
    var no = L.words.filter(function (e) { return !PH.has(e.w, L.sound) && !PH.positions(e.w, L.sound).amb; });
    if (yes.length < 2 || no.length < 2) return null;
    var nYes = Math.min(yes.length, 4), nNo = Math.min(no.length, 8 - nYes);
    var items = U.shuffle(yes.slice(0, nYes).concat(U.sample(no, nNo, L.rnd)), L.rnd);
    var cols = items.length > 6 ? 4 : 3;
    var lay = drawGrid(L, items, cols, { pic: 230 });
    var nm = soundName(L.sound);
    return {
      type: 'hear', title: 'Поймай звук ' + nm, area: 'Фонематический слух',
      goal: 'развивать фонематический слух: выделять звук ' + nm + ' в словах по теме',
      instr: 'Назови картинки. Обведи только те, в названии которых слышится звук ' + nm + '.',
      note: 'Со звуком ' + nm + ': ' + items.filter(function (e) { return PH.has(e.w, L.sound); }).map(function (e) { return e.w; }).join(', ') + '. Без звука: ' + items.filter(function (e) { return !PH.has(e.w, L.sound); }).map(function (e) { return e.w; }).join(', ') + '.',
      words: items, h: lay.h, draw: lay.draw,
      play: { name: 'Поймай звук', lines: [['Логопед', 'Хлопните в ладоши, когда услышите звук ' + nm + ': ' + items.map(function (e) { return e.w; }).join(', ') + '.'], ['Дети', 'Хлопают на словах: ' + items.filter(function (e) { return PH.has(e.w, L.sound); }).map(function (e) { return e.w; }).join(', ') + '.']] }
    };
  };

  G.syll = function (L) {
    var list = L.words.filter(single);
    if (list.length < 4) return null;
    var items = list.slice(0, L.age === '4' ? 4 : 6);
    var cols = items.length <= 4 ? 4 : 3;
    var lay = drawGrid(L, items, cols, {
      pic: 230, extraH: 90,
      cell: function (g, e, x, y, cw) {
        for (var k = 0; k < 4; k++) IMG.circle(g, x + cw / 2 + (k - 1.5) * 70, y + 36, 26, INK, '#fff', 4);
      }
    });
    return {
      type: 'syll', title: 'Прохлопай и посчитай слоги', area: 'Слоговой анализ',
      goal: 'учить делить слова на слоги, определять количество слогов',
      instr: 'Назови картинку, прохлопай слово. Сколько в нём слогов? Закрась столько кружков, сколько слогов.',
      note: items.map(function (e) { var s = PH.syllables(e.w); return e.w + ' — ' + s + ' ' + U.plural(s, 'слог', 'слога', 'слогов'); }).join('; ') + '.',
      words: items, h: lay.h, draw: lay.draw,
      play: { name: 'Прохлопай слово', lines: [['Логопед', 'Прохлопаем слова и посчитаем слоги: ' + items.slice(0, 4).map(function (e) { return e.w; }).join(', ') + '.'], ['Дети', items.slice(0, 4).map(function (e) { var s = PH.syllables(e.w); return cap(e.w) + ' — ' + s + ' ' + U.plural(s, 'слог', 'слога', 'слогов') + '.'; }).join(' ')]] }
    };
  };

  G.first = function (L) {
    if (L.age === '4') return null;
    var list = L.words.filter(single);
    if (list.length < 4) return null;
    var items = list.slice(0, 6);
    var lay = drawGrid(L, items, 3, {
      pic: 230, extraH: 90,
      cell: function (g, e, x, y, cw) { IMG.circle(g, x + cw / 2, y + 36, 32, INK, '#fff', 4); }
    });
    var TYPE = { vowel: 'гласный — красный', hard: 'твёрдый согласный — синий', soft: 'мягкий согласный — зелёный' };
    return {
      type: 'first', title: 'Первый звук', area: 'Звуковой анализ',
      goal: 'учить выделять первый звук в слове и давать ему характеристику',
      instr: 'Назови картинку и первый звук в слове. Закрась кружок: гласный — красным, твёрдый согласный — синим, мягкий согласный — зелёным.',
      note: items.map(function (e) { var f = PH.firstSound(e.w); return e.w + ' — ' + f.label + ', ' + TYPE[f.type]; }).join('; ') + '.',
      words: items, h: lay.h, draw: lay.draw,
      play: { name: 'Назови первый звук', lines: [['Логопед', 'Назовите первый звук в словах: ' + items.slice(0, 4).map(function (e) { return e.w; }).join(', ') + '.'], ['Дети', items.slice(0, 4).map(function (e) { return cap(e.w) + ' — ' + PH.firstSound(e.w).label + '.'; }).join(' ')]] }
    };
  };

  function routes(L) {
    var r = (L.theme.routes || []).filter(function (x) { return IMG.hasPicture(x[0]) && IMG.hasPicture(x[1]); });
    return U.shuffle(r, L.rnd);
  }

  G.maze = function (L) {
    var rs = routes(L);
    if (!rs.length) return null;
    var route = rs[0];
    var dims = L.age === '4' ? [7, 5] : (L.age === '5' ? [10, 6] : [13, 8]);
    var cols = dims[0], rows = dims[1];
    var rnd = U.rng(Math.floor(L.rnd() * 1e9));
    // лабиринт: обход в глубину
    var walls = [];
    for (var y = 0; y < rows; y++) { walls.push([]); for (var x = 0; x < cols; x++) walls[y].push({ n: 1, e: 1, s: 1, w: 1, v: 0 }); }
    var stack = [[0, Math.floor(rows / 2)]];
    walls[Math.floor(rows / 2)][0].v = 1;
    while (stack.length) {
      var cur = stack[stack.length - 1], cx = cur[0], cy = cur[1];
      var nb = [];
      if (cy > 0 && !walls[cy - 1][cx].v) nb.push([cx, cy - 1, 'n', 's']);
      if (cx < cols - 1 && !walls[cy][cx + 1].v) nb.push([cx + 1, cy, 'e', 'w']);
      if (cy < rows - 1 && !walls[cy + 1][cx].v) nb.push([cx, cy + 1, 's', 'n']);
      if (cx > 0 && !walls[cy][cx - 1].v) nb.push([cx - 1, cy, 'w', 'e']);
      if (!nb.length) { stack.pop(); continue; }
      var nx = nb[Math.floor(rnd() * nb.length)];
      walls[cy][cx][nx[2]] = 0;
      walls[nx[1]][nx[0]][nx[3]] = 0;
      walls[nx[1]][nx[0]].v = 1;
      stack.push([nx[0], nx[1]]);
    }
    var entryY = Math.floor(rows / 2), exitY = Math.floor(rnd() * rows);
    walls[entryY][0].w = 0; walls[exitY][cols - 1].e = 0;
    var side = 230, mw = W - side * 2 - 40, cell = Math.min(mw / cols, 110), mh = cell * rows;
    var ox = side + 20 + (mw - cell * cols) / 2, oy = 20;
    var H = mh + 60;
    var a = E(route[0]), b = E(route[1]);
    return {
      type: 'maze', title: 'Лабиринт', area: 'Зрительно-моторная координация',
      goal: 'развивать зрительно-моторную координацию, пространственную ориентировку, подготовку руки к письму',
      instr: route[2] + ' Проведи дорожку карандашом, не касаясь стенок.',
      note: 'Путь от картинки «' + a.w + '» к картинке «' + b.w + '».',
      words: [a, b], h: H,
      draw: function (cv) {
        var g = cv.getContext('2d');
        return Promise.all([IMG.word(a, 'c'), IMG.word(b, 'c')]).then(function (ims) {
          IMG.roundRect(g, ox - 16, oy - 16, cell * cols + 32, mh + 32, 24, null, '#f5f6ff');
          g.save(); g.strokeStyle = INK; g.lineWidth = 7; g.lineCap = 'round';
          g.beginPath();
          for (var yy = 0; yy < rows; yy++) for (var xx = 0; xx < cols; xx++) {
            var c = walls[yy][xx], px = ox + xx * cell, py = oy + yy * cell;
            if (c.n) { g.moveTo(px, py); g.lineTo(px + cell, py); }
            if (c.w) { g.moveTo(px, py); g.lineTo(px, py + cell); }
            if (yy === rows - 1 && c.s) { g.moveTo(px, py + cell); g.lineTo(px + cell, py + cell); }
            if (xx === cols - 1 && c.e) { g.moveTo(px + cell, py); g.lineTo(px + cell, py + cell); }
          }
          g.stroke(); g.restore();
          IMG.draw(g, ims[0], 10, oy + entryY * cell + cell / 2 - side / 2, side, side, { label: a.w, scale: DB.imageOf(a).small ? 0.75 : 1 });
          IMG.draw(g, ims[1], W - side - 10, oy + exitY * cell + cell / 2 - side / 2, side, side, { label: b.w, scale: DB.imageOf(b).small ? 0.75 : 1 });
        });
      }
    };
  };

  G.trace = function (L) {
    var rows = routes(L).map(function (r) { return { a: E(r[0]), b: E(r[1]), s: r[2] }; });
    ['home', 'food', 'tool', 'baby'].forEach(function (k) {
      var pr = L.theme.pairs && L.theme.pairs[k];
      if (!pr || rows.length >= 3) return;
      pr.items.forEach(function (p) {
        if (rows.length >= 3 || !IMG.hasPicture(p[0]) || !IMG.hasPicture(p[1])) return;
        if (rows.some(function (x) { return x.a.w === p[0] || x.b.w === p[1]; })) return;
        rows.push({ a: E(p[0]), b: E(p[1]), s: 'Проведи дорожку от картинки «' + p[0] + '» к картинке «' + p[1] + '».', n: p[2] });
      });
    });
    var mode = 'pair';
    if (rows.length < 2) {
      var dims = L.words.filter(function (e) { return !e.of && e.dim && e.dim !== e.w; });
      mode = dims.length >= 2 ? 'dim' : 'sil';
      rows = (mode === 'dim' ? dims : L.words.filter(function (e) { return !e.of; })).slice(0, 3).map(function (e) { return { a: e, b: e, s: '' }; });
    }
    if (rows.length < 2) return null;
    var sil = mode === 'sil';
    rows = rows.slice(0, 3);
    var pairs = rows.map(function (r) { return [r.a, r.b]; });
    var kinds = L.age === '4' ? ['straight', 'wave', 'arc'] : (L.age === '5' ? ['wave', 'zigzag', 'arc'] : ['zigzag', 'loop', 'wave']);
    var rh = 250, H = pairs.length * rh + 20;
    return {
      type: 'trace', title: 'Обведи дорожки', area: 'Графомоторика',
      goal: 'развивать мелкую моторику, зрительно-моторную координацию, готовить руку к письму',
      instr: 'Обведи дорожки по пунктиру, не отрывая карандаша от бумаги. ' + (mode === 'dim'
        ? 'Проведи каждую большую картинку к маленькой и назови ласково: «' + rows[0].a.w + ' — ' + rows[0].a.dim + '».'
        : sil ? 'Проведи каждую картинку к её тени и назови её.' : rows.map(function (r) { return r.s; }).join(' ')),
      note: mode === 'dim' ? rows.map(function (r) { return r.a.w + ' — ' + r.a.dim; }).join('; ') + '.'
        : sil ? 'Дорожки: ' + rows.map(function (r) { return r.a.w; }).join(', ') + ' — к своей тени.' : rows.map(function (r) { return r.n || (cap(r.a.w) + ' → ' + r.b.w + '.'); }).join(' '),
      words: pairs.map(function (p) { return p[0]; }), h: H,
      draw: function (cv) {
        var g = cv.getContext('2d');
        var flat = []; pairs.forEach(function (p) { flat.push(p[0], p[1]); });
        return Promise.all(flat.map(function (e) { return IMG.word(e, 'c'); })).then(function (ims) {
          pairs.forEach(function (p, i) {
            var y = 10 + i * rh, cy = y + rh / 2 - 10;
            IMG.draw(g, ims[i * 2], 20, y + 10, 210, 210, { label: p[0].w, scale: DB.imageOf(p[0]).small ? 0.75 : 1 });
            IMG.draw(g, ims[i * 2 + 1], W - 230, y + 10, 210, 210, { label: mode === 'dim' ? p[1].dim : p[1].w, scale: mode === 'dim' ? 0.55 : (DB.imageOf(p[1]).small ? 0.75 : 1), silhouette: sil, alignBottom: mode === 'dim' });
            g.save(); g.strokeStyle = '#8a8fb0'; g.lineWidth = 7; g.setLineDash([4, 22]); g.lineCap = 'round';
            g.beginPath();
            var x0 = 250, x1 = W - 250, k = kinds[i % kinds.length];
            g.moveTo(x0, cy);
            var steps = 240;
            for (var s = 1; s <= steps; s++) {
              var t = s / steps, x = x0 + (x1 - x0) * t, yy = cy;
              if (k === 'wave') yy = cy + Math.sin(t * Math.PI * 6) * 60;
              else if (k === 'zigzag') { var ph = (t * 8) % 1; yy = cy + (ph < 0.5 ? (ph * 4 - 1) : (3 - ph * 4)) * 60; }
              else if (k === 'arc') yy = cy - Math.abs(Math.sin(t * Math.PI * 4)) * 90 + 45;
              else if (k === 'loop') { var ang = t * Math.PI * 12; x = x0 + (x1 - x0) * t + Math.cos(ang + Math.PI) * 32 + 32 * (t === 1 ? 0 : 0); yy = cy + Math.sin(ang) * 55; }
              g.lineTo(x, yy);
            }
            g.stroke(); g.restore();
          });
        });
      }
    };
  };

  var COLOR_RE = /^(красн|оранжев|ж[её]лт|зел[её]н|голуб|син(ий|яя|ее|ие)$|фиолетов|розов|коричнев|сер(ый|ая|ое|ые)$|серебрист|ч[её]рн|бел(ый|ая|ое|ые)$|белоснежн|рыж|золот|бур(ый|ая|ое|ые)$|п[её]стр|разноцветн|сиренев|малинов|бордов|бежев|румян|полосат|пятнист|алый|ал(ая|ое|ые)$)/i;

  G.color = function (L) {
    var items = L.words.filter(function (e) { return !e.of; }).slice(0, 2);
    if (items.length < 1) return null;
    var colorTalk = (L.theme.talk || []).filter(function (t) { return /цвет/i.test(t.name); })[0];
    var hints = items.map(function (e) {
      var it = colorTalk && colorTalk.items.filter(function (x) { return x[0] === e.w; })[0];
      if (it) return e.w + ' — ' + it[1];
      var a = (e.adj || []).filter(function (x) { return COLOR_RE.test(x); })[0];
      return a ? e.w + ' — ' + a : null;
    }).filter(Boolean);
    return {
      type: 'color', title: 'Раскрась', area: 'Мелкая моторика',
      goal: 'развивать мелкую моторику, закреплять знание цвета и признаков предметов',
      instr: 'Назови, кто (что) нарисован. Раскрась аккуратно, не выходя за контур. Расскажи, какого цвета ' + (items[0].g === 'мн' ? 'бывают ' : 'бывает ') + items[0].w + '.',
      note: hints.length ? 'Подсказка по цвету: ' + hints.join('; ') + '.' : 'Подбирай цвета, как в жизни, и называй цвет каждой части картинки.',
      words: items, h: 640,
      draw: function (cv) {
        var g = cv.getContext('2d');
        return Promise.all(items.map(function (e) { return IMG.word(e, 'b'); })).then(function (ims) {
          if (items.length === 1) {
            IMG.draw(g, ims[0], W / 2 - 310, 10, 620, 620, { label: items[0].w });
          } else {
            IMG.draw(g, ims[0], 60, 20, 660, 600, { label: items[0].w });
            IMG.draw(g, ims[1], W - 720, 20, 660, 600, { label: items[1].w });
          }
        });
      }
    };
  };

  G.shadow = function (L) {
    var list = L.words.filter(function (e) { return !e.of; });
    if (list.length < 3) return null;
    var items = list.slice(0, L.age === '4' ? 3 : 4);
    var left = items.map(function (e) { return { e: e }; });
    var right = U.shuffle(items.map(function (e) { return { e: e, sil: true, noCap: true }; }), L.rnd);
    var lay = drawConnect(L, left, right, { pic: 180 });
    return {
      type: 'shadow', title: 'Найди тень', area: 'Зрительное восприятие',
      goal: 'развивать зрительное восприятие и внимание, умение соотносить предмет и его силуэт',
      instr: 'Найди тень каждой картинки и соедини их линией. Назови, чья (какая) это тень.',
      note: 'Тени: ' + items.map(function (e) { return e.w; }).join(', ') + '.',
      words: items, h: lay.h, draw: lay.draw
    };
  };

  G.overlap = function (L) {
    var list = L.words.filter(function (e) { return !e.of; });
    if (list.length < 3) return null;
    var items = U.sample(list.slice(0, 8), L.age === '4' ? 3 : 4, L.rnd);
    return {
      type: 'overlap', title: 'Кто (что) спрятался?', area: 'Зрительное восприятие',
      goal: 'развивать зрительное внимание и восприятие наложенных изображений',
      instr: 'Внимательно рассмотри картинку. Назови всех, кто (что) на ней спрятался. Обведи каждую картинку своим цветом.',
      note: 'На картинке: ' + items.map(function (e) { return e.w; }).join(', ') + '.',
      words: items, h: 700,
      draw: function (cv) {
        var g = cv.getContext('2d');
        return Promise.all(items.map(function (e) { return IMG.word(e, 'b'); })).then(function (ims) {
          IMG.roundRect(g, W / 2 - 420, 10, 840, 680, 40, FRAME, '#fff', null, 3);
          var offs = [[-150, -120], [150, -100], [-120, 130], [140, 120]];
          items.forEach(function (e, i) {
            IMG.draw(g, ims[i], W / 2 - 250 + offs[i][0] * 0.9, 350 - 250 + offs[i][1] * 0.9, 500, 500, { multiply: true, label: e.w });
          });
        });
      }
    };
  };

  G.riddle = function (L) {
    var rid = (L.theme.riddles || []).filter(function (r) { return IMG.hasPicture(r[0]); });
    if (!rid.length) return null;
    var chosen = U.sample(rid, L.age === '4' ? 1 : 2, L.rnd);
    var rows = chosen.map(function (r) {
      var ans = E(r[0]);
      var others = U.sample(L.words.filter(function (e) { return e.w !== ans.w && !e.of; }), 2, L.rnd);
      var opts = U.shuffle([ans].concat(others), L.rnd);
      return { r: r, ans: ans, opts: opts };
    });
    var rh = 420;
    return {
      type: 'riddle', title: 'Отгадай загадку', area: 'Связная речь, мышление',
      goal: 'развивать слуховое внимание, мышление, умение отгадывать загадки и доказывать отгадку',
      instr: 'Послушай загадку. Найди отгадку среди картинок и обведи её. Объясни, как догадался.',
      note: rows.map(function (x, i) { return (rows.length > 1 ? (i + 1) + ') ' : '') + '«' + String(x.r[1]).replace(/\.$/, '') + '» — ' + x.ans.w; }).join('; ') + '.',
      riddles: rows.map(function (x) { return x.r[1]; }),
      words: rows.map(function (x) { return x.ans; }), h: rows.length * rh + 10,
      draw: function (cv) {
        var g = cv.getContext('2d');
        var flat = []; rows.forEach(function (x) { flat = flat.concat(x.opts); });
        return Promise.all(flat.map(function (e) { return IMG.word(e, 'c'); })).then(function (ims) {
          rows.forEach(function (x, ri) {
            var y = 5 + ri * rh;
            IMG.roundRect(g, 20, y, W - 40, rh - 20, 30, FRAME, '#fff', null, 3);
            var th = IMG.wrap(g, '«' + x.r[1] + '»', 60, y + 60, W - 120, 38, 48, { color: INK, italic: true });
            x.opts.forEach(function (e, i) {
              var cw = (W - 80) / 3;
              IMG.draw(g, ims[ri * 3 + i], 40 + i * cw + (cw - 230) / 2, y + 40 + th, 230, rh - 90 - th, { label: e.w, scale: DB.imageOf(e).small ? 0.75 : 1 });
            });
          });
        });
      }
    };
  };

  G.mnemo = function (L) {
    var st = L.theme.story;
    if (!st) return null;
    var subject = E(st.word);
    var plan = st.plan;
    var cols = plan.length > 6 ? 4 : 3, rows = Math.ceil(plan.length / cols), cw = W / cols, ch = 330;
    return {
      type: 'mnemo', title: 'Расскажи по схеме', area: 'Связная речь',
      goal: 'учить составлять описательный рассказ с опорой на мнемотаблицу',
      instr: 'Рассмотри схему. Составь рассказ про ' + (st.about || (subject ? DB.acc(subject) : 'предмет')) + ' по порядку: отвечай на вопрос каждой клеточки.',
      note: 'Образец рассказа: ' + st.text,
      words: subject ? [subject] : [], h: rows * ch + 20,
      draw: function (cv) {
        var g = cv.getContext('2d');
        return Promise.all(plan.map(function (p) { return p[0] === '@' ? IMG.word(subject, 'c') : (p[0].indexOf('x:') === 0 || /^[0-9A-F]/.test(p[0]) ? IMG.code(p[0], 'c').catch(function () { return null; }) : IMG.word(p[0], 'c')); })).then(function (ims) {
          plan.forEach(function (p, i) {
            var r = Math.floor(i / cols), c = i % cols, x = c * cw, y = 10 + r * ch;
            IMG.roundRect(g, x + 12, y, cw - 24, ch - 20, 26, ACCENT, '#f5f6ff', null, 4);
            IMG.circle(g, x + 52, y + 44, 28, null, ACCENT);
            IMG.text(g, String(i + 1), x + 52, y + 58, 38, { align: 'center', bold: true, color: '#fff' });
            IMG.draw(g, ims[i], x + (cw - 190) / 2, y + 20, 190, 190, { label: '?' });
            IMG.wrap(g, p[1], x + 30, y + 250, cw - 60, 28, 34, { color: INK });
          });
        });
      },
      play: { name: 'Рассказ по мнемотаблице', lines: [['Логопед', 'Давайте составим рассказ по схеме. Первая клеточка — ' + plan[0][1].toLowerCase() + ' Дальше — по порядку.'], ['Ребёнок', st.text]] }
    };
  };

  G.sinkvein = function (L) {
    if (L.age !== '6') return null;
    var st = L.theme.story;
    var e = st ? E(st.word) : L.words[0];
    if (!e || e.adj.length < 2 || e.v.length < 2) {
      e = L.words.filter(function (x) { return x.adj.length >= 2 && x.v.length >= 2; })[0];
    }
    if (!e) return null;
    var sent = (L.theme.sents || []).filter(function (s) { return s.toLowerCase().indexOf(e.w.slice(0, Math.max(3, e.w.length - 2))) >= 0; })[0] || (cap(e.w) + ' ' + e.v[0] + '.');
    var lines = [cap(e.w), e.adj.slice(0, 2).join(', '), e.v.slice(0, 3).join(', '), sent, U.cap(L.theme.cat[0])];
    var labels = ['Кто? Что?', 'Какой? (2 слова)', 'Что делает? (3 слова)', 'Предложение', 'Одно слово — обобщение'];
    return {
      type: 'sinkvein', title: 'Синквейн', area: 'Связная речь',
      goal: 'учить составлять синквейн: подбирать признаки и действия к предмету, обобщать',
      instr: 'Составь синквейн про ' + DB.acc(e) + ': 1 — кто это; 2 — какой (два слова); 3 — что делает (три слова); 4 — предложение; 5 — одно слово-обобщение.',
      note: 'Пример: ' + lines.join(' / '),
      words: [e], h: 760,
      draw: function (cv) {
        var g = cv.getContext('2d');
        return IMG.word(e, 'c').then(function (im) {
          var widths = [1, 2, 3, 4, 1];
          widths.forEach(function (n, i) {
            var bw = 190, gap = 26, total = n * bw + (n - 1) * gap, y = 20 + i * 146;
            if (i === 3) { total = 1100; }
            var x0 = (W - total) / 2 + 180;
            IMG.text(g, (i + 1) + '. ' + labels[i], 30, y + 80, 30, { color: MUTED, maxWidth: 340 });
            if (i === 3) { IMG.roundRect(g, x0, y, total, 120, 22, ACCENT, '#fff', null, 4); return; }
            for (var k = 0; k < n; k++) IMG.roundRect(g, x0 + k * (bw + gap), y, bw, 120, 22, ACCENT, i === 0 ? '#f5f6ff' : '#fff', null, 4);
            if (i === 0) IMG.draw(g, im, x0 + 20, y + 6, bw - 40, 108, { label: e.w });
          });
        });
      },
      play: { name: 'Синквейн', lines: [['Логопед', 'Составим синквейн про ' + DB.acc(e) + '.'], ['Дети', lines.join(' / ')]] }
    };
  };

  G.prep = function (L) {
    var list = L.words.filter(function (e) { return !e.of && single(e); });
    if (!list.length) return null;
    var e = list.filter(function (x) { return x.anim; })[0] || list[0];
    var P = [['в', 'в коробке'], ['на', 'на коробке'], ['под', 'под коробкой'], ['за', 'за коробкой'], ['около', 'около коробки']];
    var cw = W / 5;
    return {
      type: 'prep', title: 'Где ' + e.w + '?', area: 'Грамматика (предлоги)',
      goal: 'учить понимать и употреблять простые предлоги в, на, под, за, около',
      instr: 'Скажи, где ' + e.w + '. Используй слова: в, на, под, за, около. Образец: «' + cap(e.w) + ' в коробке».',
      note: P.map(function (p) { return cap(e.w) + ' ' + p[1]; }).join('. ') + '.',
      words: [e], h: 470,
      draw: function (cv) {
        var g = cv.getContext('2d');
        return Promise.all([IMG.word(e, 'c'), IMG.code('1F4E6', 'c').catch(function () { return null; })]).then(function (ims) {
          P.forEach(function (p, i) {
            var x = i * cw, box = 170, bx = x + (cw - box) / 2, by = 230;
            IMG.roundRect(g, x + 10, 10, cw - 20, 450, 26, FRAME, '#fff', null, 3);
            var obj = 140;
            if (p[0] === 'за') IMG.draw(g, ims[0], bx + 45, by - 90, obj, obj, { scale: 0.9 });
            if (p[0] === 'в') IMG.draw(g, ims[0], bx + 15, by - 70, obj, obj, { scale: 0.9 });
            IMG.draw(g, ims[1], bx, by, box, box);
            if (p[0] === 'на') IMG.draw(g, ims[0], bx + 15, by - obj + 20, obj, obj, { scale: 0.9 });
            if (p[0] === 'под') IMG.draw(g, ims[0], bx + 15, by + box - 10, obj, 90, { scale: 0.9 });
            if (p[0] === 'около') IMG.draw(g, ims[0], bx + box - 30, by + 40, 120, 120, { scale: 0.9 });
            IMG.text(g, p[0].toUpperCase(), x + cw / 2, 70, 44, { align: 'center', bold: true, color: ACCENT });
          });
        });
      },
      play: { name: 'Где спрятался?', lines: [['Логопед', '(Ставит картинку «' + e.w + '» в коробку, на коробку, под коробку, за коробку, около коробки.) Где ' + e.w + '?'], ['Дети', P.map(function (p) { return cap(e.w) + ' ' + p[1] + '.'; }).join(' ')]] }
    };
  };

  G.forms = function (L) {
    var f = L.theme.forms;
    if (!f) return null;
    var items = f.items.filter(function (x) { return IMG.hasPicture(x[0]); }).slice(0, L.age === '4' ? 3 : 5);
    if (items.length < 3) return null;
    var rh = 190;
    return {
      type: 'forms', title: f.name, area: 'Словообразование',
      goal: 'упражнять в образовании относительных прилагательных и согласовании их с существительными',
      instr: f.q + ' Образец: «' + items[0][2] + '»',
      note: items.map(function (x) { return x[2]; }).join(' '),
      words: items.map(function (x) { return E(x[0]); }), h: items.length * rh + 20,
      draw: function (cv) {
        var g = cv.getContext('2d');
        return Promise.all(items.map(function (x) { return IMG.word(x[0], 'c'); })).then(function (ims) {
          items.forEach(function (x, i) {
            var y = 10 + i * rh;
            IMG.roundRect(g, 20, y, 260, rh - 20, 24, FRAME, '#fff', null, 3);
            IMG.draw(g, ims[i], 45, y + 8, 210, rh - 36, { label: x[0] });
            IMG.line(g, 320, y + rh / 2 - 10, 420, y + rh / 2 - 10, 6, ACCENT);
            IMG.line(g, 420, y + rh / 2 - 10, 396, y + rh / 2 - 30, 6, ACCENT);
            IMG.line(g, 420, y + rh / 2 - 10, 396, y + rh / 2 + 10, 6, ACCENT);
            var ans = x[1].split(' ');
            IMG.line(g, 470, y + rh / 2 + 10, 1060, y + rh / 2 + 10, 4, '#9aa0c0', [14, 12]);
            IMG.text(g, ans.slice(1).join(' '), 1100, y + rh / 2 + 8, 44, { color: INK });
          });
        });
      },
      play: { name: f.name, lines: [['Логопед', f.q], ['Дети', items.map(function (x) { return x[2]; }).join(' ')]] }
    };
  };

  G.poss = function (L) {
    var parts = L.theme.possParts;
    if (!parts) return null;
    var list = L.words.filter(function (e) { return e.poss && !e.of; });
    if (list.length < 2) return null;
    var items = list.slice(0, L.age === '4' ? 2 : 3);
    var rh = 300;
    return {
      type: 'poss', title: 'Чей? Чья? Чьё? Чьи?', area: 'Словообразование',
      goal: 'упражнять в образовании притяжательных прилагательных',
      instr: 'Назови, чей это ' + parts[0][0] + ', чья ' + parts[1][0] + ', чьё ' + parts[2][0] + ', чьи ' + parts[3][0] + '. Образец: «' + cap(DB.poss(items[0].poss, 'м')) + ' ' + parts[0][0] + '».',
      note: items.map(function (e) { return parts.map(function (p) { return DB.poss(e.poss, p[1]) + ' ' + p[0]; }).join(', '); }).join('; ') + '.',
      words: items, h: items.length * rh + 10,
      draw: function (cv) {
        var g = cv.getContext('2d');
        return Promise.all(items.map(function (e) { return IMG.word(e, 'c'); })).then(function (ims) {
          items.forEach(function (e, i) {
            var y = 5 + i * rh;
            IMG.roundRect(g, 20, y, W - 40, rh - 20, 26, FRAME, '#fff', null, 3);
            IMG.draw(g, ims[i], 50, y + 10, 260, 260, { label: e.w });
            parts.forEach(function (p, k) {
              var x = 370 + (k % 2) * 600, yy = y + 90 + Math.floor(k / 2) * 110;
              IMG.line(g, x, yy, x + 300, yy, 4, '#9aa0c0', [14, 12]);
              IMG.text(g, p[0], x + 320, yy - 4, 44, { color: INK });
            });
          });
        });
      },
      play: { name: 'Чей? Чья? Чьё?', lines: [['Логопед', 'Чей хвост у ' + items[0].gs + '? Чья голова?'], ['Дети', items.map(function (e) { return cap(parts.map(function (p) { return DB.poss(e.poss, p[1]) + ' ' + p[0]; }).join(', ')) + '.'; }).join(' ')]] }
    };
  };

  G.find = function (L) {
    var list = L.words.filter(function (e) { return !e.of && !e.noCount && e.gs && e.gp; });
    if (list.length < 3) return null;
    var kinds = list.slice(0, 3);
    var counts = U.shuffle(L.age === '4' ? [2, 3, 4] : [3, 4, 5], L.rnd);
    var spots = [];
    var rnd = U.rng(Math.floor(L.rnd() * 1e9));
    var area = { x: 40, y: 20, w: W - 80, h: 560 }, sz = 150;
    kinds.forEach(function (e, ki) {
      for (var k = 0; k < counts[ki]; k++) {
        var tries = 0, p;
        do {
          p = { x: area.x + rnd() * (area.w - sz), y: area.y + rnd() * (area.h - sz), ki: ki, flip: rnd() < 0.5 };
          tries++;
        } while (tries < 200 && spots.some(function (q) { return Math.abs(q.x - p.x) < sz * 0.8 && Math.abs(q.y - p.y) < sz * 0.8; }));
        spots.push(p);
      }
    });
    return {
      type: 'find', title: 'Найди и посчитай', area: 'Внимание, грамматика',
      goal: 'развивать зрительное внимание, упражнять в согласовании числительных с существительными',
      instr: 'Найди на картинке ' + (kinds[0].anim ? 'всех, кто на ней нарисован' : 'все предметы') + ', посчитай их и скажи, сколько: «На картинке ' + DB.count(kinds[0], counts[0]) + '».',
      note: kinds.map(function (e, i) { return DB.count(e, counts[i]); }).join(', ') + '.',
      words: kinds, h: 820,
      draw: function (cv) {
        var g = cv.getContext('2d');
        return Promise.all(kinds.map(function (e) { return IMG.word(e, 'c'); })).then(function (ims) {
          IMG.roundRect(g, 20, 10, W - 40, 580, 30, FRAME, '#fbfbff', null, 3);
          spots.forEach(function (p) { IMG.draw(g, ims[p.ki], p.x, p.y, sz, sz, { flip: p.flip }); });
          kinds.forEach(function (e, i) {
            var x = 60 + i * ((W - 120) / 3);
            IMG.draw(g, ims[i], x, 620, 170, 170);
            IMG.text(g, '—', x + 200, 725, 50, { color: MUTED });
            IMG.roundRect(g, x + 250, 650, 130, 130, 18, INK, '#fff', null, 4);
          });
        });
      }
    };
  };

  G.puzzle = function (L) {
    var e = L.words.filter(function (x) { return !x.of; })[0];
    if (!e) return null;
    var cuts = L.age === '4' ? [2, 2] : (L.age === '5' ? [3, 2] : [3, 3]);
    return {
      type: 'puzzle', title: 'Разрезная картинка', area: 'Целостное восприятие',
      goal: 'развивать целостное восприятие предмета, мелкую моторику',
      instr: 'Раскрась картинку, разрежь её по пунктирным линиям и собери снова. Назови, что получилось.',
      note: 'Картинка: ' + e.w + ' (' + (cuts[0] * cuts[1]) + ' частей).',
      words: [e], h: 760,
      draw: function (cv) {
        var g = cv.getContext('2d');
        return IMG.word(e, 'b').then(function (im) {
          var s = 720, x = (W - s) / 2, y = 20;
          IMG.roundRect(g, x, y, s, s, 0, INK, '#fff', null, 5);
          IMG.draw(g, im, x + 20, y + 20, s - 40, s - 40, { label: e.w });
          for (var i = 1; i < cuts[0]; i++) IMG.line(g, x + s * i / cuts[0], y, x + s * i / cuts[0], y + s, 4, '#555', [18, 14]);
          for (var j = 1; j < cuts[1]; j++) IMG.line(g, x, y + s * j / cuts[1], x + s, y + s * j / cuts[1], 4, '#555', [18, 14]);
        });
      }
    };
  };

  /* ---------- Математика (ФЭМП) на материале темы ---------- */
  var ORD = {
    'м': ['', 'первый', 'второй', 'третий', 'четвёртый', 'пятый', 'шестой', 'седьмой', 'восьмой', 'девятый', 'десятый'],
    'ж': ['', 'первая', 'вторая', 'третья', 'четвёртая', 'пятая', 'шестая', 'седьмая', 'восьмая', 'девятая', 'десятая'],
    'ср': ['', 'первое', 'второе', 'третье', 'четвёртое', 'пятое', 'шестое', 'седьмое', 'восьмое', 'девятое', 'десятое']
  };
  var ORD_ACC_F = ['', 'первую', 'вторую', 'третью', 'четвёртую', 'пятую', 'шестую', 'седьмую', 'восьмую', 'девятую', 'десятую'];
  var WHICH = { 'м': 'Какой', 'ж': 'Какая', 'ср': 'Какое' };
  function ord(n, g) { return (ORD[g] || ORD['м'])[n] || String(n); }
  /** Слова, которые можно считать: есть род. ед. и род. мн., не «только мн. ч.» */
  function countables(L) { return L.words.filter(function (e) { return !e.of && !e.noCount && e.g !== 'мн' && e.gs && e.gp; }); }
  function maxNum(L) { return L.age === '4' ? 5 : (L.age === '5' ? 8 : 10); }
  function kto(e) { return e.anim ? 'Кто нарисован' : 'Что нарисовано'; }
  function rangeTo(a, b) { var r = []; for (var i = a; i <= b; i++) r.push(i); return r; }
  function supAcc(e, big) {
    var a = big ? ['самого большого', 'самую большую', 'самое большое', 'самый большой', 'самых больших', 'самые большие']
      : ['самого маленького', 'самую маленькую', 'самое маленькое', 'самый маленький', 'самых маленьких', 'самые маленькие'];
    if (e.g === 'ж') return a[1];
    if (e.g === 'ср') return a[2];
    if (e.g === 'мн') return e.anim ? a[4] : a[5];
    return e.anim ? a[0] : a[3];
  }
  function sayFill(tpl, w, a) {
    var e = DB.word(w) || {};
    var pl = e.pl || w;
    return String(tpl).replace(/\{W\}/g, cap(w)).replace(/\{w\}/g, w).replace(/\{PL\}/g, cap(pl)).replace(/\{pl\}/g, pl)
      .replace(/\{A\}/g, cap(a || '')).replace(/\{a\}/g, a || '');
  }

  /** n одинаковых картинок в прямоугольнике */
  function drawGroup(g, im, n, x, y, w, h, o) {
    o = o || {};
    if (n <= 0) return [];
    var best = null;
    for (var cols = 1; cols <= n; cols++) {
      var rows = Math.ceil(n / cols), s = Math.min(w / cols, h / rows);
      if (!best || s > best.s) best = { cols: cols, rows: rows, s: s };
    }
    var s = best.s * 0.94, spots = [];
    var gx = x + (w - best.cols * best.s) / 2, gy = y + (h - best.rows * best.s) / 2;
    for (var i = 0; i < n; i++) {
      var r = Math.floor(i / best.cols), c = i % best.cols;
      var inRow = Math.min(best.cols, n - r * best.cols);
      var rx = gx + (best.cols - inRow) * best.s / 2 + c * best.s;
      var px = rx + (best.s - s) / 2, py = gy + r * best.s + (best.s - s) / 2;
      IMG.draw(g, im, px, py, s, s, { scale: o.scale || 1, label: o.label });
      spots.push({ x: px, y: py, s: s });
    }
    return spots;
  }
  function cross(g, x, y, s) {
    IMG.line(g, x + s * 0.12, y + s * 0.12, x + s * 0.88, y + s * 0.88, 8, '#dc2626');
    IMG.line(g, x + s * 0.88, y + s * 0.12, x + s * 0.12, y + s * 0.88, 8, '#dc2626');
  }

  G.m_number = function (L) {
    var list = countables(L);
    if (list.length < 3) return null;
    var items = U.sample(list, L.age === '4' ? 3 : 4, L.rnd);
    var max = maxNum(L);
    var nums = U.sample(rangeTo(1, max), items.length, L.rnd);
    var digits = U.shuffle(nums.slice(), L.rnd);
    var rh = 250, H = items.length * rh + 20;
    return {
      type: 'm_number', title: 'Сосчитай и соедини с цифрой', area: 'Математика: счёт',
      goal: 'упражнять в счёте в пределах ' + max + ', учить соотносить количество предметов с цифрой',
      instr: 'Сосчитай картинки в каждой рамке и соедини рамку с нужной цифрой. Скажи, сколько их, например: «' + cap(DB.count(items[0], nums[0])) + '».',
      note: cap(items.map(function (e, i) { return DB.count(e, nums[i]) + ' — цифра ' + nums[i]; }).join('; ')) + '.',
      words: items, h: H,
      draw: function (cv) {
        var g = cv.getContext('2d');
        return Promise.all(items.map(function (e) { return IMG.word(e, 'c'); })).then(function (ims) {
          items.forEach(function (e, i) {
            var y = 10 + i * rh;
            IMG.roundRect(g, 20, y, 1080, rh - 24, 26, FRAME, '#fff', null, 3);
            drawGroup(g, ims[i], nums[i], 36, y + 12, 1048, rh - 48, { scale: DB.imageOf(e).small ? 0.8 : 1, label: e.w });
            IMG.circle(g, 1140, y + (rh - 24) / 2, 14, INK, '#fff', 4);
            var d = digits[i];
            IMG.circle(g, 1330, y + (rh - 24) / 2, 14, INK, '#fff', 4);
            IMG.circle(g, 1470, y + (rh - 24) / 2, 78, ACCENT, '#eef0ff', 5);
            IMG.text(g, String(d), 1470, y + (rh - 24) / 2 + 30, 88, { align: 'center', bold: true, color: ACCENT });
          });
        });
      },
      play: { name: 'Сосчитай и назови', lines: [['Логопед', 'Сосчитайте картинки в каждой рамке. Назовите число и предмет полным ответом.'], ['Дети', items.map(function (e, i) { return cap(DB.count(e, nums[i])) + '.'; }).join(' ')]] }
    };
  };

  G.m_compare = function (L) {
    var list = countables(L);
    if (list.length < 2) return null;
    var kinds = L.age === '4' ? ['more', 'less'] : U.shuffle(['more', 'less', 'equal'], L.rnd);
    var top = Math.min(maxNum(L), 7);
    var rows = kinds.map(function (k) {
      var pair = U.sample(list, 2, L.rnd), a = pair[0], b = pair[1];
      var x = 1 + Math.floor(L.rnd() * (top - 1)), y;
      if (k === 'equal') y = x;
      else {
        var hi = 2 + Math.floor(L.rnd() * (top - 1)), lo = 1 + Math.floor(L.rnd() * (hi - 1));
        x = k === 'more' ? hi : lo; y = k === 'more' ? lo : hi;
      }
      return { a: a, b: b, na: x, nb: y, sign: x > y ? '>' : (x < y ? '<' : '=') };
    });
    function say(r) {
      if (r.sign === '=') return cap(r.a.gp) + ' и ' + r.b.gp + ' поровну: ' + r.na + ' = ' + r.nb;
      return cap(r.a.gp) + ' ' + (r.sign === '>' ? 'больше' : 'меньше') + ', чем ' + r.b.gp + ': ' + r.na + ' ' + r.sign + ' ' + r.nb;
    }
    function ask(r) { return (r.a.anim && r.b.anim ? 'Кого' : 'Чего') + ' больше: ' + r.a.gp + ' или ' + r.b.gp + '?'; }
    /** Ответ ребёнка на вопрос «Кого больше?»: сначала называем бо́льшую группу */
    function answer(r) {
      if (r.sign === '=') return cap(r.a.gp) + ' и ' + r.b.gp + ' поровну.';
      var big = r.sign === '>' ? r.a : r.b, small = r.sign === '>' ? r.b : r.a;
      return cap(big.gp) + ' больше, чем ' + small.gp + '.';
    }
    var rh = 260, H = rows.length * rh + 20, young = L.age === '4';
    return {
      type: 'm_compare', title: young ? 'Где больше?' : 'Больше, меньше или поровну?', area: 'Математика: сравнение',
      goal: 'учить сравнивать группы предметов по количеству, употреблять слова «больше», «меньше», «поровну»',
      instr: young ? 'Сосчитай картинки слева и справа. Обведи ту группу, в которой картинок больше.'
        : 'Сосчитай картинки слева и справа и поставь в окошко знак: «больше» (>), «меньше» (<) или «равно» (=).',
      note: young ? rows.map(function (r) { return answer(r).replace(/\.$/, '') + ' (' + Math.max(r.na, r.nb) + ' > ' + Math.min(r.na, r.nb) + ') — обвести группу ' + (r.na > r.nb ? 'слева' : 'справа'); }).join('. ') + '.'
        : rows.map(say).join('. ') + '.',
      words: U.uniq(rows.map(function (r) { return r.a; }).concat(rows.map(function (r) { return r.b; }))), h: H,
      draw: function (cv) {
        var g = cv.getContext('2d');
        var flat = []; rows.forEach(function (r) { flat.push(r.a, r.b); });
        return Promise.all(flat.map(function (e) { return IMG.word(e, 'c'); })).then(function (ims) {
          rows.forEach(function (r, i) {
            var y = 10 + i * rh, bh = rh - 24;
            IMG.roundRect(g, 20, y, 680, bh, 26, FRAME, '#fff', null, 3);
            drawGroup(g, ims[i * 2], r.na, 36, y + 14, 648, bh - 28, { scale: DB.imageOf(r.a).small ? 0.8 : 1, label: r.a.w });
            IMG.roundRect(g, W - 700, y, 680, bh, 26, FRAME, '#fff', null, 3);
            drawGroup(g, ims[i * 2 + 1], r.nb, W - 684, y + 14, 648, bh - 28, { scale: DB.imageOf(r.b).small ? 0.8 : 1, label: r.b.w });
            if (young) IMG.text(g, '?', W / 2, y + bh / 2 + 30, 90, { align: 'center', bold: true, color: MUTED });
            else IMG.roundRect(g, W / 2 - 70, y + bh / 2 - 70, 140, 140, 20, INK, '#fff', null, 5);
          });
        });
      },
      play: { name: young ? 'Где больше?' : 'Больше, меньше, поровну', lines: rows.map(function (r) { return ['Логопед', ask(r)]; }).concat([['Дети', rows.map(answer).join(' ')]]) }
    };
  };

  G.m_order = function (L) {
    var list = countables(L).filter(function (e) { return ORD[e.g]; });
    if (list.length < 4) return null;
    var n = Math.min(L.age === '4' ? 5 : 7, list.length);
    var row = U.sample(list, n, L.rnd);
    var qn = L.age === '4' ? 2 : 3;
    var asked = U.sample(rangeTo(1, n), qn, L.rnd).sort(function (a, b) { return a - b; });
    var mark = 1 + Math.floor(L.rnd() * n);
    var qs = asked.map(function (p) { var e = row[p - 1]; return WHICH[e.g] + ' по счёту ' + e.w + '?'; });
    var cw = (W - 40) / n, pic = Math.min(cw - 24, 200), H = pic + (L.captions ? 170 : 130);
    return {
      type: 'm_order', title: 'Какой по счёту?', area: 'Математика: порядковый счёт',
      goal: 'упражнять в порядковом счёте, учить отвечать на вопросы «Какой по счёту?», «Который?», согласовывать порядковые числительные с существительными',
      instr: 'Посчитай картинки слева направо. ' + qs.join(' ') + (L.age === '4' ? '' : ' Обведи ' + ORD_ACC_F[mark] + ' картинку.') +
        (L.age === '6' ? ' Напиши в окошке под каждой картинкой её номер.' : ''),
      note: cap(asked.map(function (p) { var e = row[p - 1]; return e.w + ' — ' + ord(p, e.g); }).join('; ')) + '.' +
        (L.age === '4' ? '' : ' Обвести: ' + row[mark - 1].w + ' (' + ord(mark, 'ж') + ' картинка).'),
      words: row, h: H,
      draw: function (cv) {
        var g = cv.getContext('2d');
        return Promise.all(row.map(function (e) { return IMG.word(e, 'c'); })).then(function (ims) {
          IMG.line(g, 60, 26, W - 90, 26, 5, ACCENT);
          IMG.line(g, W - 90, 26, W - 116, 10, 5, ACCENT);
          IMG.line(g, W - 90, 26, W - 116, 42, 5, ACCENT);
          row.forEach(function (e, i) {
            var x = 20 + i * cw, y = 50;
            IMG.roundRect(g, x + 6, y, cw - 12, pic + (L.captions ? 60 : 24), 22, FRAME, '#fff', null, 3);
            IMG.draw(g, ims[i], x + (cw - pic) / 2, y + 10, pic, pic, { label: e.w, scale: DB.imageOf(e).small ? 0.8 : 1 });
            caption(g, e, x, y + pic + 44, cw, L, 26);
            if (L.age === '6') IMG.roundRect(g, x + cw / 2 - 34, H - 76, 68, 68, 12, INK, '#fff', null, 4);
          });
        });
      },
      play: { name: 'Какой по счёту?', lines: asked.map(function (p) { var e = row[p - 1]; return ['Логопед', WHICH[e.g] + ' по счёту ' + e.w + '?']; })
        .concat([['Дети', asked.map(function (p) { var e = row[p - 1]; return cap(e.w) + ' — ' + ord(p, e.g) + '.'; }).join(' ')]]) }
    };
  };

  G.m_pattern = function (L) {
    var list = L.words.filter(function (e) { return !e.of; });
    if (list.length < 3) return null;
    var kinds = L.age === '4' ? ['AB', 'AB'] : (L.age === '5' ? ['AB', 'AAB'] : ['ABC', 'AABB']);
    var rows = kinds.map(function (k) {
      var letters = U.uniq(k.split('')), pick = U.sample(list, letters.length, L.rnd), map = {};
      letters.forEach(function (ch, i) { map[ch] = pick[i]; });
      var len = k === 'ABC' ? 9 : 8, blanks = L.age === '4' ? 2 : 3;
      var seq = rangeTo(0, len - 1).map(function (i) { return map[k[i % k.length]]; });
      return { seq: seq, blanks: blanks, len: len };
    });
    var cw0 = (W - 40) / 9, pic = cw0 - 22, rh = pic + 50, H = rows.length * rh + 20;
    function show(r) { return r.seq.slice(0, r.len - r.blanks).map(function (e) { return e.w; }).join(', '); }
    function next(r) { return r.seq.slice(r.len - r.blanks).map(function (e) { return e.w; }).join(', '); }
    return {
      type: 'm_pattern', title: 'Продолжи ряд', area: 'Математика: закономерность',
      goal: 'учить находить закономерность в ряду предметов и продолжать её, развивать логическое мышление',
      instr: 'Посмотри, как чередуются картинки. Что будет дальше? Назови и дорисуй в пустых клеточках недостающие картинки.',
      note: rows.map(function (r, i) { return (i + 1) + ') ' + show(r) + '… Дальше: ' + next(r) + '.'; }).join(' '),
      words: U.uniq([].concat.apply([], rows.map(function (r) { return r.seq; }))), h: H,
      draw: function (cv) {
        var g = cv.getContext('2d');
        var flat = []; rows.forEach(function (r) { flat = flat.concat(r.seq); });
        return Promise.all(flat.map(function (e) { return IMG.word(e, 'c'); })).then(function (ims) {
          var k = 0;
          rows.forEach(function (r, ri) {
            var y = 10 + ri * rh, cw = (W - 40) / r.len;
            r.seq.forEach(function (e, i) {
              var x = 20 + i * cw, blank = i >= r.len - r.blanks;
              IMG.roundRect(g, x + 4, y, cw - 8, rh - 22, 18, blank ? ACCENT : FRAME, blank ? '#fbfbff' : '#fff', blank ? [14, 10] : null, blank ? 4 : 3);
              if (!blank) IMG.draw(g, ims[k], x + (cw - pic) / 2, y + 10, pic, pic, { label: e.w, scale: DB.imageOf(e).small ? 0.8 : 1 });
              else IMG.text(g, '?', x + cw / 2, y + (rh - 22) / 2 + 22, 64, { align: 'center', bold: true, color: '#c7c9e0' });
              k++;
            });
          });
        });
      },
      play: { name: 'Что будет дальше?', lines: rows.map(function (r) { return ['Логопед', 'Продолжите ряд: ' + show(r) + '…']; })
        .concat([['Дети', rows.map(function (r) { return cap(next(r)) + '.'; }).join(' ')]]) }
    };
  };

  G.m_size = function (L) {
    var list = L.words.filter(function (e) { return !e.of; });
    if (!list.length) return null;
    var e = U.pick(list, L.rnd);
    var n = L.age === '4' ? 3 : (L.age === '5' ? 4 : 5);
    var scales = rangeTo(0, n - 1).map(function (i) { return 0.42 + i * (0.58 / (n - 1)); });
    var order = U.shuffle(rangeTo(0, n - 1), L.rnd);
    var young = L.age === '4';
    var cw = (W - 40) / n, box = Math.min(cw - 30, 300), H = box + (young ? 40 : 130);
    var small = order.indexOf(0), big = order.indexOf(n - 1);
    var rank = order.map(function (s) { return s + 1; });
    return {
      type: 'm_size', title: young ? 'Большой и маленький' : 'От маленького к большому', area: 'Математика: величина',
      goal: 'учить сравнивать предметы по величине, раскладывать их в порядке возрастания, употреблять слова «большой», «поменьше», «самый маленький»',
      instr: young ? 'Обведи ' + supAcc(e, true) + ' ' + DB.acc(e) + ', а ' + supAcc(e, false) + ' зачеркни.'
        : 'Пронумеруй картинки от самой маленькой до самой большой: напиши в кружках 1, 2, 3…',
      note: young ? 'Самая большая — ' + (big + 1) + '-я картинка слева, самая маленькая — ' + (small + 1) + '-я.'
        : 'Номера слева направо: ' + rank.join(', ') + '.',
      words: [e], h: H,
      draw: function (cv) {
        var g = cv.getContext('2d');
        return IMG.word(e, 'c').then(function (im) {
          order.forEach(function (s, i) {
            var x = 20 + i * cw + (cw - box) / 2;
            IMG.draw(g, im, x, 10, box, box, { scale: scales[s], alignBottom: true, label: e.w });
            if (!young) IMG.circle(g, x + box / 2, box + 70, 40, INK, '#fff', 4);
          });
          IMG.line(g, 20, box + 16, W - 20, box + 16, 3, FRAME);
        });
      },
      play: { name: 'Большой — маленький', lines: [['Логопед', 'Покажите ' + supAcc(e, true) + ' ' + DB.acc(e) + '. А теперь ' + supAcc(e, false) + '. Разложите картинки от самой маленькой до самой большой.'],
        ['Дети', 'Показывают и раскладывают картинки по величине, объясняют: «Это самая маленькая картинка, эта больше, а эта самая большая».']] }
    };
  };

  G.m_sum = function (L) {
    if (L.age === '4') return null;
    var list = countables(L);
    if (!list.length) return null;
    var max = L.age === '5' ? 5 : 10;
    var ws = U.sample(list, 2, L.rnd);
    var e1 = ws[0], e2 = ws[1] || ws[0];
    var a = 1 + Math.floor(L.rnd() * (max - 2)), b = 1 + Math.floor(L.rnd() * (max - a));
    var probs = [{ op: '+', e: e1, a: a, b: b, r: a + b }];
    if (L.age === '6') {
      var n = 4 + Math.floor(L.rnd() * (max - 3)), k = 2 + Math.floor(L.rnd() * (n - 2));
      probs.push({ op: '−', e: e2, a: n, b: k, r: n - k });
    } else {
      var c = 1 + Math.floor(L.rnd() * (max - 2)), d = 1 + Math.floor(L.rnd() * (max - c));
      probs.push({ op: '+', e: e2, a: c, b: d, r: c + d });
    }
    function textOf(p) {
      if (p.op === '+') return cap(DB.count(p.e, p.a)) + ' и ещё ' + DB.count(p.e, p.b) + '. Сколько всего ' + p.e.gp + '?';
      return 'Нарисовано ' + DB.count(p.e, p.a) + '. ' + cap(U.numWord(p.b, 'ж')) + ' ' + U.plural(p.b, 'картинку', 'картинки', 'картинок') + ' зачеркнули. Сколько ' + p.e.gp + ' осталось?';
    }
    function eq(p) { return p.a + ' ' + p.op + ' ' + p.b + ' = ' + p.r; }
    var rh = 300, H = probs.length * rh + 10;
    return {
      type: 'm_sum', title: 'Реши задачу', area: 'Математика: сложение и вычитание',
      goal: 'учить решать простые задачи на ' + (L.age === '6' ? 'сложение и вычитание' : 'сложение') + ' в пределах ' + max + ' с опорой на картинки, отвечать полным ответом',
      instr: 'Послушай задачу, посмотри на картинки и запиши ответ в окошко. ' + probs.map(function (p, i) { return (i + 1) + ') ' + textOf(p); }).join(' '),
      note: probs.map(function (p) { return eq(p) + ' (' + DB.count(p.e, p.r) + ')'; }).join('; ') + '.',
      words: U.uniq([e1, e2]), h: H,
      draw: function (cv) {
        var g = cv.getContext('2d');
        return Promise.all(probs.map(function (p) { return IMG.word(p.e, 'c'); })).then(function (ims) {
          probs.forEach(function (p, i) {
            var y = 10 + i * rh, bh = rh - 30, sc = DB.imageOf(p.e).small ? 0.8 : 1;
            if (p.op === '+') {
              IMG.roundRect(g, 20, y, 560, bh, 24, FRAME, '#fff', null, 3);
              drawGroup(g, ims[i], p.a, 34, y + 12, 532, bh - 24, { scale: sc, label: p.e.w });
              IMG.text(g, '+', 640, y + bh / 2 + 34, 110, { align: 'center', bold: true, color: ACCENT });
              IMG.roundRect(g, 700, y, 480, bh, 24, FRAME, '#fff', null, 3);
              drawGroup(g, ims[i], p.b, 714, y + 12, 452, bh - 24, { scale: sc, label: p.e.w });
            } else {
              IMG.roundRect(g, 20, y, 1160, bh, 24, FRAME, '#fff', null, 3);
              var spots = drawGroup(g, ims[i], p.a, 34, y + 12, 1132, bh - 24, { scale: sc, label: p.e.w });
              spots.slice(p.a - p.b).forEach(function (s) { cross(g, s.x, s.y, s.s); });
            }
            IMG.text(g, '=', 1250, y + bh / 2 + 34, 110, { align: 'center', bold: true, color: ACCENT });
            IMG.roundRect(g, 1330, y + bh / 2 - 90, 180, 180, 24, INK, '#fff', null, 5);
            if (L.age === '6') IMG.text(g, p.a + ' ' + p.op + ' ' + p.b + ' =', 1420, y + bh + 22, 30, { align: 'center', color: MUTED });
          });
        });
      },
      play: { name: 'Реши задачу', lines: probs.map(function (p) { return ['Логопед', 'Послушайте задачу. ' + textOf(p)]; })
        .concat([['Дети', probs.map(function (p) { return cap(DB.count(p.e, p.r)) + '. ' + eq(p) + '.'; }).join(' ')]]) }
    };
  };

  G.m_space = function (L) {
    var list = L.words.filter(function (e) { return !e.of; });
    if (list.length < 4) return null;
    var rows = 2, cols = 2;
    if (L.age !== '4') { if (list.length >= 9) { rows = 3; cols = 3; } else if (list.length >= 6) { rows = 2; cols = 3; } }
    var cells = U.sample(list, rows * cols, L.rnd), grid = [];
    for (var r = 0; r < rows; r++) grid.push(cells.slice(r * cols, (r + 1) * cols));
    var qs = [], used = {};
    function add(q, ans) { if (ans && !used[q] && !used['=' + ans.w] && qs.length < (L.age === '4' ? 3 : 4)) { used[q] = used['=' + ans.w] = 1; qs.push({ q: q, a: ans }); } }
    if (rows === 3 && cols === 3) add(kto(grid[1][1]) + ' в центре?', grid[1][1]);
    /* только вопросы с единственным ответом: соседняя клетка в том же ряду (столбце), и других клеток в этом направлении нет */
    var cand = [];
    for (r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var ref = grid[r][c];
      if (!ref.gs) continue;
      if (c === 1) cand.push(['left', kto(grid[r][0]) + ' слева от ' + ref.gs + '?', grid[r][0]]);
      if (c === cols - 2) cand.push(['right', kto(grid[r][cols - 1]) + ' справа от ' + ref.gs + '?', grid[r][cols - 1]]);
      if (L.age !== '4' && r === 1) cand.push(['up', kto(grid[0][c]) + ' выше ' + ref.gs + '?', grid[0][c]]);
      if (L.age !== '4' && r === rows - 2) cand.push(['down', kto(grid[rows - 1][c]) + ' ниже ' + ref.gs + '?', grid[rows - 1][c]]);
    }
    if (L.age !== '4') {
      cand.push(['corner', kto(grid[0][cols - 1]) + ' в правом верхнем углу?', grid[0][cols - 1]]);
      cand.push(['corner', kto(grid[rows - 1][0]) + ' в левом нижнем углу?', grid[rows - 1][0]]);
    }
    cand = U.shuffle(cand, L.rnd);
    var kinds = {};
    cand.forEach(function (x) { if (!kinds[x[0]]) { kinds[x[0]] = 1; add(x[1], x[2]); } });
    cand.forEach(function (x) { add(x[1], x[2]); });
    function where(x) { return x.q.replace(/^(Кто нарисован|Что нарисовано) /, '').replace(/\?$/, ''); }
    var cw = (W - 40) / cols, ch = Math.min(cw, 300), H = rows * ch + 30;
    return {
      type: 'm_space', title: 'Где что нарисовано?', area: 'Математика: ориентировка',
      goal: 'учить ориентироваться на листе бумаги, употреблять слова «слева», «справа», «выше», «в центре», «в углу»',
      instr: 'Рассмотри картинки и ответь на вопросы. ' + qs.map(function (x) { return x.q; }).join(' '),
      note: cap(qs.map(function (x) { return where(x) + ' — ' + x.a.w; }).join('; ')) + '.',
      words: cells, h: H,
      draw: function (cv) {
        var g = cv.getContext('2d');
        return Promise.all(cells.map(function (e) { return IMG.word(e, 'c'); })).then(function (ims) {
          IMG.roundRect(g, 14, 10, W - 28, rows * ch + 10, 26, INK, '#fff', null, 5);
          for (var rr = 0; rr < rows; rr++) for (var cc = 0; cc < cols; cc++) {
            var e = grid[rr][cc], x = 20 + cc * cw, y = 15 + rr * ch;
            if (cc > 0) IMG.line(g, x, 15, x, 15 + rows * ch, 3, FRAME);
            if (rr > 0) IMG.line(g, 20, y, W - 20, y, 3, FRAME);
            var p = ch - 40;
            IMG.draw(g, ims[rr * cols + cc], x + (cw - p) / 2, y + 10, p, p - (L.captions ? 30 : 0), { label: e.w, scale: DB.imageOf(e).small ? 0.8 : 1 });
            caption(g, e, x, y + ch - 14, cw, L, 26);
          }
        });
      },
      play: { name: 'Где что нарисовано?', lines: qs.map(function (x) { return ['Логопед', x.q]; })
        .concat([['Дети', qs.map(function (x) { return cap(where(x)) + ' — ' + x.a.w + '.'; }).join(' ')]]) }
    };
  };

  /* ---------- Окружающий мир на материале темы ---------- */
  G.w_true = function (L) {
    if (L.age === '4') return null;
    var games = (L.theme.talk || []).filter(function (t) {
      return /где|живёт|растёт|ест|питается|любит|работает|нужен|нужна|нужно|делает/i.test(t.name + ' ' + t.qt) && !/цвет|почему/i.test(t.name + ' ' + t.qt) && t.items.length >= 3;
    });
    var pool = [];
    games.forEach(function (t) {
      t.items.forEach(function (it) {
        var e = E(it[0]);
        if (!e || !IMG.hasPicture(e)) return;
        var wrong = t.items.filter(function (o) { return o[1] !== it[1] && !t.items.some(function (z) { return z[0] === it[0] && z[1] === o[1]; }); });
        pool.push({ t: t, it: it, e: e, wrong: wrong });
      });
    });
    if (pool.length < 4) return null;
    var pick = U.sample(pool, 4, L.rnd);
    var rows = pick.map(function (p, i) {
      var truth = sayFill(p.t.tpl, p.it[0], p.it[1]);
      if (i % 2 === 1 && p.wrong.length) {
        var w = U.pick(p.wrong, L.rnd);
        return { e: p.e, text: sayFill(p.t.tpl, p.it[0], w[1]), ok: false, fix: truth };
      }
      return { e: p.e, text: truth, ok: true };
    });
    rows = U.shuffle(rows, L.rnd);
    /** Предложение внутри кавычек посреди фразы — без конечной точки */
    function quote(s) { return String(s).replace(/\.$/, ''); }
    var rh = 190, H = rows.length * rh + 10;
    return {
      type: 'w_true', title: 'Верно или неверно?', area: 'Окружающий мир',
      goal: 'уточнять представления детей об объектах темы, учить находить ошибку и доказывать своё мнение',
      instr: 'Послушай, что говорит взрослый. Если это правда — обведи галочку, если неправда — обведи крестик и скажи, как правильно.',
      note: rows.map(function (r, i) { return (i + 1) + ') «' + quote(r.text) + '» — ' + (r.ok ? 'верно' : 'неверно, правильно: «' + quote(r.fix) + '»'); }).join('; ') + '.',
      statements: rows.map(function (r) { return r.text; }),
      words: U.uniq(rows.map(function (r) { return r.e; })), h: H,
      draw: function (cv) {
        var g = cv.getContext('2d');
        return Promise.all(rows.map(function (r) { return IMG.word(r.e, 'c'); })).then(function (ims) {
          rows.forEach(function (r, i) {
            var y = 5 + i * rh, bh = rh - 20;
            IMG.roundRect(g, 20, y, W - 40, bh, 24, FRAME, '#fff', null, 3);
            IMG.draw(g, ims[i], 40, y + 10, bh - 20, bh - 20, { label: r.e.w, scale: DB.imageOf(r.e).small ? 0.8 : 1 });
            IMG.text(g, String(i + 1), 40 + bh, y + bh / 2 + 16, 44, { bold: true, color: ACCENT });
            IMG.wrap(g, r.text, 110 + bh, y + 56, W - 560 - bh, 34, 42, { color: INK });
            var bx = W - 380;
            IMG.roundRect(g, bx, y + 20, 150, bh - 40, 20, '#16a34a', '#f0fdf4', null, 4);
            IMG.line(g, bx + 40, y + bh / 2, bx + 68, y + bh / 2 + 28, 10, '#16a34a');
            IMG.line(g, bx + 68, y + bh / 2 + 28, bx + 112, y + bh / 2 - 30, 10, '#16a34a');
            var cx = W - 200;
            IMG.roundRect(g, cx, y + 20, 150, bh - 40, 20, '#dc2626', '#fef2f2', null, 4);
            IMG.line(g, cx + 45, y + bh / 2 - 32, cx + 105, y + bh / 2 + 32, 10, '#dc2626');
            IMG.line(g, cx + 105, y + bh / 2 - 32, cx + 45, y + bh / 2 + 32, 10, '#dc2626');
          });
        });
      },
      play: { name: 'Верно или неверно?', lines: rows.map(function (r) { return ['Логопед', 'Верно или нет: «' + quote(r.text) + '»?']; })
        .concat([['Дети', rows.map(function (r) { return r.ok ? 'Верно!' : 'Неверно! ' + r.fix; }).join(' ')]]) }
    };
  };

  G.w_describe = function (L) {
    var all = L.words.filter(function (e) { return !e.of; });
    var list = all.filter(function (e) { return (e.adj || []).length >= 2 && (e.v || []).length >= 1; });
    if (list.length < 2 || all.length < 3) return null;
    var chosen = U.sample(list, L.age === '4' ? 1 : 2, L.rnd);
    var rows = chosen.map(function (e) {
      var others = U.sample(all.filter(function (x) { return x.w !== e.w; }), 2, L.rnd);
      return { e: e, opts: U.shuffle([e].concat(others), L.rnd), text: cap(e.adj.slice(0, 3).join(', ')) + '. ' + cap(e.v.slice(0, 2).join(', ')) + '. ' + (e.anim ? 'Кто это?' : 'Что это?') };
    });
    var rh = 400;
    return {
      type: 'w_describe', title: 'Узнай по описанию', area: 'Окружающий мир',
      goal: 'учить узнавать предмет по описанию его признаков и действий, развивать внимание и мышление',
      instr: 'Послушай описание. Найди среди картинок, о ком (о чём) говорится, и обведи. Докажи свой ответ.',
      note: rows.map(function (r) { return '«' + r.text + '» — ' + r.e.w; }).join('; ') + '.',
      riddles: rows.map(function (r) { return r.text; }),
      words: rows.map(function (r) { return r.e; }), h: rows.length * rh + 10,
      draw: function (cv) {
        var g = cv.getContext('2d');
        var flat = []; rows.forEach(function (r) { flat = flat.concat(r.opts); });
        return Promise.all(flat.map(function (e) { return IMG.word(e, 'c'); })).then(function (ims) {
          rows.forEach(function (r, ri) {
            var y = 5 + ri * rh;
            IMG.roundRect(g, 20, y, W - 40, rh - 20, 30, FRAME, '#fff', null, 3);
            var th = IMG.wrap(g, '«' + r.text + '»', 60, y + 60, W - 120, 38, 48, { color: INK, italic: true });
            r.opts.forEach(function (e, i) {
              var cw = (W - 80) / 3;
              IMG.draw(g, ims[ri * 3 + i], 40 + i * cw + (cw - 230) / 2, y + 40 + th, 230, rh - 90 - th, { label: e.w, scale: DB.imageOf(e).small ? 0.75 : 1 });
            });
          });
        });
      },
      play: { name: 'Узнай по описанию', lines: rows.map(function (r) { return ['Логопед', '«' + r.text + '»']; })
        .concat([['Дети', rows.map(function (r) { return 'Это ' + r.e.w + '!'; }).join(' ')]]) }
    };
  };

  G.w_diff = function (L) {
    var list = L.words.filter(function (e) { return !e.of; });
    if (list.length < 5) return null;
    var nObj = L.age === '4' ? 5 : Math.min(7, list.length);
    var nDiff = L.age === '4' ? 2 : (L.age === '5' ? 3 : 4);
    var objs = U.sample(list, nObj, L.rnd);
    var spare = list.filter(function (e) { return objs.indexOf(e) < 0; });
    var rnd = U.rng(Math.floor(L.rnd() * 1e9));
    var PW = W - 60, PH = 470, sz = 170, spots = [];
    objs.forEach(function () {
      var p, tries = 0;
      do { p = { x: 20 + rnd() * (PW - sz - 40), y: 10 + rnd() * (PH - sz - 20) }; tries++; }
      while (tries < 300 && spots.some(function (q) { return Math.abs(q.x - p.x) < sz * 0.95 && Math.abs(q.y - p.y) < sz * 0.95; }));
      spots.push(p);
    });
    var types = ['missing', 'replace', 'bigger', 'flip'];
    var changes = [], idx = U.shuffle(rangeTo(0, nObj - 1), L.rnd);
    for (var i = 0; i < idx.length && changes.length < nDiff; i++) {
      var e = objs[idx[i]];
      var opts = types.filter(function (t) {
        if (t === 'missing') return !!e.gs && !changes.some(function (c) { return c.type === 'missing'; });
        if (t === 'replace') return !!e.gs && spare.length > 0;
        if (t === 'flip') return !!e.anim;
        return true;
      });
      var fresh = opts.filter(function (x) { return !changes.some(function (c) { return c.type === x; }); });
      var t = fresh.length ? fresh[Math.floor(rnd() * fresh.length)] : opts[changes.length % opts.length];
      var ch = { i: idx[i], type: t, e: e };
      if (t === 'replace') { ch.r = spare.splice(Math.floor(rnd() * spare.length), 1)[0]; }
      changes.push(ch);
    }
    function sayChange(c) {
      var e = c.e, g4 = { 'м': 0, 'ж': 1, 'ср': 2, 'мн': 3 }[e.g] || 0;
      if (c.type === 'missing') return 'внизу нет ' + e.gs;
      if (c.type === 'replace') return 'вместо ' + e.gs + ' — ' + c.r.w;
      if (c.type === 'bigger') return e.w + ' ' + ['стал', 'стала', 'стало', 'стали'][g4] + ' больше';
      return e.w + ' ' + ['повернулся', 'повернулась', 'повернулось', 'повернулись'][g4] + ' в другую сторону';
    }
    var H = PH * 2 + 60;
    return {
      type: 'w_diff', title: 'Найди отличия', area: 'Внимание, окружающий мир',
      goal: 'развивать зрительное внимание, учить сравнивать изображения и называть различия полным ответом',
      instr: 'Сравни две картинки. Найди ' + nDiff + ' ' + U.plural(nDiff, 'отличие', 'отличия', 'отличий') + ' и обведи их на нижней картинке. Расскажи, что изменилось.',
      note: cap(changes.map(sayChange).join('; ')) + '.',
      words: objs.concat(changes.filter(function (c) { return c.r; }).map(function (c) { return c.r; })), h: H,
      draw: function (cv) {
        var g = cv.getContext('2d');
        var extra = changes.filter(function (c) { return c.r; }).map(function (c) { return c.r; });
        return Promise.all(objs.concat(extra).map(function (e) { return IMG.word(e, 'c'); })).then(function (ims) {
          [0, 1].forEach(function (panel) {
            var oy = 10 + panel * (PH + 40);
            IMG.roundRect(g, 20, oy, W - 40, PH, 30, INK, panel ? '#fffdf5' : '#fbfcff', null, 4);
            objs.forEach(function (e, k) {
              var c = panel ? changes.filter(function (x) { return x.i === k; })[0] : null;
              if (c && c.type === 'missing') return;
              var im = ims[k], s = sz, dx = 0, flip = false;
              if (c && c.type === 'replace') im = ims[objs.length + extra.indexOf(c.r)];
              if (c && c.type === 'bigger') { s = sz * 1.35; dx = -sz * 0.17; }
              if (c && c.type === 'flip') flip = true;
              IMG.draw(g, im, 30 + spots[k].x + dx, oy + spots[k].y + dx, s, s, { flip: flip, label: e.w });
            });
          });
        });
      },
      play: { name: 'Найди отличия', lines: [['Логопед', 'Сравните две картинки. Что изменилось на нижней картинке?'], ['Дети', changes.map(function (c) { return cap(sayChange(c)); }).join('. ') + '.']] }
    };
  };

  /* ---------- каталог и подбор ---------- */
  /** Области заданий: речь, математика (ФЭМП), окружающий мир, моторика и внимание */
  var AREAS = [['speech', 'Речь'], ['math', 'Математика'], ['world', 'Окружающий мир'], ['motor', 'Моторика и внимание']];
  var CATALOG = [
    ['name', 'Назови и покажи', ['speech', 'world']], ['odd', 'Четвёртый лишний', ['world', 'speech']], ['groups', 'Разложи по группам', ['world']],
    ['many', 'Один — много', ['speech']], ['count', 'Посчитай', ['speech', 'math']], ['find', 'Найди и посчитай', ['math', 'speech']], ['dim', 'Назови ласково', ['speech']],
    ['baby', 'У кого кто? (детёныши)', ['world', 'speech']], ['food', 'Кто что ест? / Кому что нужно?', ['world', 'speech']], ['home', 'Кто где живёт?', ['world']], ['tool', 'Кому что нужно?', ['world']],
    ['forms', 'Какой? (словообразование)', ['speech']], ['poss', 'Чей? Чья? Чьё?', ['speech']], ['prep', 'Предлоги: где?', ['speech', 'math']],
    ['hear', 'Поймай звук', ['speech']], ['sound', 'Где спрятался звук?', ['speech']], ['syll', 'Слоги', ['speech']], ['first', 'Первый звук', ['speech']],
    ['riddle', 'Отгадай загадку', ['speech', 'world']], ['mnemo', 'Рассказ по схеме', ['speech']], ['sinkvein', 'Синквейн', ['speech']],
    ['m_number', 'Сосчитай и соедини с цифрой', ['math']], ['m_compare', 'Больше, меньше, поровну', ['math']], ['m_order', 'Какой по счёту?', ['math']],
    ['m_pattern', 'Продолжи ряд (закономерность)', ['math']], ['m_size', 'Большой — маленький (величина)', ['math']], ['m_sum', 'Реши задачу', ['math']],
    ['m_space', 'Где что нарисовано? (ориентировка)', ['math']],
    ['w_true', 'Верно или неверно?', ['world']], ['w_describe', 'Узнай по описанию', ['world', 'speech']], ['w_diff', 'Найди отличия', ['world', 'motor']],
    ['maze', 'Лабиринт', ['motor']], ['trace', 'Обведи дорожки', ['motor']], ['shadow', 'Найди тень', ['motor']], ['overlap', 'Кто спрятался?', ['motor']],
    ['color', 'Раскрась', ['motor']], ['puzzle', 'Разрезная картинка', ['motor']]
  ];
  function areasOf(id) { var c = CATALOG.filter(function (x) { return x[0] === id; })[0]; return c ? c[2] : []; }

  var PRESET = {
    complex: ['name', 'sound', 'hear', 'many', 'count', 'baby', 'food', 'odd', 'mnemo', 'maze', 'color'],
    lex: ['name', 'odd', 'many', 'count', 'dim', 'baby', 'food', 'forms', 'poss', 'groups', 'prep', 'find'],
    sound: ['hear', 'sound', 'syll', 'first', 'riddle', 'trace', 'color'],
    coherent: ['name', 'riddle', 'mnemo', 'sinkvein', 'food', 'prep', 'color'],
    literacy: ['sound', 'hear', 'syll', 'first', 'riddle', 'maze'],
    math: ['m_number', 'm_compare', 'm_order', 'm_sum', 'm_pattern', 'm_space', 'm_size', 'find', 'maze', 'color'],
    world: ['name', 'groups', 'odd', 'food', 'home', 'baby', 'tool', 'w_true', 'w_describe', 'w_diff', 'riddle', 'color'],
    mixed: ['name', 'sound', 'many', 'm_number', 'm_compare', 'groups', 'food', 'w_describe', 'm_pattern', 'maze', 'color']
  };

  /** Какие задания возможны для урока (с учётом темы, слов, звука, возраста) */
  function available(L) {
    var out = [];
    CATALOG.forEach(function (c) {
      try {
        var t = G[c[0]](Object.assign({}, L, { rnd: U.rng(1) }));
        if (t) out.push(c[0]);
      } catch (e) { if (window.console) console.warn('task', c[0], e); }
    });
    return out;
  }

  function defaults(L, avail) {
    var pre = PRESET[L.direction] || PRESET.complex;
    var picks = pre.filter(function (id) { return avail.indexOf(id) >= 0; });
    if (picks.indexOf('sound') >= 0 && picks.indexOf('hear') >= 0) picks.splice(picks.indexOf('hear'), 1);
    if (picks.indexOf('baby') >= 0 && picks.indexOf('food') >= 0 && L.age === '4') picks.splice(picks.indexOf('food'), 1);
    var max = L.age === '4' ? 6 : 8;
    ['shadow', 'trace', 'overlap', 'color'].forEach(function (x) { if (picks.length < max && avail.indexOf(x) >= 0 && picks.indexOf(x) < 0) picks.push(x); });
    return picks.slice(0, max);
  }

  function build(L, ids) {
    var out = [];
    ids.forEach(function (id, i) {
      if (!G[id]) return;
      var rnd = U.rng(U.hash(L.seed + '|' + id + '|' + (L.reroll && L.reroll[id] || 0)));
      try {
        var t = G[id](Object.assign({}, L, { rnd: rnd }));
        if (t) { t.id = id; if (t.note) t.note = cap(t.note); out.push(t); }
      } catch (e) { if (window.console) console.error('task', id, e); }
    });
    return out;
  }

  function render(t, scale) {
    var s = scale || 1;
    var cv = IMG.canvas(W * s, t.h * s);
    var g = cv.getContext('2d');
    if (s !== 1) g.scale(s, s);
    return Promise.resolve(t.draw(cv)).then(function () { return cv; });
  }

  return { G: G, CATALOG: CATALOG, AREAS: AREAS, areasOf: areasOf, PRESET: PRESET, available: available, defaults: defaults, build: build, render: render, W: W, withPic: withPic, themeWords: themeWords };
})();
