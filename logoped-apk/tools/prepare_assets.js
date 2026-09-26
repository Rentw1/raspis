#!/usr/bin/env node
/*
 * Подготовка картинок: собирает коды OpenMoji, которые используются в словаре и темах,
 * копирует цветные (img/c) и контурные (img/b) SVG в assets и пишет data/omcodes.js.
 * Запуск: node tools/prepare_assets.js [путь к распакованному пакету openmoji]
 * Пакет можно получить так: npm pack openmoji@17.0.0 && tar xzf openmoji-17.0.0.tgz
 * Проверка без перезаписи файлов (для CI): node tools/prepare_assets.js --check
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const WWW = path.join(ROOT, 'app', 'assets', 'www');
const CHECK = process.argv.includes('--check');
let OM = process.argv.slice(2).filter(a => !a.startsWith('--'))[0];

if (!OM && !CHECK) {
  const cache = path.join(ROOT, '.tools', 'openmoji');
  if (!fs.existsSync(path.join(cache, 'package', 'color', 'svg'))) {
    fs.mkdirSync(cache, { recursive: true });
    console.log('» Скачиваю пакет openmoji@17.0.0 из npm…');
    execSync('npm pack openmoji@17.0.0 --silent', { cwd: cache, stdio: 'inherit' });
    execSync('tar xzf openmoji-17.0.0.tgz', { cwd: cache });
  }
  OM = path.join(cache, 'package');
}

const ctx = { console, window: {}, TextEncoder, document: undefined };
ctx.window = ctx;
vm.createContext(ctx);
function load(rel) { vm.runInContext(fs.readFileSync(path.join(WWW, rel), 'utf8'), ctx, { filename: rel }); }
['js/util.js', 'js/phonetics.js', 'js/art.js', 'js/art2.js', 'data/db.js', 'data/methods.js'].forEach(load);
fs.readdirSync(path.join(WWW, 'data')).filter(f => /^themes_.*\.js$/.test(f)).sort().forEach(f => load('data/' + f));
const DB = vm.runInContext('DB', ctx);
const ART = vm.runInContext('ART', ctx);

const codes = new Set(['1F5E3', '1F4E6', '1F9FA', '1F331', '1F333', '2744', '2600', '1F3E0', '1F332']);
const isCode = c => typeof c === 'string' && /^[0-9A-F]{4,5}(-[0-9A-F]{4,5})*$/.test(c);
Object.values(DB.words).forEach(e => { if (isCode(e.img)) codes.add(e.img); });
Object.values(ART.RECOLOR).forEach(r => codes.add(r.base));
DB.themes.forEach(t => {
  if (isCode(t.icon)) codes.add(t.icon);
  if (t.groups) t.groups.sets.forEach(s => { if (isCode(s[1])) codes.add(s[1]); });
  if (t.story) t.story.plan.forEach(p => { if (isCode(p[0])) codes.add(p[0]); });
});

const problems = DB.problems.slice();
// проверки словаря и тем
DB.themes.forEach(t => {
  t.words.concat(t.extra || []).forEach(w => { if (!DB.words[w]) problems.push(`Тема ${t.id}: нет слова «${w}»`); });
  Object.keys(t.pairs || {}).forEach(k => t.pairs[k].items.forEach(p => {
    [p[0], p[1]].forEach(w => { if (!DB.words[w]) problems.push(`Тема ${t.id}, пары ${k}: нет слова «${w}»`); });
  }));
  (t.routes || []).forEach(r => [r[0], r[1]].forEach(w => { if (!DB.words[w]) problems.push(`Тема ${t.id}, маршрут: нет слова «${w}»`); }));
  (t.riddles || []).forEach(r => { if (!DB.words[r[0]]) problems.push(`Тема ${t.id}, загадка: нет слова «${r[0]}»`); });
  if (t.story && !DB.words[t.story.word]) problems.push(`Тема ${t.id}: нет слова рассказа «${t.story.word}»`);
  if (t.forms) t.forms.items.forEach(x => { if (!DB.words[x[0]]) problems.push(`Тема ${t.id}, forms: нет слова «${x[0]}»`); });
  (t.talk || []).forEach(g => g.items.forEach(x => { if (!DB.words[x[0]]) problems.push(`Тема ${t.id}, игра «${g.name}»: нет слова «${x[0]}»`); }));
  (t.contrast || []).forEach(c => { if (!DB.byId[c]) problems.push(`Тема ${t.id}: нет темы-контраста ${c}`); });
  if (t.groups) t.groups.sets.forEach(s => {
    if (Array.isArray(s[2])) s[2].forEach(w => { if (!DB.words[w]) problems.push(`Тема ${t.id}, группа «${s[0]}»: нет слова «${w}»`); });
    else if (s[2] !== 'self' && !DB.byId[s[2]]) problems.push(`Тема ${t.id}: нет темы группы ${s[2]}`);
  });
  if (!t.cat || t.cat.length < 3) problems.push(`Тема ${t.id}: нет cat`);
});
Object.values(DB.words).forEach(e => {
  if (e.img && e.img.startsWith('x:') && !ART.has(e.img.slice(2))) problems.push(`Слово «${e.w}»: нет рисунка ${e.img}`);
  if (e.of && !DB.words[e.of]) problems.push(`Слово «${e.w}»: нет слова-родителя ${e.of}`);
  if (e.baby && !DB.words[e.baby]) problems.push(`Слово «${e.w}»: нет детёныша ${e.baby}`);
  if (!e.img) problems.push(`Слово «${e.w}»: нет картинки`);
});

const outC = path.join(WWW, 'img', 'c'), outB = path.join(WWW, 'img', 'b');
const ok = {};
if (CHECK) {
  const OM_CODES = vm.runInContext(fs.readFileSync(path.join(WWW, 'data', 'omcodes.js'), 'utf8') + ';OM_CODES', ctx);
  [...codes].sort().forEach(c => {
    if (!fs.existsSync(path.join(outC, c + '.svg')) || !fs.existsSync(path.join(outB, c + '.svg'))) problems.push('Нет файла картинки ' + c + '.svg в img/c или img/b');
    else if (!OM_CODES[c]) problems.push('Код ' + c + ' не записан в data/omcodes.js');
    else ok[c] = 1;
  });
  if (!fs.existsSync(path.join(WWW, 'data', 'omindex.js'))) problems.push('Нет data/omindex.js (запустите tools/prepare_assets.js)');
  console.log(`Проверка: тем ${DB.themes.length}, слов ${Object.keys(DB.words).length}, картинок OpenMoji ${Object.keys(ok).length}, своих рисунков ${ART.ids().length}`);
  if (problems.length) { console.log('Проблемы (' + problems.length + '):\n  ' + problems.join('\n  ')); process.exitCode = 1; }
  return;
}
[outC, outB].forEach(d => { fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); });
const min = s => s.replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').replace(/\n/g, '').replace(/ id="[^"]*"/g, '').trim();
[...codes].sort().forEach(c => {
  const src = path.join(OM, 'color', 'svg', c + '.svg'), srcB = path.join(OM, 'black', 'svg', c + '.svg');
  if (!fs.existsSync(src) || !fs.existsSync(srcB)) { problems.push('Нет OpenMoji ' + c); return; }
  fs.writeFileSync(path.join(outC, c + '.svg'), min(fs.readFileSync(src, 'utf8')));
  fs.writeFileSync(path.join(outB, c + '.svg'), min(fs.readFileSync(srcB, 'utf8')));
  ok[c] = 1;
});
fs.writeFileSync(path.join(WWW, 'data', 'omcodes.js'), "'use strict';\n/* Сгенерировано tools/prepare_assets.js — коды OpenMoji в img/c и img/b */\nvar OM_CODES = " + JSON.stringify(ok) + ';\n');
fs.copyFileSync(path.join(OM, 'LICENSE.txt'), path.join(WWW, 'img', 'OPENMOJI_LICENSE.txt'));

// Указатель всех OpenMoji (английские названия и теги) — для подбора картинок к новым словам:
// встроенные коды берутся из img/, остальные скачиваются из интернета (CDN пакета openmoji).
const GROUPS = ['animals-nature', 'food-drink', 'travel-places', 'activities', 'objects', 'extras-openmoji', 'extras-unicode', 'people-body'];
const PEOPLE = /person-role|family|person-activity|body-parts|person-fantasy|person-resting|person-sport/;
const meta = JSON.parse(fs.readFileSync(path.join(OM, 'data', 'openmoji.json'), 'utf8'));
const idx = [];
meta.forEach(m => {
  if (GROUPS.indexOf(m.group) < 0 || m.skintone) return;
  if (m.group === 'people-body' && !PEOPLE.test(m.subgroups || '')) return;
  if (!fs.existsSync(path.join(OM, 'color', 'svg', m.hexcode + '.svg'))) return;
  const tags = [];
  String((m.openmoji_tags || '') + ',' + (m.tags || '')).split(',').map(t => t.trim().toLowerCase()).forEach(t => { if (t && tags.indexOf(t) < 0 && tags.length < 8) tags.push(t); });
  idx.push([m.hexcode, String(m.annotation || '').toLowerCase().replace(/[|\n]/g, ' '), tags.join(',').replace(/[|\n]/g, ' ')].join('|'));
});
fs.writeFileSync(path.join(WWW, 'data', 'omindex.js'), "'use strict';\n/* Сгенерировано tools/prepare_assets.js — указатель OpenMoji: код|название|теги */\nvar OM_INDEX = " + JSON.stringify(idx.join('\n')) + ';\n');
console.log('Указатель OpenMoji: ' + idx.length + ' записей');

console.log(`Тем: ${DB.themes.length}, слов: ${Object.keys(DB.words).length}, картинок OpenMoji: ${Object.keys(ok).length}, своих рисунков: ${ART.ids().length}`);
if (problems.length) {
  console.log('Проблемы (' + problems.length + '):\n  ' + problems.join('\n  '));
  process.exitCode = 1;
}
