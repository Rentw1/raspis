/** Веб-поиск (DuckDuckGo без ключа, Tavily, Brave, SearXNG) и извлечение текста страниц. */
import { NetError, type CancelToken } from '../core/errors';
import { BROWSER_UA, buildUrl, decodeJson, fetchText, getJson, hostName } from '../core/net';
import { collapseSpaces, decodeEntities, hostOf, stripHtml } from '../core/text';
import { webEngineNeedsKey, type WebEngine } from '../models/settings';

export interface WebResult {
  title: string;
  url: string;
  snippet: string;
}

export const resultHost = (r: WebResult) => hostOf(r.url);

type J = Record<string, unknown>;
const obj = (v: unknown): J => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as J) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Разбор HTML-выдачи DuckDuckGo (html.duckduckgo.com/html). */
export function parseDuckDuckGo(body: string): WebResult[] {
  const out: WebResult[] = [];
  const blocks = body.split(/<div[^>]+class="[^"]*\bresult\b/).slice(1);
  for (const blk of blocks) {
    const head = blk.slice(0, 200);
    if (/result--ad/.test(head)) continue;
    const a = /<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(blk) ??
      /<a[^>]+href="([^"]+)"[^>]*class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/.exec(blk);
    if (!a) continue;
    let href = decodeEntities(a[1]);
    if (href.includes('uddg=')) {
      try {
        const u = new URL(href.startsWith('//') ? `https:${href}` : href, 'https://duckduckgo.com');
        href = u.searchParams.get('uddg') ?? href;
      } catch {
        continue;
      }
    }
    if (!href.startsWith('http') || href.includes('duckduckgo.com/y.js')) continue;
    const sn = /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div|td)>/.exec(blk);
    out.push({ title: collapseSpaces(stripHtml(a[2])), url: href, snippet: sn ? collapseSpaces(stripHtml(sn[1])) : '' });
  }
  return out;
}

export class WebSearch {
  constructor(
    readonly engine: WebEngine,
    private readonly key = '',
    private readonly searxngBase = '',
  ) {}

  get enabled(): boolean {
    return (
      this.engine !== 'none' &&
      (!webEngineNeedsKey(this.engine) || this.key !== '') &&
      (this.engine !== 'searxng' || this.searxngBase.startsWith('http'))
    );
  }

  async search(query: string, limit = 8, cancel?: CancelToken): Promise<WebResult[]> {
    switch (this.engine) {
      case 'none':
        return [];
      case 'duckduckgo':
        return this.ddg(query, limit, cancel);
      case 'tavily':
        return this.tavily(query, limit, cancel);
      case 'brave':
        return this.brave(query, limit, cancel);
      case 'searxng':
        return this.searx(query, limit, cancel);
    }
  }

  private async ddg(query: string, limit: number, cancel?: CancelToken): Promise<WebResult[]> {
    const r = await fetchText('https://html.duckduckgo.com/html/', {
      method: 'POST',
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html',
        'Accept-Language': 'ru-RU,ru;q=0.9',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ q: query, kl: 'ru-ru' }).toString(),
      cancel,
    });
    if (r.status !== 200) {
      throw new NetError(`DuckDuckGo: ошибка ${r.status}${r.status === 202 ? ' (временное ограничение)' : ''}`, { status: r.status });
    }
    if (r.text.includes('anomaly-modal') || r.text.includes('challenge-form')) {
      throw new NetError('DuckDuckGo временно ограничил запросы. Подождите или подключите Tavily в настройках.');
    }
    return parseDuckDuckGo(r.text).slice(0, limit);
  }

  private async tavily(query: string, limit: number, cancel?: CancelToken): Promise<WebResult[]> {
    const r = await fetchText('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.key}` },
      body: JSON.stringify({ query, max_results: limit, search_depth: 'basic', include_answer: false, include_raw_content: false }),
      timeoutMs: 40000,
      cancel,
    });
    return arr(obj(decodeJson(r)).results)
      .map((e) => obj(e))
      .map((e) => ({ title: String(e.title ?? ''), url: String(e.url ?? ''), snippet: String(e.content ?? '') }))
      .filter((e) => e.url.startsWith('http'));
  }

  private async brave(query: string, limit: number, cancel?: CancelToken): Promise<WebResult[]> {
    const j = await getJson(buildUrl('https://api.search.brave.com/res/v1/web/search', { q: query, count: limit, search_lang: 'ru', country: 'RU' }), {
      headers: { 'X-Subscription-Token': this.key, Accept: 'application/json' },
      cancel,
    });
    return arr(obj(obj(j).web).results)
      .map((e) => obj(e))
      .map((e) => ({ title: stripHtml(String(e.title ?? '')), url: String(e.url ?? ''), snippet: stripHtml(String(e.description ?? '')) }))
      .filter((e) => e.url.startsWith('http'));
  }

  private async searx(query: string, limit: number, cancel?: CancelToken): Promise<WebResult[]> {
    const base = this.searxngBase.trim().replace(/\/+$/, '');
    const j = await getJson(`${base}/search?q=${encodeURIComponent(query)}&format=json&language=ru`, { cancel });
    return arr(obj(j).results)
      .slice(0, limit)
      .map((e) => obj(e))
      .map((e) => ({ title: String(e.title ?? ''), url: String(e.url ?? ''), snippet: String(e.content ?? '') }))
      .filter((e) => e.url.startsWith('http'));
  }
}

const DROP_BLOCKS = /<(script|style|noscript|svg|nav|header|footer|aside|form|iframe|button|template)\b[\s\S]*?<\/\1\s*>/gi;
const TEXT_BLOCKS = /<(p|li|h1|h2|h3|td|blockquote)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;

/** Основной текст страницы: абзацы, пункты списков, заголовки, ячейки таблиц. */
export function extractPage(html: string, maxChars = 5000): { title: string; text: string } {
  const title = collapseSpaces(stripHtml(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? ''));
  let doc = html.replace(/<!--[\s\S]*?-->/g, '').replace(DROP_BLOCKS, ' ');
  const pick = (tag: string) => new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`, 'i').exec(doc)?.[1];
  doc = pick('article') ?? pick('main') ?? pick('body') ?? doc;
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const m of doc.matchAll(TEXT_BLOCKS)) {
    const t = collapseSpaces(stripHtml(m[2]));
    if (t.length >= 25 && !seen.has(t)) {
      seen.add(t);
      parts.push(t);
    }
  }
  let text = parts.join('\n');
  if (text.length < 200) text = collapseSpaces(stripHtml(doc));
  return { title, text: text.length > maxChars ? text.slice(0, maxChars) : text };
}

export async function readPage(url: string, maxChars = 5000, cancel?: CancelToken): Promise<{ title: string; text: string }> {
  const r = await fetchText(url, {
    headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'ru-RU,ru;q=0.9' },
    cancel,
  });
  if (r.status !== 200) throw new NetError(`${hostName(url)}: ошибка ${r.status}`, { status: r.status });
  const ct = (r.headers.get('content-type') ?? '').toLowerCase();
  if (ct && !ct.includes('html') && !ct.includes('text')) throw new NetError(`${hostName(url)}: не текстовая страница`);
  return extractPage(r.text, maxChars);
}

/** Официальные сайты, на которые допустимо ссылаться в списке литературы. */
export function isReputableHost(host: string): boolean {
  const h = host.toLowerCase();
  const ends = [
    '.gov.ru', 'rosstat.gov.ru', 'cbr.ru', 'consultant.ru', 'garant.ru', 'pravo.gov.ru', 'kremlin.ru', 'government.ru', 'tatarstan.ru',
    'tatstat.gks.ru', 'gks.ru', 'nalog.ru', 'sfr.gov.ru', 'cyberleninka.ru', 'elibrary.ru', '.edu.ru', 'minfin.ru', 'economy.gov.ru', 'mintrud.gov.ru',
  ];
  return h === 'gov.ru' || ends.some((e) => h.endsWith(e));
}
