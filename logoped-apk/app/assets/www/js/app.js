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
    include: { title: true, info: true, techcard: true, conspect: true, home: true, keys: true, sources: true, worksheet: true }
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
  var ST = load('lp.state', defState());
  ST.tech = Object.assign(defTech(), ST.tech || {});
  var customWords = load('lp.customWords', {});
  Object.keys(customWords).forEach(function (w) { if (!DB.words[w]) DB.words[w] = customWords[w]; });
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
  function config() {
    return {
      theme: theme(), words: selWords(), age: ST.age, form: ST.form, kind: ST.kind, direction: ST.direction,
      sound: ST.sound, sound2: ST.sound ? ST.sound2 : null, duration: ST.duration || 0, conclusion: ST.conclusion,
      tech: Object.assign({}, ST.tech, { sinkvein: ST.tech.sinkvein && ST.age === '6' }), captions: S.captions !== false,
      seed: ST.seed, reroll: ST.reroll || {}, date: Date.now()
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
    var ov = IMG.getOverride(e.w);
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
    app.appendChild(card(1, 'Лексическая тема', 'месяц: ' + monthName(baseTheme().month), [
      h('button', { class: 'theme-pick', onclick: openThemePicker }, [
        h('img', { src: codeSrc(baseTheme().icon), alt: '' }),
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
        return h('div', { class: 'opt' + (ST.direction === d.id ? ' on' : ''), onclick: function () { ST.direction = d.id; ST.taskIds = null; changed(); } }, [
          h('span', { class: 'dot' }), h('div', { class: 'txt' }, [h('b', { text: d.name })])
        ]);
      }))
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
    app.appendChild(card(7, 'Задания рабочего листа', ids.length + ' из ' + avail.length, [
      h('div', { class: 'small muted', style: 'margin-bottom:8px', text: 'Все задания строятся только из слов выбранной темы; картинки в заданиях — те же слова, что в тексте задания.' }),
      h('div', { class: 'list' }, avail.map(function (id) {
        var on = ids.indexOf(id) >= 0;
        return h('div', { class: 'opt' + (on ? ' on' : ''), onclick: function () {
          var cur = currentTaskIds(config(), avail);
          ST.taskIds = on ? cur.filter(function (x) { return x !== id; }) : cur.concat([id]);
          changed();
        } }, [h('span', { class: 'box', text: on ? '✓' : '' }), h('div', { class: 'txt' }, [h('b', { text: names[id] || id })])]);
      })),
      ST.taskIds ? h('button', { class: 'btn ghost sm', style: 'margin-top:8px', text: 'Подобрать автоматически', onclick: function () { ST.taskIds = null; changed(); } }) : null
    ]));

    dock([h('button', { class: 'btn primary', html: ICON.wand + 'Собрать занятие', onclick: buildLesson })]);
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
      order.forEach(function (m) {
        var ts = DB.themes.filter(function (t) { return t.month === m && (!q || t.title.toLowerCase().indexOf(q) >= 0 || t.words.some(function (w) { return w.indexOf(q) === 0; })); });
        if (!ts.length) return;
        list.appendChild(h('div', { class: 'month', text: monthName(m) }));
        list.appendChild(h('div', { class: 'tgrid' }, ts.map(function (t) {
          return h('button', { class: 'tcard' + (t.id === ST.themeId ? ' on' : ''), onclick: function () {
            ST.themeId = t.id; ST.customTitle = ''; ST.off = []; ST.extraWords = []; ST.taskIds = null; ST.seed = String(Date.now());
            closeSheet(); changed();
          } }, [h('img', { src: codeSrc(t.icon), alt: '' }), h('span', { text: t.title })]);
        })));
      });
      info.innerHTML = '';
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
          customWords[w] = { w: w, g: 'м', adj: [], v: [], custom: true };
          DB.words[w] = customWords[w];
          store('lp.customWords', customWords);
          addWord(w);
          openImageDialog(DB.word(w));
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
      app.appendChild(h('div', { class: 'card tc' }, P.stages.map(function (s) {
        return h('div', { class: 'row' }, [
          h('div', {}, [h('b', { text: s.n + '. ' + s.name + ' — ' + s.min + ' мин' })]),
          h('div', { text: 'Задачи: ' + s.aim }), h('div', { text: 'Логопед: ' + s.teacher }), h('div', { text: 'Дети: ' + s.children }),
          h('div', { class: 'muted', text: 'Методы: ' + s.methods + '. Результат: ' + s.result })
        ]);
      }).concat([h('div', { class: 'row' }, [h('b', { text: 'Итого: ' + U.min(P.total) })])])));
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
  function makeDocx() {
    busy('Готовлю документ Word…', 0);
    var pngs = [];
    var chain = Promise.resolve();
    R.tasks.forEach(function (t, i) {
      chain = chain.then(function () {
        return TASKS.render(t, 1).then(function (cv) { pngs[i] = IMG.toPngBytes(cv); }).catch(function () { pngs[i] = null; })
          .then(function () { busy('Готовлю документ Word…', (i + 1) / (R.tasks.length + 1)); });
      });
    });
    return chain.then(function () {
      var bytes = EXPORT.docx(R.L, R.plan, R.tasks, pngs, S);
      return { name: EXPORT.fileName(R.L, 'docx'), bytes: bytes };
    });
  }
  function exportDocx() {
    makeDocx().then(function (f) { return NET.saveFile(f.name, f.bytes, DOCX_MIME).then(function (res) { return [f, res]; }); })
      .then(function (x) {
        busy(false);
        var f = x[0], res = x[1];
        if (!res || !res.ok) { snack('Не удалось сохранить: ' + ((res && res.error) || 'ошибка')); return; }
        R.saved = res.name || f.name;
        snack('Сохранено: ' + (res.path || f.name), NET.isAndroid() ? [['Открыть', function () { NET.openFile(R.saved, DOCX_MIME); }], ['Отправить', function () { NET.shareFile(R.saved, DOCX_MIME); }]] : []);
      }).catch(function (err) { busy(false); snack('Ошибка: ' + err.message); });
  }
  function shareDocx() {
    if (!NET.isAndroid()) { exportDocx(); return; }
    makeDocx().then(function (f) { return NET.saveFile(f.name, f.bytes, DOCX_MIME).then(function (res) { return [f, res]; }); })
      .then(function (x) {
        busy(false);
        if (!x[1] || !x[1].ok) { snack('Не удалось подготовить файл'); return; }
        R.saved = x[1].name || x[0].name;
        NET.shareFile(R.saved, DOCX_MIME);
      }).catch(function (err) { busy(false); snack('Ошибка: ' + err.message); });
  }
  function printDialog() {
    var body = h('div', { class: 'list' }, [
      ['sheet', 'Только рабочий лист', 'Задания с картинками — удобно печатать детям'],
      ['plan', 'Только конспект', 'Цели, техкарта, ход занятия, задание родителям'],
      ['all', 'Всё вместе', 'Конспект и рабочий лист']
    ].map(function (o) {
      return h('div', { class: 'opt', onclick: function () { closeSheet(); doPrint(o[0]); } }, [h('span', { class: 'dot' }), h('div', { class: 'txt' }, [h('b', { text: o[1] }), h('span', { text: o[2] })])]);
    }));
    body.appendChild(h('div', { class: 'small muted', style: 'margin-top:10px', text: 'Откроется окно печати Android: можно выбрать принтер или «Сохранить как PDF».' }));
    openSheet('Печать / PDF', body);
  }
  function doPrint(part) {
    busy('Готовлю страницы для печати…');
    var urls = [];
    var chain = Promise.resolve();
    R.tasks.forEach(function (t, i) {
      chain = chain.then(function () { return TASKS.render(t, 0.8).then(function (cv) { urls[i] = cv.toDataURL('image/png'); }); });
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
        h('img', { src: codeSrc((DB.byId[x.cfg.themeId] || {}).icon), style: 'width:40px;height:40px' }),
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

  /* ---------- настройки ---------- */
  function openSettings() {
    var body = h('div');
    function field(label, key, multiline) {
      var inp = multiline ? h('textarea', { text: S[key] || '' }) : h('input', { type: 'text', value: S[key] || '' });
      inp.addEventListener('input', function () { S[key] = inp.value; saveAll(); });
      body.appendChild(h('div', { class: 'field' }, [h('label', { text: label }), inp]));
    }
    field('Полное название учреждения (титульный лист)', 'orgFull', true);
    field('Краткое название (шапка приложения)', 'orgShort');
    field('Город', 'city');
    field('ФИО составителя', 'teacher');
    field('Должность', 'position');
    field('Название группы', 'group');
    body.appendChild(h('div', { class: 'label', text: 'Документ Word' }));
    body.appendChild(seg([[14, 'Шрифт 14 пт'], [12, 'Шрифт 12 пт']], S.fontSize, function (v) { S.fontSize = v; saveAll(); closeSheet(); openSettings(); }));
    var incNames = [['title', 'Титульный лист'], ['info', 'Информационная карта (цели, задачи)'], ['techcard', 'Технологическая карта'], ['conspect', 'Ход занятия (конспект)'],
      ['home', 'Задание родителям'], ['keys', 'Ключи к заданиям'], ['sources', 'Нормативная база и литература'], ['worksheet', 'Рабочий лист']];
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
