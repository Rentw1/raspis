/** Клиент OpenAI-совместимых сервисов ИИ (+ GigaChat с OAuth) с потоковой выдачей, повторами и сменой модели. */
import { AiError, cancelledError, CancelToken, NetError, type AiErrorKind } from '../core/errors';
import { hostName, send, usesProxy } from '../core/net';
import { AiFormatError, parseJsonLoose, stripHtml, stripThinking, truncate, uuid4 } from '../core/text';
import type { AiSettings } from '../models/settings';
import { NON_CHAT_MODEL, providerById, type AiProvider } from './providers';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const sys = (content: string): ChatMessage => ({ role: 'system', content });
export const user = (content: string): ChatMessage => ({ role: 'user', content });
export const assistant = (content: string): ChatMessage => ({ role: 'assistant', content });

export interface ChatResult {
  text: string;
  finishReason?: string;
  model: string;
  provider: string;
  truncated: boolean;
}

export interface PingResult {
  ok: boolean;
  message: string;
  model?: string;
}

export interface GroundedAnswer {
  text: string;
  links: { title: string; url: string }[];
}

export type StatusCallback = (message: string) => void;

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  onDelta?: (delta: string) => void;
  onStatus?: StatusCallback;
  cancel?: CancelToken;
}

export const keyName = (providerId: string) => `ai_key_${providerId}`;
export const GIGACHAT_CERT = 'gigachat_cert_pem';
const GIGACHAT_OAUTH = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';

function headerGet(h: Headers | Record<string, string>, name: string): string | null {
  if (h instanceof Headers) return h.get(name);
  const k = Object.keys(h).find((x) => x.toLowerCase() === name.toLowerCase());
  return k ? h[k] : null;
}

/** Ошибка HTTP → понятное сообщение. */
export function errorFrom(status: number, body: string, headers: Headers | Record<string, string> = {}): AiError {
  let msg = '';
  try {
    const j = JSON.parse(body) as unknown;
    const e = typeof j === 'object' && j !== null && !Array.isArray(j) ? ((j as Record<string, unknown>).error ?? j) : j;
    if (typeof e === 'object' && e !== null && !Array.isArray(e)) {
      const o = e as Record<string, unknown>;
      msg = String(o.message ?? o.msg ?? o.detail ?? o.error ?? '');
      const meta = o.metadata as Record<string, unknown> | undefined;
      if (meta && meta.raw) msg = `${msg} ${String(meta.raw)}`;
    } else if (Array.isArray(e) && e.length) {
      const f = e[0] as Record<string, unknown>;
      msg = typeof f === 'object' && f ? String((f.error as Record<string, unknown> | undefined)?.message ?? f.message ?? '') : String(f);
    } else {
      msg = String(e);
    }
  } catch {
    msg = stripHtml(body);
  }
  msg = truncate(msg.replace(/\s+/g, ' ').trim(), 260);
  let retryAfterMs: number | undefined;
  const ra = headerGet(headers, 'retry-after');
  if (ra) {
    const sec = Number(ra.trim());
    if (Number.isFinite(sec)) retryAfterMs = Math.min(90, Math.max(1, Math.ceil(sec))) * 1000;
  }
  const tail = msg ? ` ${msg}` : '';
  const mk = (m: string, kind: AiErrorKind, retryable = false) => new AiError(m, { kind, status, retryable, retryAfterMs });
  switch (status) {
    case 400:
    case 422:
      return mk(`Сервис отклонил запрос (${status}).${tail}`, 'badRequest');
    case 401:
      return mk(`Ошибка авторизации (401): ключ не принят.${tail}`, 'auth');
    case 403:
      return mk(`Запрос отклонён (403): нет доступа к модели или сервис недоступен в вашем регионе.${tail}`, 'auth');
    case 402:
      return mk(`Закончились бесплатные кредиты или нужна оплата (402).${tail}`, 'payment');
    case 404:
      return mk(`Модель или адрес не найдены (404).${tail}`, 'notFound');
    case 408:
      return mk(`Сервис не дождался запроса (408).${tail}`, 'timeout', true);
    case 413:
      return mk(`Слишком длинный запрос (413).${tail}`, 'badRequest');
    case 429:
      return mk(`Превышен лимит бесплатных запросов (429).${tail}`, 'rateLimit', true);
    default:
      if (status >= 500) return mk(`Ошибка сервера ИИ (${status}).${tail}`, 'server', true);
      return mk(`Ошибка сервиса ИИ (${status}).${tail}`, 'other');
  }
}

/** Сортировка моделей по предпочтениям сервиса, затем по версии (новее — выше). */
export function rankModels(p: AiProvider, ids: string[]): string[] {
  const prefs = p.prefer.map((x) => new RegExp(x, 'i'));
  const group = (id: string) => {
    const i = prefs.findIndex((r) => r.test(id));
    return i < 0 ? prefs.length : i;
  };
  const version = (id: string) => {
    const m = /(\d+(?:\.\d+)?)/.exec(id.replace(/^[a-z-]+\//, ''));
    return m ? Number(m[1]) || 0 : 0;
  };
  return [...new Set(ids)].sort((a, b) => {
    const ga = group(a);
    const gb = group(b);
    if (ga !== gb) return ga - gb;
    const va = version(a);
    const vb = version(b);
    if (va !== vb) return vb - va;
    return a.length !== b.length ? a.length - b.length : a.localeCompare(b);
  });
}

function parseCompletion(txt: string): [string, string | undefined] {
  let j: unknown;
  try {
    j = JSON.parse(txt);
  } catch {
    throw new AiError('Сервис ИИ прислал непонятный ответ.', { kind: 'format' });
  }
  const o = (typeof j === 'object' && j !== null ? j : {}) as Record<string, unknown>;
  if (o.error) throw errorFrom(400, txt);
  const choices = o.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new AiError('Сервис ИИ не прислал текст.', { kind: 'empty', retryable: true });
  }
  const ch = choices[0] as Record<string, unknown>;
  const msg = ch.message as Record<string, unknown> | undefined;
  let content: unknown = msg ? msg.content : ch.text;
  if (Array.isArray(content)) {
    content = content.map((x) => (typeof x === 'string' ? x : typeof x === 'object' && x ? String((x as Record<string, unknown>).text ?? '') : '')).join('');
  }
  return [String(content ?? ''), ch.finish_reason == null ? undefined : String(ch.finish_reason)];
}

function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(onTimeout()), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function readSse(body: ReadableStream<Uint8Array>, onDelta?: (d: string) => void): Promise<[string, string | undefined]> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let finish: string | undefined;
  let pending = '';
  try {
    for (;;) {
      const { value, done } = await withTimeout(reader.read(), 150000, () => new AiError('Сервис ИИ перестал присылать текст (таймаут).', { kind: 'timeout', retryable: true }));
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      let i: number;
      while ((i = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, i).trim();
        pending = pending.slice(i + 1);
        if (!line || line.startsWith(':') || !line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') return [text, finish];
        let j: Record<string, unknown>;
        try {
          j = JSON.parse(data) as Record<string, unknown>;
        } catch {
          continue;
        }
        if (j.error) {
          const code = typeof j.error === 'object' && j.error ? Number((j.error as Record<string, unknown>).code) : NaN;
          throw errorFrom(Number.isFinite(code) && code >= 400 ? code : 500, data);
        }
        const choices = j.choices;
        if (Array.isArray(choices) && choices.length && typeof choices[0] === 'object') {
          const ch = choices[0] as Record<string, unknown>;
          const delta = (ch.delta ?? ch.message) as Record<string, unknown> | undefined;
          const c = delta?.content;
          if (typeof c === 'string' && c) {
            text += c;
            onDelta?.(c);
          }
          if (ch.finish_reason != null) finish = String(ch.finish_reason);
        }
      }
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
  return [text, finish];
}

export class AiClient {
  private sessionModel = new Map<string, string>();
  private modelCache = new Map<string, string[]>();
  private gcToken: string | null = null;
  private gcExpires = 0;

  constructor(
    readonly settings: AiSettings,
    private readonly readSecret: (name: string) => string,
    private readonly onSettingsChanged?: () => void,
  ) {}

  get provider(): AiProvider | undefined {
    return providerById(this.settings.provider);
  }

  /** Сбросить кэш (после смены ключа/сервиса). */
  resetSession(): void {
    this.sessionModel.clear();
    this.modelCache.clear();
    this.gcToken = null;
  }

  baseFor(p: AiProvider): string {
    return (p.id === 'custom' ? this.settings.customBase : p.base).trim().replace(/\/+$/, '');
  }

  modelFor(p: AiProvider): string {
    const s = this.sessionModel.get(p.id);
    if (s) return s;
    const m = (this.settings.models[p.id] ?? '').trim();
    return m || p.defaultModel;
  }

  isReady(providerId?: string): boolean {
    const p = providerById(providerId ?? this.settings.provider);
    if (!p) return false;
    if (!/^https?:\/\//.test(this.baseFor(p))) return false;
    if (!p.needsKey) return true;
    return this.readSecret(keyName(p.id)) !== '';
  }

  label(providerId?: string): string {
    const p = providerById(providerId ?? this.settings.provider);
    if (!p) return 'не подключён';
    const m = this.modelFor(p);
    return m ? `${p.name} · ${m}` : p.name;
  }

  // ---------------- HTTP ----------------

  private async headers(p: AiProvider, cancel?: CancelToken): Promise<Record<string, string>> {
    const h: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (p.auth === 'gigachat') {
      h.Authorization = `Bearer ${await this.gigachatToken(p, cancel)}`;
    } else {
      const k = this.readSecret(keyName(p.id));
      if (k) h.Authorization = `Bearer ${k}`;
    }
    if (p.id === 'openrouter') {
      h['HTTP-Referer'] = 'https://github.com/Rentw1/raspis';
      h['X-Title'] = 'Kursovaya LTET';
    }
    if (p.id === 'github') {
      h.Accept = 'application/vnd.github+json';
      h['X-GitHub-Api-Version'] = '2022-11-28';
    }
    return h;
  }

  private async gigachatToken(p: AiProvider, cancel?: CancelToken): Promise<string> {
    if (this.gcToken && Date.now() < this.gcExpires - 60000) return this.gcToken;
    let key = this.readSecret(keyName(p.id)).trim();
    if (!key) throw new AiError('Введите ключ авторизации GigaChat.', { kind: 'config' });
    key = key.replace(/^Basic\s+/i, '');
    const s = await send(
      GIGACHAT_OAUTH,
      {
        method: 'POST',
        headers: { Authorization: `Basic ${key}`, RqUID: uuid4(), 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: `scope=${encodeURIComponent(this.settings.gigachatScope)}`,
        timeoutMs: 40000,
        cancel,
      },
    );
    let txt: string;
    try {
      txt = await s.resp.text();
    } finally {
      s.release();
    }
    if (s.resp.status !== 200) throw errorFrom(s.resp.status, txt, s.resp.headers);
    let j: Record<string, unknown>;
    try {
      j = JSON.parse(txt) as Record<string, unknown>;
    } catch {
      throw new AiError('GigaChat прислал непонятный ответ на запрос токена.', { kind: 'format' });
    }
    const token = typeof j.access_token === 'string' ? j.access_token : '';
    if (!token) throw new AiError('GigaChat не выдал токен доступа.', { kind: 'auth' });
    const exp = j.expires_at;
    this.gcExpires = typeof exp === 'number' ? (exp < 100000000000 ? exp * 1000 : exp) : Date.now() + 25 * 60000;
    this.gcToken = token;
    return token;
  }

  private netError(p: AiProvider, e: unknown, cancel?: CancelToken): AiError {
    if (cancel?.isCancelled) return cancelledError();
    if (e instanceof AiError) return e;
    if (e instanceof NetError) {
      if (e.timeout) return new AiError(`Сервис ${p.name} не ответил вовремя.`, { kind: 'timeout', retryable: true });
      const extra = p.auth === 'gigachat' && !usesProxy()
        ? ' GigaChat работает только через свой сервер (откройте приложение с него).'
        : p.russia === 'vpn'
          ? ' Если вы в России — включите VPN или откройте приложение с сервера за рубежом.'
          : '';
      return new AiError(`Нет связи с ${p.name}: ${e.message}.${extra}`, { kind: 'network', retryable: true });
    }
    if (e instanceof DOMException && e.name === 'AbortError') return cancelledError();
    return new AiError(`Ошибка связи с ${p.name}: ${e instanceof Error ? e.message : String(e)}`, { kind: 'network', retryable: true });
  }

  // ---------------- Модели ----------------

  async listModels(providerId: string, refresh = false): Promise<string[]> {
    const p = providerById(providerId);
    if (!p) throw new AiError('Выберите сервис ИИ.', { kind: 'config' });
    const cached = this.modelCache.get(p.id);
    if (!refresh && cached) return cached;
    const base = this.baseFor(p);
    if (!base) throw new AiError('Укажите адрес сервера.', { kind: 'config' });
    try {
      const s = await send(p.modelsUrl ?? `${base}/models`, { headers: await this.headers(p), timeoutMs: 40000 });
      let body: string;
      try {
        body = await s.resp.text();
      } finally {
        s.release();
      }
      if (s.resp.status !== 200) throw errorFrom(s.resp.status, body, s.resp.headers);
      let j: unknown;
      try {
        j = JSON.parse(body);
      } catch {
        throw new AiError(`${hostName(base)}: список моделей в непонятном формате.`, { kind: 'format' });
      }
      const o = j as Record<string, unknown>;
      const raw = Array.isArray(j) ? j : Array.isArray(o?.data) ? (o.data as unknown[]) : Array.isArray(o?.models) ? (o.models as unknown[]) : [];
      let ids: string[] = [];
      for (const m of raw) {
        if (typeof m === 'string') {
          ids.push(m);
          continue;
        }
        if (typeof m !== 'object' || m === null) continue;
        const r = m as Record<string, unknown>;
        const out = r.supported_output_modalities;
        if (Array.isArray(out) && !out.includes('text')) continue;
        const type = typeof r.type === 'string' ? r.type : '';
        if (p.id === 'gigachat' && type && type !== 'chat' && type !== 'model') continue;
        const id = String(r.id ?? r.name ?? '');
        if (id) ids.push(id);
      }
      ids = ids.map((x) => x.replace(/^models\//, '')).filter((x) => x && !NON_CHAT_MODEL.test(x));
      if (p.freeSuffix) ids = ids.filter((x) => x.endsWith(p.freeSuffix as string));
      const ranked = rankModels(p, ids);
      this.modelCache.set(p.id, ranked);
      return ranked;
    } catch (e) {
      throw this.netError(p, e);
    }
  }

  async ensureModel(p: AiProvider): Promise<string> {
    const m = this.modelFor(p);
    if (m) return m;
    const ids = await this.listModels(p.id);
    if (!ids.length) {
      throw new AiError(`У сервиса ${p.name} не нашлось подходящей модели. Укажите модель вручную в настройках.`, { kind: 'config' });
    }
    this.settings.models[p.id] = ids[0];
    this.onSettingsChanged?.();
    return ids[0];
  }

  // ---------------- Текст ----------------

  async chat(messages: ChatMessage[], o: ChatOptions = {}): Promise<string> {
    return (await this.chatFull(messages, o)).text;
  }

  async chatFull(messages: ChatMessage[], o: ChatOptions = {}): Promise<ChatResult> {
    const primary = this.provider;
    if (!primary) throw new AiError('ИИ не подключён. Откройте Настройки → Нейросеть.', { kind: 'config' });
    if (!this.isReady(primary.id)) {
      throw new AiError(`Для сервиса ${primary.name} нужен ключ. Получите бесплатный ключ и вставьте его в настройках.`, { kind: 'config' });
    }
    try {
      return await this.withRetries(primary, messages, o);
    } catch (e) {
      if (!(e instanceof AiError) || e.kind === 'cancelled' || e.kind === 'format') throw e;
      const fb = providerById(this.settings.fallbackProvider);
      if (!fb || fb.id === primary.id || !this.isReady(fb.id)) throw e;
      o.onStatus?.(`${primary.name}: ${e.message} Пробую запасной сервис ${fb.name}…`);
      return this.withRetries(fb, messages, o);
    }
  }

  private async withRetries(p: AiProvider, messages: ChatMessage[], o: ChatOptions): Promise<ChatResult> {
    let model = await this.ensureModel(p);
    const tried = new Set<string>();
    let attempt = 0;
    let dropJson = false;
    let dropMax = false;
    let dropExtra = false;
    let noStream = false;
    const wantStream = !!o.onDelta;
    for (;;) {
      o.cancel?.throwIfCancelled();
      try {
        return await this.chatOnce(p, model, messages, {
          temperature: o.temperature ?? 0.5,
          maxTokens: dropMax ? undefined : o.maxTokens,
          json: !!o.json && !dropJson,
          extra: !dropExtra,
          stream: wantStream && !noStream,
          onDelta: o.onDelta,
          cancel: o.cancel,
        });
      } catch (err) {
        const e = err instanceof AiError ? err : this.netError(p, err, o.cancel);
        if (e.kind === 'cancelled') throw e;
        if (e.kind === 'badRequest') {
          // Упрощаем запрос: без JSON-режима, без доп. параметров, без лимита длины, без потока.
          if (o.json && !dropJson) {
            dropJson = true;
            continue;
          }
          if (!dropExtra) {
            dropExtra = true;
            continue;
          }
          if (o.maxTokens !== undefined && !dropMax) {
            dropMax = true;
            continue;
          }
          if (wantStream && !noStream) {
            noStream = true;
            continue;
          }
        }
        if (e.retryable && attempt < 2) {
          attempt++;
          const wait = e.retryAfterMs ?? (attempt === 1 ? 6000 : 20000);
          o.onStatus?.(`${p.name}: ${e.message} Повтор через ${Math.round(wait / 1000)} с…`);
          if (o.cancel) await o.cancel.delay(wait);
          else await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        const canSwitch =
          this.settings.autoSwitchModel &&
          p.id !== 'custom' &&
          (['rateLimit', 'notFound', 'payment', 'server', 'empty', 'timeout'] as AiErrorKind[]).includes(e.kind);
        if (canSwitch && tried.size < 4) {
          tried.add(model);
          let next = '';
          try {
            next = (await this.listModels(p.id)).find((m) => !tried.has(m)) ?? '';
          } catch {
            next = '';
          }
          if (next) {
            o.onStatus?.(`Модель ${model} недоступна (${e.message}). Переключаюсь на ${next}…`);
            model = next;
            this.sessionModel.set(p.id, next);
            attempt = 0;
            continue;
          }
        }
        throw e;
      }
    }
  }

  private async chatOnce(
    p: AiProvider,
    model: string,
    messages: ChatMessage[],
    o: { temperature: number; maxTokens?: number; json: boolean; extra: boolean; stream: boolean; onDelta?: (d: string) => void; cancel?: CancelToken },
  ): Promise<ChatResult> {
    const body: Record<string, unknown> = { model, messages, temperature: o.temperature };
    if (o.maxTokens !== undefined) body.max_tokens = Math.min(o.maxTokens, p.maxOutput);
    if (o.json && p.auth !== 'gigachat') body.response_format = { type: 'json_object' };
    if (o.extra && p.id === 'gemini') body.reasoning_effort = 'low';
    if (o.stream) body.stream = true;
    let s;
    try {
      s = await send(
        `${this.baseFor(p)}/chat/completions`,
        { method: 'POST', headers: await this.headers(p, o.cancel), body: JSON.stringify(body), timeoutMs: 120000, cancel: o.cancel },
        true,
      );
    } catch (e) {
      throw this.netError(p, e, o.cancel);
    }
    try {
      const resp = s.resp;
      if (resp.status < 200 || resp.status >= 300) {
        const txt = await withTimeout(resp.text(), 30000, () => new AiError('Нет ответа', { kind: 'timeout' })).catch(() => '');
        throw errorFrom(resp.status, txt, resp.headers);
      }
      const ct = resp.headers.get('content-type') ?? '';
      let content: string;
      let finish: string | undefined;
      if (o.stream && ct.includes('event-stream') && resp.body) {
        [content, finish] = await readSse(resp.body, o.onDelta);
      } else {
        const txt = await withTimeout(resp.text(), 300000, () => new AiError(`Сервис ${p.name} не ответил вовремя.`, { kind: 'timeout', retryable: true }));
        [content, finish] = parseCompletion(txt);
        if (o.onDelta && content) o.onDelta(content);
      }
      content = stripThinking(content).trim();
      if (!content) {
        throw new AiError(
          finish === 'length' ? 'Ответ модели обрезан до начала текста (модель «думает» слишком долго).' : 'ИИ вернул пустой ответ.',
          { kind: 'empty', retryable: true },
        );
      }
      return { text: content, finishReason: finish, model, provider: p.id, truncated: finish === 'length' || finish === 'max_tokens' };
    } catch (e) {
      throw this.netError(p, e, o.cancel);
    } finally {
      s.release();
    }
  }

  // ---------------- Проверка подключения ----------------

  async ping(providerId: string): Promise<PingResult> {
    const p = providerById(providerId);
    if (!p) return { ok: false, message: 'Выберите сервис ИИ.' };
    if (!/^https?:\/\//.test(this.baseFor(p))) return { ok: false, message: 'Укажите адрес сервера (https://…/v1).' };
    if (p.needsKey && !this.readSecret(keyName(p.id))) return { ok: false, message: 'Введите ключ API.' };
    this.resetSession();
    const q: ChatMessage[] = [user('Ответь одним словом без пояснений: столица России?')];
    try {
      const model = await this.ensureModel(p);
      let r: ChatResult;
      try {
        r = await this.chatOnce(p, model, q, { temperature: 0, maxTokens: 400, json: false, extra: true, stream: false });
      } catch (e) {
        if (!(e instanceof AiError) || e.kind !== 'badRequest') throw e;
        r = await this.chatOnce(p, model, q, { temperature: 0, json: false, extra: false, stream: false });
      }
      const answer = truncate(r.text.replace(/\s+/g, ' '), 60);
      return { ok: true, message: `Подключено успешно: ${p.name} · ${model}. Ответ модели: «${answer}»`, model };
    } catch (e) {
      if (e instanceof AiError) {
        if (e.kind === 'auth') return { ok: false, message: `Ошибка подключения: ключ не принят или запрос отклонён. ${e.message}` };
        return { ok: false, message: `Ошибка подключения. ${e.message}` };
      }
      return { ok: false, message: `Ошибка подключения: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  // ---------------- Gemini + поиск Google ----------------

  async geminiSearch(prompt: string, cancel?: CancelToken): Promise<GroundedAnswer> {
    const p = providerById('gemini') as AiProvider;
    const key = this.readSecret(keyName('gemini'));
    if (!key) throw new AiError('Нет ключа Gemini.', { kind: 'config' });
    const model = await this.ensureModel(p);
    try {
      const s = await send(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
          }),
          timeoutMs: 150000,
          cancel,
        },
      );
      let body: string;
      try {
        body = await s.resp.text();
      } finally {
        s.release();
      }
      if (s.resp.status !== 200) throw errorFrom(s.resp.status, body, s.resp.headers);
      const j = JSON.parse(body) as Record<string, unknown>;
      const cands = Array.isArray(j.candidates) ? (j.candidates as Record<string, unknown>[]) : [];
      if (!cands.length) throw new AiError('Gemini не нашёл ответа.', { kind: 'empty' });
      const c = cands[0];
      const parts = ((c.content as Record<string, unknown> | undefined)?.parts as Record<string, unknown>[] | undefined) ?? [];
      const text = parts.map((x) => String(x.text ?? '')).join('\n').trim();
      const links: { title: string; url: string }[] = [];
      const chunks = ((c.groundingMetadata as Record<string, unknown> | undefined)?.groundingChunks as Record<string, unknown>[] | undefined) ?? [];
      for (const ch of chunks) {
        const web = ch.web as Record<string, unknown> | undefined;
        if (web?.uri) links.push({ title: String(web.title ?? ''), url: String(web.uri) });
      }
      return { text: stripThinking(text), links };
    } catch (e) {
      throw this.netError(p, e, cancel);
    }
  }

  /** Запрос с ответом в JSON (с повтором, если модель ответила не по формату). */
  async chatJson(
    system: string,
    userText: string,
    o: { temperature?: number; maxTokens?: number; expectArray?: boolean; onStatus?: StatusCallback; cancel?: CancelToken; onDelta?: (d: string) => void } = {},
  ): Promise<unknown> {
    const msgs = [sys(system), user(userText)];
    const first = await this.chat(msgs, {
      temperature: o.temperature ?? 0.3,
      maxTokens: o.maxTokens,
      json: !o.expectArray,
      onStatus: o.onStatus,
      cancel: o.cancel,
      onDelta: o.onDelta,
    });
    try {
      return parseJsonLoose(first, o.expectArray);
    } catch (e) {
      if (!(e instanceof AiFormatError)) throw e;
      o.onStatus?.('Ответ ИИ не в формате JSON — прошу повторить…');
      const retry = await this.chat(
        [...msgs, assistant(truncate(first, 2000)), user('Ответь ещё раз: только JSON по заданной схеме, без пояснений и без Markdown.')],
        { temperature: 0.2, maxTokens: o.maxTokens, json: !o.expectArray, onStatus: o.onStatus, cancel: o.cancel },
      );
      try {
        return parseJsonLoose(retry, o.expectArray);
      } catch (e2) {
        if (e2 instanceof AiFormatError) throw new AiError(e2.message, { kind: 'format' });
        throw e2;
      }
    }
  }
}
