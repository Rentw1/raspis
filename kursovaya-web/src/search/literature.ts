/**
 * Клиенты открытых библиографических баз. Каждый возвращает источники с реальными
 * выходными данными (ключи API не нужны).
 */
import type { CancelToken } from '../core/errors';
import { BROWSER_UA, buildUrl, decodeJson, fetchText, getJson, APP_UA } from '../core/net';
import { hasCyrillic, newId, parsePersonName, stripHtml, truncate } from '../core/text';
import { makeSource, SourceOrigin, type Source } from '../models/source';

type J = Record<string, unknown>;
const obj = (v: unknown): J => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as J) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | undefined => (v === null || v === undefined || v === '' ? undefined : String(v));
const int = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  if (typeof v === 'string' && /^\d{1,5}$/.test(v.trim())) return Number(v.trim());
  return undefined;
};

export interface SearchOpts {
  limit?: number;
  fromYear?: number;
  cancel?: CancelToken;
}

export interface LiteratureApi {
  readonly name: string;
  search(query: string, o?: SearchOpts): Promise<Source[]>;
}

// ---------------- OpenAlex ----------------

export class OpenAlexApi implements LiteratureApi {
  readonly name = SourceOrigin.openAlex;
  constructor(
    private readonly email = '',
    private readonly onlyRussian = true,
  ) {}

  async search(query: string, o: SearchOpts = {}): Promise<Source[]> {
    const filters = ['type:article|book|book-chapter|review'];
    if (this.onlyRussian) filters.push('language:ru');
    if (o.fromYear) filters.push(`from_publication_date:${o.fromYear}-01-01`);
    const url = buildUrl('https://api.openalex.org/works', {
      search: query,
      filter: filters.join(','),
      per_page: o.limit ?? 20,
      select: 'id,doi,display_name,publication_year,authorships,primary_location,biblio,type,language,abstract_inverted_index,cited_by_count',
      mailto: this.email || undefined,
    });
    return OpenAlexApi.parse(await getJson(url, { cancel: o.cancel }));
  }

  static abstractFromIndex(idx: unknown): string {
    const words = new Map<number, string>();
    for (const [w, pos] of Object.entries(obj(idx))) {
      for (const p of arr(pos)) if (typeof p === 'number') words.set(p, w);
    }
    return [...words.keys()]
      .sort((a, b) => a - b)
      .map((k) => words.get(k))
      .join(' ');
  }

  static parse(j: unknown): Source[] {
    const out: Source[] = [];
    for (const r0 of arr(obj(j).results)) {
      const r = obj(r0);
      const title = String(r.display_name ?? r.title ?? '').trim();
      if (title.length < 6) continue;
      const type = String(r.type ?? 'article');
      const loc = obj(r.primary_location);
      const src = obj(loc.source);
      const biblio = obj(r.biblio);
      const fp = str(biblio.first_page);
      const lp = str(biblio.last_page);
      const pages = fp ? (lp && lp !== fp ? `${fp}–${lp}` : fp) : undefined;
      const doiUrl = str(r.doi);
      const doi = doiUrl?.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
      const authors: string[] = [];
      for (const a of arr(r.authorships)) {
        const n = str(obj(obj(a).author).display_name);
        if (n && n.trim()) authors.push(parsePersonName(n).surnameInitials);
      }
      const isBook = type === 'book';
      const cited = typeof r.cited_by_count === 'number' ? r.cited_by_count : 0;
      out.push(
        makeSource({
          id: newId('oa'),
          type: isBook ? 'book' : 'article',
          title,
          authors,
          container: isBook ? undefined : str(src.display_name),
          publisher: str(src.host_organization_name),
          year: int(r.publication_year),
          volume: str(biblio.volume),
          issue: str(biblio.issue),
          pages: isBook ? undefined : pages,
          doi,
          url: doiUrl ?? str(loc.landing_page_url),
          annotation: truncate(OpenAlexApi.abstractFromIndex(r.abstract_inverted_index), 700) || undefined,
          origin: SourceOrigin.openAlex,
          verified: true,
          score: Math.min(50, Math.max(0, cited)) / 50,
        }),
      );
    }
    return out;
  }
}

// ---------------- Crossref ----------------

export class CrossrefApi implements LiteratureApi {
  readonly name = SourceOrigin.crossref;
  constructor(
    private readonly email = '',
    private readonly onlyRussian = true,
  ) {}

  async search(query: string, o: SearchOpts = {}): Promise<Source[]> {
    const filter = ['type:journal-article'];
    if (o.fromYear) filter.push(`from-pub-date:${o.fromYear}`);
    const url = buildUrl('https://api.crossref.org/works', {
      'query.bibliographic': query,
      rows: o.limit ?? 20,
      filter: filter.join(','),
      select: 'DOI,title,author,issued,container-title,page,volume,issue,publisher,type,abstract,URL',
      mailto: this.email || undefined,
    });
    const j = await getJson(url, { cancel: o.cancel, headers: { 'User-Agent': `${APP_UA}${this.email ? ` (mailto:${this.email})` : ''}` } });
    const list = CrossrefApi.parse(j);
    return this.onlyRussian ? list.filter((s) => hasCyrillic(s.title)) : list;
  }

  static parse(j: unknown): Source[] {
    const out: Source[] = [];
    for (const it0 of arr(obj(obj(j).message).items)) {
      const it = obj(it0);
      const titles = arr(it.title);
      if (!titles.length) continue;
      const title = stripHtml(String(titles[0]));
      if (title.length < 6) continue;
      const authors: string[] = [];
      for (const a0 of arr(it.author)) {
        const a = obj(a0);
        const fam = String(a.family ?? '').trim();
        const giv = String(a.given ?? '').trim();
        const name = String(a.name ?? '');
        if (!fam && !name) continue;
        authors.push(parsePersonName(fam ? `${fam}, ${giv}` : name).surnameInitials);
      }
      let year: number | undefined;
      const dp = arr(obj(it.issued)['date-parts']);
      if (dp.length && Array.isArray(dp[0]) && dp[0].length) year = int(dp[0][0]);
      const containers = arr(it['container-title']);
      out.push(
        makeSource({
          id: newId('cr'),
          type: 'article',
          title,
          authors,
          container: containers.length ? stripHtml(String(containers[0])) : undefined,
          publisher: str(it.publisher),
          year,
          volume: str(it.volume),
          issue: str(it.issue),
          pages: str(it.page),
          doi: str(it.DOI),
          url: str(it.URL),
          annotation: truncate(stripHtml(String(it.abstract ?? '')), 700) || undefined,
          origin: SourceOrigin.crossref,
          verified: true,
        }),
      );
    }
    return out;
  }
}

// ---------------- КиберЛенинка ----------------

export class CyberLeninkaApi implements LiteratureApi {
  readonly name = SourceOrigin.cyberLeninka;

  async search(query: string, o: SearchOpts = {}): Promise<Source[]> {
    const r = await fetchText('https://cyberleninka.ru/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': BROWSER_UA,
        Origin: 'https://cyberleninka.ru',
        Referer: `https://cyberleninka.ru/search?q=${encodeURIComponent(query)}`,
      },
      body: JSON.stringify({ mode: 'articles', q: query, size: o.limit ?? 20, from: 0 }),
      cancel: o.cancel,
    });
    const list = CyberLeninkaApi.parse(decodeJson(r));
    return o.fromYear ? list.filter((s) => s.year === undefined || s.year >= (o.fromYear as number)) : list;
  }

  static parse(j: unknown): Source[] {
    const out: Source[] = [];
    for (const a0 of arr(obj(j).articles)) {
      const a = obj(a0);
      const title = stripHtml(String(a.name ?? ''));
      if (title.length < 6) continue;
      const link = String(a.link ?? '');
      const authors = arr(a.authors)
        .map((e) => parsePersonName(String(e)).surnameInitials)
        .filter(Boolean);
      out.push(
        makeSource({
          id: newId('cl'),
          type: 'article',
          title,
          authors,
          container: a.journal == null ? undefined : stripHtml(String(a.journal)),
          year: int(a.year),
          url: link ? (link.startsWith('http') ? link : `https://cyberleninka.ru${link}`) : undefined,
          annotation: truncate(stripHtml(String(a.annotation ?? '')), 700) || undefined,
          origin: SourceOrigin.cyberLeninka,
          verified: true,
          accessed: new Date().toISOString(),
        }),
      );
    }
    return out;
  }
}

// ---------------- Google Книги ----------------

export class GoogleBooksApi implements LiteratureApi {
  readonly name = SourceOrigin.googleBooks;
  constructor(private readonly onlyRussian = true) {}

  async search(query: string, o: SearchOpts = {}): Promise<Source[]> {
    const url = buildUrl('https://www.googleapis.com/books/v1/volumes', {
      q: query,
      langRestrict: this.onlyRussian ? 'ru' : undefined,
      printType: 'books',
      maxResults: Math.min(40, Math.max(1, o.limit ?? 20)),
      orderBy: 'relevance',
    });
    const list = GoogleBooksApi.parse(await getJson(url, { cancel: o.cancel }));
    return o.fromYear ? list.filter((s) => s.year === undefined || s.year >= (o.fromYear as number) - 5) : list;
  }

  static parse(j: unknown): Source[] {
    const out: Source[] = [];
    for (const it0 of arr(obj(j).items)) {
      const vi = obj(obj(it0).volumeInfo);
      const title = String(vi.title ?? '').trim();
      if (title.length < 4) continue;
      const y = /\d{4}/.exec(String(vi.publishedDate ?? ''));
      let isbn: string | undefined;
      for (const id0 of arr(vi.industryIdentifiers)) {
        const id = obj(id0);
        if (id.type === 'ISBN_13') isbn = str(id.identifier);
      }
      const pc = int(vi.pageCount);
      out.push(
        makeSource({
          id: newId('gb'),
          type: 'book',
          title,
          subtitle: str(vi.subtitle),
          authors: arr(vi.authors).map((e) => parsePersonName(String(e)).surnameInitials),
          publisher: str(vi.publisher),
          year: y ? Number(y[0]) : undefined,
          pageCount: pc && pc > 0 ? pc : undefined,
          isbn,
          url: str(vi.canonicalVolumeLink ?? vi.infoLink),
          annotation: truncate(stripHtml(String(vi.description ?? '')), 700) || undefined,
          origin: SourceOrigin.googleBooks,
          verified: true,
        }),
      );
    }
    return out;
  }
}

// ---------------- Википедия (только справочный контекст) ----------------

export const WikipediaApi = {
  async context(query: string, o: { pages?: number; chars?: number; cancel?: CancelToken } = {}): Promise<string> {
    const s = await getJson(
      buildUrl('https://ru.wikipedia.org/w/api.php', {
        action: 'query',
        list: 'search',
        srsearch: query,
        srlimit: o.pages ?? 2,
        format: 'json',
        utf8: 1,
        origin: '*',
      }),
      { cancel: o.cancel },
    );
    const titles = arr(obj(obj(s).query).search).map((e) => String(obj(e).title ?? '')).filter(Boolean);
    if (!titles.length) return '';
    const e = await getJson(
      buildUrl('https://ru.wikipedia.org/w/api.php', {
        action: 'query',
        prop: 'extracts',
        explaintext: 1,
        exchars: o.chars ?? 2500,
        titles: titles.join('|'),
        format: 'json',
        utf8: 1,
        origin: '*',
      }),
      { cancel: o.cancel },
    );
    return WikipediaApi.parseExtracts(e);
  },

  parseExtracts(j: unknown): string {
    const out: string[] = [];
    for (const p0 of Object.values(obj(obj(obj(j).query).pages))) {
      const p = obj(p0);
      const ex = String(p.extract ?? '').trim();
      if (ex) out.push(`${String(p.title ?? '')}: ${ex.replace(/\n{2,}/g, '\n')}`);
    }
    return out.join('\n').trim();
  },
};

/**
 * Признаки изданий, запрещённых регламентом в списке литературы
 * (учебники по дисциплине, энциклопедии, словари, газеты).
 */
export const FORBIDDEN_SOURCE_RE = new RegExp(
  'учебник|учебное пособие|учеб\\.\\s*пособ|учебно-методическ|пособие для (студентов|учащихся|спо|вузов)|для студентов|для бакалавр|для спо|' +
    'среднего профессионального образования|хрестомат|энциклопед|словар|справочник|газет|википеди|конспект лекций|курс лекций|практикум',
  'i',
);

export function isForbiddenSource(s: Source): boolean {
  const ann = s.annotation ?? '';
  const text = `${s.title} ${s.subtitle ?? ''} ${s.container ?? ''} ${ann.length > 300 ? ann.slice(0, 300) : ann}`;
  return FORBIDDEN_SOURCE_RE.test(text);
}
