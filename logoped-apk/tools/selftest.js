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
const ctx = { console, TextEncoder };
ctx.window = ctx;
vm.createContext(ctx);
['js/util.js', 'js/phonetics.js', 'js/art.js', 'js/art2.js', 'data/db.js', 'data/methods.js', 'data/omcodes.js']
  .concat(fs.readdirSync(path.join(WWW, 'data')).filter(f => /^themes_.*\.js$/.test(f)).sort().map(f => 'data/' + f))
  .concat(['js/images.js', 'js/tasks.js', 'js/lesson.js'])
  .forEach(rel => vm.runInContext(fs.readFileSync(path.join(WWW, rel), 'utf8'), ctx, { filename: rel }));
const { DB, TASKS, LESSON, METHODS, IMG, PH } = vm.runInContext('({ DB, TASKS, LESSON, METHODS, IMG, PH })', ctx);

const BAD = /undefined|null|NaN|\[object|\{[wWaA]\}|\{pl\}|\{PL\}|\s{2,}\S|\s[,.;:]/;
const issues = [];
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
  if (words.length !== th.words.length) issues.push(th.id + ': у слов нет картинок: ' + th.words.filter(w => !IMG.hasPicture(w)).join(', '));
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
