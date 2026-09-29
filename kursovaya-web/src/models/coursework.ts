import { academicYear, Reg } from '../core/regulation';
import { clamp, newId, wordCount } from '../core/text';
import { normalizeSource, type Source } from './source';

/** Данные титульного листа (ПРИЛОЖЕНИЕ 4 регламента). */
export interface Meta {
  topic: string;
  studentName: string;
  group: string;
  course: number;
  specialty: string;
  discipline: string;
  supervisor: string;
  academicYear: string;
  /** База практики / организация для практической части (необязательно). */
  organization: string;
  /** Пожелания к содержанию. */
  wishes: string;
  /** Фактические данные для анализа в практической главе. */
  practiceData: string;
}

export type SignaturePlace = 'afterBibliography' | 'endOfWork';

/** Тонкие настройки генерации. */
export interface GenOptions {
  /** Доля теории в основной части, %. */
  theoryPercent: number;
  chapters: number;
  /** Желаемый объём без приложений, страниц (15–30). */
  targetPages: number;
  tables: boolean;
  maxTables: number;
  appendices: boolean;
  appendixCount: number;
  internetSources: boolean;
  webFacts: boolean;
  normativeActs: boolean;
  sourcesCount: number;
  /** Предпочтительная «свежесть» литературы, лет. */
  recentYears: number;
  excludeTextbooks: boolean;
  creativity: number;
  signature: SignaturePlace;
}

export type ChapterRole = 'theory' | 'practice';

export interface PlanChapter {
  title: string;
  role: ChapterRole;
  points: string[];
  tables: string[];
}

export interface PlanAppendix {
  title: string;
  content: string;
  /** В какой главе сослаться на приложение. */
  chapter: number;
}

/** План работы (составляется ИИ, можно править вручную). */
export interface Plan {
  object: string;
  subject: string;
  goal: string;
  tasks: string[];
  methods: string[];
  keywords: string[];
  searchQueries: string[];
  chapters: PlanChapter[];
  appendices: PlanAppendix[];
}

export type SectionKind = 'introduction' | 'chapter' | 'conclusion';
export type PartStatus = 'pending' | 'running' | 'done' | 'error';

/**
 * Структурная часть: введение, глава, заключение. Текст — в простой разметке: абзацы через пустую
 * строку, перечисления — строки с «– », таблицы — строка «Таблица N — Название» и строки «| … | … |».
 */
export interface Section {
  id: string;
  kind: SectionKind;
  number: number;
  title: string;
  role: ChapterRole;
  text: string;
  targetWords: number;
  status: PartStatus;
  error?: string;
  /** Сгенерированные части (для продолжения после обрыва). */
  parts: string[];
}

export interface Appendix {
  id: string;
  number: number;
  title: string;
  text: string;
  status: PartStatus;
  error?: string;
  /** Что должно быть в приложении (из плана). */
  brief: string;
  chapter: number;
}

/** Факт из интернета для практической части. */
export interface WebFact {
  text: string;
  url: string;
  sourceTitle: string;
}

/** Результат вёрстки — для оглавления и проверки объёма. */
export interface LayoutInfo {
  totalPages: number;
  /** Страниц без приложений (включая титульный лист). */
  mainPages: number;
  startPage: Record<string, number>;
  /** Объём раздела в страницах (с дробной частью). */
  volume: Record<string, number>;
  at: string;
}

export interface PlagiarismMatch {
  text: string;
  url: string;
  title: string;
  section: string;
}

/** Результат проверки уникальности текста через интернет-поиск или Text.ru. */
export interface PlagiarismResult {
  method: 'web' | 'textru';
  /** Уникальность, % (0–100). */
  unique: number;
  checked: number;
  matches: PlagiarismMatch[];
  at: string;
  note?: string;
}

export interface Coursework {
  id: string;
  created: string;
  updated: string;
  meta: Meta;
  options: GenOptions;
  plan?: Plan;
  sources: Source[];
  sections: Section[];
  appendices: Appendix[];
  facts: WebFact[];
  wikiContext: string;
  /** Состояние шагов генерации: id шага → done | error | skipped. */
  steps: Record<string, string>;
  layout?: LayoutInfo;
  aiReview?: string;
  plagiarism?: PlagiarismResult;
  generatedBy: string;
  version: 1;
}

export function defaultMeta(): Meta {
  return {
    topic: '',
    studentName: '',
    group: '',
    course: 2,
    specialty: '',
    discipline: '',
    supervisor: '',
    academicYear: academicYear(),
    organization: '',
    wishes: '',
    practiceData: '',
  };
}

export function defaultOptions(): GenOptions {
  return {
    theoryPercent: 45,
    chapters: 2,
    targetPages: 25,
    tables: true,
    maxTables: 3,
    appendices: true,
    appendixCount: 2,
    internetSources: true,
    webFacts: true,
    normativeActs: true,
    sourcesCount: 20,
    recentYears: 7,
    excludeTextbooks: true,
    creativity: 0.5,
    signature: 'afterBibliography',
  };
}

export function emptyPlan(): Plan {
  return { object: '', subject: '', goal: '', tasks: [], methods: [], keywords: [], searchQueries: [], chapters: [], appendices: [] };
}

export function newCoursework(): Coursework {
  const now = new Date().toISOString();
  return {
    id: newId('cw'),
    created: now,
    updated: now,
    meta: defaultMeta(),
    options: defaultOptions(),
    sources: [],
    sections: [],
    appendices: [],
    facts: [],
    wikiContext: '',
    steps: {},
    generatedBy: '',
    version: 1,
  };
}

export function newSection(kind: SectionKind, number: number): Section {
  return { id: newId('sec'), kind, number, title: '', role: 'theory', text: '', targetWords: 0, status: 'pending', parts: [] };
}

// ---------------- Производные значения ----------------

export function missingForTitle(m: Meta): string[] {
  const out: string[] = [];
  if (!m.topic.trim()) out.push('тема');
  if (!m.studentName.trim()) out.push('ФИО студента');
  if (!m.group.trim()) out.push('группа');
  if (!m.specialty.trim()) out.push('специальность');
  if (!m.discipline.trim()) out.push('дисциплина');
  if (!m.supervisor.trim()) out.push('ФИО руководителя');
  return out;
}

export function sectionHeading(s: Section): string {
  if (s.kind === 'introduction') return Reg.introTitle;
  if (s.kind === 'conclusion') return Reg.conclusionTitle;
  return Reg.chapterHeading(s.number, s.title);
}

export function sectionShortName(s: Section): string {
  if (s.kind === 'introduction') return 'Введение';
  if (s.kind === 'conclusion') return 'Заключение';
  return `Глава ${s.number}`;
}

export function sectionStepId(s: Section): string {
  return s.kind === 'chapter' ? `chapter${s.number}` : s.kind;
}

export const sectionWords = (s: Section | undefined) => (s ? wordCount(s.text) : 0);

export const introductionOf = (cw: Coursework) => cw.sections.find((s) => s.kind === 'introduction');
export const conclusionOf = (cw: Coursework) => cw.sections.find((s) => s.kind === 'conclusion');
export const chaptersOf = (cw: Coursework) => cw.sections.filter((s) => s.kind === 'chapter').sort((a, b) => a.number - b.number);

/** Разделы в порядке следования в работе. */
export function orderedSections(cw: Coursework): Section[] {
  const out: Section[] = [];
  const i = introductionOf(cw);
  if (i) out.push(i);
  out.push(...chaptersOf(cw));
  const c = conclusionOf(cw);
  if (c) out.push(c);
  return out;
}

export const selectedSources = (cw: Coursework) => cw.sources.filter((s) => s.selected);
export const hasText = (cw: Coursework) => cw.sections.some((s) => s.text.trim() !== '');
export const totalWords = (cw: Coursework) => cw.sections.reduce((a, s) => a + wordCount(s.text), 0);
export const cwTitle = (cw: Coursework) => cw.meta.topic.trim() || 'Без темы';

// ---------------- Чтение сохранённых данных ----------------

type J = Record<string, unknown>;
const obj = (v: unknown): J => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as J) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const s = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const n = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const b = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
const strs = (v: unknown): string[] => arr(v).map((x) => String(x));

const PART_STATUS: PartStatus[] = ['pending', 'running', 'done', 'error'];
const status = (v: unknown): PartStatus => (PART_STATUS.includes(v as PartStatus) ? (v as PartStatus) : 'pending');
const role = (v: unknown): ChapterRole => (v === 'practice' ? 'practice' : 'theory');

export function normalizeMeta(j: J): Meta {
  const d = defaultMeta();
  return {
    topic: s(j.topic),
    studentName: s(j.studentName),
    group: s(j.group),
    course: clamp(Math.round(n(j.course, d.course)), 1, 5),
    specialty: s(j.specialty),
    discipline: s(j.discipline),
    supervisor: s(j.supervisor),
    academicYear: s(j.academicYear, d.academicYear) || d.academicYear,
    organization: s(j.organization),
    wishes: s(j.wishes),
    practiceData: s(j.practiceData),
  };
}

export function normalizeOptions(j: J): GenOptions {
  const d = defaultOptions();
  return {
    theoryPercent: clamp(Math.round(n(j.theoryPercent, d.theoryPercent)), 25, 75),
    chapters: clamp(Math.round(n(j.chapters, d.chapters)), Reg.minChapters, Reg.maxChapters),
    targetPages: clamp(Math.round(n(j.targetPages, d.targetPages)), Reg.minPages, Reg.maxPages),
    tables: b(j.tables, d.tables),
    maxTables: clamp(Math.round(n(j.maxTables, d.maxTables)), 1, 8),
    appendices: b(j.appendices, d.appendices),
    appendixCount: clamp(Math.round(n(j.appendixCount, d.appendixCount)), 1, 5),
    internetSources: b(j.internetSources, d.internetSources),
    webFacts: b(j.webFacts, d.webFacts),
    normativeActs: b(j.normativeActs, d.normativeActs),
    sourcesCount: clamp(Math.round(n(j.sourcesCount, d.sourcesCount)), 8, 40),
    recentYears: clamp(Math.round(n(j.recentYears, d.recentYears)), 3, 30),
    excludeTextbooks: b(j.excludeTextbooks, d.excludeTextbooks),
    creativity: clamp(n(j.creativity, d.creativity), 0.1, 1),
    signature: j.signature === 'endOfWork' ? 'endOfWork' : 'afterBibliography',
  };
}

export function normalizePlan(j: J): Plan {
  return {
    object: s(j.object),
    subject: s(j.subject),
    goal: s(j.goal),
    tasks: strs(j.tasks),
    methods: strs(j.methods),
    keywords: strs(j.keywords),
    searchQueries: strs(j.searchQueries),
    chapters: arr(j.chapters).map((x) => {
      const c = obj(x);
      return { title: s(c.title), role: role(c.role), points: strs(c.points), tables: strs(c.tables) };
    }),
    appendices: arr(j.appendices).map((x) => {
      const a = obj(x);
      return { title: s(a.title), content: s(a.content), chapter: Math.round(n(a.chapter, 2)) };
    }),
  };
}

function normalizeSection(j: J): Section {
  const kind: SectionKind = j.kind === 'introduction' || j.kind === 'conclusion' ? j.kind : 'chapter';
  return {
    id: s(j.id) || newId('sec'),
    kind,
    number: Math.round(n(j.number, 0)),
    title: s(j.title),
    role: role(j.role),
    text: s(j.text),
    targetWords: Math.round(n(j.targetWords, 0)),
    status: status(j.status) === 'running' ? 'pending' : status(j.status),
    error: typeof j.error === 'string' ? j.error : undefined,
    parts: strs(j.parts),
  };
}

function normalizeAppendix(j: J): Appendix {
  return {
    id: s(j.id) || newId('app'),
    number: Math.round(n(j.number, 1)),
    title: s(j.title),
    text: s(j.text),
    status: status(j.status) === 'running' ? 'pending' : status(j.status),
    error: typeof j.error === 'string' ? j.error : undefined,
    brief: s(j.brief),
    chapter: Math.round(n(j.chapter, 2)),
  };
}

function normalizeLayout(j: J): LayoutInfo {
  const numMap = (v: unknown): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [k, x] of Object.entries(obj(v))) if (typeof x === 'number' && Number.isFinite(x)) out[k] = x;
    return out;
  };
  return {
    totalPages: Math.round(n(j.totalPages, 0)),
    mainPages: Math.round(n(j.mainPages, 0)),
    startPage: numMap(j.startPage),
    volume: numMap(j.volume),
    at: s(j.at, new Date().toISOString()),
  };
}

function normalizePlagiarism(j: J): PlagiarismResult {
  return {
    method: j.method === 'textru' ? 'textru' : 'web',
    unique: clamp(n(j.unique, 100), 0, 100),
    checked: Math.round(n(j.checked, 0)),
    matches: arr(j.matches).map((x) => {
      const m = obj(x);
      return { text: s(m.text), url: s(m.url), title: s(m.title), section: s(m.section) };
    }),
    at: s(j.at, new Date().toISOString()),
    note: typeof j.note === 'string' ? j.note : undefined,
  };
}

/** Проект из сохранённого JSON (с проверкой типов и значениями по умолчанию). */
export function normalizeCoursework(raw: unknown): Coursework {
  const j = obj(raw);
  const now = new Date().toISOString();
  const steps: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj(j.steps))) if (typeof v === 'string') steps[k] = v;
  return {
    id: s(j.id) || newId('cw'),
    created: s(j.created, now),
    updated: s(j.updated, now),
    meta: normalizeMeta(obj(j.meta)),
    options: normalizeOptions(obj(j.options)),
    plan: j.plan ? normalizePlan(obj(j.plan)) : undefined,
    sources: arr(j.sources).map((x) => normalizeSource(obj(x))),
    sections: arr(j.sections).map((x) => normalizeSection(obj(x))),
    appendices: arr(j.appendices).map((x) => normalizeAppendix(obj(x))),
    facts: arr(j.facts).map((x) => {
      const f = obj(x);
      return { text: s(f.text), url: s(f.url), sourceTitle: s(f.sourceTitle) };
    }),
    wikiContext: s(j.wikiContext),
    steps,
    layout: j.layout ? normalizeLayout(obj(j.layout)) : undefined,
    aiReview: typeof j.aiReview === 'string' ? j.aiReview : undefined,
    plagiarism: j.plagiarism ? normalizePlagiarism(obj(j.plagiarism)) : undefined,
    generatedBy: s(j.generatedBy),
    version: 1,
  };
}

export function cloneCoursework(cw: Coursework): Coursework {
  return normalizeCoursework(JSON.parse(JSON.stringify(cw)));
}

export function copyAsNew(cw: Coursework): Coursework {
  const c = cloneCoursework(cw);
  const now = new Date().toISOString();
  c.id = newId('cw');
  c.created = now;
  c.updated = now;
  return c;
}
