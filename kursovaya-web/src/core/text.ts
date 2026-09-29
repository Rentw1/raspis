/** Текстовые утилиты: слова, типографика, ФИО, сравнение текстов, даты, имена файлов. */

/** Неразрывный пробел. */
export const NBSP = ' ';

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(b);
  else for (let i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256);
  return b;
}

/** Короткий уникальный идентификатор. */
export function newId(prefix = ''): string {
  const t = Date.now().toString(36);
  const r = Array.from(randomBytes(6), (x) => (x % 36).toString(36)).join('');
  return `${prefix}${t}${r}`;
}

/** UUID v4 (заголовок RqUID у GigaChat). */
export function uuid4(): string {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const WORD_RE = /[A-Za-zА-Яа-яЁё0-9]+(?:[-’][A-Za-zА-Яа-яЁё0-9]+)*/g;

export function wordCount(s: string): number {
  return (s.match(WORD_RE) ?? []).length;
}

export function words(s: string): string[] {
  return s.match(WORD_RE) ?? [];
}

/** Схлопывает пробелы и табуляции; неразрывные пробелы сохраняются (они важны для вёрстки). */
export function collapseSpaces(s: string): string {
  return s.replace(/[ \t]+/g, ' ').trim();
}

export function hasCyrillic(s: string): boolean {
  return /[А-Яа-яЁё]/.test(s);
}

export function cyrillicRatio(s: string): number {
  const letters = (s.match(/[A-Za-zА-Яа-яЁё]/g) ?? []).length;
  if (letters === 0) return 0;
  return (s.match(/[А-Яа-яЁё]/g) ?? []).length / letters;
}

const ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", laquo: '«', raquo: '»', mdash: '—', ndash: '–', hellip: '…',
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d: string) => {
      const c = Number(d);
      return Number.isFinite(c) && c > 0 && c < 0x110000 ? String.fromCodePoint(c) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => {
      const c = parseInt(h, 16);
      return Number.isFinite(c) && c > 0 && c < 0x110000 ? String.fromCodePoint(c) : '';
    })
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m);
}

export function stripHtml(s: string): string {
  let t = s.replace(/<br\s*\/?>/gi, ' ');
  t = t.replace(/<[^>]+>/g, '');
  return collapseSpaces(decodeEntities(t));
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/\s+$/, '')}…`;
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Удаляет управляющие символы, недопустимые в XML 1.0. */
export function xmlSafe(s: string): string {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
}

/** Русская типографика для текста от ИИ: «ёлочки», тире, неразрывные пробелы в ссылках. */
export function typography(s: string): string {
  let t = s.replace(/\r/g, '').replace(/[“”„‟]/g, '"');
  let out = '';
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === '"') {
      const prev = i === 0 ? ' ' : t[i - 1];
      out += i === 0 || /[\s(\[«—–-]/.test(prev) ? '«' : '»';
    } else {
      out += ch;
    }
  }
  t = out;
  t = t.replace(/(\S) +-{1,2} +(?=\S)/g, '$1 – ');
  t = t.replace(/(\s)—(?=\s)/g, '$1–');
  t = t.replace(/\.{3}/g, '…');
  // «с. 45», «№ 5» — неразрывный пробел, чтобы номер не отрывался.
  t = t.replace(/(^|[^А-Яа-яЁёA-Za-z])([сС]\.) ?(\d)/g, `$1$2${NBSP}$3`);
  t = t.replace(/(№) ?(\d)/g, `$1${NBSP}$2`);
  t = t.replace(/ {2,}/g, ' ');
  return t;
}

// ---------------- ФИО ----------------

export class PersonName {
  constructor(
    readonly surname: string,
    readonly first: string,
    readonly patronymic: string,
  ) {}

  get initials(): string {
    const parts: string[] = [];
    if (this.first) parts.push(`${this.first[0].toUpperCase()}.`);
    if (this.patronymic) parts.push(`${this.patronymic[0].toUpperCase()}.`);
    return parts.join(NBSP);
  }

  /** «Иванов И. И.» */
  get surnameInitials(): string {
    return this.initials ? `${this.surname}${NBSP}${this.initials}` : this.surname;
  }

  /** «И. И. Иванов» */
  get initialsSurname(): string {
    return this.initials ? `${this.initials}${NBSP}${this.surname}` : this.surname;
  }

  /** «Иванов, И. И.» — заголовок библиографической записи. */
  get heading(): string {
    return this.initials ? `${this.surname},${NBSP}${this.initials}` : this.surname;
  }
}

const FEMALE_SUFFIXES = ['вна', 'чна', 'кызы', 'гызы', 'шна'];
const MALE_SUFFIXES = ['вич', 'ич', 'оглы', 'улы', 'ьич'];

function isPatronymic(w: string): boolean {
  const l = w.toLowerCase();
  return FEMALE_SUFFIXES.some((e) => l.endsWith(e)) || MALE_SUFFIXES.some((e) => l.endsWith(e));
}

/** Женский род по отчеству или фамилии (для «выполнил / выполнила» на титульном листе). */
export function isFemaleName(fio: string): boolean {
  const parts = fio.trim().split(/\s+/).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const l = parts[i].toLowerCase().replace(/\./g, '');
    if (FEMALE_SUFFIXES.some((e) => l.endsWith(e))) return true;
    if (MALE_SUFFIXES.some((e) => l.endsWith(e))) return false;
  }
  if (parts.length > 0 && /(ова|ева|ёва|ина|ына|ская|цкая|ая)$/.test(parts[0].toLowerCase())) return true;
  return false;
}

const COMMON_FIRST_NAMES = new Set(
  (
    'александр алексей анатолий андрей антон артем артём борис вадим валентин валерий василий виктор виталий владимир ' +
    'владислав вячеслав геннадий георгий григорий даниил денис дмитрий евгений егор иван игорь илья кирилл константин ' +
    'леонид максим марат михаил никита николай олег павел петр пётр роман руслан сергей станислав степан тимур федор фёдор ' +
    'юрий ярослав айдар рустем рустам ильдар ринат ренат рамиль алина алла анастасия анна валентина валерия вера виктория ' +
    'галина дарья диана екатерина елена елизавета жанна зарина ирина карина кристина ксения лариса лилия любовь людмила ' +
    'маргарита марина мария надежда наталья наталия нина ольга полина светлана софия софья татьяна юлия яна гульнара эльвира ' +
    'альбина айгуль лейсан резеда гузель регина алсу динара john james robert michael david maria anna peter paul thomas'
  ).split(' '),
);

function looksLikeInitial(w: string): boolean {
  return /^[A-ZА-ЯЁ]\.?$/.test(w.split(NBSP).join(''));
}

function capName(s: string): string {
  if (!s) return s;
  if (s === s.toUpperCase() && s.length > 2) {
    return s
      .split('-')
      .map((x) => (x ? x[0] + x.slice(1).toLowerCase() : x))
      .join('-');
  }
  return s[0].toUpperCase() + s.slice(1);
}

/**
 * Разбирает ФИО в разных записях: «Иванов Иван Иванович», «Иван Иванович Иванов», «Иванов И. И.»,
 * «И. И. Иванов», «Иванов, И. И.», «Smith, John», «John Smith».
 */
export function parsePersonName(raw: string): PersonName {
  let s = raw.split(NBSP).join(' ').replace(/\s+/g, ' ').trim();
  if (!s) return new PersonName('', '', '');
  if (s.includes(',')) {
    const i = s.indexOf(',');
    const sur = s.slice(0, i).trim();
    const rest = s.slice(i + 1).trim().replace(/\./g, '. ').replace(/\s+/g, ' ').trim();
    const r = rest.split(' ').filter(Boolean);
    return new PersonName(capName(sur), r[0] ?? '', r[1] ?? '');
  }
  s = s.replace(/([A-ZА-ЯЁ])\.(?=[A-ZА-ЯЁ])/g, '$1. ');
  const p = s.split(' ').filter(Boolean);
  if (p.length === 1) return new PersonName(capName(p[0]), '', '');
  if (looksLikeInitial(p[0])) {
    let k = 0;
    while (k < p.length && looksLikeInitial(p[k])) k++;
    const initials = p.slice(0, k);
    const sur = p.slice(k).join(' ');
    return new PersonName(capName(sur), initials[0] ?? '', initials[1] ?? '');
  }
  if (p.length >= 2 && looksLikeInitial(p[1])) {
    return new PersonName(capName(p[0]), p[1], p.length > 2 && looksLikeInitial(p[2]) ? p[2] : '');
  }
  if (p.length >= 3) {
    if (isPatronymic(p[2])) return new PersonName(capName(p[0]), p[1], p[2]);
    if (isPatronymic(p[1])) return new PersonName(capName(p[2]), p[0], p[1]);
    if (!hasCyrillic(s)) return new PersonName(capName(p[p.length - 1]), p[0], p[1]);
    return new PersonName(capName(p[0]), p[1], p[2]);
  }
  const a = p[0].toLowerCase();
  const b = p[1].toLowerCase();
  if (COMMON_FIRST_NAMES.has(a) && !COMMON_FIRST_NAMES.has(b)) return new PersonName(capName(p[1]), p[0], '');
  if (COMMON_FIRST_NAMES.has(b)) return new PersonName(capName(p[0]), p[1], '');
  if (!hasCyrillic(s)) return new PersonName(capName(p[1]), p[0], '');
  if (/(ов|ев|ёв|ин|ын|ский|цкий|ова|ева|ина|ская|цкая|ых|их|ко|юк|ук|ян|дзе|швили)$/.test(a)) {
    return new PersonName(capName(p[0]), p[1], '');
  }
  return new PersonName(capName(p[1]), p[0], '');
}

// ---------------- Похожесть текстов ----------------

const normWord = (w: string) => w.toLowerCase().replace(/ё/g, 'е');

const STEM_ENDS = [
  'иями', 'ями', 'ами', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ых', 'их', 'ой', 'ей', 'ий', 'ый', 'ая', 'яя', 'ое', 'ее',
  'ую', 'юю', 'ия', 'ие', 'ии', 'ию', 'ью', 'ов', 'ев', 'ам', 'ям', 'ах', 'ях', 'ом', 'ем', 'а', 'я', 'о', 'е', 'ы', 'и', 'у',
  'ю', 'ь', 'й',
];

/** Простейший стеммер: отбрасывает типичные окончания (для сравнения ключевых слов). */
export function stemRu(w: string): string {
  const s = normWord(w);
  if (s.length <= 4) return s;
  for (const e of STEM_ENDS) {
    if (s.length - e.length >= 4 && s.endsWith(e)) return s.slice(0, s.length - e.length);
  }
  return s;
}

const STOP = new Set(
  (
    'и в во на с со по к ко о об от до из за для при не что как это а но или у же ли бы его ее их также так то все был была ' +
    'были быть является являются который которые которая которых этом этой'
  ).split(' '),
);

export function keywordStems(s: string): Set<string> {
  const out = new Set<string>();
  for (const w of words(s)) {
    const n = normWord(w);
    if (n.length > 2 && !STOP.has(n)) out.add(stemRu(n));
  }
  return out;
}

/** Шинглы из n слов для поиска дословных совпадений. */
export function shingles(s: string, n = 5): Set<string> {
  const w = words(s)
    .map(normWord)
    .filter((x) => !STOP.has(x));
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
  return out;
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let n = 0;
  for (const x of small) if (big.has(x)) n++;
  return n;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const inter = intersectionSize(a, b);
  return inter / (a.size + b.size - inter);
}

/** Доля шинглов a, встречающихся в b. */
export function containment(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  return intersectionSize(a, b) / a.size;
}

export function setIntersection<T>(a: Set<T>, b: Set<T>): Set<T> {
  const out = new Set<T>();
  for (const x of a) if (b.has(x)) out.add(x);
  return out;
}

// ---------------- Даты, числа, имена файлов ----------------

export const two = (v: number) => String(v).padStart(2, '0');

export function dateRu(d: Date): string {
  return `${two(d.getDate())}.${two(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function timeRu(d: Date): string {
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
}

/** Безопасное имя файла (кириллица сохраняется). */
export function safeFileName(s: string, max = 80): string {
  let t = s.replace(/[\\/:*?"<>|\u0000-\u001F«»]/g, '').replace(/\s+/g, '_');
  t = t.replace(/_+/g, '_').replace(/^[_.]+|[_.]+$/g, '');
  if (t.length > max) t = t.slice(0, max);
  return t || 'kursovaya';
}

/** Склонение: plural(5, 'источник', 'источника', 'источников'). */
export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const NUM_WORDS_GEN: Record<number, string> = { 1: 'одной', 2: 'двух', 3: 'трех', 4: 'четырех', 5: 'пяти', 6: 'шести' };

export function chaptersGenitive(n: number): string {
  return `${NUM_WORDS_GEN[n] ?? n} ${plural(n, 'главы', 'глав', 'глав')}`;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// ---------------- JSON от ИИ ----------------

export class AiFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiFormatError';
  }
}

/** Удаляет из ответа модели «размышления» (<think>…</think>). */
export function stripThinking(s: string): string {
  let t = s.replace(/<think>[\s\S]*?<\/think>/gi, '');
  const open = t.toLowerCase().indexOf('<think>');
  if (open >= 0) t = t.slice(0, open);
  return t.trim();
}

function fixQuotes(s: string): string {
  return s.replace(/[“”„]/g, '"').split(' ').join(' ');
}

/** Переводы строк внутри строковых литералов → \n (частая ошибка моделей). */
function escapeNewlinesInStrings(s: string): string {
  let out = '';
  let inStr = false;
  let esc = false;
  for (const ch of s) {
    if (inStr) {
      if (esc) {
        esc = false;
        out += ch;
      } else if (ch === '\\') {
        esc = true;
        out += ch;
      } else if (ch === '"') {
        inStr = false;
        out += ch;
      } else if (ch === '\n') out += '\\n';
      else if (ch === '\r') continue;
      else if (ch === '\t') out += '\\t';
      else out += ch;
    } else {
      if (ch === '"') inStr = true;
      out += ch;
    }
  }
  return out;
}

/**
 * Достаёт JSON-объект или массив из ответа модели: с ограждениями ```json, пояснениями до/после,
 * хвостовыми запятыми, «умными» кавычками, переводами строк внутри строк.
 */
export function parseJsonLoose(text: string, expectArray = false): unknown {
  let t = stripThinking(text).replace(/^﻿/, '').trim();
  const fence = /```(?:json|JSON)?\s*([\s\S]*?)```/.exec(t);
  if (fence) t = fence[1].trim();
  const [open, close] = expectArray ? ['[', ']'] : ['{', '}'];
  let a = t.indexOf(open);
  let b = t.lastIndexOf(close);
  if (a < 0 || b <= a) {
    const [o2, c2] = expectArray ? ['{', '}'] : ['[', ']'];
    a = t.indexOf(o2);
    b = t.lastIndexOf(c2);
    if (a < 0 || b <= a) throw new AiFormatError('ИИ ответил не в формате JSON. Повторите попытку или выберите другую модель.');
  }
  t = t.slice(a, b + 1);
  const noComma = t.replace(/,\s*([}\]])/g, '$1');
  const candidates = [t, noComma, fixQuotes(noComma), escapeNewlinesInStrings(fixQuotes(noComma))];
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      // следующая попытка
    }
  }
  throw new AiFormatError('ИИ прислал повреждённый JSON. Повторите попытку или выберите другую модель.');
}

type Json = unknown;

const isObj = (v: Json): v is Record<string, Json> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function jObj(v: Json): Record<string, Json> {
  return isObj(v) ? v : {};
}

export function jStr(v: Json, max = 2000): string {
  if (v === null || v === undefined) return '';
  const s = (typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v)).replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max) : s;
}

export function jStrList(v: Json, max = 30, maxLen = 600): string[] {
  if (v === null || v === undefined) return [];
  const list = Array.isArray(v) ? v : [v];
  const out: string[] = [];
  for (const e of list) {
    const val = isObj(e) ? (e.text ?? e.title ?? e.name ?? Object.values(e)[0]) : e;
    const s = jStr(val, maxLen);
    if (s) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

export function jInt(v: Json): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  if (typeof v === 'string') {
    const m = /-?\d+/.exec(v);
    return m ? Number(m[0]) : null;
  }
  return null;
}

export function jList(v: Json): Json[] {
  return Array.isArray(v) ? v : [];
}
