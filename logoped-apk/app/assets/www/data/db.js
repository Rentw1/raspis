'use strict';
/*
 * Словарь и темы.
 * Строка слова: им.ед | род.ед | им.мн | род.мн | род(м/ж/ср/мн) | ласк. | картинка | англ. | доп.
 * «-» — формы нет. Картинка: код OpenMoji (1F408), своя картинка (x:kapusta) или of:кошка (детёныш — по картинке мамы).
 * Доп.: anim; mass; poss=кошачий; baby=котёнок; adj=а,б,в; v=глагол,глагол
 */
var DB = (function () {
  var words = {}, themes = [], byId = {}, problems = [];

  function nn(v) { return (v === undefined || v === '' || v === '-') ? null : v; }
  function list(v) { return v ? v.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : []; }

  function W(text) {
    text.split('\n').forEach(function (raw) {
      var line = raw.trim();
      if (!line || line.charAt(0) === '#') return;
      var p = line.split('|').map(function (s) { return s.trim(); });
      if (p.length < 8) { problems.push('Строка слова: ' + line); return; }
      var e = { w: p[0], gs: nn(p[1]), pl: nn(p[2]), gp: nn(p[3]), g: p[4] || 'м', dim: nn(p[5]), img: nn(p[6]), en: nn(p[7]), adj: [], v: [] };
      (p[8] || '').split(';').forEach(function (kv) {
        kv = kv.trim();
        if (!kv) return;
        var i = kv.indexOf('=');
        if (i < 0) { e[kv] = true; return; }
        var k = kv.slice(0, i).trim(), v = kv.slice(i + 1).trim();
        e[k] = (k === 'adj' || k === 'v') ? list(v) : v;
      });
      if (e.img && e.img.indexOf('of:') === 0) { e.of = e.img.slice(3); e.small = true; }
      if (e.g === 'мн' || e.mass) e.noCount = true;
      if (words[e.w]) problems.push('Повтор слова: ' + e.w);
      words[e.w] = e;
    });
  }

  function T(t) {
    if (byId[t.id]) problems.push('Повтор темы: ' + t.id);
    t.words = t.words || [];
    t.extra = t.extra || [];
    t.pairs = t.pairs || {};
    t.talk = t.talk || [];
    t.sents = t.sents || [];
    t.riddles = t.riddles || [];
    t.routes = t.routes || [];
    t.lit = t.lit || [];
    // формы обобщающего слова: [им.ед, им.мн, род.мн, вин.ед, вин.мн]
    var first = words[t.words[0]];
    t.catAccSg = t.cat[3] || t.cat[0];
    t.catAccPl = t.cat[4] || (first && first.anim ? t.cat[2] : t.cat[1]);
    themes.push(t);
    byId[t.id] = t;
  }

  function word(w) { return words[w] || null; }

  /** Картинка слова (с учётом «детёнышей»): {img (код или null — тогда только замена из интернета), small} */
  function imageOf(w) {
    var e = typeof w === 'string' ? words[w] : w;
    if (!e) return null;
    if (e.of) {
      var parent = words[e.of];
      return { img: parent && parent.img || null, small: true, of: e.of };
    }
    return { img: e.img || null, small: !!e.small };
  }

  /** Добавить слово (своё или от ИИ), если такого ещё нет. Возвращает запись словаря. */
  function addWord(e) {
    if (!e || !e.w) return null;
    if (words[e.w]) return words[e.w];
    e.adj = e.adj || []; e.v = e.v || [];
    if (e.img && e.img.indexOf('of:') === 0) { e.of = e.img.slice(3); e.small = true; }
    if (e.g === 'мн' || e.mass) e.noCount = true;
    words[e.w] = e;
    return e;
  }

  /** Добавить (или заменить) тему, например созданную с помощью ИИ */
  function addTheme(t) {
    removeTheme(t.id);
    T(t);
    return byId[t.id];
  }
  function removeTheme(id) {
    if (!byId[id]) return;
    var i = themes.indexOf(byId[id]);
    if (i >= 0) themes.splice(i, 1);
    delete byId[id];
  }

  /** Притяжательное прилагательное в нужном роде: кошачий → кошачья / кошачье / кошачьи */
  function poss(m, g) {
    if (!m) return null;
    var st;
    if (/ий$/.test(m) && !/(ский|цкий)$/.test(m)) {
      st = m.slice(0, -2);
      return g === 'ж' ? st + 'ья' : g === 'ср' ? st + 'ье' : g === 'мн' ? st + 'ьи' : m;
    }
    if (/(ый|ой)$/.test(m)) {
      st = m.slice(0, -2);
      return g === 'ж' ? st + 'ая' : g === 'ср' ? st + 'ое' : g === 'мн' ? st + 'ые' : m;
    }
    if (/(ин|ын|ов|ев)$/.test(m)) {
      return g === 'ж' ? m + 'а' : g === 'ср' ? m + 'о' : g === 'мн' ? m + 'ы' : m;
    }
    return m;
  }

  /** Винительный падеж (про кого? про что?): кошку, кота, мяч, белого медведя, золотую рыбку */
  function acc(w) {
    var e = typeof w === 'string' ? words[w] : w;
    if (!e) return String(w || '');
    var parts = e.w.split(' '), last = parts[parts.length - 1];
    if (e.g === 'мн') return e.anim && e.gp ? e.gp : e.w;
    if (e.g === 'м' && e.anim && e.gs && !/[ая]$/.test(last)) return e.gs;
    if (e.g === 'ср' || /(ь|мя)$/.test(last) || !/[ая]$/.test(last)) return e.w;
    return parts.map(function (t) {
      if (/ая$/.test(t)) return t.slice(0, -2) + 'ую';
      if (/яя$/.test(t)) return t.slice(0, -2) + 'юю';
      if (/ья$/.test(t)) return t.slice(0, -2) + 'ью';
      if (/[^аеёиоуыэюя]а$/i.test(t)) return t.slice(0, -1) + 'у';
      if (/я$/.test(t)) return t.slice(0, -1) + 'ю';
      return t;
    }).join(' ');
  }

  /** «лишний / лишняя / лишнее / лишние» */
  function extraAdj(g) { return { 'м': 'Лишний', 'ж': 'Лишняя', 'ср': 'Лишнее', 'мн': 'Лишние' }[g] || 'Лишний'; }

  /** Счёт: одна кошка, две кошки, пять кошек */
  function count(e, n) {
    if (!e || e.noCount || !e.gs || !e.gp) return null;
    var n10 = n % 10, n100 = n % 100, form;
    if (n10 === 1 && n100 !== 11) form = e.w;
    else if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) {
      // «два белых медведя», «две золотые рыбки»: прилагательное — во мн. ч., существительное — в род. ед.
      var ws = e.w.split(' '), src = (e.g === 'ж' ? e.pl : e.gp);
      form = (ws.length > 1 && src && ws.slice(0, -1).every(function (t) { return /(ый|ий|ой|ая|яя|ое|ее|ья|ье)$/.test(t); }))
        ? src.split(' ').slice(0, -1).concat(e.gs.split(' ').slice(-1)).join(' ')
        : e.gs;
    }
    else form = e.gp;
    return U.numWord(n, e.g) + ' ' + form;
  }

  /** Поиск слова по началу (для добавления своих слов) */
  function search(q, limit) {
    q = String(q || '').toLowerCase().trim();
    if (!q) return [];
    var out = [];
    Object.keys(words).forEach(function (k) {
      if (k.toLowerCase().indexOf(q) === 0 || (words[k].en && words[k].en.indexOf(q) === 0)) out.push(words[k]);
    });
    Object.keys(words).forEach(function (k) {
      if (out.indexOf(words[k]) < 0 && k.toLowerCase().indexOf(q) > 0) out.push(words[k]);
    });
    return out.slice(0, limit || 20);
  }

  /** Подбор темы по свободному тексту (для «своей темы») */
  function guessTheme(text) {
    var t = String(text || '').toLowerCase().replace(/ё/g, 'е');
    if (!t.trim()) return null;
    var best = null, bestScore = 0;
    themes.forEach(function (th) {
      var score = 0;
      var title = th.title.toLowerCase().replace(/ё/g, 'е');
      title.split(/[\s.,«»()]+/).filter(function (x) { return x.length > 3; }).forEach(function (tw) {
        var stem = tw.slice(0, Math.max(4, tw.length - 2));
        if (t.indexOf(stem) >= 0) score += 3;
      });
      th.words.concat(th.extra).forEach(function (w) {
        var stem = w.toLowerCase().replace(/ё/g, 'е');
        stem = stem.slice(0, Math.max(3, stem.length - 1));
        if (t.indexOf(stem) >= 0) score += 2;
      });
      (th.keys || []).forEach(function (k) { if (t.indexOf(k) >= 0) score += 4; });
      if (score > bestScore) { bestScore = score; best = th; }
    });
    return bestScore > 0 ? best : null;
  }

  return {
    W: W, T: T, word: word, words: words, themes: themes, byId: byId, problems: problems,
    imageOf: imageOf, addWord: addWord, addTheme: addTheme, removeTheme: removeTheme, poss: poss, acc: acc, extraAdj: extraAdj, count: count, search: search, guessTheme: guessTheme
  };
})();
