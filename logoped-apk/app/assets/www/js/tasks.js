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
      note: rows.map(function (x) { return '«' + x.r[1] + '» — ' + x.ans.w; }).join(' '),
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

  /* ---------- каталог и подбор ---------- */
  var CATALOG = [
    ['name', 'Назови и покажи'], ['odd', 'Четвёртый лишний'], ['groups', 'Разложи по группам'],
    ['many', 'Один — много'], ['count', 'Посчитай'], ['find', 'Найди и посчитай'], ['dim', 'Назови ласково'],
    ['baby', 'У кого кто? (детёныши)'], ['food', 'Кто что ест? / Кому что нужно?'], ['home', 'Кто где живёт?'], ['tool', 'Кому что нужно?'],
    ['forms', 'Какой? (словообразование)'], ['poss', 'Чей? Чья? Чьё?'], ['prep', 'Предлоги: где?'],
    ['hear', 'Поймай звук'], ['sound', 'Где спрятался звук?'], ['syll', 'Слоги'], ['first', 'Первый звук'],
    ['riddle', 'Отгадай загадку'], ['mnemo', 'Рассказ по схеме'], ['sinkvein', 'Синквейн'],
    ['maze', 'Лабиринт'], ['trace', 'Обведи дорожки'], ['shadow', 'Найди тень'], ['overlap', 'Кто спрятался?'],
    ['color', 'Раскрась'], ['puzzle', 'Разрезная картинка']
  ];

  var PRESET = {
    complex: ['name', 'sound', 'hear', 'many', 'count', 'baby', 'food', 'odd', 'mnemo', 'maze', 'color'],
    lex: ['name', 'odd', 'many', 'count', 'dim', 'baby', 'food', 'forms', 'poss', 'groups', 'prep', 'find'],
    sound: ['hear', 'sound', 'syll', 'first', 'riddle', 'trace', 'color'],
    coherent: ['name', 'riddle', 'mnemo', 'sinkvein', 'food', 'prep', 'color'],
    literacy: ['sound', 'hear', 'syll', 'first', 'riddle', 'maze']
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

  return { G: G, CATALOG: CATALOG, PRESET: PRESET, available: available, defaults: defaults, build: build, render: render, W: W, withPic: withPic, themeWords: themeWords };
})();
