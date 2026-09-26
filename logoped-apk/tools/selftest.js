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
  .concat(['js/images.js', 'js/tasks.js', 'js/lesson.js', 'js/online.js', 'js/ai.js'])
  .forEach(rel => vm.runInContext(fs.readFileSync(path.join(WWW, rel), 'utf8'), ctx, { filename: rel }));
const { DB, TASKS, LESSON, METHODS, IMG, PH, AI, NET } = vm.runInContext('({ DB, TASKS, LESSON, METHODS, IMG, PH, AI, NET })', ctx);

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

console.log(`Тем: ${DB.themes.length}, занятий собрано: ${lessons}, заданий: ${tasksTotal}, замечаний: ${issues.length}`);
if (issues.length) {
  console.log(issues.slice(0, 60).join('\n'));
  process.exitCode = 1;
}
