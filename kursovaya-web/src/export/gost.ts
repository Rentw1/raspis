/** Библиографическое описание по ГОСТ 7.1-2003 и сортировка списка литературы по алфавиту. */
import { capitalize, dateRu, NBSP, parsePersonName, PersonName, stripHtml } from '../core/text';
import { isElectronic, SourceOrigin, type Source } from '../models/source';

export const SEP = '. – ';

/** Издательство → город (если база не указала место издания). */
const PUBLISHER_CITY: [string, string][] = [
  ['юрайт', 'Москва'], ['инфра-м', 'Москва'], ['инфра м', 'Москва'], ['кнорус', 'Москва'], ['проспект', 'Москва'],
  ['дашков', 'Москва'], ['статут', 'Москва'], ['норма', 'Москва'], ['академия', 'Москва'], ['юнити', 'Москва'],
  ['юстиция', 'Москва'], ['магистр', 'Москва'], ['эксмо', 'Москва'], ['аст', 'Москва'], ['альпина', 'Москва'],
  ['дмк пресс', 'Москва'], ['вузовский учебник', 'Москва'], ['финансы и статистика', 'Москва'], ['экономика', 'Москва'],
  ['высшая школа', 'Москва'], ['наука', 'Москва'], ['высшей школы экономики', 'Москва'], ['вшэ', 'Москва'],
  ['издательство московского университета', 'Москва'], ['мгу', 'Москва'], ['русайнс', 'Москва'], ['лаборатория знаний', 'Москва'],
  ['солон', 'Москва'], ['форум', 'Москва'], ['омега-л', 'Москва'], ['альфа-м', 'Москва'], ['флинта', 'Москва'],
  ['перспектива', 'Москва'], ['логос', 'Москва'], ['велби', 'Москва'], ['питер', 'Санкт-Петербург'], ['лань', 'Санкт-Петербург'],
  ['бхв', 'Санкт-Петербург'], ['юридический центр', 'Санкт-Петербург'], ['спбгу', 'Санкт-Петербург'],
  ['санкт-петербургского', 'Санкт-Петербург'], ['феникс', 'Ростов-на-Дону'], ['ай пи ар медиа', 'Саратов'],
  ['ай пи эр медиа', 'Саратов'], ['инфра-инженерия', 'Вологда'], ['казанского', 'Казань'], ['казанский', 'Казань'],
  ['кфу', 'Казань'], ['татарское книжное', 'Казань'], ['уральского', 'Екатеринбург'], ['новосибирского', 'Новосибирск'],
  ['томского', 'Томск'],
];

export function cityForPublisher(publisher?: string): string | undefined {
  if (!publisher) return undefined;
  const p = publisher.toLowerCase().replace(/ё/g, 'е');
  return PUBLISHER_CITY.find(([k]) => p.includes(k))?.[1];
}

function clean(s?: string): string {
  let t = (s ?? '').replace(/[ \t\r\n]+/g, ' ').trim();
  while (t.length > 0 && '.,;:'.includes(t[t.length - 1])) t = t.slice(0, -1).replace(/\s+$/, '');
  return t;
}

/** Заголовки в ВЕРХНЕМ РЕГИСТРЕ из баз → обычный регистр. */
export function cleanTitle(s: string): string {
  let t = clean(stripHtml(s));
  const letters = t.replace(/[^A-Za-zА-Яа-яЁё]/g, '');
  if (letters.length > 8 && letters === letters.toUpperCase()) t = t.toLowerCase();
  return capitalize(t);
}

const names = (s: Source): PersonName[] => s.authors.map(parsePersonName).filter((n) => n.surname !== '');

function resp(n: PersonName[], etAl: boolean): string {
  const shown = etAl ? n.slice(0, 3) : n;
  const r = shown.map((e) => e.initialsSurname).join(', ');
  return etAl && n.length > 3 ? `${r} [и${NBSP}др.]` : r;
}

function electronic(s: Source, accessed?: Date): string {
  const url = (s.url ?? '').trim();
  if (!url) return '';
  const d = s.accessed ? new Date(s.accessed) : (accessed ?? new Date());
  return `${SEP}Режим доступа: ${url} (дата обращения: ${dateRu(Number.isNaN(d.getTime()) ? new Date() : d)})`;
}

function volumeIssue(s: Source): string {
  const parts: string[] = [];
  if ((s.volume ?? '').trim()) parts.push(`Т.${NBSP}${clean(s.volume)}`);
  if ((s.issue ?? '').trim()) parts.push(`№${NBSP}${clean(s.issue).replace(/^№\s*/, '')}`);
  return parts.join(', ');
}

const pagesRange = (p: string) => clean(p).replace(/\s*[-—−]\s*/g, '–');

function finish(t: string): string {
  let r = t.replace(/[ \t\r\n]+/g, ' ').replace(/ ,/g, ',').trim();
  r = r.replace(/\.\.+$/, '.');
  if (!r.endsWith('.') && !r.endsWith(')')) r = `${r}.`;
  if (r.endsWith(')')) r = `${r}.`;
  return r;
}

function book(s: Source, accessed?: Date): string {
  const n = names(s);
  const title = cleanTitle(s.title);
  const sub = clean(s.subtitle);
  const many = n.length > 3;
  let b = '';
  if (n.length && !many) b += `${n[0].heading} `;
  b += title;
  if (sub) b += ` : ${sub}`;
  if (isElectronic(s) && s.type === 'other') b += ' [Электронный ресурс]';
  if (n.length) b += ` / ${resp(n, many)}`;
  const city = clean(s.city) || cityForPublisher(s.publisher) || '';
  const pub = clean(s.publisher);
  const year = s.year ? String(s.year) : '';
  const imprint = !city && !pub ? `[Б.${NBSP}м. : б.${NBSP}и.]` : `${city || `[Б.${NBSP}м.]`} : ${pub || `[б.${NBSP}и.]`}`;
  b += `${SEP}${imprint}${year ? `, ${year}` : ''}`;
  if (s.pageCount && s.pageCount > 0) b += `${SEP}${s.pageCount}${NBSP}с`;
  if (s.type === 'other' && s.url) b += electronic(s, accessed);
  return finish(b);
}

function article(s: Source, accessed?: Date): string {
  const n = names(s);
  const title = cleanTitle(s.title);
  const many = n.length > 3;
  const el = !!s.url && (s.origin === SourceOrigin.cyberLeninka || !(s.pages ?? '').trim());
  let b = '';
  if (n.length && !many) b += `${n[0].heading} `;
  b += title;
  if (el) b += ' [Электронный ресурс]';
  if (n.length) b += ` / ${resp(n, many)}`;
  const journal = clean(s.container);
  if (journal) b += ` // ${journal}`;
  if (s.year) b += `${SEP}${s.year}`;
  const vi = volumeIssue(s);
  if (vi) b += `${SEP}${vi}`;
  if ((s.pages ?? '').trim()) b += `${SEP}С.${NBSP}${pagesRange(s.pages as string)}`;
  if (el) b += electronic(s, accessed);
  return finish(b);
}

function web(s: Source, accessed?: Date): string {
  const title = cleanTitle(s.title);
  const site = clean(s.siteName ?? s.container);
  let b = `${title} [Электронный ресурс]`;
  if (site && site.toLowerCase() !== title.toLowerCase()) b += ` // ${site}`;
  if (s.year) b += `${SEP}${s.year}`;
  b += electronic(s, accessed);
  return finish(b);
}

const KIND_MAP: Record<string, string> = {
  'федеральный закон': 'федер. закон',
  фз: 'федер. закон',
  'федеральный конституционный закон': 'федер. конституц. закон',
  'закон рт': 'закон Респ. Татарстан',
  'закон республики татарстан': 'закон Респ. Татарстан',
  'указ президента рф': 'указ Президента Рос. Федерации',
  'указ президента российской федерации': 'указ Президента Рос. Федерации',
  'постановление правительства рф': 'постановление Правительства Рос. Федерации',
  'постановление правительства российской федерации': 'постановление Правительства Рос. Федерации',
  'приказ минфина россии': 'приказ М-ва финансов Рос. Федерации',
  'приказ министерства финансов российской федерации': 'приказ М-ва финансов Рос. Федерации',
};

export function normalizeKind(kind?: string): string {
  const k = clean(kind).toLowerCase();
  if (!k) return '';
  return KIND_MAP[k] ?? k.replace(/рф/g, 'Рос. Федерации');
}

function normative(s: Source, accessed?: Date): string {
  const title = cleanTitle(s.title);
  const kind = normalizeKind(s.docKind);
  let b = title;
  const req: string[] = [];
  if (kind) req.push(kind);
  if ((s.docDate ?? '').trim()) req.push(`от ${clean(s.docDate)}`);
  if ((s.docNumber ?? '').trim()) req.push(`№${NBSP}${clean(s.docNumber).replace(/^№\s*/, '')}`);
  if (req.length) b += ` : ${req.join(' ')}`;
  if (s.url) b += ` [Электронный ресурс]${electronic(s, accessed)}`;
  return finish(b);
}

/** Полное библиографическое описание. */
export function formatSource(s: Source, accessed?: Date): string {
  if ((s.manual ?? '').trim()) return finish((s.manual as string).trim());
  switch (s.type) {
    case 'normative':
      return normative(s, accessed);
    case 'web':
      return web(s, accessed);
    case 'article':
      return article(s, accessed);
    default:
      return book(s, accessed);
  }
}

/** Краткая подпись для промптов и списков в интерфейсе. */
export function shortLabel(s: Source): string {
  const n = names(s);
  const a = n.length ? `${n.slice(0, 2).map((e) => e.surnameInitials).join(', ')}${n.length > 2 ? ' и др.' : ''} ` : '';
  switch (s.type) {
    case 'article':
      return `${a}${cleanTitle(s.title)}${s.container ? ` // ${clean(s.container)}` : ''}${s.year ? `, ${s.year}` : ''}`;
    case 'normative': {
      const req = [normalizeKind(s.docKind), s.docDate ? `от ${s.docDate}` : '', s.docNumber ? `№ ${s.docNumber}` : ''].filter(Boolean).join(' ');
      return `${cleanTitle(s.title)} (${req})`;
    }
    case 'web':
      return `${cleanTitle(s.title)} (сайт${s.siteName ? ` ${s.siteName}` : ''})`;
    default:
      return `${a}${cleanTitle(s.title)}${s.subtitle ? ` : ${clean(s.subtitle)}` : ''}${s.publisher ? `. – ${clean(s.publisher)}` : ''}${s.year ? `, ${s.year}` : ''}`;
  }
}

export function sortKey(s: Source): string {
  const f = formatSource(s).toLowerCase().replace(/ё/g, 'е').replace(/^[^a-zа-я0-9]+/, '');
  const cyr = f.length > 0 && /[а-я]/.test(f[0]);
  return `${cyr ? '0' : '1'}${f}`;
}

/** Список литературы: по алфавиту (сначала русские описания, затем на латинице). */
export function orderedSources(sources: Source[]): Source[] {
  return sources
    .filter((s) => s.selected)
    .map((s) => ({ s, k: sortKey(s) }))
    .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
    .map((x) => x.s);
}
