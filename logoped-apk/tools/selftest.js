#!/usr/bin/env node
/*
 * Самопроверка генераторов без браузера: для каждой темы, возраста, направления и звука
 * собирает рабочий лист и конспект и проверяет, что
 *  - каждое задание построено из слов выбранной темы (или названной в ответе смежной темы),
 *  - у всех слов задания есть картинка,
 *  - в текстах нет пустых подстановок (undefined, null, {w} …),
 *  - хронометраж этапов совпадает с длительностью занятия по СанПиН.
 * Запуск: node tools/selftest.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WWW = path.join(__dirname, '..', 'app', 'assets', 'www');
const issues = [];
const ctx = { console, TextEncoder };
ctx.window = ctx;
vm.createContext(ctx);
['js/util.js', 'js/phonetics.js', 'js/art.js', 'js/art2.js', 'data/db.js', 'data/methods.js', 'data/omcodes.js', 'data/omindex.js']
  .concat(fs.readdirSync(path.join(WWW, 'data')).filter(f => /^themes_.*\.js$/.test(f)).sort().map(f => 'data/' + f))
  .concat(['js/images.js', 'js/tasks.js', 'js/lesson.js', 'js/online.js', 'js/ai.js', 'js/docx.js', 'js/export.js'])
  .forEach(rel => vm.runInContext(fs.readFileSync(path.join(WWW, rel), 'utf8'), ctx, { filename: rel }));
const { DB, TASKS, LESSON, METHODS, IMG, PH, AI, NET, EXPORT, DOCX, U } = vm.runInContext('({ DB, TASKS, LESSON, METHODS, IMG, PH, AI, NET, EXPORT, DOCX, U })', ctx);

/* Тема «от ИИ» (типичный ответ модели: в ограждении ```, с лишней запятой, с ошибками) — проверяем разбор и сборку занятий */
const AI_SAMPLE = {
  title: 'Спорт', month: 1, kind: 'toy', contrast: ['posuda', 'dik_zhiv', 'нет_такой'],
  cat: ['спортивный инвентарь', 'спортивный инвентарь', 'спортивного инвентаря'],
  words: [
    { w: 'мяч', gs: 'мяча', pl: 'мячи', gp: 'мячей', g: 'м', dim: 'мячик', en: 'soccer ball' },
    { w: 'лыжи', gs: '-', pl: 'лыжи', gp: 'лыж', g: 'мн', en: 'skis' },
    { w: 'медаль', gs: 'медали', pl: 'медали', gp: 'медалей', g: 'ж', en: 'sports medal' },
    { w: 'коньки', gs: '-', pl: 'коньки', gp: 'коньков', g: 'мн', en: 'ice skate' },
    { w: 'велосипед', gs: 'велосипеда', pl: 'велосипеды', gp: 'велосипедов', g: 'м', en: 'bicycle' },
    { w: 'кубок', gs: 'кубка', pl: 'кубки', gp: 'кубков', g: 'м', dim: 'кубочек', en: 'trophy', adj: ['золотой'], v: ['блестит'] },
    { w: 'ракетка', gs: 'ракетки', pl: 'ракетки', gp: 'ракеток', g: 'ж', en: 'badminton' },
    { w: 'Ball', gs: 'x', g: 'м' },
    { w: 'шайба', gs: 'шайбы', pl: 'котята', gp: 'шайб', g: 'ж', en: 'hockey puck' }
  ],
  riddles: [['мяч', 'Его пинают, а он не плачет, его бросают — он скачет.'], ['слон', 'Не из темы.']],
  routes: [['мяч', 'кубок', 'Проведи мяч к кубку.'], ['мяч', 'слон', 'Не из темы.']],
  talk: [{ name: 'Для чего?', qt: 'Для чего нужен {w}?', tpl: '{W} нужен, {a}.', items: [['мяч', 'чтобы играть'], ['кубок', 'чтобы наградить'], ['медаль', 'чтобы наградить'], ['слон', 'нет']] }],
  sents: ['Мальчик ловит мяч.', 'Девочка катается на коньках.'],
  story: { word: 'мяч', text: 'Это мяч. Он круглый, резиновый и лёгкий. Им играют в футбол. Мяч можно бросать, ловить и катать. После игры мяч нужно положить на место.' },
  finger: { name: 'Спортсмены', lines: ['Раз, (жест)', 'Раз, (жест)', 'Два, (жест)', 'Три. (жест)'] }
};
let aiTheme = null;
try {
  const raw = 'Вот ответ:\n```json\n' + JSON.stringify(AI_SAMPLE).replace(/\]\}$/, '],}') + '\n```';
  const res = AI.normalizeTheme(AI.parseJson(raw), 'Спорт', 'ai_selftest');
  res.newWords.forEach(e => {
    const hit = NET.openmojiSearch(e.en || '', 1)[0];
    if (hit && hit.offline && hit.score >= 60) e.img = hit.hex;
    DB.addWord(e);
  });
  aiTheme = DB.addTheme(res.theme);
  const t = aiTheme, sh = DB.word('шайба');
  const checks = [
    [t.words.indexOf('Ball') < 0, 'латинское слово должно быть отброшено'],
    [t.riddles.every(r => t.words.indexOf(r[0]) >= 0), 'загадки только со словами темы'],
    [t.routes.length === 1, 'маршрут «мяч → слон» должен быть отброшен'],
    [t.talk[0] && t.talk[0].items.every(it => t.words.indexOf(it[0]) >= 0), 'игры только со словами темы'],
    [t.contrast.join() === 'posuda,dik_zhiv', 'несуществующая тема-контраст отброшена'],
    [t.cat.length === 5, 'обобщающее слово во всех падежах'],
    [!sh || sh.pl === null, 'неверная форма «котята» у слова «шайба» должна быть отброшена'],
    [t.finger && t.finger.lines.length === 4, 'повторяющиеся строки гимнастики сохраняются']
  ];
  checks.forEach(c => { if (!c[0]) issues.push('ИИ-тема: ' + c[1]); });
} catch (e) { issues.push('ИИ-тема: ошибка разбора ' + e.message); }

const BAD = /undefined|null|NaN|\[object|\{[wWaA]\}|\{pl\}|\{PL\}|\s{2,}\S|\s[,.;:]/;
let lessons = 0, tasksTotal = 0;

function scan(label, v) {
  if (typeof v === 'string') { if (BAD.test(v)) issues.push(label + ': ' + v.slice(0, 160)); }
  else if (Array.isArray(v)) v.forEach(x => scan(label, x));
  else if (v && typeof v === 'object') {
    Object.keys(v).forEach(k => { if (!['draw', 'words', 'theme', 'tasks', 'rnd'].includes(k)) scan(label + '.' + k, v[k]); });
  }
}

/** Слова, допустимые в задании темы: сама тема, её доп. слова, пары, маршруты, загадки, рассказ, группы и темы-контрасты */
function allowed(th) {
  const s = new Set(th.words.concat(th.extra || []));
  Object.values(th.pairs || {}).forEach(p => p.items.forEach(x => { s.add(x[0]); s.add(x[1]); }));
  (th.routes || []).forEach(r => { s.add(r[0]); s.add(r[1]); });
  (th.riddles || []).forEach(r => s.add(r[0]));
  if (th.story) s.add(th.story.word);
  if (th.forms) th.forms.items.forEach(x => s.add(x[0]));
  const linked = (th.contrast || []).slice();
  if (th.groups) th.groups.sets.forEach(g => {
    if (Array.isArray(g[2])) g[2].forEach(w => s.add(w));
    else if (g[2] !== 'self') linked.push(g[2]);
  });
  linked.forEach(id => { const t = DB.byId[id]; if (t) t.words.forEach(w => s.add(w)); });
  return s;
}

const tech = {};
METHODS.TECH.forEach(t => { tech[t.id] = true; });
const sounds = [null].concat(PH.TARGETS.map(t => t.id));

DB.themes.forEach(th => {
  const words = th.words.map(w => DB.word(w)).filter(e => e && IMG.hasPicture(e));
  if (words.length !== th.words.length && !th.ai) issues.push(th.id + ': у слов нет картинок: ' + th.words.filter(w => !IMG.hasPicture(w)).join(', '));
  const ok = allowed(th);
  ['4', '5', '6'].forEach(age => {
    METHODS.DIRECTIONS.forEach(dir => {
      sounds.forEach(snd => {
        if (dir.id !== 'sound' && dir.id !== 'complex' && snd && snd !== 'Р') return;
        ['front', 'sub', 'ind'].forEach(form => {
          if (form !== 'front' && (snd || dir.id !== 'complex')) return;
          const L = {
            theme: th, words, age, form, kind: snd ? 'new' : 'consolidate', direction: dir.id, sound: snd, sound2: null,
            duration: 0, conclusion: 'ОНР III уровня', tech, captions: true, seed: th.id + age, reroll: {}, date: 0
          };
          const label = [th.id, age, dir.id, snd || '-', form].join('/');
          let tasks, plan;
          try {
            const avail = TASKS.available(L);
            tasks = TASKS.build(L, TASKS.defaults(L, avail));
            L.tasks = tasks;
            plan = LESSON.build(L);
          } catch (e) { issues.push(label + ': ошибка ' + e.message); return; }
          lessons++;
          if (!tasks.length) issues.push(label + ': пустой рабочий лист');
          tasks.forEach(t => {
            tasksTotal++;
            scan(label + '/' + t.id, t);
            (t.words || []).forEach(e => {
              if (!e) { issues.push(label + '/' + t.id + ': пустое слово'); return; }
              if (!IMG.hasPicture(e)) issues.push(label + '/' + t.id + ': нет картинки «' + e.w + '»');
              if (!ok.has(e.w) && !(e.of && ok.has(e.of))) issues.push(label + '/' + t.id + ': слово не из темы «' + e.w + '»');
            });
          });
          scan(label + '/plan', plan);
          if (plan.total !== LESSON.duration(L)) issues.push(label + ': хронометраж ' + plan.total + ' ≠ ' + LESSON.duration(L));
        });
      });
    });
  });
});

/* Экспорт: Word и HTML по частям — всё занятие, только рабочий лист, лист с ответами, без листа */
const INC = { title: true, info: false, techcard: true, conspect: true, home: true, extra: true, keys: true, sources: true, worksheet: true };
const SETTINGS = { orgFull: 'МАДОУ «Центр развития ребенка – детский сад № 1 «Шатлык»»', city: 'г. Набережные Челны', teacher: 'Иванова И. И.', position: 'учитель-логопед', fontSize: 14, include: INC };
function partSettings(part) {
  if (part === 'sheet' || part === 'sheetKeys') {
    const inc = {}; Object.keys(INC).forEach(k => { inc[k] = false; }); inc.worksheet = true;
    return Object.assign({}, SETTINGS, { include: inc, answersOnSheet: part === 'sheetKeys' });
  }
  if (part === 'plan') return Object.assign({}, SETTINGS, { include: Object.assign({}, INC, { worksheet: false }) });
  return SETTINGS;
}
let exportsN = 0;
['osen', 'dom_zhiv', 'zim_ptic', 'transport', 'ovoshchi', 'kosmos'].map(id => DB.byId[id] || DB.themes[0]).forEach(th => {
  const words = th.words.map(w => DB.word(w)).filter(e => e && IMG.hasPicture(e));
  METHODS.DIRECTIONS.forEach(dir => {
    const L = { theme: th, words, age: '5', form: 'front', kind: 'consolidate', direction: dir.id, sound: null, sound2: null,
      duration: 0, conclusion: 'ОНР III уровня', tech, captions: true, seed: 'exp' + th.id, reroll: {}, date: 0 };
    const tasks = TASKS.build(L, TASKS.defaults(L, TASKS.available(L)));
    L.tasks = tasks;
    const plan = LESSON.build(L), kind = EXPORT.kindOf(L);
    ['all', 'sheet', 'sheetKeys', 'plan'].forEach(part => {
      const label = 'экспорт ' + th.id + '/' + dir.id + '/' + part;
      let xml, page;
      try {
        const zip = Buffer.from(EXPORT.docx(L, plan, tasks, [], partSettings(part))).toString('utf8');
        xml = zip.slice(zip.indexOf('<w:body>'), zip.indexOf('</w:body>'));
        page = EXPORT.html(L, plan, tasks, [], Object.assign({}, SETTINGS, { answersOnSheet: true }), part === 'all' ? null : part);
      } catch (e) { issues.push(label + ': ошибка ' + e.message); return; }
      exportsN++;
      const sheet = xml.indexOf('РАБОЧИЙ ЛИСТ'), keysN = (xml.match(/Для взрослого/g) || []).length, htmlKeys = (page.match(/Для взрослого/g) || []).length;
      const name = EXPORT.fileName(L, 'docx', part);
      if (/[\\/:*?"<>|]/.test(name) || !/\.docx$/.test(name)) issues.push(label + ': имя файла ' + name);
      if (part === 'sheet' || part === 'sheetKeys') {
        if (sheet < 0) issues.push(label + ': нет рабочего листа');
        if (/КОНСПЕКТ|Технологическая карта|Ход занятия/.test(xml)) issues.push(label + ': в рабочий лист попал конспект');
        if (xml.indexOf('<w:sectPr') >= 0 && xml.indexOf('<w:sectPr') < sheet) issues.push(label + ': пустая страница перед рабочим листом');
        if (keysN !== (part === 'sheetKeys' ? tasks.length : 0)) issues.push(label + ': ответов в листе ' + keysN + ' из ' + tasks.length);
        if (htmlKeys !== (part === 'sheetKeys' ? tasks.length : 0)) issues.push(label + ': ответов в HTML ' + htmlKeys);
        if (/Технологическая карта/.test(page)) issues.push(label + ': в HTML листа попал конспект');
        if (!/^Рабочий лист/.test(name)) issues.push(label + ': имя файла листа ' + name);
      } else {
        if (xml.indexOf('Технологическая карта ' + kind.gen) < 0) issues.push(label + ': нет заголовка техкарты «' + kind.gen + '»');
        if (xml.indexOf(DOCX.esc(kind.area)) < 0) issues.push(label + ': нет образовательной области «' + kind.area + '»');
        if (part === 'plan' && sheet >= 0) issues.push(label + ': рабочий лист в файле без листа');
        if (part === 'all' && sheet < 0) issues.push(label + ': нет рабочего листа');
        if (page.indexOf(U.esc('Технологическая карта ' + kind.gen)) < 0) issues.push(label + ': нет техкарты в HTML');
      }
    });
  });
});

console.log(`Тем: ${DB.themes.length}, занятий собрано: ${lessons}, заданий: ${tasksTotal}, файлов экспорта: ${exportsN}, замечаний: ${issues.length}`);
if (issues.length) {
  console.log(issues.slice(0, 60).join('\n'));
  process.exitCode = 1;
}
