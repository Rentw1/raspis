'use strict';
/*
 * Упрощённый фонетический разбор русского слова (для задач логопеда):
 * мягкость по гласным второго ряда и Ь, оглушение на конце слова,
 * ассимиляция по звонкости/глухости, сч/зч → [щ], [й'] в начале слога.
 * Спорные случаи (смягчение перед мягким согласным: «гвоздь», «мостик»)
 * помечаются amb=true — такие слова не используются для работы над этим звуком.
 */
var PH = (function () {
  var VOWELS = 'аеёиоуыэюя';
  var SOFTV = 'еёиюя';
  var IOT = 'еёюя';
  var VSOUND = { 'а': 'а', 'о': 'о', 'у': 'у', 'ы': 'ы', 'э': 'э', 'е': 'э', 'ё': 'о', 'ю': 'у', 'я': 'а', 'и': 'и' };
  var TO_VOICELESS = { 'б': 'п', 'в': 'ф', 'г': 'к', 'д': 'т', 'ж': 'ш', 'з': 'с' };
  var TO_VOICED = { 'п': 'б', 'ф': 'в', 'к': 'г', 'т': 'д', 'ш': 'ж', 'с': 'з' };
  var VOICELESS = 'пфктшсхцчщ';
  var VOICED_TRIGGER = 'бгджз';
  var HARD_ONLY = 'жшц';
  var SOFT_ONLY = 'чщй';
  var CONS = 'бвгджзйклмнпрстфхцчшщ';

  function isV(c) { return VOWELS.indexOf(c) >= 0; }
  function isC(c) { return CONS.indexOf(c) >= 0; }

  /** Разбор одного слова → массив звуков {s, soft, v} */
  function word(w) {
    w = String(w || '').toLowerCase().replace(/[^а-яё]/g, '');
    var res = [], i, ch, prev, next;
    for (i = 0; i < w.length; i++) {
      ch = w.charAt(i); prev = w.charAt(i - 1); next = w.charAt(i + 1);
      if (isV(ch)) {
        var iot = IOT.indexOf(ch) >= 0 && (i === 0 || isV(prev) || prev === 'ъ' || prev === 'ь');
        if (iot || (ch === 'и' && prev === 'ь')) res.push({ s: 'й', soft: true, v: false });
        res.push({ s: VSOUND[ch], soft: false, v: true });
      } else if (isC(ch)) {
        // сч, зч, жч → [щ]
        if ((ch === 'с' || ch === 'з' || ch === 'ж') && next === 'ч') {
          res.push({ s: 'щ', soft: true, v: false });
          i++;
          continue;
        }
        var soft = SOFT_ONLY.indexOf(ch) >= 0 ||
          (HARD_ONLY.indexOf(ch) < 0 && !!next && (SOFTV.indexOf(next) >= 0 || next === 'ь'));
        res.push({ s: ch, soft: soft, v: false });
      }
    }
    // -тся / -ться → [ц]
    for (i = 0; i < res.length - 1; i++) {
      if (res[i].s === 'т' && res[i + 1].s === 'с' && i + 2 < res.length && res[i + 2].s === 'а' && i + 3 === res.length) {
        res.splice(i, 2, { s: 'ц', soft: false, v: false });
      }
    }
    // оглушение на конце и ассимиляция (справа налево)
    for (i = res.length - 1; i >= 0; i--) {
      var cur = res[i];
      if (cur.v) continue;
      var nx = res[i + 1];
      if (!nx) {
        if (TO_VOICELESS[cur.s]) cur.s = TO_VOICELESS[cur.s];
      } else if (!nx.v) {
        if (TO_VOICELESS[cur.s] && VOICELESS.indexOf(nx.s) >= 0) cur.s = TO_VOICELESS[cur.s];
        else if (TO_VOICED[cur.s] && VOICED_TRIGGER.indexOf(nx.s) >= 0) cur.s = TO_VOICED[cur.s];
        if (!cur.soft && 'сзтдн'.indexOf(cur.s) >= 0 && nx.soft && 'тдснлз'.indexOf(nx.s) >= 0) cur.amb = true;
      }
    }
    return res;
  }

  function key(snd) {
    if (!snd) return '';
    return snd.s + (snd.soft && SOFT_ONLY.indexOf(snd.s) < 0 ? "'" : '');
  }

  /** Звуки для выбора логопедом */
  var TARGETS = [
    { id: 'С', key: 'с', name: '[С]', group: 'svist' },
    { id: 'Сь', key: "с'", name: "[С']", group: 'svist' },
    { id: 'З', key: 'з', name: '[З]', group: 'svist' },
    { id: 'Зь', key: "з'", name: "[З']", group: 'svist' },
    { id: 'Ц', key: 'ц', name: '[Ц]', group: 'svist' },
    { id: 'Ш', key: 'ш', name: '[Ш]', group: 'ship' },
    { id: 'Ж', key: 'ж', name: '[Ж]', group: 'ship' },
    { id: 'Ч', key: 'ч', name: "[Ч']", group: 'ship' },
    { id: 'Щ', key: 'щ', name: "[Щ']", group: 'ship' },
    { id: 'Л', key: 'л', name: '[Л]', group: 'l' },
    { id: 'Ль', key: "л'", name: "[Л']", group: 'l' },
    { id: 'Р', key: 'р', name: '[Р]', group: 'r' },
    { id: 'Рь', key: "р'", name: "[Р']", group: 'r' },
    { id: 'К', key: 'к', name: '[К]', group: 'back' },
    { id: 'Г', key: 'г', name: '[Г]', group: 'back' },
    { id: 'Х', key: 'х', name: '[Х]', group: 'back' },
    { id: 'Й', key: 'й', name: "[Й']", group: 'j' }
  ];
  var BY_ID = {};
  TARGETS.forEach(function (t) { BY_ID[t.id] = t; });

  /** Позиции звука в слове (или фразе из нескольких слов) */
  function positions(text, targetId) {
    var t = BY_ID[targetId];
    if (!t) return null;
    var words = String(text).toLowerCase().split(/[\s-]+/).filter(Boolean);
    var out = { has: false, amb: false, pos: [], count: 0, multi: words.length > 1 };
    words.forEach(function (w, wi) {
      var snds = word(w);
      snds.forEach(function (s, i) {
        if (key(s) !== t.key) return;
        if (s.amb) { out.amb = true; return; }
        out.has = true; out.count++;
        if (words.length === 1) out.pos.push(i === 0 ? 'начало' : (i === snds.length - 1 ? 'конец' : 'середина'));
      });
      // «мягкий вариант» того же звука в спорной позиции тоже делает слово спорным
      snds.forEach(function (s) {
        if (s.amb && s.s === t.key.charAt(0)) out.amb = true;
      });
    });
    out.pos = out.pos.filter(function (p, i, a) { return a.indexOf(p) === i; });
    return out;
  }

  function has(text, targetId) {
    var p = positions(text, targetId);
    return !!(p && p.has && !p.amb);
  }

  /** Слово содержит звук, похожий на целевой (для дифференциации/контроля) */
  function hasAny(text, ids) {
    return ids.some(function (id) { return has(text, id); });
  }

  function syllables(text) {
    var n = 0, s = String(text).toLowerCase();
    for (var i = 0; i < s.length; i++) if (isV(s.charAt(i))) n++;
    return n;
  }

  /** Первый звук: {s, type: 'vowel'|'hard'|'soft', label} */
  function firstSound(text) {
    var w = String(text).toLowerCase().split(/\s+/)[0];
    var snd = word(w)[0];
    if (!snd) return null;
    var type = snd.v ? 'vowel' : (snd.soft ? 'soft' : 'hard');
    var label = '[' + snd.s.toUpperCase() + (snd.soft && SOFT_ONLY.indexOf(snd.s) < 0 ? "'" : (snd.s === 'й' || snd.s === 'ч' || snd.s === 'щ' ? "'" : '')) + ']';
    return { s: snd.s, type: type, label: label };
  }

  /** Транскрипция для справки педагогу: кошка → [кошка] */
  function transcript(text) {
    return '[' + String(text).toLowerCase().split(/\s+/).map(function (w) {
      return word(w).map(function (s) { return s.s + (s.soft && !s.v && SOFT_ONLY.indexOf(s.s) < 0 ? "'" : ''); }).join('');
    }).join(' ') + ']';
  }

  var GROUP_NAMES = {
    svist: 'свистящих звуков', ship: 'шипящих звуков', l: 'звука [Л]', r: 'звука [Р]', back: 'заднеязычных звуков', j: "звука [Й']"
  };

  /** Характеристика звука для этапа «Характеристика звука» */
  var CHAR = {
    'С': 'согласный, глухой, твёрдый (обозначаем синим цветом); губы в улыбке, кончик языка за нижними зубами, воздушная струя холодная — «водичка льётся» или «насос»: с-с-с',
    'Сь': 'согласный, глухой, мягкий (обозначаем зелёным цветом); губы в улыбке, кончик языка упирается в нижние зубы — «маленький насос»: сь-сь-сь',
    'З': 'согласный, звонкий, твёрдый (синий); губы в улыбке, кончик языка за нижними зубами, горлышко «работает» — «комарик звенит»: з-з-з',
    'Зь': 'согласный, звонкий, мягкий (зелёный); «маленький комарик»: зь-зь-зь',
    'Ц': 'согласный, глухой, всегда твёрдый (синий); кончик языка за нижними зубами, короткий сильный выдох — «кузнечик стрекочет»: ц-ц-ц',
    'Ш': 'согласный, глухой, всегда твёрдый (синий); губы округлены «бубликом», широкий язык «чашечкой» наверху — «змея шипит»: ш-ш-ш',
    'Ж': 'согласный, звонкий, всегда твёрдый (синий); губы «бубликом», язык «чашечкой» вверху, горлышко работает — «жук жужжит»: ж-ж-ж',
    'Ч': "согласный, глухой, всегда мягкий (зелёный); губы вытянуты вперёд, кончик языка касается бугорков за верхними зубами — «паровоз пыхтит»: ч'-ч'-ч'",
    'Щ': "согласный, глухой, всегда мягкий (зелёный); губы вытянуты, язык поднят к бугоркам, долгий тёплый выдох — «щёточка чистит»: щ'-щ'-щ'",
    'Л': 'согласный, звонкий, твёрдый (синий); кончик языка упирается в верхние зубы — «самолёт гудит»: л-л-л',
    'Ль': "согласный, звонкий, мягкий (зелёный); губы в улыбке, кончик языка за нижними зубами — «ль-ль-ль»",
    'Р': 'согласный, звонкий, твёрдый (синий); кончик языка вибрирует у бугорков за верхними зубами — «тигрёнок рычит» / «мотор заводится»: р-р-р',
    'Рь': "согласный, звонкий, мягкий (зелёный); «маленький моторчик»: рь-рь-рь",
    'К': 'согласный, глухой, твёрдый (синий); спинка языка поднимается к нёбу — «молоточек стучит»: к-к-к',
    'Г': 'согласный, звонкий, твёрдый (синий); «гусь гогочет»: г-г-г',
    'Х': 'согласный, глухой, твёрдый (синий); «греем ладошки»: х-х-х',
    'Й': "согласный, звонкий, всегда мягкий (зелёный); кончик языка за нижними зубами, спинка поднята — й'"
  };

  /** Слоговые дорожки для автоматизации */
  function syllablePaths(targetId) {
    var t = BY_ID[targetId];
    if (!t) return [];
    var c = t.key.charAt(0);
    var soft = t.key.length > 1;
    var voiced = 'згжбдв'.indexOf(c) >= 0; // звонкие в конце оглушаются — обратные слоги не даём
    if (c === 'й') return ['я-ё-ю-е', 'ай-ой-уй-ый', 'ая-оё-ую-ые'];
    if (soft) {
      var s = [c + 'я-' + c + 'ё-' + c + 'ю-' + c + 'и-' + c + 'е'];
      if (!voiced) s.push('а' + c + 'ь-о' + c + 'ь-у' + c + 'ь-и' + c + 'ь');
      s.push('а' + c + 'я-о' + c + 'ё-у' + c + 'ю-и' + c + 'и');
      return s;
    }
    if (c === 'ч' || c === 'щ') {
      return [c + 'а-' + c + 'о-' + c + 'у-' + c + 'и', 'а' + c + '-о' + c + '-у' + c + '-и' + c, 'а' + c + 'а-о' + c + 'о-у' + c + 'у-и' + c + 'и'];
    }
    if ('кгх'.indexOf(c) >= 0) {
      var b = [c + 'а-' + c + 'о-' + c + 'у', 'а' + c + 'а-о' + c + 'о-у' + c + 'у'];
      if (!voiced) b.splice(1, 0, 'а' + c + '-о' + c + '-у' + c + '-ы' + c);
      return b;
    }
    var y = (c === 'ш' || c === 'ж') ? 'и' : 'ы';
    var rows = [c + 'а-' + c + 'о-' + c + 'у-' + c + y];
    if (!voiced) rows.push('а' + c + '-о' + c + '-у' + c + '-ы' + c);
    rows.push('а' + c + 'а-о' + c + 'о-у' + c + 'у' + (y === 'ы' ? '-ы' + c + 'ы' : ''));
    var CL = { 'с': 'ска-ско-ску, ста-сто-сту', 'з': 'зва-зво-зву, зна-зно-зну', 'ш': 'шка-шко-шку, шла-шло-шлу',
      'ж': 'жда-ждо-жду, жма-жмо-жму', 'л': 'кла-кло-клу, пла-пло-плу', 'р': 'тра-тро-тру, кра-кро-кру', 'ц': 'цва-цво-цву' };
    if (CL[c]) rows.push(CL[c]);
    return rows;
  }

  return {
    word: word, key: key, positions: positions, has: has, hasAny: hasAny, syllables: syllables,
    firstSound: firstSound, transcript: transcript, TARGETS: TARGETS, BY_ID: BY_ID, GROUP_NAMES: GROUP_NAMES,
    CHAR: CHAR, syllablePaths: syllablePaths
  };
})();
