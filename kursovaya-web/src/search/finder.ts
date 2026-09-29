/** Поиск литературы, фактов и нормативных актов в интернете. */
import type { AiClient } from '../ai/client';
import { factsRequest, JSON_SYSTEM, literatureFallbackRequest, normativeRequest, selectSourcesRequest } from '../ai/prompts';
import { errorMessage, isCancelled, type CancelToken } from '../core/errors';
import { collapseSpaces, hostOf, jInt, jList, jObj, jStr, jStrList, keywordStems, newId, parsePersonName, setIntersection, truncate } from '../core/text';
import type { Coursework, WebFact } from '../models/coursework';
import { WEB_ENGINE_LABEL, webEngineNeedsKey, type SearchSettings } from '../models/settings';
import { dedupKey, makeSource, SourceOrigin, type Source } from '../models/source';
import { CrossrefApi, CyberLeninkaApi, GoogleBooksApi, isForbiddenSource, OpenAlexApi, WikipediaApi, type LiteratureApi } from './literature';
import { isReputableHost, readPage, resultHost, WebSearch, type WebResult } from './web';

export type Progress = (message: string) => void;

export interface SourceTestResult {
  name: string;
  ok: boolean;
  message: string;
}

const TOPIC_NOISE = /(^|\s)(на примере|на материалах|по материалам|в условиях|в современных условиях)(?=\s|$)[\s\S]*$/i;
const LEAD_NOISE =
  /^(анализ|совершенствование|особенности|роль|проблемы|организация|разработка|оценка|исследование|сравнительный анализ|современные|основные|теоретические и практические аспекты|теоретические основы|актуальные вопросы|пути повышения|повышение)\s+/i;

/** Ядро темы: без «на примере…», названий организаций в кавычках и вводных слов. */
export function topicCore(topic: string): string {
  let t = topic.replace(/«[^»]*»|"[^"]*"/g, ' ').replace(TOPIC_NOISE, '');
  t = collapseSpaces(t.replace(/[()[\].,:;!?]/g, ' '));
  for (let i = 0; i < 3; i++) {
    const n = t.replace(LEAD_NOISE, '');
    if (n === t) break;
    t = n;
  }
  return collapseSpaces(t.replace(/\s+(и|в|на|с|по|для|о|об)$/i, ''));
}

export function buildQueries(cw: Coursework, max = 6): string[] {
  const core = topicCore(cw.meta.topic.trim());
  const q: string[] = [];
  const add = (s: string) => {
    const v = collapseSpaces(s);
    if (v.length >= 4 && !q.some((e) => e.toLowerCase() === v.toLowerCase())) q.push(v);
  };
  add(core);
  for (const s of cw.plan?.searchQueries ?? []) add(s);
  const w = core.split(' ');
  if (w.length > 4) add(w.slice(0, 4).join(' '));
  for (const k of (cw.plan?.keywords ?? []).slice(0, 3)) add(k);
  const disc = cw.meta.discipline.replace(/^(МДК|ОП|ПМ)\s*[\d.]*\s*/i, '').trim();
  if (disc && q.length < max) add(`${disc} ${w.slice(0, 2).join(' ')}`);
  return q.slice(0, max);
}

function merge(found: Map<string, Source>, s: Source): void {
  const k = dedupKey(s);
  const old = found.get(k);
  if (!old) {
    found.set(k, s);
    return;
  }
  if (!old.authors.length) old.authors = s.authors;
  old.container ??= s.container;
  old.publisher ??= s.publisher;
  old.year ??= s.year;
  old.pages ??= s.pages;
  old.pageCount ??= s.pageCount;
  old.volume ??= s.volume;
  old.issue ??= s.issue;
  old.url ??= s.url;
  if ((old.annotation ?? '').length < (s.annotation ?? '').length) old.annotation = s.annotation;
}

/** Фильтр по регламенту + оценка релевантности. */
export function filterCandidates(cw: Coursework, all: Source[]): Source[] {
  const topicStems = keywordStems(`${cw.meta.topic} ${(cw.plan?.keywords ?? []).join(' ')}`);
  const disciplineStems = keywordStems(cw.meta.discipline);
  const now = new Date().getFullYear();
  const out: Source[] = [];
  for (const s of all) {
    if (cw.options.excludeTextbooks && isForbiddenSource(s)) continue;
    if (s.title.length < 8) continue;
    if (!s.authors.length && !s.publisher && !s.container) continue;
    const titleStems = keywordStems(`${s.title} ${s.subtitle ?? ''}`);
    const annStems = keywordStems(s.annotation ?? '');
    const hitTitle = setIntersection(titleStems, topicStems).size;
    const hitAnn = setIntersection(annStems, topicStems).size;
    const hitDisc = setIntersection(titleStems, disciplineStems).size;
    if (hitTitle === 0 && hitAnn < 2) continue;
    let score = hitTitle * 2 + hitAnn * 0.5 + hitDisc * 0.5;
    if (s.year) {
      const age = now - s.year;
      score += age <= cw.options.recentYears ? 2 : age <= cw.options.recentYears + 5 ? 0.5 : -1;
    } else {
      score -= 1.5;
    }
    if (s.type === 'book') score += 0.8;
    if ((s.annotation ?? '').length > 100) score += 0.5;
    if (s.pages || (s.pageCount ?? 0) > 0) score += 0.4;
    if (s.authors.length) score += 0.4;
    score += s.score;
    s.score = score;
    out.push(s);
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 80);
}

export class SourceFinder {
  constructor(
    readonly settings: SearchSettings,
    private readonly webKey: string,
    private readonly ai: AiClient | null,
    private readonly cancel?: CancelToken,
  ) {}

  get web(): WebSearch {
    return new WebSearch(this.settings.engine, this.webKey, this.settings.searxngBase);
  }

  private apis(): LiteratureApi[] {
    const s = this.settings;
    const out: LiteratureApi[] = [];
    if (s.cyberLeninka) out.push(new CyberLeninkaApi());
    if (s.openAlex) out.push(new OpenAlexApi(s.contactEmail, s.onlyRussian));
    if (s.googleBooks) out.push(new GoogleBooksApi(s.onlyRussian));
    if (s.crossref) out.push(new CrossrefApi(s.contactEmail, s.onlyRussian));
    return out;
  }

  private async guard<T>(f: () => Promise<T>, fallback: T, progress: Progress | undefined, what: string): Promise<T> {
    try {
      return await f();
    } catch (e) {
      if (this.cancel?.isCancelled || isCancelled(e)) throw e;
      progress?.(`${what}: ${errorMessage(e)}`);
      return fallback;
    }
  }

  // ---------------- Литература ----------------

  async findLiterature(cw: Coursework, progress?: Progress): Promise<Source[]> {
    const queries = buildQueries(cw);
    const fromYear = new Date().getFullYear() - cw.options.recentYears - 3;
    const found = new Map<string, Source>();
    for (const api of this.apis()) {
      for (let i = 0; i < queries.length && i < 4; i++) {
        this.cancel?.throwIfCancelled();
        progress?.(`${api.name}: «${queries[i]}»`);
        const list = await this.guard(() => api.search(queries[i], { limit: 20, fromYear, cancel: this.cancel }), [] as Source[], progress, api.name);
        for (const s of list) merge(found, s);
        if (!list.length && i === 0) break; // база недоступна или пусто — не тратим время
      }
    }
    const all = [...found.values()];
    const filtered = filterCandidates(cw, all);
    progress?.(`Найдено публикаций: ${all.length}, подходящих: ${filtered.length}`);
    return filtered;
  }

  /** ИИ отбирает самые подходящие публикации; без ИИ — по оценке релевантности. */
  async selectBest(cw: Coursework, candidates: Source[], need: number, progress?: Progress): Promise<Source[]> {
    if (candidates.length <= need) return candidates;
    if (this.ai?.isReady()) {
      try {
        progress?.('ИИ отбирает источники по теме…');
        const j = await this.ai.chatJson(JSON_SYSTEM, selectSourcesRequest(cw, candidates.slice(0, 60), need), {
          temperature: 0.1,
          maxTokens: 1500,
          cancel: this.cancel,
          onStatus: progress,
        });
        const ids = jStrList(Array.isArray(j) ? j : jObj(j).selected, need * 2);
        const byId = new Map(candidates.map((s) => [s.id, s]));
        const picked: Source[] = [];
        for (const id of ids) {
          const s = byId.get(id.trim());
          if (s && !picked.includes(s)) picked.push(s);
        }
        if (picked.length >= Math.round(need * 0.6)) {
          for (const s of candidates) {
            if (picked.length >= need) break;
            if (!picked.includes(s)) picked.push(s);
          }
          return picked.slice(0, need);
        }
      } catch (e) {
        if (isCancelled(e)) throw e;
        progress?.(`Отбор ИИ не удался (${errorMessage(e)}) — беру по релевантности.`);
      }
    }
    const books = candidates.filter((s) => s.type === 'book');
    const arts = candidates.filter((s) => s.type !== 'book');
    const wantBooks = Math.min(books.length, Math.max(0, Math.round(need * 0.35)));
    return [...books.slice(0, wantBooks), ...arts.slice(0, need - wantBooks)].slice(0, need);
  }

  /** Источники, предложенные ИИ, когда интернет-поиск недоступен (помечаются как непроверенные). */
  async aiLiterature(cw: Coursework, need: number, progress?: Progress): Promise<Source[]> {
    if (!this.ai) return [];
    progress?.('Интернет-базы недоступны — ИИ предлагает литературу (нужно проверить)…');
    const j = await this.ai.chatJson(JSON_SYSTEM, literatureFallbackRequest(cw, need), {
      temperature: 0.2,
      maxTokens: 3500,
      cancel: this.cancel,
      onStatus: progress,
    });
    const items = Array.isArray(j) ? j : jList(jObj(j).items);
    const out: Source[] = [];
    for (const it0 of items) {
      const it = jObj(it0);
      const title = jStr(it.title, 300);
      if (title.length < 6) continue;
      const isBook = jStr(it.type).toLowerCase().startsWith('book');
      const s = makeSource({
        id: newId('ai'),
        type: isBook ? 'book' : 'article',
        title,
        authors: jStrList(it.authors, 6, 60).map((a) => parsePersonName(a).surnameInitials),
        container: isBook ? undefined : jStr(it.journal, 200) || undefined,
        city: isBook ? jStr(it.city, 60) || undefined : undefined,
        publisher: isBook ? jStr(it.publisher, 120) || undefined : undefined,
        year: jInt(it.year) ?? undefined,
        issue: jStr(it.issue, 20) || undefined,
        pages: isBook ? undefined : jStr(it.pages, 20) || undefined,
        pageCount: isBook ? (jInt(it.page_count) ?? undefined) : undefined,
        origin: SourceOrigin.ai,
        verified: false,
        note: 'Предложен ИИ — проверьте, что издание существует',
      });
      if (cw.options.excludeTextbooks && isForbiddenSource(s)) continue;
      out.push(s);
    }
    return out;
  }

  // ---------------- Нормативные акты ----------------

  async normativeActs(cw: Coursework, progress?: Progress): Promise<Source[]> {
    if (!this.ai) return [];
    progress?.('Подбираю нормативные акты…');
    const j = await this.ai.chatJson(JSON_SYSTEM, normativeRequest(cw), { temperature: 0.1, maxTokens: 1500, cancel: this.cancel, onStatus: progress });
    const acts = Array.isArray(j) ? j : jList(jObj(j).acts);
    const out: Source[] = [];
    for (const a0 of acts) {
      const a = jObj(a0);
      const title = jStr(a.title, 300);
      if (title.length < 4) continue;
      out.push(
        makeSource({
          id: newId('na'),
          type: 'normative',
          title,
          docKind: jStr(a.kind, 80) || undefined,
          docDate: jStr(a.date, 20) || undefined,
          docNumber: jStr(a.number, 40) || undefined,
          origin: SourceOrigin.ai,
          verified: false,
          note: 'Реквизиты предложены ИИ',
        }),
      );
    }
    const web = this.web;
    if (!web.enabled || !out.length) return out;
    for (const s of out) {
      this.cancel?.throwIfCancelled();
      const number = (s.docNumber ?? '').toLowerCase().replace(/\s/g, '');
      const q = `${s.docKind ?? ''} от ${s.docDate ?? ''} № ${s.docNumber ?? ''} ${s.title}`.trim();
      progress?.(`Проверяю: ${truncate(q, 80)}`);
      const res = await this.guard(() => web.search(q, 6, this.cancel), [] as WebResult[], progress, 'Проверка акта');
      for (const r of res) {
        const hay = `${r.title} ${r.snippet} ${r.url}`.toLowerCase().replace(/\s/g, '');
        if (number && hay.includes(number)) {
          s.verified = true;
          s.note = undefined;
          if (isReputableHost(resultHost(r))) {
            s.url = r.url;
            s.accessed = new Date().toISOString();
            break;
          }
        }
      }
      if (!s.verified) s.note = 'Не подтверждён поиском — проверьте реквизиты';
    }
    return out;
  }

  // ---------------- Факты для практической части ----------------

  async collectFacts(cw: Coursework, progress?: Progress): Promise<{ facts: WebFact[]; sources: Source[] }> {
    const facts: WebFact[] = [];
    const sources: Source[] = [];
    const core = topicCore(cw.meta.topic);
    const year = new Date().getFullYear();
    const queries = [`${core} статистика ${year}`, `${core} показатели Росстат`];
    for (const c of (cw.plan?.chapters ?? []).filter((c) => c.role !== 'theory').slice(0, 2)) queries.push(`${c.title} данные`);
    if (cw.meta.organization.trim()) queries.push(`${cw.meta.organization.trim()} ${core}`);

    // Gemini с поиском Google — самый надёжный вариант, если подключён.
    const ai = this.ai;
    if (ai && ai.settings.useGeminiSearch && ai.settings.provider === 'gemini' && ai.isReady('gemini')) {
      try {
        progress?.('Gemini ищет факты в Google…');
        const g = await ai.geminiSearch(
          `Найди в интернете актуальные (за последние 3 года) статистические данные, показатели и факты по теме «${cw.meta.topic}» ` +
            `для практической главы курсовой работы (Россия${cw.meta.organization ? `, организация: ${cw.meta.organization}` : ''}). ` +
            'Ответь списком из 10–15 пунктов, каждый — факт с числами и названием источника.',
          this.cancel,
        );
        for (const line of g.text.split('\n')) {
          const t = line.replace(/^\s*([-–*•]|\d+[.)])\s*/, '').replace(/\*\*/g, '').trim();
          if (t.length > 30 && /\d/.test(t)) facts.push({ text: t, url: '', sourceTitle: '' });
        }
        for (const l of g.links.slice(0, 8)) {
          sources.push(
            makeSource({
              id: newId('w'),
              type: 'web',
              title: l.title || l.url,
              siteName: l.title,
              url: l.url,
              origin: SourceOrigin.web,
              verified: true,
              selected: false,
              accessed: new Date().toISOString(),
            }),
          );
        }
      } catch (e) {
        if (isCancelled(e)) throw e;
        progress?.(`Поиск Gemini не удался: ${errorMessage(e)}`);
      }
    }
    const web = this.web;
    if (!web.enabled) return { facts, sources };
    const results = new Map<string, WebResult>();
    for (const q of queries.slice(0, 4)) {
      this.cancel?.throwIfCancelled();
      progress?.(`Поиск в интернете: «${q}»`);
      const res = await this.guard(() => web.search(q, 6, this.cancel), [] as WebResult[], progress, 'Веб-поиск');
      for (const r of res) if (!results.has(r.url)) results.set(r.url, r);
    }
    if (!results.size) return { facts, sources };
    const ranked = [...results.values()].sort((a, b) => Number(isReputableHost(resultHost(b))) - Number(isReputableHost(resultHost(a))));
    const materials: string[] = [];
    let read = 0;
    for (const r of ranked.slice(0, 8)) {
      this.cancel?.throwIfCancelled();
      let text = r.snippet;
      let title = r.title;
      const host = resultHost(r);
      if (this.settings.readPages && read < 4) {
        progress?.(`Читаю страницу: ${host}`);
        const page = await this.guard(() => readPage(r.url, 3500, this.cancel), { title: '', text: '' }, progress, host);
        if (page.text.length > text.length) {
          text = page.text;
          read++;
        }
        if (page.title) title = page.title;
      }
      if (!text.trim()) continue;
      materials.push(`[${r.url}] ${truncate(title, 150)}\n${truncate(text, 3500)}\n`);
      sources.push(
        makeSource({
          id: newId('w'),
          type: 'web',
          title: truncate(title || host, 200),
          siteName: host,
          url: r.url,
          annotation: truncate(text, 600),
          origin: SourceOrigin.web,
          verified: true,
          selected: isReputableHost(host),
          accessed: new Date().toISOString(),
        }),
      );
    }
    if (!materials.length || !ai) return { facts, sources };
    progress?.('ИИ выписывает факты из найденных страниц…');
    try {
      const j = await ai.chatJson(JSON_SYSTEM, factsRequest(cw, truncate(materials.join('\n'), 16000)), {
        temperature: 0.1,
        maxTokens: 2500,
        cancel: this.cancel,
        onStatus: progress,
      });
      const list = Array.isArray(j) ? j : jList(jObj(j).facts);
      for (const f0 of list) {
        const f = jObj(f0);
        const t = jStr(f.text, 500);
        if (t.length < 15) continue;
        facts.push({ text: t, url: jStr(f.url, 400), sourceTitle: jStr(f.source, 200) });
      }
    } catch (e) {
      if (isCancelled(e)) throw e;
      progress?.(`Не удалось выписать факты: ${errorMessage(e)}`);
      for (const s of sources.slice(0, 5)) {
        if (s.annotation) facts.push({ text: truncate(s.annotation, 400), url: s.url ?? '', sourceTitle: s.siteName ?? '' });
      }
    }
    // Сайты, из которых реально взяты факты, отмечаем для списка литературы (если официальные).
    const used = new Set(facts.map((f) => f.url).filter(Boolean));
    for (const s of sources) if (s.url && used.has(s.url) && isReputableHost(hostOf(s.url))) s.selected = true;
    return { facts, sources };
  }

  // ---------------- Справочный контекст ----------------

  async referenceContext(cw: Coursework, progress?: Progress): Promise<string> {
    if (!this.settings.wikipedia) return '';
    progress?.('Википедия: справочные сведения (в список литературы не входит)…');
    return this.guard(() => WikipediaApi.context(topicCore(cw.meta.topic), { cancel: this.cancel }), '', progress, 'Википедия');
  }

  // ---------------- Проверка подключения к источникам ----------------

  async testAll(): Promise<SourceTestResult[]> {
    const s = this.settings;
    const out: SourceTestResult[] = [];
    const t = async (name: string, f: () => Promise<number>) => {
      try {
        const n = await f();
        out.push({ name, ok: n > 0, message: n > 0 ? `работает (найдено: ${n})` : 'ответ пустой' });
      } catch (e) {
        out.push({ name, ok: false, message: errorMessage(e) });
      }
    };
    const q = 'управление персоналом';
    const checks: Promise<void>[] = [];
    if (s.cyberLeninka) checks.push(t(SourceOrigin.cyberLeninka, async () => (await new CyberLeninkaApi().search(q, { limit: 3 })).length));
    if (s.openAlex) checks.push(t(SourceOrigin.openAlex, async () => (await new OpenAlexApi(s.contactEmail).search(q, { limit: 3 })).length));
    if (s.googleBooks) checks.push(t(SourceOrigin.googleBooks, async () => (await new GoogleBooksApi().search(q, { limit: 3 })).length));
    if (s.crossref) checks.push(t(SourceOrigin.crossref, async () => (await new CrossrefApi(s.contactEmail).search('персонал', { limit: 5 })).length));
    if (s.wikipedia) checks.push(t('Википедия', async () => ((await WikipediaApi.context(q, { pages: 1, chars: 300 })) ? 1 : 0)));
    const web = this.web;
    if (web.enabled) checks.push(t(`Веб-поиск: ${WEB_ENGINE_LABEL[s.engine]}`, async () => (await web.search(q, 3)).length));
    await Promise.all(checks);
    if (s.engine !== 'none' && !web.enabled) {
      out.push({ name: 'Веб-поиск', ok: false, message: webEngineNeedsKey(s.engine) ? 'нужен ключ' : 'укажите адрес SearXNG' });
    }
    return out;
  }
}

