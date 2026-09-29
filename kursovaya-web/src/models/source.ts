import { newId } from '../core/text';

export type SourceType = 'article' | 'book' | 'normative' | 'web' | 'other';

export const SOURCE_TYPES: SourceType[] = ['article', 'book', 'normative', 'web', 'other'];

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  article: 'Статья',
  book: 'Книга',
  normative: 'Нормативный акт',
  web: 'Сайт',
  other: 'Другое',
};

/** Откуда взят источник. */
export const SourceOrigin = {
  openAlex: 'OpenAlex',
  crossref: 'Crossref',
  cyberLeninka: 'КиберЛенинка',
  googleBooks: 'Google Книги',
  web: 'Интернет',
  ai: 'ИИ',
  manual: 'Вручную',
} as const;

/** Библиографический источник (для списка литературы по ГОСТ 7.1-2003). */
export interface Source {
  id: string;
  type: SourceType;
  /** Авторы в виде «Фамилия И. О.». */
  authors: string[];
  title: string;
  subtitle?: string;
  /** Журнал / сборник (для статей), сайт — для веб-ресурсов. */
  container?: string;
  city?: string;
  publisher?: string;
  year?: number;
  volume?: string;
  issue?: string;
  /** Страницы статьи: «45–52». */
  pages?: string;
  /** Объём книги в страницах. */
  pageCount?: number;
  url?: string;
  doi?: string;
  isbn?: string;
  /** Аннотация / фрагмент текста — контекст для ИИ и проверки заимствований. */
  annotation?: string;
  origin: string;
  /** true — найден в реальной базе (OpenAlex, КиберЛенинка…) или подтверждён поиском. */
  verified: boolean;
  selected: boolean;
  /** Готовое описание по ГОСТ, введённое вручную (заменяет автоматическое). */
  manual?: string;
  docKind?: string;
  docDate?: string;
  docNumber?: string;
  /** Дата обращения (ISO). */
  accessed?: string;
  note?: string;
  score: number;
  siteName?: string;
}

export function makeSource(p: Partial<Source> & Pick<Source, 'type' | 'title'>): Source {
  return {
    id: p.id ?? newId('s'),
    authors: [],
    origin: SourceOrigin.manual,
    verified: false,
    selected: true,
    score: 0,
    ...p,
  };
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v : undefined);
const int = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : undefined);

export function normalizeSource(j: Record<string, unknown>): Source {
  const type = SOURCE_TYPES.includes(j.type as SourceType) ? (j.type as SourceType) : 'other';
  return {
    id: str(j.id) ?? newId('s'),
    type,
    authors: Array.isArray(j.authors) ? j.authors.map(String).filter(Boolean) : [],
    title: typeof j.title === 'string' ? j.title : '',
    subtitle: str(j.subtitle),
    container: str(j.container),
    city: str(j.city),
    publisher: str(j.publisher),
    year: int(j.year),
    volume: str(j.volume),
    issue: str(j.issue),
    pages: str(j.pages),
    pageCount: int(j.pageCount),
    url: str(j.url),
    doi: str(j.doi),
    isbn: str(j.isbn),
    annotation: str(j.annotation),
    origin: str(j.origin) ?? SourceOrigin.manual,
    verified: j.verified === true,
    selected: j.selected !== false,
    manual: str(j.manual),
    docKind: str(j.docKind),
    docDate: str(j.docDate),
    docNumber: str(j.docNumber),
    accessed: str(j.accessed),
    note: str(j.note),
    score: typeof j.score === 'number' && Number.isFinite(j.score) ? j.score : 0,
    siteName: str(j.siteName),
  };
}

export function isElectronic(s: Source): boolean {
  return !!s.url && (s.type === 'web' || s.origin === SourceOrigin.cyberLeninka || s.type === 'normative');
}

/** Ключ для поиска дублей. */
export function dedupKey(s: Source): string {
  if (s.doi) return `doi:${s.doi.toLowerCase()}`;
  const t = s.title.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]/g, '');
  return `t:${t.slice(0, 60)}`;
}

export function copySource(s: Source): Source {
  return { ...s, authors: [...s.authors] };
}
