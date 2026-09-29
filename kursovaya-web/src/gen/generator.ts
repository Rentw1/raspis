/**
 * Пошаговое написание курсовой: план → источники → факты → главы (частями) → заключение →
 * введение (после основной части, как требует регламент) → приложения → нумерация и ссылки.
 */
import { sys, user, type AiClient } from '../ai/client';
import {
  appendixRequest,
  chapterPartRequest,
  conclusionRequest,
  factsText,
  introductionRequest,
  JSON_SYSTEM,
  paraphraseParagraph,
  planRequest,
  rewriteRequest,
  sourcesForPrompt,
  WRITER_SYSTEM,
  type RewriteMode,
} from '../ai/prompts';
import { cleanHeading } from '../core/regulation';
import { AiError, CancelToken, errorMessage, isCancelled } from '../core/errors';
import { clamp, jInt, jList, jObj, jStr, jStrList, newId, timeRu, wordCount } from '../core/text';
import { orderedSources } from '../export/gost';
import {
  chaptersOf,
  conclusionOf,
  introductionOf,
  newSection,
  orderedSections,
  sectionHeading,
  sectionShortName,
  sectionStepId,
  selectedSources,
  type Appendix,
  type Coursework,
  type GenOptions,
  type Plan,
  type PlanAppendix,
  type PlanChapter,
  type Section,
  type SectionKind,
} from '../models/coursework';
import { anyLiterature } from '../models/settings';
import { dedupKey, type Source } from '../models/source';
import type { SourceFinder } from '../search/finder';
import { computeBudget, partsFor } from './budget';
import { cleanAiText, cleanCaption, dropInvalidCitations, parseMarkup, renumberTables } from './markup';

export type GenStepState = 'pending' | 'running' | 'done' | 'error' | 'skipped';

export interface GenStepInfo {
  id: string;
  title: string;
}

type Listener = () => void;

/** Состояние генерации для интерфейса (подписка на изменения). */
export class GenProgress {
  running = false;
  currentStep = '';
  status = '';
  live = '';
  log: string[] = [];
  error: string | null = null;
  private listeners = new Set<Listener>();
  private pending: ReturnType<typeof setTimeout> | null = null;

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  update(): void {
    if (this.pending) {
      clearTimeout(this.pending);
      this.pending = null;
    }
    for (const l of [...this.listeners]) l();
  }

  /** Частые обновления (поток текста) — не чаще 10 раз в секунду. */
  private updateSoon(): void {
    if (this.pending) return;
    this.pending = setTimeout(() => {
      this.pending = null;
      for (const l of [...this.listeners]) l();
    }, 100);
  }

  setStatus(s: string): void {
    this.status = s;
    this.addLog(s);
  }

  addLog(s: string): void {
    this.log.push(`${timeRu(new Date())}  ${s}`);
    if (this.log.length > 300) this.log.splice(0, this.log.length - 300);
    this.update();
  }

  appendLive(delta: string): void {
    this.live += delta;
    if (this.live.length > 6000) this.live = this.live.slice(this.live.length - 5000);
    this.updateSoon();
  }

  clearLive(): void {
    this.live = '';
    this.update();
  }
}

export function stepsFor(cw: Coursework): GenStepInfo[] {
  const steps: GenStepInfo[] = [
    { id: 'plan', title: 'План работы' },
    { id: 'sources', title: 'Источники (интернет)' },
  ];
  if (cw.options.webFacts) steps.push({ id: 'facts', title: 'Факты для практической части' });
  for (let i = 1; i <= cw.options.chapters; i++) steps.push({ id: `chapter${i}`, title: `Глава ${i}` });
  steps.push({ id: 'conclusion', title: 'Заключение' }, { id: 'introduction', title: 'Введение (после основной части)' });
  if (cw.options.appendices) steps.push({ id: 'appendices', title: 'Приложения' });
  steps.push({ id: 'finalize', title: 'Нумерация и ссылки' });
  return steps;
}

export function parsePlan(j: Record<string, unknown>, o: GenOptions): Plan {
  const n = o.chapters;
  const chapters: PlanChapter[] = [];
  for (const c0 of jList(j.chapters)) {
    const c = jObj(c0);
    const title = cleanHeading(jStr(c.title, 200));
    if (title.length < 5) continue;
    chapters.push({
      title,
      role: jStr(c.role).toLowerCase().startsWith('theor') ? 'theory' : 'practice',
      points: jStrList(c.points, 10, 300),
      tables: o.tables ? jStrList(c.tables, 3, 200).map(cleanCaption) : [],
    });
  }
  chapters.splice(n);
  while (chapters.length < n) {
    const i = chapters.length;
    chapters.push({
      title:
        i === 0
          ? 'Теоретические основы исследования'
          : i === 1
            ? 'Анализ фактического материала по теме исследования'
            : 'Разработка рекомендаций по совершенствованию',
      role: i === 0 ? 'theory' : 'practice',
      points: [],
      tables: [],
    });
  }
  // Регламент: первая глава — теоретическая, остальные — практические.
  chapters.forEach((c, i) => {
    c.role = i === 0 ? 'theory' : 'practice';
    if (c.points.length < 3) {
      c.points =
        i === 0
          ? ['понятие и сущность', 'классификация и виды', 'нормативное регулирование', 'факторы и условия', 'современные подходы и проблемы']
          : ['характеристика объекта анализа', 'анализ показателей в динамике', 'оценка структуры', 'выявленные проблемы', 'рекомендации'];
    }
  });
  // Таблицы: не больше заданного числа, приоритет практическим главам.
  let left = o.tables ? o.maxTables : 0;
  for (const c of [...chapters.slice(1), chapters[0]]) {
    const keep = Math.min(left, c.tables.length);
    c.tables = c.tables.slice(0, keep);
    left -= keep;
  }
  const apps: PlanAppendix[] = [];
  if (o.appendices) {
    for (const a0 of jList(j.appendices)) {
      const a = jObj(a0);
      const t = cleanHeading(jStr(a.title, 200));
      if (t.length < 4) continue;
      apps.push({ title: t, content: jStr(a.content, 400), chapter: clamp(jInt(a.chapter) ?? 2, 1, n) });
    }
    while (apps.length < o.appendixCount) {
      apps.push({
        title: apps.length === 0 ? 'Исходные данные для анализа' : 'Дополнительные материалы по теме исследования',
        content: 'таблица исходных данных',
        chapter: n >= 2 ? 2 : 1,
      });
    }
    apps.splice(o.appendixCount);
  }
  return {
    object: jStr(j.object, 400),
    subject: jStr(j.subject, 400),
    goal: jStr(j.goal, 500),
    tasks: jStrList(j.tasks, 7, 300),
    methods: jStrList(j.methods, 8, 120),
    keywords: jStrList(j.keywords, 14, 80),
    searchQueries: jStrList(j.search_queries ?? j.searchQueries, 8, 120),
    chapters,
    appendices: apps,
  };
}

/** Создаёт/обновляет разделы и приложения по плану. */
export function syncSectionsWithPlan(cw: Coursework): void {
  const plan = cw.plan;
  if (!plan) return;
  const budget = computeBudget(cw.options, Math.max(selectedSources(cw).length, cw.options.sourcesCount));
  const ensure = (kind: SectionKind, number: number): Section => {
    const ex = cw.sections.find((s) => s.kind === kind && (kind !== 'chapter' || s.number === number));
    if (ex) return ex;
    const s = newSection(kind, number);
    cw.sections.push(s);
    return s;
  };
  const intro = ensure('introduction', 0);
  intro.targetWords = budget.introWords;
  intro.title = 'Введение';
  plan.chapters.forEach((pc, i) => {
    const s = ensure('chapter', i + 1);
    s.title = pc.title;
    s.role = pc.role;
    s.targetWords = budget.chapterWords[Math.min(i, budget.chapterWords.length - 1)];
  });
  cw.sections = cw.sections.filter((s) => !(s.kind === 'chapter' && s.number > plan.chapters.length));
  const concl = ensure('conclusion', 0);
  concl.targetWords = budget.conclusionWords;
  concl.title = 'Заключение';
  const apps: Appendix[] = plan.appendices.map((pa, i) => {
    const ex = cw.appendices[i];
    const same = !!ex && ex.title === pa.title;
    return {
      id: ex?.id ?? newId('app'),
      number: i + 1,
      title: pa.title,
      brief: pa.content,
      chapter: pa.chapter,
      text: same ? ex.text : '',
      status: same ? ex.status : 'pending',
    };
  });
  cw.appendices = cw.options.appendices ? apps : [];
}

export function splitPoints(points: string[], parts: number): string[][] {
  const out: string[][] = Array.from({ length: parts }, () => []);
  points.forEach((p, i) => {
    out[clamp(Math.floor((i * parts) / Math.max(1, points.length)), 0, parts - 1)].push(p);
  });
  return out;
}

export function tail(text: string, chars = 1400): string {
  const t = text.trim();
  if (t.length <= chars) return t;
  const cut = t.slice(t.length - chars);
  const i = cut.indexOf('\n\n');
  return (i >= 0 && i < chars * 0.6 ? cut.slice(i + 2) : cut).trim();
}

export function trimToSentence(text: string): string {
  const t = text.replace(/\s+$/, '');
  const lines = t.split('\n');
  if (lines.length && lines[lines.length - 1].trim().startsWith('|')) return t;
  let idx = -1;
  const re = /[.!?…»)](\s|$)/g;
  for (const m of t.matchAll(re)) idx = m.index ?? idx;
  return idx > t.length * 0.5 ? t.slice(0, idx + 1) : t;
}

/** Если на приложение нет ссылки в тексте — добавить её в соответствующую главу. */
export function ensureAppendixReferences(cw: Coursework): number {
  let added = 0;
  const all = orderedSections(cw)
    .map((s) => s.text)
    .join('\n');
  const chapters = chaptersOf(cw);
  for (const a of cw.appendices) {
    const re = new RegExp(`приложени[еяюи]\\s+${a.number}(?!\\d)`, 'i');
    if (re.test(all)) continue;
    const ch = chapters.find((c) => c.number === a.chapter) ?? chapters[chapters.length - 1];
    if (!ch || !ch.text.trim()) continue;
    const paras = ch.text.split(/\n\s*\n/);
    let idx = -1;
    for (let i = paras.length - 1; i >= 0; i--) {
      const p = paras[i].trim();
      if (!p.startsWith('Таким образом') && !p.startsWith('|') && !p.startsWith('Таблица') && !p.startsWith('–')) {
        idx = i;
        break;
      }
    }
    if (idx < 0) idx = paras.length - 1;
    paras[idx] = `${paras[idx].replace(/\s+$/, '')} Подробные сведения приведены в приложении ${a.number} («${a.title}»).`;
    ch.text = paras.join('\n\n');
    added++;
  }
  return added;
}

export class Generator {
  private cancel: CancelToken | null = null;

  constructor(
    readonly cw: Coursework,
    private readonly ai: AiClient,
    private readonly finderFactory: (cancel: CancelToken) => SourceFinder,
    private readonly save: () => Promise<void>,
    readonly progress: GenProgress,
  ) {}

  get isRunning(): boolean {
    return this.progress.running;
  }

  stateOf(id: string): GenStepState {
    const s = this.cw.steps[id];
    if (s === 'done' || s === 'error' || s === 'skipped') return s;
    return this.progress.running && this.progress.currentStep === id ? 'running' : 'pending';
  }

  stop(): void {
    this.cancel?.cancel();
    this.progress.setStatus('Останавливаю…');
  }

  /** Сбросить шаг и все зависящие от него (для «Перегенерировать»). */
  resetFrom(stepId: string): void {
    const ids = stepsFor(this.cw).map((e) => e.id);
    const i = ids.indexOf(stepId);
    if (i < 0) return;
    for (const id of ids.slice(i)) delete this.cw.steps[id];
    if (stepId === 'plan') {
      for (const s of this.cw.sections) {
        s.text = '';
        s.parts = [];
        s.status = 'pending';
      }
      for (const a of this.cw.appendices) {
        a.text = '';
        a.status = 'pending';
      }
    }
  }

  /** Запуск (или продолжение) генерации. */
  async run(only?: Set<string>): Promise<void> {
    const p = this.progress;
    if (p.running) return;
    p.running = true;
    p.error = null;
    p.clearLive();
    const cancel = new CancelToken();
    this.cancel = cancel;
    p.update();
    try {
      for (const st of stepsFor(this.cw)) {
        if (only && !only.has(st.id)) continue;
        if (!only && this.cw.steps[st.id] === 'done') continue;
        cancel.throwIfCancelled();
        p.currentStep = st.id;
        p.setStatus(`▶ ${st.title}`);
        p.clearLive();
        try {
          await this.runStep(st.id, cancel);
          this.cw.steps[st.id] = 'done';
        } catch (e) {
          if (isCancelled(e) || !(e instanceof AiError)) throw e;
          this.cw.steps[st.id] = 'error';
          p.error = `${st.title}: ${e.message}`;
          p.addLog(`✖ ${p.error}`);
          await this.save();
          return;
        }
        await this.save();
        p.addLog(`✔ ${st.title}`);
      }
      p.setStatus('Готово. Проверьте работу на вкладке «Проверка».');
    } catch (e) {
      if (isCancelled(e)) {
        p.setStatus('Остановлено. Нажмите «Продолжить», чтобы продолжить с того же места.');
      } else {
        p.error = e instanceof AiError ? e.message : `Ошибка: ${errorMessage(e)}`;
        p.addLog(`✖ ${p.error}`);
      }
      for (const s of this.cw.sections) if (s.status === 'running') s.status = 'pending';
      for (const a of this.cw.appendices) if (a.status === 'running') a.status = 'pending';
      await this.save().catch(() => undefined);
    } finally {
      p.running = false;
      p.currentStep = '';
      this.cancel = null;
      p.update();
    }
  }

  private async runStep(id: string, cancel: CancelToken): Promise<void> {
    if (id === 'plan') return this.plan(cancel);
    if (id === 'sources') return this.sources(cancel);
    if (id === 'facts') return this.facts(cancel);
    if (id.startsWith('chapter')) return this.chapter(Number(id.slice(7)), cancel);
    if (id === 'conclusion') return this.conclusion(cancel);
    if (id === 'introduction') return this.introduction(cancel);
    if (id === 'appendices') return this.appendices(cancel);
    if (id === 'finalize') return this.finalize();
  }

  private log = (s: string) => this.progress.addLog(s);

  // ---------------- План ----------------

  private async plan(cancel: CancelToken): Promise<void> {
    if (this.cw.meta.topic.trim().length < 5) throw new AiError('Укажите тему курсовой работы на вкладке «Данные».', { kind: 'config' });
    const j = await this.ai.chatJson(JSON_SYSTEM, planRequest(this.cw), {
      temperature: 0.4,
      maxTokens: 3500,
      cancel,
      onStatus: this.log,
      onDelta: (d) => this.progress.appendLive(d),
    });
    if (typeof j !== 'object' || j === null || Array.isArray(j)) throw new AiError('ИИ не прислал план. Повторите попытку.', { kind: 'format' });
    this.cw.plan = parsePlan(j as Record<string, unknown>, this.cw.options);
    syncSectionsWithPlan(this.cw);
  }

  // ---------------- Источники ----------------

  private async sources(cancel: CancelToken): Promise<void> {
    const cw = this.cw;
    const need = cw.options.sourcesCount;
    const finder = this.finderFactory(cancel);
    const haveSelected = cw.sources.filter((s) => s.selected && s.type !== 'normative' && s.type !== 'web').length;
    if (haveSelected < Math.round(need * 0.7)) {
      let picked: Source[] = [];
      let candidates: Source[] = [];
      if (cw.options.internetSources && anyLiterature(finder.settings)) {
        this.progress.setStatus('Ищу литературу в интернете…');
        candidates = await finder.findLiterature(cw, this.log);
        picked = await finder.selectBest(cw, candidates, need - haveSelected, this.log);
      }
      if (picked.length < (need - haveSelected) * 0.5) {
        try {
          picked.push(...(await finder.aiLiterature(cw, need - haveSelected - picked.length, this.log)));
        } catch (e) {
          if (isCancelled(e)) throw e;
          this.log(`ИИ не смог предложить литературу: ${errorMessage(e)}`);
        }
      }
      const known = new Set(cw.sources.map(dedupKey));
      for (const s of picked) {
        const k = dedupKey(s);
        if (known.has(k)) continue;
        known.add(k);
        s.selected = true;
        cw.sources.push(s);
      }
      // остальные найденные — в резерв (можно включить вручную на вкладке «Источники»)
      for (const s of candidates.slice(0, 40)) {
        const k = dedupKey(s);
        if (known.has(k)) continue;
        known.add(k);
        s.selected = false;
        cw.sources.push(s);
      }
    }
    if (cw.options.normativeActs && !cw.sources.some((s) => s.type === 'normative')) {
      try {
        const acts = await finder.normativeActs(cw, this.log);
        for (const s of acts) {
          s.selected = true;
          cw.sources.push(s);
        }
      } catch (e) {
        if (isCancelled(e)) throw e;
        this.log(`Нормативные акты не подобраны: ${errorMessage(e)}`);
      }
    }
    if (!cw.wikiContext) cw.wikiContext = await finder.referenceContext(cw, this.log);
    if (!selectedSources(cw).length) {
      throw new AiError(
        'Не удалось подобрать ни одного источника. Проверьте интернет или добавьте литературу вручную на вкладке «Источники».',
        { kind: 'config' },
      );
    }
    this.log(`Источников в списке литературы: ${selectedSources(cw).length}`);
  }

  // ---------------- Факты ----------------

  private async facts(cancel: CancelToken): Promise<void> {
    const finder = this.finderFactory(cancel);
    this.progress.setStatus('Собираю фактический материал в интернете…');
    const { facts, sources } = await finder.collectFacts(this.cw, this.log);
    this.cw.facts = facts;
    const known = new Set(this.cw.sources.map((s) => s.url ?? dedupKey(s)));
    for (const s of sources) {
      const k = s.url ?? dedupKey(s);
      if (known.has(k)) continue;
      known.add(k);
      this.cw.sources.push(s);
    }
    this.log(
      facts.length
        ? `Собрано фактов: ${facts.length}`
        : 'Фактов в интернете не найдено — практическая часть опирается на ваши данные или условный пример.',
    );
  }

  // ---------------- Главы ----------------

  private tablesBefore(chapterNumber: number): number {
    let n = 0;
    for (const c of chaptersOf(this.cw).filter((c) => c.number < chapterNumber)) {
      n += parseMarkup(c.text).filter((b) => b.kind === 'table').length;
    }
    return n;
  }

  private async chapter(n: number, cancel: CancelToken): Promise<void> {
    const cw = this.cw;
    const plan = cw.plan;
    if (!plan) throw new AiError('Сначала нужен план работы.', { kind: 'config' });
    const section = chaptersOf(cw).find((s) => s.number === n);
    const pc = plan.chapters[n - 1];
    if (!section || !pc) throw new AiError(`Глава ${n} не найдена в плане.`, { kind: 'config' });
    const ordered = orderedSources(cw.sources);
    const sourcesList = sourcesForPrompt(ordered);
    const parts = partsFor(section.targetWords);
    const perPart = Math.round(section.targetWords / parts);
    const groups = splitPoints(pc.points, parts);
    const firstTable = this.tablesBefore(n) + 1;
    const appRefs: [number, string][] = cw.appendices.filter((a) => a.chapter === n).map((a) => [a.number, a.title]);
    const drop = [pc.title, sectionHeading(section)];
    section.status = 'running';
    if (section.parts.length > parts) section.parts.splice(parts);
    for (let p = section.parts.length; p < parts; p++) {
      cancel.throwIfCancelled();
      this.progress.setStatus(`Глава ${n}: часть ${p + 1} из ${parts} (≈${perPart} слов)`);
      const tables: [number, string][] = [];
      pc.tables.forEach((title, t) => {
        const part = pc.role === 'theory' ? Math.min(parts - 1, 1) : Math.min(parts - 1, t);
        if (part === p) tables.push([firstTable + t, title]);
      });
      const prompt = chapterPartRequest({
        cw,
        section,
        chapter: pc,
        part: p + 1,
        parts,
        words: perPart,
        pointsHere: groups[p],
        previousTail: tail(section.parts.join('\n\n')),
        sourcesList,
        minCitations: pc.role === 'theory' ? 4 : 2,
        tables,
        appendixRefs: p === parts - 1 ? appRefs : [],
        last: p === parts - 1,
        facts: factsText(cw),
        reference: cw.wikiContext,
      });
      const text = await this.write(prompt, perPart, cancel, drop);
      section.parts.push(dropInvalidCitations(text, ordered.length));
      section.text = section.parts.join('\n\n');
      await this.save();
    }
    // Дописываем, если глава получилась заметно короче нужного.
    let extra = 0;
    while (wordCount(section.text) < section.targetWords * 0.85 && extra < 2) {
      cancel.throwIfCancelled();
      extra++;
      const missing = section.targetWords - wordCount(section.text);
      this.progress.setStatus(`Глава ${n} короче нужного — дописываю ≈${missing} слов`);
      const prompt = chapterPartRequest({
        cw,
        section,
        chapter: pc,
        part: parts + extra,
        parts: parts + extra,
        words: missing,
        pointsHere: pc.points,
        previousTail: tail(section.text),
        sourcesList,
        minCitations: 2,
        tables: [],
        appendixRefs: [],
        last: false,
        facts: factsText(cw),
        reference: cw.wikiContext,
        continuation: true,
      });
      const text = await this.write(prompt, missing, cancel, drop);
      // вставляем перед итоговым абзацем «Таким образом…»
      const paras = section.text.split(/\n\s*\n/);
      let lastIdx = -1;
      for (let i = paras.length - 1; i >= 0; i--) {
        if (paras[i].trim().startsWith('Таким образом')) {
          lastIdx = i;
          break;
        }
      }
      const add = dropInvalidCitations(text, ordered.length);
      if (lastIdx > 0) paras.splice(lastIdx, 0, add);
      else paras.push(add);
      section.text = paras.join('\n\n');
      section.parts = [section.text];
      await this.save();
    }
    section.text = renumberTables(section.text, firstTable)[0];
    section.status = 'done';
  }

  /** Запрос текста у ИИ + очистка; при обрыве по длине — обрезка до последнего полного предложения. */
  private async write(prompt: string, words: number, cancel: CancelToken, drop: string[]): Promise<string> {
    this.progress.clearLive();
    const r = await this.ai.chatFull([sys(WRITER_SYSTEM), user(prompt)], {
      temperature: this.cw.options.creativity,
      maxTokens: clamp(Math.round(words * 3.2), 2000, 8000),
      onDelta: (d) => this.progress.appendLive(d),
      onStatus: this.log,
      cancel,
    });
    let text = cleanAiText(r.text, drop);
    if (r.truncated) text = trimToSentence(text);
    if (wordCount(text) < Math.min(120, words * 0.3)) {
      throw new AiError(`ИИ прислал слишком короткий текст (${wordCount(text)} слов). Повторите или выберите другую модель.`, {
        kind: 'empty',
      });
    }
    this.cw.generatedBy = this.ai.label(r.provider);
    return text;
  }

  // ---------------- Заключение и введение ----------------

  private async conclusion(cancel: CancelToken): Promise<void> {
    const s = conclusionOf(this.cw);
    if (!s) throw new AiError('Нет раздела «Заключение» — пересоставьте план.', { kind: 'config' });
    if (chaptersOf(this.cw).some((c) => !c.text.trim())) throw new AiError('Сначала должны быть написаны все главы.', { kind: 'config' });
    this.progress.setStatus(`Пишу заключение (≈${s.targetWords} слов)`);
    s.status = 'running';
    s.text = await this.write(conclusionRequest(this.cw, s.targetWords), s.targetWords, cancel, ['Заключение']);
    s.parts = [s.text];
    s.status = 'done';
  }

  private async introduction(cancel: CancelToken): Promise<void> {
    const cw = this.cw;
    const s = introductionOf(cw);
    if (!s) throw new AiError('Нет раздела «Введение» — пересоставьте план.', { kind: 'config' });
    if (chaptersOf(cw).some((c) => !c.text.trim())) {
      throw new AiError('Введение пишется только после основной части: сначала сгенерируйте все главы.', { kind: 'config' });
    }
    const ordered = orderedSources(cw.sources);
    this.progress.setStatus(`Пишу введение (≈${s.targetWords} слов) — по готовой основной части`);
    s.status = 'running';
    const text = await this.write(
      introductionRequest(cw, {
        words: s.targetWords,
        sourcesList: sourcesForPrompt(ordered, 120),
        sourcesCount: ordered.length,
        appendicesCount: cw.appendices.length,
      }),
      s.targetWords,
      cancel,
      ['Введение'],
    );
    s.text = dropInvalidCitations(text, ordered.length);
    s.parts = [s.text];
    s.status = 'done';
  }

  // ---------------- Приложения ----------------

  private async appendices(cancel: CancelToken): Promise<void> {
    for (const a of this.cw.appendices) {
      if (a.status === 'done' && a.text.trim()) continue;
      cancel.throwIfCancelled();
      this.progress.setStatus(`Приложение ${a.number}: ${a.title}`);
      a.status = 'running';
      this.progress.clearLive();
      const r = await this.ai.chatFull([sys(WRITER_SYSTEM), user(appendixRequest(this.cw, a))], {
        temperature: 0.4,
        maxTokens: 3000,
        onDelta: (d) => this.progress.appendLive(d),
        onStatus: this.log,
        cancel,
      });
      a.text = cleanAiText(r.text, [a.title, `Приложение ${a.number}`]);
      a.status = a.text.trim() ? 'done' : 'error';
      await this.save();
    }
  }

  // ---------------- Завершение ----------------

  /** Сквозная нумерация таблиц, ссылки на приложения, удаление неверных ссылок на источники. */
  async finalize(): Promise<void> {
    const cw = this.cw;
    const max = orderedSources(cw.sources).length;
    let next = 1;
    for (const c of chaptersOf(cw)) {
      const [t, n] = renumberTables(c.text, next);
      c.text = dropInvalidCitations(t, max);
      next = n;
    }
    for (const s of [introductionOf(cw), conclusionOf(cw)]) if (s) s.text = dropInvalidCitations(s.text, max);
    ensureAppendixReferences(cw);
  }

  // ---------------- Правка разделов ----------------

  /** Перегенерировать один раздел (глава, введение, заключение). */
  async regenerateSection(s: Section): Promise<void> {
    const id = sectionStepId(s);
    s.text = '';
    s.parts = [];
    delete this.cw.steps[id];
    await this.run(new Set([id]));
  }

  /** Расширить / сократить / перефразировать раздел. */
  async rewriteSection(s: Section, mode: RewriteMode): Promise<void> {
    const p = this.progress;
    if (p.running) return;
    p.running = true;
    p.error = null;
    const cancel = new CancelToken();
    this.cancel = cancel;
    p.clearLive();
    const name = sectionShortName(s);
    p.setStatus(mode === 'extend' ? `Расширяю: ${name}` : mode === 'shorten' ? `Сокращаю: ${name}` : `Перефразирую: ${name}`);
    try {
      const ordered = orderedSources(this.cw.sources);
      const w = wordCount(s.text);
      const words = mode === 'extend' ? Math.round(w * 1.4) : mode === 'shorten' ? Math.round(w * 0.7) : w;
      const text = await this.write(rewriteRequest(this.cw, s, mode, sourcesForPrompt(ordered, 200, false)), words, cancel, [s.title, sectionHeading(s)]);
      s.text = dropInvalidCitations(text, ordered.length);
      s.parts = [s.text];
      if (s.kind === 'chapter') s.text = renumberTables(s.text, this.tablesBefore(s.number) + 1)[0];
      await this.save();
      p.setStatus(`Готово: ${name}`);
    } catch (e) {
      p.error = isCancelled(e) ? 'Остановлено.' : errorMessage(e);
      p.addLog(`✖ ${p.error}`);
    } finally {
      p.running = false;
      this.cancel = null;
      p.update();
    }
  }

  /** Перефразировать абзац (для устранения дословных совпадений). */
  async paraphrase(paragraph: string, cancel?: CancelToken): Promise<string> {
    const r = await this.ai.chat([sys(WRITER_SYSTEM), user(paraphraseParagraph(paragraph))], { temperature: 0.7, maxTokens: 1500, cancel });
    return cleanAiText(r);
  }

  /** Долгая операция вне шагов генерации (исправления проверки) с общим индикатором и отменой. */
  async task(title: string, fn: (cancel: CancelToken) => Promise<void>): Promise<void> {
    const p = this.progress;
    if (p.running) return;
    p.running = true;
    p.error = null;
    const cancel = new CancelToken();
    this.cancel = cancel;
    p.clearLive();
    p.setStatus(title);
    try {
      await fn(cancel);
      await this.save();
    } catch (e) {
      p.error = isCancelled(e) ? 'Остановлено.' : errorMessage(e);
      p.addLog(`✖ ${p.error}`);
    } finally {
      p.running = false;
      this.cancel = null;
      p.update();
    }
  }
}

