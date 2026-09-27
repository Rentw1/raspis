'use strict';
/* Интерфейс приложения «Логопед-конструктор». */
(function () {
  var app = document.getElementById('app');
  var dockIn = document.getElementById('dockIn');

  var ICON = {
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    word: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13l1.5 5 2.5-5 2.5 5L16 13"/></svg>',
    print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
    wand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>'
  };

  /* ---------- хранение ---------- */
  function load(key, def) {
    try { var v = localStorage.getItem(key); if (v) return Object.assign({}, def, JSON.parse(v)); } catch (e) { /* нет хранилища */ }
    return Object.assign({}, def);
  }
  function store(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* нет места */ } }

  var DEF_SETTINGS = {
    orgFull: 'Муниципальное автономное дошкольное образовательное учреждение города Набережные Челны «Центр развития ребенка – детский сад № 1 «Шатлык»»',
    orgShort: 'Детский сад № 1 «Шатлык» · Набережные Челны',
    city: 'Набережные Челны', teacher: '', position: 'учитель-логопед', group: '',
    fontSize: 14, answersOnSheet: false, captions: true, uiScale: 16,
    include: { title: true, info: false, techcard: true, conspect: true, home: true, extra: true, keys: true, sources: true, worksheet: true }, ver: 2,
    ai: { provider: '', keys: {}, models: {}, base: '', imageModel: '', customImages: false }
  };
  function defTech() { var o = {}; METHODS.TECH.forEach(function (t) { o[t.id] = t.on; }); return o; }
  function defState() {
    return {
      themeId: 'dom_zhiv', customTitle: '', age: '5', form: 'front', kind: 'consolidate', duration: 0,
      conclusion: 'ОНР III уровня', direction: 'complex', sound: null, sound2: null,
      off: [], extraWords: [], tech: defTech(), taskIds: null, seed: String(Date.now()), reroll: {}
    };
  }
  var S = load('lp.settings', DEF_SETTINGS);
  S.include = Object.assign({}, DEF_SETTINGS.include, S.include || {});
  if ((S.ver || 1) < 2) { S.include.info = false; S.ver = 2; }
  var ST = load('lp.state', defState());
  ST.tech = Object.assign(defTech(), ST.tech || {});
  var customWords = load('lp.customWords', {});
  Object.keys(customWords).forEach(function (w) { DB.addWord(customWords[w]); });
  var aiStore = load('lp.aiThemes', { themes: {} });
  Object.keys(aiStore.themes || {}).forEach(function (id) {
    var t = aiStore.themes[id];
    try { DB.addTheme(t); } catch (e) { if (window.console) console.warn('ai theme', id, e); }
  });
  S.ai = Object.assign({}, DEF_SETTINGS.ai, S.ai || {});
  AI.configure(S.ai, function (c) { S.ai = c; saveAll(); });
  function saveAll() { store('lp.settings', S); store('lp.state', ST); }

  /* ---------- DOM-помощники ---------- */
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null && c !== false) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function iconBtn(id, icon) { var b = document.getElementById(id); b.innerHTML = ICON[icon]; return b; }

  var snackTimer = null;
  function snack(msg, actions, ms) {
    var old = document.querySelector('.snack'); if (old) old.remove();
    var el = h('div', { class: 'snack' }, [h('div', { class: 'msg', text: msg })].concat((actions || []).map(function (a) {
      return h('button', { text: a[0], onclick: function () { el.remove(); a[1](); } });
    })));
    document.body.appendChild(el);
    clearTimeout(snackTimer);
    snackTimer = setTimeout(function () { el.remove(); }, ms || (actions && actions.length ? 9000 : 3500));
  }
  var busyEl = null;
  function busy(msg, frac) {
    if (msg === false) { if (busyEl) { busyEl.remove(); busyEl = null; } return; }
    if (!busyEl) { busyEl = h('div', { class: 'busy' }, [h('div', { class: 'in' }, [h('div', { class: 'spinner' }), h('div', { class: 'bmsg' }), h('div', { class: 'bar' }, [h('i')])])]); document.body.appendChild(busyEl); }
    busyEl.querySelector('.bmsg').textContent = msg;
    busyEl.querySelector('.bar').style.display = frac == null ? 'none' : 'block';
    if (frac != null) busyEl.querySelector('.bar i').style.width = Math.round(frac * 100) + '%';
  }

  /* ---------- модальные листы ---------- */
  var sheets = [];
  function openSheet(title, body, footer, onClose) {
    var bg = h('div', { class: 'sheet-bg' });
    var sh = h('div', { class: 'sheet' }, [
      h('div', { class: 'hd' }, [h('b', { text: title }), h('button', { class: 'x-btn', text: '✕', onclick: function () { closeSheet(); } })]),
      h('div', { class: 'bd' }, [body]),
      footer ? h('div', { class: 'ft' }, footer) : null
    ]);
    bg.appendChild(sh);
    bg.addEventListener('click', function (e) { if (e.target === bg) closeSheet(); });
    document.body.appendChild(bg);
    sheets.push({ el: bg, onClose: onClose });
    return sh;
  }
  function closeSheet() {
    var s = sheets.pop();
    if (!s) return false;
    s.el.remove();
    if (s.onClose) s.onClose();
    return true;
  }

  /* ---------- модель занятия ---------- */
  function baseTheme() { return DB.byId[ST.themeId] || DB.themes[0]; }
  function theme() {
    var t = baseTheme();
    return ST.customTitle ? Object.assign({}, t, { title: ST.customTitle }) : t;
  }
  function allWords() {
    var t = baseTheme();
    return U.uniq(t.words.concat(ST.extraWords || [])).map(DB.word).filter(Boolean);
  }
  function selWords() {
    return allWords().filter(function (e) { return (ST.off || []).indexOf(e.w) < 0 && IMG.hasPicture(e); });
  }
  function extraKey() { return ST.themeId + '|' + (ST.customTitle || '') + '|' + (ST.sound || '') + '|' + ST.age; }
  function themeIcon(t) {
    if (t && t.icon) return codeSrc(t.icon);
    var e = t && DB.word(t.words[0]);
    return (e && wordThumb(e)) || codeSrc('1F5E3');
  }
  function config() {
    return {
      theme: theme(), words: selWords(), age: ST.age, form: ST.form, kind: ST.kind, direction: ST.direction,
      sound: ST.sound, sound2: ST.sound ? ST.sound2 : null, duration: ST.duration || 0, conclusion: ST.conclusion,
      tech: Object.assign({}, ST.tech, { sinkvein: ST.tech.sinkvein && ST.age === '6' }), captions: S.captions !== false,
      seed: ST.seed, reroll: ST.reroll || {}, date: Date.now(), extra: ST.extra && ST.extra.key === extraKey() ? ST.extra : null
    };
  }
  function codeSrc(code) {
    if (!code) return '';
    if (code.indexOf('x:') === 0) {
      var s = ART.color(code.slice(2));
      if (s) return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
      var rc = ART.RECOLOR[code.slice(2)];
      return rc ? 'img/c/' + rc.base + '.svg' : '';
    }
    return 'img/c/' + code + '.svg';
  }
  function wordThumb(e) {
    var ov = IMG.getOverride(e.w) || (e.of ? IMG.getOverride(e.of) : null);
    if (ov && ov.c) return ov.c;
    var io = DB.imageOf(e);
    return io ? codeSrc(io.img) : '';
  }

  /* ---------- экран конструктора ---------- */
  var screen = 'form';
  var R = null; // результат

  function setHeader() {
    document.getElementById('orgSub').textContent = screen === 'result' ? (theme().title + ' · ' + (ST.sound ? 'звук ' + PH.BY_ID[ST.sound].name : 'без звука')) : (S.orgShort || '');
    document.getElementById('btnBack').classList.toggle('hidden', screen !== 'result');
    document.getElementById('logo').classList.toggle('hidden', screen === 'result');
    document.getElementById('appTitle').textContent = screen === 'result' ? 'Готовое занятие' : 'Логопед-конструктор';
  }

  function card(num, title, hint, body) {
    return h('section', { class: 'card' }, [h('h2', {}, [h('span', { class: 'num', text: String(num) }), title, hint ? h('span', { class: 'hint', text: hint }) : null])].concat(body));
  }
  function seg(options, value, onPick) {
    return h('div', { class: 'seg' }, options.map(function (o) {
      return h('button', { class: o[0] === value ? 'on' : '', text: o[1], onclick: function () { onPick(o[0]); } });
    }));
  }

  function renderForm() {
    screen = 'form';
    setHeader();
    app.innerHTML = '';
    var th = theme(), L = config();
    var dur = LESSON.duration(L);

    // 1. Тема
    app.appendChild(card(1, 'Лексическая тема', baseTheme().ai ? 'своя тема (ИИ)' : 'месяц: ' + monthName(baseTheme().month), [
      h('button', { class: 'theme-pick', onclick: openThemePicker }, [
        h('img', { src: themeIcon(baseTheme()), alt: '' }),
        h('div', {}, [h('div', { class: 't', text: th.title }), h('div', { class: 'm', text: allWords().length + ' слов · обобщение: ' + baseTheme().cat[1] + (ST.customTitle ? ' · словарь темы «' + baseTheme().title + '»' : '') })]),
        h('span', { class: 'chev', text: 'Сменить ›' })
      ])
    ]));

    // 2. Группа и форма
    app.appendChild(card(2, 'Группа и форма занятия', U.min(dur), [
      h('div', { class: 'label', text: 'Возраст детей' }),
      seg(METHODS.AGES.map(function (a) { return [a.id, a.years + ' лет']; }), ST.age, function (v) { ST.age = v; ST.duration = 0; changed(); }),
      h('div', { class: 'label', text: 'Форма' }),
      seg(METHODS.FORMS.map(function (f) { return [f.id, f.name]; }), ST.form, function (v) { ST.form = v; ST.duration = 0; changed(); }),
      h('div', { class: 'label', text: 'Тип занятия' }),
      seg([['new', 'Изучение нового'], ['consolidate', 'Закрепление']], ST.kind, function (v) { ST.kind = v; changed(); }),
      h('div', { class: 'label', text: 'Продолжительность (по СанПиН — автоматически)' }),
      h('div', { class: 'row-gap' }, [
        h('div', { class: 'stepper' }, [
          h('button', { text: '−', onclick: function () { ST.duration = Math.max(5, dur - 1); changed(); } }),
          h('span', { text: U.min(dur) }),
          h('button', { text: '+', onclick: function () { ST.duration = Math.min(45, dur + 1); changed(); } })
        ]),
        ST.duration ? h('button', { class: 'btn sm ghost', text: 'Как по СанПиН', onclick: function () { ST.duration = 0; changed(); } }) : h('span', { class: 'small muted', text: 'норма для возраста и формы' })
      ]),
      h('div', { class: 'label', text: 'Речевое заключение' }),
      (function () {
        var sel = h('select', { onchange: function () { ST.conclusion = sel.value; saveAll(); } }, METHODS.CONCLUSIONS.map(function (c) { return h('option', { value: c, text: c, selected: c === ST.conclusion }); }));
        return sel;
      })()
    ]));

    // 3. Направление
    app.appendChild(card(3, 'Направление работы', null, [
      h('div', { class: 'list' }, METHODS.DIRECTIONS.map(function (d) {
        return h('div', { class: 'opt' + (ST.direction === d.id ? ' on' : ''), onclick: function () { ST.direction = d.id; ST.taskIds = null; ST.sheetSet = null; changed(); } }, [
          h('span', { class: 'dot' }), h('div', { class: 'txt' }, [h('b', { text: d.name })])
        ]);
      })),
      h('div', { class: 'small muted', style: 'margin-top:8px', text: 'Математика, окружающий мир и смешанное занятие строятся на словах той же лексической темы: счёт, сравнение и знания о мире — на тех же картинках.' })
    ]));

    // 4. Звук
    var words = selWords();
    function cnt(id) { return words.concat(TASKS.withPic(baseTheme().extra || [])).filter(function (e) { return PH.has(e.w, id); }).length; }
    var sndChips = [h('button', { class: 'chip snd' + (!ST.sound ? ' on' : ''), text: 'Без звука', onclick: function () { ST.sound = null; ST.sound2 = null; changed(); } })]
      .concat(PH.TARGETS.map(function (t) {
        var n = cnt(t.id);
        return h('button', { class: 'chip snd' + (ST.sound === t.id ? ' on' : ''), onclick: function () { ST.sound = t.id; if (ST.sound2 === t.id) ST.sound2 = null; changed(); } },
          [t.name, h('span', { class: 'badge' + (n ? '' : ' zero'), text: String(n) })]);
      }));
    var soundBody = [h('div', { class: 'chips' }, sndChips)];
    if (ST.sound) {
      var sw = LESSON.soundWords(L, ST.sound).map(function (e) { return e.w; });
      soundBody.push(sw.length >= 3
        ? h('div', { class: 'okbox', text: 'Слова темы со звуком ' + PH.BY_ID[ST.sound].name + ': ' + sw.join(', ') + '.' })
        : h('div', { class: 'warnbox', text: 'В словаре темы мало слов со звуком ' + PH.BY_ID[ST.sound].name + (sw.length ? ' (' + sw.join(', ') + ')' : '') + '. Задания на звук будут короче. Лучше выбрать звук с большим числом слов (цифра на кнопке) или добавить свои слова в п. 5.' }));
      soundBody.push(h('div', { class: 'label', text: 'Дифференциация (необязательно): второй звук' }));
      soundBody.push(h('div', { class: 'chips' }, [h('button', { class: 'chip snd' + (!ST.sound2 ? ' on' : ''), text: 'Нет', onclick: function () { ST.sound2 = null; changed(); } })].concat(
        PH.TARGETS.filter(function (t) { return t.id !== ST.sound; }).map(function (t) {
          return h('button', { class: 'chip snd' + (ST.sound2 === t.id ? ' on' : ''), text: t.name, onclick: function () { ST.sound2 = t.id; changed(); } });
        }))));
    }
    app.appendChild(card(4, 'Звук', 'цифра — слов темы со звуком', soundBody));

    // 5. Слова
    var chips = allWords().map(function (e) {
      var off = (ST.off || []).indexOf(e.w) >= 0, pic = IMG.hasPicture(e);
      return h('button', {
        class: 'chip' + (off || !pic ? ' off' : ' on'),
        onclick: function () {
          if (!pic) { openImageDialog(e); return; }
          ST.off = off ? ST.off.filter(function (x) { return x !== e.w; }) : (ST.off || []).concat([e.w]);
          ST.taskIds = null; changed();
        },
        oncontextmenu: function (ev) { ev.preventDefault(); openImageDialog(e); }
      }, [wordThumb(e) ? h('img', { src: wordThumb(e), alt: '' }) : null, e.w]);
    });
    chips.push(h('button', { class: 'chip add', text: '+ слово', onclick: openWordPicker }));
    app.appendChild(card(5, 'Лексический материал', words.length + ' выбрано', [
      h('div', { class: 'chips' }, chips),
      h('div', { class: 'small muted', style: 'margin-top:10px', text: 'Нажмите на слово, чтобы убрать или вернуть его. Долгое нажатие — сменить картинку (пиктограммы ARASAAC, фото из интернета, галерея).' }),
      h('div', { class: 'row-gap', style: 'margin-top:10px' }, [
        h('button', { class: 'btn soft sm', html: ICON.wand + 'Пиктограммы ARASAAC для всех слов', onclick: fetchArasaacAll }),
        h('button', { class: 'btn ghost sm', text: 'Вернуть встроенные', onclick: resetPictures })
      ])
    ]));

    // 6. Технологии
    app.appendChild(card(6, 'Технологии и этапы', null, [h('div', {}, METHODS.TECH.map(function (t) {
      if (t.id === 'sinkvein' && ST.age !== '6') return null;
      var on = !!ST.tech[t.id];
      return h('div', { class: 'switch' + (on ? ' on' : ''), onclick: function () { ST.tech[t.id] = !on; if (t.id === 'mnemo' || t.id === 'sinkvein') ST.taskIds = null; changed(); } }, [
        h('div', { class: 'txt' }, [t.name]), h('span', { class: 'tg' })
      ]);
    }))]));

    // 7. Рабочий лист
    var avail = TASKS.available(L);
    var ids = currentTaskIds(L, avail);
    var names = {}; TASKS.CATALOG.forEach(function (c) { names[c[0]] = c[1]; });
    var areaName = {}; TASKS.AREAS.forEach(function (a) { areaName[a[0]] = a[1]; });
    var flt = areaName[ST.areaFilter] ? ST.areaFilter : 'all';
    var inArea = function (id, a) { return a === 'all' || TASKS.areasOf(id).indexOf(a) >= 0; };
    var shown = avail.filter(function (id) { return inArea(id, flt); });
    app.appendChild(card(7, 'Задания рабочего листа', ids.length + ' из ' + avail.length, [
      h('div', { class: 'small muted', style: 'margin-bottom:4px', text: 'Все задания строятся только из слов выбранной темы; картинки в заданиях — те же слова, что в тексте задания.' }),
      h('div', { class: 'label', text: 'Готовый набор заданий' }),
      h('div', { class: 'chips tight' }, SHEET_SETS.map(function (s) {
        var on = s[0] === 'auto' ? !ST.taskIds : !!ST.taskIds && ST.sheetSet === s[0];
        return h('button', { class: 'chip' + (on ? ' on' : ''), text: s[1], onclick: function () { pickSheetSet(s[0]); } });
      })),
      h('div', { class: 'label', text: 'Показать задания' }),
      h('div', { class: 'chips tight' }, [['all', 'Все']].concat(TASKS.AREAS).map(function (a) {
        var n = avail.filter(function (id) { return inArea(id, a[0]); }).length;
        var sel = ids.filter(function (id) { return inArea(id, a[0]); }).length;
        return h('button', { class: 'chip' + (flt === a[0] ? ' on' : ''), onclick: function () { ST.areaFilter = a[0]; changed(); } },
          [a[1], h('span', { class: 'badge' + (sel ? '' : ' zero'), text: sel + '/' + n })]);
      })),
      h('div', { class: 'list', style: 'margin-top:10px' }, shown.map(function (id) {
        var on = ids.indexOf(id) >= 0;
        return h('div', { class: 'opt' + (on ? ' on' : ''), onclick: function () {
          var cur = currentTaskIds(config(), avail);
          ST.taskIds = on ? cur.filter(function (x) { return x !== id; }) : cur.concat([id]);
          ST.sheetSet = null;
          changed();
        } }, [h('span', { class: 'box', text: on ? '✓' : '' }), h('div', { class: 'txt' }, [h('b', { text: names[id] || id }),
          h('span', { text: TASKS.areasOf(id).map(function (a) { return areaName[a]; }).join(' · ') })])]);
      })),
      h('div', { class: 'small muted', style: 'margin-top:8px', text: 'Задания разных разделов можно смешивать: отметьте нужные в любом разделе — все они попадут в один рабочий лист, конспект и техкарту.' }),
      ST.taskIds ? h('button', { class: 'btn ghost sm', style: 'margin-top:8px', text: 'Подобрать автоматически', onclick: function () { ST.taskIds = null; ST.sheetSet = null; changed(); } }) : null
    ]));

    dock([h('button', { class: 'btn primary', html: ICON.wand + 'Собрать занятие', onclick: buildLesson })]);
  }

  var SHEET_SETS = [['auto', 'По направлению'], ['speech', 'Речь'], ['math', 'Математика'], ['world', 'Окружающий мир'], ['mixed', 'Смешанный']];
  /** Готовый набор заданий области (или смешанный) без смены направления занятия */
  function pickSheetSet(id) {
    ST.sheetSet = id;
    if (id === 'auto') { ST.taskIds = null; changed(); return; }
    var L = config();
    var avail = TASKS.available(L);
    var dir = id !== 'speech' ? id : (['math', 'world', 'mixed'].indexOf(L.direction) >= 0 ? 'complex' : L.direction);
    var picks = TASKS.defaults(Object.assign({}, L, { direction: dir }), avail);
    if (!picks.length) { snack('Для этой темы нет подходящих заданий.'); return; }
    ST.taskIds = picks;
    ST.areaFilter = id === 'mixed' ? 'all' : id;
    changed();
  }

  function currentTaskIds(L, avail) {
    if (ST.taskIds) return TASKS.CATALOG.map(function (c) { return c[0]; }).filter(function (id) { return ST.taskIds.indexOf(id) >= 0 && avail.indexOf(id) >= 0; });
    var d = TASKS.defaults(L, avail);
    if (!L.tech.mnemo) d = d.filter(function (x) { return x !== 'mnemo'; });
    if (L.tech.sinkvein && avail.indexOf('sinkvein') >= 0 && d.indexOf('sinkvein') < 0) d.push('sinkvein');
    return d;
  }

  function changed() { saveAll(); renderForm(); }
  function dock(btns) { dockIn.innerHTML = ''; btns.forEach(function (b) { dockIn.appendChild(b); }); }
  function monthName(m) { return ['', 'январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'][m] || ''; }

  /* ---------- выбор темы ---------- */
  function openThemePicker() {
    var body = h('div');
    var search = h('input', { type: 'search', placeholder: 'Поиск темы или своя тема…', value: ST.customTitle || '' });
    var info = h('div');
    var list = h('div');
    function draw() {
      var q = search.value.trim().toLowerCase();
      list.innerHTML = '';
      var order = [9, 10, 11, 12, 1, 2, 3, 4, 5];
      var mine = DB.themes.filter(function (t) { return t.ai && (!q || t.title.toLowerCase().indexOf(q) >= 0); });
      if (mine.length) {
        list.appendChild(h('div', { class: 'month', text: 'Мои темы (созданы с ИИ)' }));
        list.appendChild(h('div', { class: 'tgrid' }, mine.map(function (t) {
          return h('div', { class: 'tcard-wrap' }, [
            h('button', { class: 'tcard' + (t.id === ST.themeId ? ' on' : ''), onclick: function () { pickTheme(t.id); } }, [h('img', { src: themeIcon(t), alt: '' }), h('span', { text: t.title })]),
            h('button', { class: 'tdel', 'aria-label': 'Удалить тему', text: '✕', onclick: function () {
              snack('Удалить тему «' + t.title + '»?', [['Удалить', function () { deleteAiTheme(t.id); draw(); }]]);
            } })
          ]);
        })));
      }
      order.forEach(function (m) {
        var ts = DB.themes.filter(function (t) { return !t.ai && t.month === m && (!q || t.title.toLowerCase().indexOf(q) >= 0 || t.words.some(function (w) { return w.indexOf(q) === 0; })); });
        if (!ts.length) return;
        list.appendChild(h('div', { class: 'month', text: monthName(m) }));
        list.appendChild(h('div', { class: 'tgrid' }, ts.map(function (t) {
          return h('button', { class: 'tcard' + (t.id === ST.themeId ? ' on' : ''), onclick: function () { pickTheme(t.id); } }, [h('img', { src: themeIcon(t), alt: '' }), h('span', { text: t.title })]);
        })));
      });
      info.innerHTML = '';
      if (q.length > 2) {
        var title = U.cap(search.value.trim());
        info.appendChild(h('div', { class: 'aibox' }, AI.ready() ? [
          h('b', { text: '✨ Новая тема «' + title + '» с помощью ИИ' }),
          h('div', { class: 'small muted', text: 'ИИ подберёт 10–12 слов строго по теме с падежными формами, загадки, предложения, рассказ, гимнастики; картинки — из OpenMoji, ARASAAC' + (AI.canImage() ? ' или нарисует ИИ' : '') + '. Вы всё проверите перед сохранением.' }),
          h('button', { class: 'btn sm primary', style: 'margin-top:8px', html: ICON.wand + 'Создать тему', onclick: function () { createAiTheme(title); } })
        ] : [
          h('b', { text: '✨ Создать тему «' + title + '» с помощью ИИ' }),
          h('div', { class: 'small muted', text: 'Подключите бесплатный ИИ (Pollinations, OpenRouter, Groq, Gemini…) — это займёт пару минут.' }),
          h('button', { class: 'btn sm soft', style: 'margin-top:8px', text: 'Подключить ИИ', onclick: function () { openAiSettings(); } })
        ]));
      }
      if (q.length > 3) {
        var g = DB.guessTheme(q);
        if (g) info.appendChild(h('div', { class: 'okbox' }, [
          'Своя тема «' + search.value.trim() + '» — возьмём словарь темы «' + g.title + '». ',
          h('button', { class: 'btn sm primary', style: 'margin-top:8px', text: 'Использовать', onclick: function () {
            ST.themeId = g.id; ST.customTitle = U.cap(search.value.trim()); ST.off = []; ST.extraWords = []; ST.taskIds = null; ST.seed = String(Date.now());
            closeSheet(); changed();
          } })
        ]));
      }
    }
    search.addEventListener('input', U.debounce(draw, 150));
    body.appendChild(search); body.appendChild(info); body.appendChild(list);
    openSheet('Лексическая тема', body);
    draw();
  }

  /* ---------- добавить слово ---------- */
  function openWordPicker() {
    var body = h('div');
    var q = h('input', { type: 'search', placeholder: 'Начните вводить слово…' });
    var res = h('div', { class: 'list', style: 'margin-top:10px' });
    function draw() {
      res.innerHTML = '';
      var v = q.value.trim().toLowerCase();
      if (!v) return;
      DB.search(v, 20).forEach(function (e) {
        res.appendChild(h('div', { class: 'opt', onclick: function () { addWord(e.w); } }, [
          wordThumb(e) ? h('img', { src: wordThumb(e), style: 'width:36px;height:36px' }) : h('span', { class: 'dot' }),
          h('div', { class: 'txt' }, [h('b', { text: e.w }), h('span', { text: [e.pl, e.gp ? 'много ' + e.gp : '', e.dim].filter(Boolean).join(' · ') })])
        ]));
      });
      if (!DB.word(v)) {
        res.appendChild(h('div', { class: 'opt', onclick: function () {
          var w = v.replace(/\s+/g, ' ');
          customWords[w] = DB.addWord({ w: w, g: 'м', adj: [], v: [], custom: true });
          store('lp.customWords', customWords);
          addWord(w);
          if (!AI.ready()) { openImageDialog(DB.word(w)); return; }
          busy('ИИ подбирает формы слова «' + w + '»…');
          AI.fillWord(w).then(function (e) {
            Object.assign(customWords[w], { gs: e.gs, pl: e.pl, gp: e.gp, g: e.g, dim: e.dim, en: e.en, anim: e.anim, adj: e.adj, v: e.v, poss: e.poss, noCount: e.noCount });
            store('lp.customWords', customWords);
          }).catch(function (err) { snack('Формы слова не получены: ' + err.message); }).then(function () {
            busy(false); changed(); openImageDialog(DB.word(w));
          });
        } }, [h('span', { class: 'dot' }), h('div', { class: 'txt' }, [h('b', { text: '+ Своё слово «' + v + '»' }), h('span', { text: 'Картинку подберём в интернете или из галереи' })])]));
      }
    }
    function addWord(w) {
      if (baseTheme().words.indexOf(w) < 0 && ST.extraWords.indexOf(w) < 0) ST.extraWords.push(w);
      ST.off = (ST.off || []).filter(function (x) { return x !== w; });
      ST.taskIds = null;
      closeSheet(); changed();
    }
    q.addEventListener('input', U.debounce(draw, 120));
    body.appendChild(q); body.appendChild(res);
    openSheet('Добавить слово', body);
    setTimeout(function () { q.focus(); }, 200);
  }

  /* ---------- картинки из интернета ---------- */
  function fetchArasaacAll() {
    if (!NET.online()) { snack('Нет интернета. Используются встроенные картинки.'); return; }
    var list = allWords().filter(function (e) { return (ST.off || []).indexOf(e.w) < 0; });
    var done = 0, ok = 0;
    busy('Подбираю пиктограммы ARASAAC…', 0);
    var chain = Promise.resolve();
    list.forEach(function (e) {
      chain = chain.then(function () {
        return NET.arasaacFor(e.w).then(function (val) { ok++; return IMG.setOverride(e.w, val); }).catch(function () { /* нет пиктограммы */ })
          .then(function () { done++; busy('Подбираю пиктограммы: ' + e.w, done / list.length); });
      });
    });
    chain.then(function () {
      busy(false); changed();
      snack(ok ? 'Пиктограммы подобраны: ' + ok + ' из ' + list.length + '. Для остальных слов — встроенные картинки.' : 'Не удалось получить пиктограммы. Проверьте интернет.');
    });
  }
  function resetPictures() {
    var list = allWords();
    Promise.all(list.map(function (e) { return IMG.getOverride(e.w) ? IMG.setOverride(e.w, null) : null; })).then(function () {
      changed(); snack('Возвращены встроенные картинки.');
    });
  }

  function openImageDialog(e, after) {
    var body = h('div');
    var cur = h('div', { class: 'row-gap', style: 'margin-bottom:10px' });
    function drawCur() {
      cur.innerHTML = '';
      var ov = IMG.getOverride(e.w);
      var src = wordThumb(e);
      cur.appendChild(src ? h('img', { src: src, style: 'width:96px;height:96px;object-fit:contain;border:1px solid #e3e5f0;border-radius:14px;background:#fff' }) : h('div', { class: 'pill', text: 'нет картинки' }));
      cur.appendChild(h('div', { class: 'small muted', style: 'flex:1', text: ov ? 'Источник: ' + (ov.credit || ov.src) : 'Встроенная картинка (OpenMoji / свой рисунок).' }));
      if (ov) cur.appendChild(h('button', { class: 'btn sm danger', text: 'Вернуть встроенную', onclick: function () { apply(null); } }));
    }
    function apply(val) {
      busy('Сохраняю картинку…');
      IMG.setOverride(e.w, val).then(function () {
        busy(false); drawCur(); snack(val ? 'Картинка для «' + e.w + '» заменена.' : 'Возвращена встроенная картинка.');
        if (after) after(); else if (screen === 'form') renderForm(); else refreshTasksWith(e.w);
      });
    }
    drawCur();
    body.appendChild(cur);

    // ARASAAC
    var aq = h('input', { type: 'search', value: e.w });
    var ag = h('div', { class: 'pgrid', style: 'margin-top:8px' });
    function aSearch() {
      if (!NET.online()) { ag.innerHTML = '<div class="warnbox">Нет интернета.</div>'; return; }
      ag.innerHTML = '<div class="muted small">Ищу…</div>';
      NET.arasaacSearch(aq.value).then(function (list) {
        ag.innerHTML = '';
        if (!list.length) { ag.innerHTML = '<div class="muted small">Ничего не найдено. Попробуйте другое слово.</div>'; return; }
        list.forEach(function (p) {
          ag.appendChild(h('button', { onclick: function () {
            busy('Загружаю пиктограмму…');
            Promise.all([NET.arasaacImage(p.id, true), NET.arasaacImage(p.id, false).catch(function () { return null; })]).then(function (r) {
              apply({ c: r[0], b: r[1], src: 'arasaac', id: p.id, credit: 'ARASAAC (arasaac.org), Sergio Palao, CC BY-NC-SA 4.0' });
            }).catch(function (err) { busy(false); snack('Ошибка: ' + err.message); });
          } }, [h('img', { src: p.thumb, loading: 'lazy', alt: '' }), p.title]));
        });
      }).catch(function (err) { ag.innerHTML = '<div class="warnbox">Не удалось выполнить поиск: ' + U.esc(err.message) + '</div>'; });
    }
    body.appendChild(h('div', { class: 'label', text: 'Пиктограммы ARASAAC (для логопедов, поиск по-русски)' }));
    body.appendChild(h('div', { class: 'row-gap' }, [h('div', { style: 'flex:1' }, [aq]), h('button', { class: 'btn soft sm', text: 'Найти', onclick: aSearch })]));
    body.appendChild(ag);

    // Openverse / Викисклад
    var oq = h('input', { type: 'search', value: e.en || e.w });
    var og = h('div', { class: 'pgrid', style: 'margin-top:8px' });
    function oSearch(src) {
      if (!NET.online()) { og.innerHTML = '<div class="warnbox">Нет интернета.</div>'; return; }
      og.innerHTML = '<div class="muted small">Ищу…</div>';
      var p = src === 'commons' ? NET.commonsSearch(oq.value) : NET.openverseSearch(oq.value, src === 'illustration' ? 'illustration' : '');
      p.then(function (list) {
        og.innerHTML = '';
        if (!list.length) { og.innerHTML = '<div class="muted small">Ничего не найдено.</div>'; return; }
        list.forEach(function (it) {
          og.appendChild(h('button', { onclick: function () {
            busy('Загружаю картинку…');
            NET.getDataUrl(it.full || it.thumb).then(function (d) { return IMG.normalizeDataUrl(d, 700); }).then(function (d) {
              apply({ c: d, b: null, src: src === 'commons' ? 'commons' : 'openverse', credit: it.credit });
            }).catch(function (err) { busy(false); snack('Ошибка: ' + err.message); });
          } }, [h('img', { src: it.thumb, loading: 'lazy', alt: '' }), (it.title || '').slice(0, 24)]));
        });
      }).catch(function (err) { og.innerHTML = '<div class="warnbox">Не удалось выполнить поиск: ' + U.esc(err.message) + '</div>'; });
    }
    body.appendChild(h('div', { class: 'label', text: 'Рисунки и фото (Openverse, Викисклад)' }));
    body.appendChild(h('div', { class: 'row-gap' }, [h('div', { style: 'flex:1' }, [oq])]));
    body.appendChild(h('div', { class: 'row-gap', style: 'margin-top:6px' }, [
      h('button', { class: 'btn soft sm', text: 'Рисунки', onclick: function () { oSearch('illustration'); } }),
      h('button', { class: 'btn soft sm', text: 'Фото', onclick: function () { oSearch('photo'); } }),
      h('button', { class: 'btn soft sm', text: 'Викисклад', onclick: function () { oSearch('commons'); } })
    ]));
    body.appendChild(og);

    // OpenMoji: встроенные и из интернета (тот же стиль, что у картинок программы)
    var mq = h('input', { type: 'search', value: e.en || '', placeholder: 'по-английски: cat, ball, rocket…' });
    var mg = h('div', { class: 'pgrid', style: 'margin-top:8px' });
    function omOverride(hit) {
      if (!hit.offline) return NET.openmojiFor(hit.hex);
      return Promise.all([IMG.svgText(hit.hex, 'c'), IMG.svgText(hit.hex, 'b').catch(function () { return null; })]).then(function (r) {
        var du = function (t) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(String(t).replace('<svg ', '<svg width="512" height="512" ')); };
        return { c: du(r[0]), b: r[1] ? du(r[1]) : null, src: 'openmoji', id: hit.hex, credit: 'OpenMoji (openmoji.org), CC BY-SA 4.0' };
      });
    }
    function mSearch() {
      mg.innerHTML = '';
      var hits = NET.openmojiSearch(mq.value, 24);
      if (!hits.length) { mg.innerHTML = '<div class="muted small">Ничего не найдено. Введите название по-английски.</div>'; return; }
      hits.forEach(function (hit) {
        if (!hit.offline && !NET.online()) return;
        mg.appendChild(h('button', { onclick: function () {
          busy('Загружаю картинку…');
          omOverride(hit).then(apply).catch(function (err) { busy(false); snack('Ошибка: ' + err.message); });
        } }, [h('img', { src: hit.offline ? 'img/c/' + hit.hex + '.svg' : NET.openmojiUrl(hit.hex), loading: 'lazy', alt: '' }), hit.ann.slice(0, 22)]));
      });
    }
    body.appendChild(h('div', { class: 'label', text: 'OpenMoji — в стиле картинок программы' }));
    body.appendChild(h('div', { class: 'row-gap' }, [h('div', { style: 'flex:1' }, [mq]), h('button', { class: 'btn soft sm', text: 'Найти', onclick: mSearch }),
      AI.ready() ? h('button', { class: 'btn ghost sm', text: 'Перевести', onclick: function () {
        busy('Перевожу…');
        AI.translate(e.w).then(function (en) { busy(false); mq.value = en; mSearch(); }).catch(function (err) { busy(false); snack(err.message); });
      } }) : null]));
    body.appendChild(mg);

    // Рисунок ИИ
    body.appendChild(h('div', { class: 'label', text: 'Нарисовать с помощью ИИ' }));
    if (AI.canImage()) {
      var pq = h('input', { type: 'text', value: e.en || e.w });
      var draw = function (style) {
        busy('ИИ рисует «' + e.w + '»… (до минуты)');
        AI.image(AI.imagePrompt(pq.value || e.w, style)).then(function (d) { return IMG.normalizeDataUrl(d, 640); }).then(function (d) {
          var ov = IMG.getOverride(e.w) || {};
          apply(style === 'bw' ? { c: ov.c || d, b: d, src: 'ai', credit: 'рисунок ИИ (' + AI.label() + ')' } : { c: d, b: ov.b || null, src: 'ai', credit: 'рисунок ИИ (' + AI.label() + ')' });
        }).catch(function (err) { busy(false); snack(err.message, [['Настройки ИИ', function () { openAiSettings(); }]], 10000); });
      };
      body.appendChild(h('div', { class: 'row-gap' }, [h('div', { style: 'flex:1' }, [pq])]));
      body.appendChild(h('div', { class: 'row-gap', style: 'margin-top:6px' }, [
        h('button', { class: 'btn soft sm', html: ICON.wand + 'Цветная картинка', onclick: function () { draw('color'); } }),
        h('button', { class: 'btn soft sm', html: ICON.wand + 'Раскраска (контур)', onclick: function () { draw('bw'); } })
      ]));
    } else {
      body.appendChild(h('div', { class: 'small muted' }, ['Рисовать умеет Pollinations (бесплатные кредиты). ',
        h('button', { class: 'btn sm ghost', text: 'Подключить', onclick: function () { openAiSettings(); } })]));
    }

    // Галерея
    var file = h('input', { type: 'file', accept: 'image/*', class: 'hidden' });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { IMG.normalizeDataUrl(rd.result, 700).then(function (d) { apply({ c: d, b: null, src: 'gallery', credit: 'фото пользователя' }); }); };
      rd.readAsDataURL(f);
    });
    body.appendChild(h('div', { class: 'label', text: 'Своя картинка' }));
    body.appendChild(h('button', { class: 'btn soft block', html: ICON.image + 'Выбрать из галереи', onclick: function () { file.click(); } }));
    body.appendChild(file);
    body.appendChild(h('div', { class: 'small muted', style: 'margin-top:10px', text: 'Выбранная картинка сохраняется в приложении и используется во всех заданиях с этим словом (и в следующих занятиях).' }));
    openSheet('Картинка: ' + e.w, body);
    if (NET.online()) aSearch();
    if (mq.value) mSearch();
  }

  /* ---------- сборка занятия ---------- */
  function buildLesson() {
    var L = config();
    if (L.words.length < 3) { snack('Выберите хотя бы 3 слова с картинками.'); return; }
    var avail = TASKS.available(L);
    var ids = currentTaskIds(L, avail);
    var tasks = TASKS.build(L, ids);
    L.tasks = tasks;
    var plan = LESSON.build(L);
    R = { L: L, plan: plan, tasks: tasks, urls: [] };
    saveHistory();
    renderTasks().then(function () { showResult('sheet'); });
  }

  function renderTasks(only) {
    var list = R.tasks;
    busy('Рисую задания…', 0);
    var chain = Promise.resolve();
    list.forEach(function (t, i) {
      if (only && only.indexOf(i) < 0) return;
      chain = chain.then(function () {
        return TASKS.render(t, 0.6).then(function (cv) { R.urls[i] = cv.toDataURL('image/png'); })
          .catch(function (err) { R.urls[i] = ''; if (window.console) console.error(err); })
          .then(function () { busy('Рисую задания…', (i + 1) / list.length); });
      });
    });
    return chain.then(function () { busy(false); });
  }

  function refreshTasksWith(word) {
    if (!R) return;
    var idx = [];
    R.tasks.forEach(function (t, i) { if ((t.words || []).some(function (e) { return e && e.w === word; })) idx.push(i); });
    if (!idx.length) idx = R.tasks.map(function (t, i) { return i; });
    renderTasks(idx).then(function () { showResult(curTab); });
  }

  function rerollTask(i) {
    var t = R.tasks[i];
    ST.reroll[t.id] = (ST.reroll[t.id] || 0) + 1;
    saveAll();
    var L = Object.assign({}, R.L, { reroll: ST.reroll });
    var nt = TASKS.build(L, [t.id])[0];
    if (!nt) return;
    R.tasks[i] = nt;
    R.L.tasks = R.tasks;
    R.plan = LESSON.build(R.L);
    renderTasks([i]).then(function () { showResult('sheet'); });
  }

  var curTab = 'sheet';
  function showResult(tab) {
    screen = 'result';
    curTab = tab || curTab;
    setHeader();
    app.innerHTML = '';
    var tabs = [['sheet', 'Рабочий лист'], ['plan', 'Конспект'], ['card', 'Техкарта'], ['info', 'Цели и задачи'], ['home', 'Родителям']];
    app.appendChild(h('div', { class: 'tabs' }, tabs.map(function (t) {
      return h('button', { class: 'tab' + (curTab === t[0] ? ' on' : ''), text: t[1], onclick: function () { showResult(t[0]); } });
    })));
    var P = R.plan;
    if (curTab === 'sheet') {
      if (!R.tasks.length) app.appendChild(h('div', { class: 'empty', text: 'Нет заданий. Вернитесь в конструктор и выберите задания.' }));
      else app.appendChild(h('div', { class: 'card sheetbar' }, [
        h('div', { class: 'small muted', text: 'Рабочий лист отдельным файлом — для ребёнка или родителей (' + R.tasks.length + ' ' + U.plural(R.tasks.length, 'задание', 'задания', 'заданий') + '):' }),
        h('div', { class: 'acts' }, [
          h('button', { class: 'btn sm primary', html: ICON.word + 'Скачать лист', onclick: function () { saveDocx('sheet', false); } }),
          h('button', { class: 'btn sm soft', html: ICON.print + 'PDF / печать', onclick: function () { doPrint('sheet'); } }),
          h('button', { class: 'btn sm soft', html: ICON.share + 'Отправить', onclick: function () { saveDocx('sheet', true); } })
        ])
      ]));
      R.tasks.forEach(function (t, i) {
        app.appendChild(h('div', { class: 'task' }, [
          h('div', { class: 'th' }, [h('span', { class: 'n', text: 'Задание ' + (i + 1) + '.' }), h('b', { text: t.title }), h('span', { class: 'area', text: t.area })]),
          h('div', { class: 'instr', text: t.instr }),
          h('div', { class: 'pic' }, [R.urls[i] ? h('img', { src: R.urls[i], alt: t.title }) : h('div', { class: 'empty', text: 'Картинка не нарисована' })]),
          h('div', { class: 'note', text: 'Для педагога: ' + t.note }),
          h('div', { class: 'acts' }, [
            h('button', { class: 'btn sm soft', html: ICON.refresh + 'Другие слова', onclick: function () { rerollTask(i); } }),
            h('button', { class: 'btn sm soft', html: ICON.image + 'Картинки', onclick: function () { pickTaskWord(t); } }),
            i > 0 ? h('button', { class: 'btn sm ghost', html: ICON.up, 'aria-label': 'Выше', onclick: function () { move(i, -1); } }) : null,
            i < R.tasks.length - 1 ? h('button', { class: 'btn sm ghost', html: ICON.down, 'aria-label': 'Ниже', onclick: function () { move(i, 1); } }) : null,
            h('button', { class: 'btn sm ghost', html: ICON.trash, 'aria-label': 'Убрать', onclick: function () { removeTask(i); } })
          ])
        ]));
      });
    } else if (curTab === 'plan') {
      app.appendChild(aiExtrasCard());
      app.appendChild(h('div', { class: 'card' }, [h('div', { class: 'small muted', text: 'Цель' }), h('div', { text: P.goal })]));
      P.stages.forEach(function (s) {
        app.appendChild(h('div', { class: 'stage' }, [
          h('h3', {}, [s.n + '. ' + s.name, h('span', { class: 'min', text: U.min(s.min) })]),
          h('div', { class: 'aim', text: s.aim })
        ].concat(s.speech.map(function (sp) {
          if (sp[0] === 'Текст') return h('p', { class: 'poem', text: sp[1] });
          if (sp[0] === 'Упражнение') return h('p', { class: 'ex', text: '– ' + sp[1] });
          if (sp[0] === 'Игра') return h('p', {}, [h('b', { text: 'Игра ' + sp[1] })]);
          return h('p', {}, [h('span', { class: 'who' + (sp[0] === 'Логопед' ? '' : ' kid'), text: sp[0] + ': ' }), sp[1]]);
        }))));
      });
    } else if (curTab === 'card') {
      var pass = h('details', { class: 'card pass' }, [h('summary', {}, [h('b', { text: 'Паспорт занятия' }), h('span', { class: 'small muted', text: ' — педагог, цель, задачи, результаты, оборудование' })])]);
      var kvp = h('div', { class: 'kv' });
      EXPORT.passport(R.L, P, S, R.tasks).forEach(function (r) {
        kvp.appendChild(h('div', { class: 'k', text: r[0] }));
        kvp.appendChild(Array.isArray(r[1])
          ? h('div', {}, r[1].map(function (x) { return typeof x === 'string' ? h('div', { text: x }) : h('div', {}, [h('b', { text: x[0][0] })]); }))
          : h('div', { text: r[1] }));
      });
      pass.appendChild(kvp);
      app.appendChild(pass);
      var col = function (label, list) {
        return h('div', { class: 'col' }, [h('div', { class: 'cl', text: label })].concat(list.map(function (x) {
          return h('p', { class: (x.b ? 'b' : '') + (x.i ? ' i' : ''), text: x.t });
        })));
      };
      LESSON.card(P).forEach(function (ph) {
        app.appendChild(h('div', { class: 'phase' }, [h('span', { text: ph.n + '. ' + ph.name }), h('span', { class: 'min', text: U.min(ph.min) })]));
        ph.stages.forEach(function (st) {
          app.appendChild(h('div', { class: 'card tc' }, [
            h('div', { class: 'tch' }, [h('b', { text: st.n + '. ' + st.name }), h('span', { class: 'min', text: U.min(st.min) })]),
            col('Задачи этапа', [{ t: st.aim }]), col(EXPORT.teacherCol(S), st.teacher), col('Деятельность детей', st.children),
            col('Методы и приёмы', [{ t: st.methods }]), col('Планируемый результат', [{ t: st.result }])
          ]));
        });
      });
    } else if (curTab === 'info') {
      var kv = h('div', { class: 'card kv' });
      function add(k, v) { kv.appendChild(h('div', { class: 'k', text: k })); kv.appendChild(v); }
      function ol(arr) { return h('ol', {}, arr.map(function (x) { return h('li', { text: x }); })); }
      add('Цель', h('div', { text: P.goal }));
      add('Образовательные задачи', ol(P.obj.edu));
      add('Развивающие задачи', ol(P.obj.dev));
      add('Воспитательные задачи', ol(P.obj.vos));
      add('Интеграция областей', ol(P.ex.integration.map(function (x) { return x[0] + ': ' + x[1]; })));
      add('Виды деятельности', h('div', { text: U.cap(P.ex.activities.join(', ')) }));
      add('Технологии', h('div', { text: U.cap(P.ex.technologies.join('; ')) }));
      add('Оборудование', ol(P.ex.equipment));
      add('Предварительная работа', ol(P.ex.prelim));
      add('Планируемые результаты', ol(P.ex.results));
      app.appendChild(kv);
    } else if (curTab === 'home') {
      app.appendChild(h('div', { class: 'card' }, [h('h2', { text: 'Задание для закрепления дома' }), h('ol', {}, P.ex.home.map(function (x) { return h('li', { text: x }); }))]));
      app.appendChild(h('div', { class: 'card' }, [h('h2', { text: 'Ключи к рабочему листу' }), h('ol', {}, R.tasks.map(function (t) { return h('li', { text: t.title + ': ' + t.note }); }))]));
    }
    dock([
      h('button', { class: 'btn primary', html: ICON.word + 'Word', onclick: exportDocx }),
      h('button', { class: 'btn soft', html: ICON.print + 'Печать / PDF', onclick: printDialog }),
      h('button', { class: 'btn soft', html: ICON.share + 'Отправить', onclick: shareDocx })
    ]);
    window.scrollTo(0, 0);
  }

  function move(i, d) {
    var j = i + d;
    var t = R.tasks[i]; R.tasks[i] = R.tasks[j]; R.tasks[j] = t;
    var u = R.urls[i]; R.urls[i] = R.urls[j]; R.urls[j] = u;
    ST.taskIds = R.tasks.map(function (x) { return x.id; }); saveAll();
    showResult('sheet');
  }
  function removeTask(i) {
    R.tasks.splice(i, 1); R.urls.splice(i, 1);
    ST.taskIds = R.tasks.map(function (x) { return x.id; }); saveAll();
    R.L.tasks = R.tasks; R.plan = LESSON.build(R.L);
    showResult('sheet');
  }
  function pickTaskWord(t) {
    var body = h('div', { class: 'pgrid' }, (t.words || []).filter(Boolean).map(function (e) {
      return h('button', { onclick: function () { closeSheet(); openImageDialog(e); } }, [h('img', { src: wordThumb(e), alt: '' }), e.w]);
    }));
    openSheet('Какую картинку заменить?', body);
  }

  /* ---------- экспорт ---------- */
  var DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  /** Что попадает в файл: 'all' — всё занятие по настройкам, 'sheet' — только рабочий лист, 'sheetKeys' — лист с ответами, 'plan' — без листа */
  var PARTS = [
    ['all', 'Всё занятие', 'Титульный лист, техкарта, конспект, рабочий лист — как в настройках'],
    ['sheet', 'Только рабочий лист', 'Задания с картинками для ребёнка — с первой страницы'],
    ['sheetKeys', 'Рабочий лист с ответами', 'Под каждым заданием — подсказка и ответ для взрослого'],
    ['plan', 'Техкарта и конспект', 'Всё, кроме рабочего листа']
  ];
  function isSheetPart(part) { return part === 'sheet' || part === 'sheetKeys'; }
  function partDialog(title, note, onPick) {
    var body = h('div', { class: 'list' }, PARTS.map(function (o) {
      return h('div', { class: 'opt', onclick: function () { closeSheet(); onPick(o[0]); } }, [h('span', { class: 'dot' }), h('div', { class: 'txt' }, [h('b', { text: o[1] }), h('span', { text: o[2] })])]);
    }));
    if (note) body.appendChild(h('div', { class: 'small muted', style: 'margin-top:10px', text: note }));
    openSheet(title, body);
  }
  function docxSettings(part) {
    if (isSheetPart(part)) {
      var inc = {};
      Object.keys(DEF_SETTINGS.include).forEach(function (k) { inc[k] = false; });
      inc.worksheet = true;
      return Object.assign({}, S, { include: inc, answersOnSheet: part === 'sheetKeys' });
    }
    if (part === 'plan') return Object.assign({}, S, { include: Object.assign({}, S.include, { worksheet: false }) });
    return S;
  }
  function makeDocx(part) {
    part = part || 'all';
    var S2 = docxSettings(part);
    var list = S2.include.worksheet === false ? [] : R.tasks;
    busy('Готовлю документ Word…', 0);
    var pngs = [];
    var chain = Promise.resolve();
    list.forEach(function (t, i) {
      chain = chain.then(function () {
        return TASKS.render(t, 1).then(function (cv) { pngs[i] = IMG.toPngBytes(cv); }).catch(function () { pngs[i] = null; })
          .then(function () { busy('Готовлю документ Word…', (i + 1) / (list.length + 1)); });
      });
    });
    return chain.then(function () {
      var bytes = EXPORT.docx(R.L, R.plan, R.tasks, pngs, S2);
      return { name: EXPORT.fileName(R.L, 'docx', part), bytes: bytes };
    });
  }
  function saveDocx(part, share) {
    if (isSheetPart(part) && !R.tasks.length) { snack('В рабочем листе нет заданий.'); return; }
    makeDocx(part).then(function (f) { return NET.saveFile(f.name, f.bytes, DOCX_MIME).then(function (res) { return [f, res]; }); })
      .then(function (x) {
        busy(false);
        var f = x[0], res = x[1];
        if (!res || !res.ok) { snack((share ? 'Не удалось подготовить файл: ' : 'Не удалось сохранить: ') + ((res && res.error) || 'ошибка')); return; }
        var saved = R.saved = res.name || f.name;
        if (share && NET.isAndroid()) { NET.shareFile(saved, DOCX_MIME); return; }
        snack('Сохранено: ' + (res.path || f.name), NET.isAndroid() ? [['Открыть', function () { NET.openFile(saved, DOCX_MIME); }], ['Отправить', function () { NET.shareFile(saved, DOCX_MIME); }]] : []);
      }).catch(function (err) { busy(false); snack('Ошибка: ' + err.message); });
  }
  function exportDocx() { partDialog('Сохранить в Word', null, function (p) { saveDocx(p, false); }); }
  function shareDocx() { partDialog('Отправить документ Word', 'Откроется список приложений: мессенджер, почта, облачный диск.', function (p) { saveDocx(p, true); }); }
  function printDialog() {
    partDialog('Печать / PDF', 'Откроется окно печати Android: можно выбрать принтер или «Сохранить как PDF».', doPrint);
  }
  function doPrint(part) {
    if (isSheetPart(part) && !R.tasks.length) { snack('В рабочем листе нет заданий.'); return; }
    busy('Готовлю страницы для печати…');
    var urls = [];
    var chain = Promise.resolve();
    if (part !== 'plan') R.tasks.forEach(function (t, i) {
      chain = chain.then(function () { return TASKS.render(t, 0.8).then(function (cv) { urls[i] = cv.toDataURL('image/png'); }).catch(function () { urls[i] = ''; }); });
    });
    chain.then(function () {
      busy(false);
      NET.printHtml(EXPORT.html(R.L, R.plan, R.tasks, urls, S, part === 'all' ? null : part), 'Логопед — ' + R.L.theme.title);
    }).catch(function (err) { busy(false); snack('Ошибка печати: ' + err.message); });
  }

  /* ---------- история ---------- */
  function saveHistory() {
    var hist = load('lp.history', { items: [] }).items || [];
    var snap = JSON.parse(JSON.stringify(ST));
    hist = hist.filter(function (x) { return !(x.cfg.themeId === snap.themeId && x.cfg.sound === snap.sound && x.cfg.age === snap.age && x.cfg.customTitle === snap.customTitle); });
    hist.unshift({ date: Date.now(), title: theme().title, cfg: snap });
    store('lp.history', { items: hist.slice(0, 40) });
  }
  function openHistory() {
    var hist = load('lp.history', { items: [] }).items || [];
    var body = h('div', { class: 'list' });
    if (!hist.length) body.appendChild(h('div', { class: 'empty', text: 'Здесь появятся собранные занятия.' }));
    hist.forEach(function (x) {
      var a = METHODS.AGES.filter(function (g) { return g.id === x.cfg.age; })[0];
      body.appendChild(h('div', { class: 'opt', onclick: function () {
        ST = Object.assign(defState(), x.cfg); saveAll(); closeSheet(); renderForm(); buildLesson();
      } }, [
        h('img', { src: DB.byId[x.cfg.themeId] ? themeIcon(DB.byId[x.cfg.themeId]) : codeSrc('1F5E3'), style: 'width:40px;height:40px' }),
        h('div', { class: 'txt' }, [h('b', { text: x.title }), h('span', { text: U.dateShort(new Date(x.date)) + ' · ' + (a ? a.years + ' лет' : '') + ' · ' + (x.cfg.sound ? 'звук ' + PH.BY_ID[x.cfg.sound].name : 'без звука') })])
      ]));
    });
    openSheet('Мои занятия', body);
  }

  /* ---------- база материалов ---------- */
  function openLibrary() {
    var body = h('div');
    var order = [9, 10, 11, 12, 1, 2, 3, 4, 5];
    order.forEach(function (m) {
      var ts = DB.themes.filter(function (t) { return t.month === m; });
      if (!ts.length) return;
      body.appendChild(h('div', { class: 'month', text: monthName(m) }));
      body.appendChild(h('div', { class: 'tgrid' }, ts.map(function (t) {
        return h('button', { class: 'tcard', onclick: function () { openThemeInfo(t); } }, [h('img', { src: codeSrc(t.icon), alt: '' }), h('span', { text: t.title })]);
      })));
    });
    body.appendChild(h('div', { class: 'small muted', style: 'margin-top:14px', text: 'Иллюстрации: OpenMoji (openmoji.org), CC BY-SA 4.0. Пиктограммы ARASAAC (arasaac.org): Sergio Palao, CC BY-NC-SA 4.0. Версия ' + NET.version() + '.' }));
    openSheet('База материалов', body);
  }
  function openThemeInfo(t) {
    var body = h('div');
    body.appendChild(h('div', { class: 'label', text: 'Словарь' }));
    body.appendChild(h('div', { class: 'list' }, t.words.map(DB.word).filter(Boolean).map(function (e) {
      return h('div', { class: 'opt' }, [h('img', { src: wordThumb(e), style: 'width:40px;height:40px' }), h('div', { class: 'txt' }, [h('b', { text: e.w }),
        h('span', { text: [e.pl ? 'мн.: ' + e.pl : '', e.gp ? 'много ' + e.gp : '', e.dim ? 'ласк.: ' + e.dim : '', e.baby ? 'детёныш: ' + e.baby : ''].filter(Boolean).join(' · ') })])]);
    })));
    function sec(title, lines) { if (!lines || !lines.length) return; body.appendChild(h('div', { class: 'label', text: title })); lines.forEach(function (l) { body.appendChild(h('p', { style: 'margin:4px 0', text: l })); }); }
    sec('Загадки', (t.riddles || []).map(function (r) { return '«' + r[1] + '» (' + r[0] + ')'; }));
    if (t.finger) sec('Пальчиковая гимнастика «' + t.finger.name + '»', t.finger.lines);
    if (t.move) sec('Физминутка «' + t.move.name + '»', t.move.lines);
    if (t.breath) sec('Дыхательная гимнастика «' + t.breath.name + '»', [t.breath.text]);
    if (t.story) sec('Образец рассказа', [t.story.text]);
    sec('Предложения', t.sents);
    sec('Художественная литература', t.lit);
    openSheet(t.title, body, [h('button', { class: 'btn primary', text: 'Выбрать тему', onclick: function () {
      ST.themeId = t.id; ST.customTitle = ''; ST.off = []; ST.extraWords = []; ST.taskIds = null;
      while (sheets.length) closeSheet();
      changed();
    } })]);
  }

  /* ---------- темы, созданные с помощью ИИ ---------- */
  function pickTheme(id) {
    ST.themeId = id; ST.customTitle = ''; ST.off = []; ST.extraWords = []; ST.taskIds = null; ST.seed = String(Date.now()); ST.extra = null;
    while (sheets.length) closeSheet();
    changed();
  }
  function aiWordsOf(t) {
    var list = t.words.slice();
    ((t.pairs && t.pairs.baby && t.pairs.baby.items) || []).forEach(function (p) { list.push(p[1]); });
    return U.uniq(list).map(DB.word).filter(function (e) { return e && e.ai; });
  }
  function saveAiTheme(t) {
    var st = load('lp.aiThemes', { themes: {} });
    st.themes = st.themes || {};
    var first = DB.word(t.words[0]);
    t.icon = first && DB.imageOf(first) && DB.imageOf(first).img && DB.imageOf(first).img.indexOf('x:') !== 0 && !first.of ? DB.imageOf(first).img : null;
    st.themes[t.id] = t;
    store('lp.aiThemes', st);
    aiWordsOf(t).forEach(function (e) { customWords[e.w] = e; });
    store('lp.customWords', customWords);
  }
  function deleteAiTheme(id) {
    var st = load('lp.aiThemes', { themes: {} });
    if (st.themes) delete st.themes[id];
    store('lp.aiThemes', st);
    DB.removeTheme(id);
    if (ST.themeId === id) { ST.themeId = DB.themes[0].id; ST.extra = null; }
    saveAll();
    if (screen === 'form') renderForm();
    snack('Тема удалена.');
  }

  /** Картинки для новых слов: OpenMoji (встроенные → из интернета), ARASAAC, рисунок ИИ */
  function assignPictures(list, progress) {
    var done = 0, ok = 0;
    var chain = Promise.resolve();
    list.forEach(function (e) {
      chain = chain.then(function () {
        if (IMG.hasPicture(e)) return null;
        var hits = e.en ? NET.openmojiSearch(e.en, 3) : [];
        var best = hits[0] && hits[0].score >= 60 ? hits[0] : null;
        if (best && best.offline) { e.img = best.hex; return null; }
        if (!NET.online()) return null;
        var p = best ? NET.openmojiFor(best.hex).then(function (v) { return IMG.setOverride(e.w, v); }) : Promise.reject(new Error('нет'));
        return p.catch(function () { return NET.arasaacFor(e.w).then(function (v) { return IMG.setOverride(e.w, v); }); })
          .catch(function () {
            if (!AI.canImage()) return null;
            return AI.image(AI.imagePrompt(e.en || e.w, 'color')).then(function (d) { return IMG.normalizeDataUrl(d, 600); })
              .then(function (c) { return IMG.setOverride(e.w, { c: c, b: null, src: 'ai', credit: 'рисунок ИИ (' + AI.label() + ')' }); });
          })
          .catch(function () { return null; });
      }).then(function () {
        done++;
        if (IMG.hasPicture(e)) ok++;
        if (progress) progress(done, list.length, e);
      });
    });
    return chain.then(function () { return ok; });
  }

  function createAiTheme(title) {
    if (!AI.ready()) { openAiSettings(); return; }
    busy('ИИ составляет словарь темы «' + title + '»… Обычно это 20–90 секунд.');
    AI.makeTheme(title, ST.age).then(function (res) {
      res.newWords.forEach(function (e) { DB.addWord(e); });
      DB.addTheme(res.theme);
      var need = res.theme.words.map(DB.word).filter(function (e) { return e && !IMG.hasPicture(e); });
      busy('Подбираю картинки…', 0);
      return assignPictures(need, function (d, n, e) { busy('Подбираю картинки: ' + e.w, d / n); }).then(function () { return res; });
    }).then(function (res) {
      busy(false);
      openAiThemeReview(res.theme, res.notes);
    }).catch(function (err) {
      busy(false);
      snack('Не удалось создать тему: ' + err.message, [['Настройки ИИ', function () { openAiSettings(); }]], 12000);
    });
  }

  function openAiThemeReview(t, notes) {
    var body = h('div');
    var saved = false;
    function draw() {
      body.innerHTML = '';
      var ws = t.words.map(DB.word).filter(Boolean);
      var missing = ws.filter(function (e) { return !IMG.hasPicture(e); });
      body.appendChild(h('div', { class: 'okbox', text: 'Обобщение: ' + t.cat[1] + '. Слов: ' + ws.length + '; загадок: ' + t.riddles.length + '; предложений: ' + t.sents.length +
        (t.story ? '; есть рассказ-образец' : '') + (t.finger ? '; пальчиковая гимнастика' : '') + (t.move ? '; физминутка' : '') + '.' }));
      if (missing.length) body.appendChild(h('div', { class: 'warnbox', text: 'Нет картинки: ' + missing.map(function (e) { return e.w; }).join(', ') + '. Нажмите на слово, чтобы подобрать картинку, иначе оно не попадёт в задания.' }));
      body.appendChild(h('div', { class: 'label', text: 'Словарь темы (нажмите — сменить картинку, ✕ — убрать слово)' }));
      body.appendChild(h('div', { class: 'chips' }, ws.map(function (e) {
        var pic = IMG.hasPicture(e);
        return h('span', { class: 'chip' + (pic ? ' on' : ' off') }, [
          h('button', { class: 'chip-in', onclick: function () { openImageDialog(e, draw); } }, [wordThumb(e) ? h('img', { src: wordThumb(e), alt: '' }) : null, e.w + (e.gp ? ' · много ' + e.gp : '')]),
          h('button', { class: 'chip-x', 'aria-label': 'Убрать', text: '✕', onclick: function () {
            if (t.words.length <= 4) { snack('В теме должно остаться хотя бы 4 слова.'); return; }
            t.words = t.words.filter(function (w) { return w !== e.w; });
            t.riddles = t.riddles.filter(function (r) { return r[0] !== e.w; });
            t.routes = t.routes.filter(function (r) { return r[0] !== e.w && r[1] !== e.w; });
            if (t.pairs.baby) t.pairs.baby.items = t.pairs.baby.items.filter(function (p) { return p[0] !== e.w; });
            DB.addTheme(t); draw();
          } })
        ]);
      })));
      if (t.riddles.length) {
        body.appendChild(h('div', { class: 'label', text: 'Загадки' }));
        t.riddles.slice(0, 3).forEach(function (r) { body.appendChild(h('p', { class: 'small', text: '«' + r[1] + '» — ' + r[0] })); });
      }
      if (t.story) {
        body.appendChild(h('div', { class: 'label', text: 'Рассказ-образец' }));
        body.appendChild(h('p', { class: 'small', text: t.story.text }));
      }
      if (notes && notes.length) body.appendChild(h('div', { class: 'small muted', text: notes.join('; ') }));
      body.appendChild(h('div', { class: 'small muted', style: 'margin-top:8px', text: 'Материал составлен ИИ (' + AI.label() + ') и проверен программой: формы слов, ссылки загадок и маршрутов на слова темы. Прочитайте его перед занятием.' }));
    }
    draw();
    openSheet('Новая тема «' + t.title + '»', body, [
      h('button', { class: 'btn ghost', text: 'Отмена', onclick: function () { closeSheet(); } }),
      h('button', { class: 'btn primary', html: ICON.wand + 'Сохранить и выбрать', onclick: function () {
        var ok = t.words.map(DB.word).filter(function (e) { return e && IMG.hasPicture(e); }).length;
        if (ok < 4) { snack('Нужно хотя бы 4 слова с картинками. Подберите картинки для слов.'); return; }
        saved = true; saveAiTheme(t); pickTheme(t.id);
        snack('Тема «' + t.title + '» сохранена. Она есть в списке тем в разделе «Мои темы».');
      } })
    ], function () { if (!saved) DB.removeTheme(t.id); });
  }

  /* ---------- ИИ: дополнительный материал к занятию ---------- */
  function aiExtrasCard() {
    var X = R.L.extra;
    var parts = [];
    if (X) {
      if ((X.chist || []).length) parts.push('чистоговорки (' + X.chist.length + ')');
      if ((X.skor || []).length) parts.push('скороговорки');
      if ((X.riddles || []).length) parts.push('загадки (' + X.riddles.length + ')');
      if (X.poem) parts.push('стихотворение');
      if (X.retell) parts.push('рассказ для пересказа');
    }
    return h('div', { class: 'card aibox' }, [
      h('b', { text: '✨ ИИ-помощник' }),
      h('div', { class: 'small muted', text: X ? 'В занятие добавлено: ' + parts.join(', ') + '. Материал есть в конспекте, техкарте и документе Word.'
        : 'Составит ' + (R.L.sound ? 'чистоговорки на звук ' + PH.BY_ID[R.L.sound].name + ', ' : '') + 'новые загадки, стихотворение и рассказ для пересказа по теме «' + R.L.theme.title + '». Программа проверит материал, вы выберете нужное.' }),
      h('div', { class: 'row-gap', style: 'margin-top:8px' }, X ? [
        h('button', { class: 'btn sm soft', html: ICON.refresh + 'Составить заново', onclick: runExtras }),
        h('button', { class: 'btn sm ghost', text: 'Убрать', onclick: function () { applyExtras(null); } })
      ] : [
        h('button', { class: 'btn sm primary', html: ICON.wand + (AI.ready() ? 'Составить материал' : 'Подключить ИИ'), onclick: runExtras })
      ])
    ]);
  }
  function runExtras() {
    if (!AI.ready()) { openAiSettings(); return; }
    busy('ИИ составляет материал по теме «' + R.L.theme.title + '»…');
    AI.makeExtras(R.L).then(function (x) { busy(false); openExtrasReview(x); })
      .catch(function (err) { busy(false); snack(err.message, [['Настройки ИИ', function () { openAiSettings(); }]], 12000); });
  }
  function openExtrasReview(x) {
    var pick = { chist: x.chist.map(function () { return true; }), skor: x.skor.map(function () { return true; }), riddles: x.riddles.map(function () { return true; }), poem: !!x.poem, retell: !!x.retell };
    var body = h('div');
    function item(on, text, toggle) {
      return h('div', { class: 'opt' + (on ? ' on' : ''), onclick: function (ev) { toggle(); ev.currentTarget.classList.toggle('on'); ev.currentTarget.querySelector('.box').textContent = ev.currentTarget.classList.contains('on') ? '✓' : ''; } },
        [h('span', { class: 'box', text: on ? '✓' : '' }), h('div', { class: 'txt' }, [h('span', { text: text })])]);
    }
    function group(title, list, key, fmt) {
      if (!list.length) return;
      body.appendChild(h('div', { class: 'label', text: title }));
      body.appendChild(h('div', { class: 'list' }, list.map(function (it, i) { return item(true, fmt(it), function () { pick[key][i] = !pick[key][i]; }); })));
    }
    group('Чистоговорки' + (R.L.sound ? ' на звук ' + PH.BY_ID[R.L.sound].name : ''), x.chist, 'chist', function (c) { return c; });
    group('Скороговорки', x.skor, 'skor', function (c) { return c; });
    group('Загадки (отгадки — слова темы)', x.riddles, 'riddles', function (r) { return '«' + r[1] + '» — ' + r[0]; });
    if (x.poem) {
      body.appendChild(h('div', { class: 'label', text: 'Стихотворение для заучивания' }));
      body.appendChild(item(true, '«' + x.poem.name + '»: ' + x.poem.lines.join(' / '), function () { pick.poem = !pick.poem; }));
    }
    if (x.retell) {
      body.appendChild(h('div', { class: 'label', text: 'Рассказ для пересказа' }));
      body.appendChild(item(true, '«' + x.retell.title + '». ' + x.retell.text + (x.questions.length ? ' Вопросы: ' + x.questions.join(' ') : ''), function () { pick.retell = !pick.retell; }));
    }
    body.appendChild(h('div', { class: 'small muted', style: 'margin-top:10px', text: 'Составлено: ' + x.by + '. Чистоговорки проверены на наличие звука, отгадки загадок — на соответствие словам темы.' }));
    openSheet('Материал ИИ', body, [
      h('button', { class: 'btn ghost', text: 'Отмена', onclick: function () { closeSheet(); } }),
      h('button', { class: 'btn primary', text: 'Добавить в занятие', onclick: function () {
        var sel = {
          chist: x.chist.filter(function (c, i) { return pick.chist[i]; }), skor: x.skor.filter(function (c, i) { return pick.skor[i]; }),
          riddles: x.riddles.filter(function (c, i) { return pick.riddles[i]; }), poem: pick.poem ? x.poem : null,
          retell: pick.retell ? x.retell : null, questions: pick.retell ? x.questions : [], by: x.by, date: x.date
        };
        closeSheet();
        applyExtras(sel.chist.length || sel.skor.length || sel.riddles.length || sel.poem || sel.retell ? sel : null);
      } })
    ]);
  }
  function applyExtras(x) {
    ST.extra = x ? Object.assign({ key: extraKey() }, x) : null;
    saveAll();
    R.L.extra = ST.extra;
    R.plan = LESSON.build(R.L);
    showResult('plan');
    snack(x ? 'Материал ИИ добавлен в конспект, техкарту и документ.' : 'Материал ИИ убран.');
  }

  /* ---------- настройки ИИ ---------- */
  function openAiSettings() {
    var cfg = AI.settings();
    var body = h('div');
    var showKey = false;
    function draw() {
      body.innerHTML = '';
      body.appendChild(h('div', { class: 'small muted', text: 'ИИ помогает создать новую тему, составить чистоговорки, загадки, стихи и нарисовать картинку. Программа проверяет ответы ИИ по словарю темы, а вы просматриваете их перед добавлением. Ключ хранится только на этом телефоне.' }));
      body.appendChild(h('div', { class: 'label', text: 'Сервис (все с бесплатным доступом)' }));
      body.appendChild(h('div', { class: 'list' }, AI.PROVIDERS.map(function (p) {
        return h('div', { class: 'opt' + (cfg.provider === p.id ? ' on' : ''), onclick: function () { cfg.provider = p.id; AI.save(); draw(); } }, [
          h('span', { class: 'dot' }), h('div', { class: 'txt' }, [h('b', { text: p.name + (p.images ? ' — текст и картинки' : '') }), h('span', { text: p.about })])
        ]);
      })));
      var p = AI.provider();
      if (!p) return;
      if (p.keyUrl) body.appendChild(h('button', { class: 'btn soft block', style: 'margin-top:10px', text: 'Получить бесплатный ключ: ' + p.keyUrl.replace('https://', ''), onclick: function () { NET.openUrl(p.keyUrl); } }));
      if (p.id === 'custom') {
        var bi = h('input', { type: 'url', value: cfg.base || '', placeholder: 'https://адрес-сервера/v1' });
        bi.addEventListener('input', function () { cfg.base = bi.value.trim(); AI.save(); });
        body.appendChild(h('div', { class: 'field' }, [h('label', { text: 'Адрес OpenAI-совместимого API' }), bi]));
        body.appendChild(h('div', { class: 'switch' + (cfg.customImages ? ' on' : ''), onclick: function (ev) { cfg.customImages = !cfg.customImages; AI.save(); ev.currentTarget.classList.toggle('on'); } },
          [h('div', { class: 'txt' }, ['Сервер умеет рисовать', h('span', { text: 'поддерживает /images/generations' })]), h('span', { class: 'tg' })]));
      }
      var ki = h('input', { type: showKey ? 'text' : 'password', value: (cfg.keys || {})[p.id] || '', placeholder: p.keyHint || 'ключ', autocomplete: 'off', spellcheck: 'false' });
      ki.addEventListener('input', function () { cfg.keys[p.id] = ki.value.trim(); AI.save(); });
      body.appendChild(h('div', { class: 'field' }, [h('label', { text: 'Ключ ' + p.name }), h('div', { class: 'row-gap' }, [h('div', { style: 'flex:1' }, [ki]),
        h('button', { class: 'btn sm ghost', text: showKey ? 'Скрыть' : 'Показать', onclick: function () { showKey = !showKey; draw(); } })])]));
      var mi = h('input', { type: 'text', value: (cfg.models || {})[p.id] || '', placeholder: p.model || 'подберётся автоматически', spellcheck: 'false' });
      mi.addEventListener('input', function () { cfg.models[p.id] = mi.value.trim(); AI.save(); });
      body.appendChild(h('div', { class: 'field' }, [h('label', { text: 'Модель (можно не указывать)' }), h('div', { class: 'row-gap' }, [h('div', { style: 'flex:1' }, [mi]),
        h('button', { class: 'btn sm soft', text: 'Список', onclick: function () { pickModel(p, function (id) { cfg.models[p.id] = id; AI.save(); draw(); }); } })])]));
      if (p.images || (p.id === 'custom' && cfg.customImages)) {
        var im = h('input', { type: 'text', value: cfg.imageModel || '', placeholder: 'модель картинок — по умолчанию', spellcheck: 'false' });
        im.addEventListener('input', function () { cfg.imageModel = im.value.trim(); AI.save(); });
        body.appendChild(h('div', { class: 'field' }, [h('label', { text: 'Модель для картинок (необязательно)' }), im]));
      }
      var res = h('div', { style: 'margin-top:8px' });
      body.appendChild(h('button', { class: 'btn primary block', html: ICON.wand + 'Проверить подключение', onclick: function () {
        res.innerHTML = '<div class="muted small">Спрашиваю ИИ…</div>';
        AI.chat([{ role: 'user', content: 'Ответь одним словом по-русски: как называется детёныш кошки?' }], { timeout: 90000, temperature: 0 }).then(function (a) {
          res.innerHTML = '';
          res.appendChild(h('div', { class: 'okbox', text: 'Работает! ' + AI.label() + ' отвечает: «' + String(a).slice(0, 80) + '».' }));
        }).catch(function (err) { res.innerHTML = ''; res.appendChild(h('div', { class: 'warnbox', text: err.message })); });
      } }));
      body.appendChild(res);
    }
    draw();
    openSheet('Бесплатный ИИ', body, null, function () { if (screen === 'form') renderForm(); });
  }
  function pickModel(p, done) {
    busy('Загружаю список моделей…');
    AI.listModels(p.id).then(function (ids) {
      busy(false);
      if (!ids.length) { snack('Сервис не вернул список моделей. Укажите модель вручную.'); return; }
      var body = h('div', { class: 'list' }, ids.slice(0, 150).map(function (id) {
        return h('div', { class: 'opt', onclick: function () { closeSheet(); done(id); } }, [h('span', { class: 'dot' }), h('div', { class: 'txt' }, [h('b', { text: id })])]);
      }));
      openSheet('Модели ' + p.name + (p.free ? ' (бесплатные)' : ''), body);
    }).catch(function (err) { busy(false); snack(err.message); });
  }

  /* ---------- настройки ---------- */
  function openSettings() {
    var body = h('div');
    function field(label, key, multiline) {
      var inp = multiline ? h('textarea', { text: S[key] || '' }) : h('input', { type: 'text', value: S[key] || '' });
      inp.addEventListener('input', function () { S[key] = inp.value; saveAll(); });
      body.appendChild(h('div', { class: 'field' }, [h('label', { text: label }), inp]));
    }
    body.appendChild(h('div', { class: 'opt aiopt', onclick: function () { openAiSettings(); } }, [h('span', { class: 'ai-ic', text: '✨' }),
      h('div', { class: 'txt' }, [h('b', { text: 'Бесплатный ИИ' }), h('span', { text: AI.ready() ? 'Подключён: ' + AI.label() : 'Не подключён — нажмите, чтобы выбрать сервис и вставить ключ' })])]));
    field('Полное название учреждения (титульный лист)', 'orgFull', true);
    field('Краткое название (шапка приложения)', 'orgShort');
    field('Город', 'city');
    field('ФИО составителя', 'teacher');
    field('Должность', 'position');
    field('Название группы', 'group');
    body.appendChild(h('div', { class: 'label', text: 'Документ Word' }));
    body.appendChild(seg([[14, 'Шрифт 14 пт'], [12, 'Шрифт 12 пт']], S.fontSize, function (v) { S.fontSize = v; saveAll(); closeSheet(); openSettings(); }));
    var incNames = [['title', 'Титульный лист'], ['info', 'Цели и задачи отдельной таблицей (в техкарте они уже есть)'], ['techcard', 'Технологическая карта'], ['conspect', 'Ход занятия (конспект)'],
      ['home', 'Задание родителям'], ['extra', 'Материал ИИ (чистоговорки, загадки, стихи)'], ['keys', 'Ключи к заданиям'], ['sources', 'Нормативная база и литература'], ['worksheet', 'Рабочий лист']];
    incNames.forEach(function (x) {
      var on = S.include[x[0]] !== false;
      body.appendChild(h('div', { class: 'switch' + (on ? ' on' : ''), onclick: function (ev) {
        S.include[x[0]] = !on; saveAll(); ev.currentTarget.classList.toggle('on');
        on = !on;
      } }, [h('div', { class: 'txt', text: x[1] }), h('span', { class: 'tg' })]));
    });
    function sw(key, label, sub) {
      var on = !!S[key];
      body.appendChild(h('div', { class: 'switch' + (on ? ' on' : ''), onclick: function (ev) { S[key] = !S[key]; saveAll(); ev.currentTarget.classList.toggle('on'); } },
        [h('div', { class: 'txt' }, [label, sub ? h('span', { text: sub }) : null]), h('span', { class: 'tg' })]));
    }
    body.appendChild(h('div', { class: 'label', text: 'Рабочий лист' }));
    sw('captions', 'Подписи под картинками', 'Помогают взрослому; ребёнок называет картинку сам');
    sw('answersOnSheet', 'Ответы для взрослого прямо на листе', 'Иначе — отдельно в разделе «Ключи»');
    body.appendChild(h('div', { class: 'label', text: 'Размер интерфейса' }));
    body.appendChild(seg([[15, 'Мельче'], [16, 'Обычный'], [18, 'Крупнее']], S.uiScale || 16, function (v) { S.uiScale = v; saveAll(); applyScale(); closeSheet(); openSettings(); }));
    body.appendChild(h('div', { class: 'label', text: 'Данные' }));
    body.appendChild(h('button', { class: 'btn danger block', text: 'Удалить все сохранённые картинки из интернета', onclick: function () {
      Promise.all(Object.keys(IMG.overrides).map(function (k) { return IMG.setOverride(k, null); })).then(function () { snack('Картинки удалены.'); });
    } }));
    openSheet('Настройки', body, null, function () { setHeader(); if (screen === 'form') renderForm(); });
  }
  function applyScale() { document.documentElement.style.setProperty('--fs', (S.uiScale || 16) + 'px'); }

  /* ---------- запуск ---------- */
  window.__onBack = function () {
    if (closeSheet()) return true;
    if (screen === 'result') { renderForm(); return true; }
    return false;
  };
  iconBtn('btnSettings', 'gear').addEventListener('click', openSettings);
  iconBtn('btnLibrary', 'book').addEventListener('click', openLibrary);
  iconBtn('btnHistory', 'clock').addEventListener('click', openHistory);
  iconBtn('btnBack', 'back').addEventListener('click', function () { renderForm(); });
  applyScale();
  if (!DB.byId[ST.themeId]) ST.themeId = DB.themes[0].id;
  IMG.loadOverrides().then(renderForm, renderForm);
  window.APP = { state: function () { return ST; }, result: function () { return R; }, build: buildLesson, makeDocx: makeDocx, settings: S };
})();
