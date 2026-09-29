/**
 * HTTP-запросы приложения. Браузер не пускает запросы к большинству сервисов (CORS),
 * поэтому, когда приложение открыто со своего сервера, запросы идут через него:
 * /api/fetch?url=… (сервер пересылает запрос и отдаёт ответ, включая поток ИИ).
 */
import type { NetMode } from '../models/settings';
import { cancelledError, CancelToken, NetError } from './errors';

export const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';
export const APP_UA = 'KursovayaLTET/1.0 (+https://github.com/Rentw1/raspis)';

/** Заголовки, которые браузер не даёт задать; через сервер они передаются как X-Fwd-*. */
const FORWARDABLE = new Set(['user-agent', 'referer', 'origin']);
const FORBIDDEN = new Set(['user-agent', 'referer', 'origin', 'cookie', 'host', 'connection', 'accept-encoding', 'content-length']);

export interface ProxyInfo {
  ok: boolean;
  server: string;
  version: string;
}

interface NetState {
  mode: NetMode;
  proxyBase: string;
  proxyOk: boolean | null;
  proxyInfo: ProxyInfo | null;
  gigachatCa: string;
}

const state: NetState = { mode: 'auto', proxyBase: '', proxyOk: null, proxyInfo: null, gigachatCa: '' };

const hasLocation = () => typeof location !== 'undefined' && typeof location.href === 'string' && location.protocol.startsWith('http');

export function configureNet(mode: NetMode, proxyBase: string): void {
  const changed = state.proxyBase !== proxyBase.trim();
  state.mode = mode;
  state.proxyBase = proxyBase.trim().replace(/\/+$/, '');
  if (changed) {
    state.proxyOk = null;
    state.proxyInfo = null;
  }
}

/** Сертификат НУЦ Минцифры для GigaChat (передаётся серверу вместе с запросом к Сберу). */
export function setGigachatCa(pem: string): void {
  state.gigachatCa = pem.trim();
}

export function apiBase(): string {
  if (state.proxyBase) return state.proxyBase;
  if (hasLocation()) return new URL('.', typeof document !== 'undefined' ? document.baseURI : location.href).href.replace(/\/+$/, '');
  return '';
}

export function proxyState(): { mode: NetMode; available: boolean | null; info: ProxyInfo | null } {
  return { mode: state.mode, available: state.proxyOk, info: state.proxyInfo };
}

/** Проверяет, работает ли сервер-посредник (/api/health). */
export async function detectProxy(timeoutMs = 6000): Promise<ProxyInfo | null> {
  const base = apiBase();
  if (!base) {
    state.proxyOk = false;
    return null;
  }
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(`${base}/api/health`, { signal: ac.signal, cache: 'no-store', credentials: 'omit' });
    const j = (await r.json()) as Partial<ProxyInfo>;
    if (r.ok && j && j.ok) {
      state.proxyOk = true;
      state.proxyInfo = { ok: true, server: String(j.server ?? 'kursovaya-server'), version: String(j.version ?? '') };
      return state.proxyInfo;
    }
  } catch {
    // сервера нет — приложение работает напрямую
  } finally {
    clearTimeout(t);
  }
  state.proxyOk = false;
  state.proxyInfo = null;
  return null;
}

export function usesProxy(url?: string): boolean {
  if (state.mode === 'direct') return false;
  if (url && hasLocation()) {
    try {
      if (new URL(url, location.href).origin === location.origin) return false;
    } catch {
      return false;
    }
  }
  if (state.mode === 'proxy') return true;
  return state.proxyOk === true;
}

function toBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function route(url: string, headers: Record<string, string>): { url: string; headers: Record<string, string>; proxied: boolean } {
  const proxied = usesProxy(url);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    const lk = k.toLowerCase();
    if (FORBIDDEN.has(lk)) {
      if (proxied && FORWARDABLE.has(lk)) out[`X-Fwd-${k}`] = v;
      continue;
    }
    out[k] = v;
  }
  if (!proxied) return { url, headers: out, proxied };
  try {
    const host = new URL(url).hostname;
    if (state.gigachatCa && /(^|\.)sberbank\.ru$/i.test(host)) out['X-Proxy-Ca'] = toBase64(state.gigachatCa);
  } catch {
    throw new NetError(`Неверный адрес: ${url}`);
  }
  return { url: `${apiBase()}/api/fetch?url=${encodeURIComponent(url)}`, headers: out, proxied };
}

export function hostName(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | URLSearchParams;
  /** Таймаут до ответа (а для fetchText — до конца чтения тела), мс. */
  timeoutMs?: number;
  cancel?: CancelToken;
}

export interface Sent {
  resp: Response;
  proxied: boolean;
  /** Снять связь с отменой (обязательно после чтения потока). */
  release: () => void;
  timedOut: () => boolean;
}

/**
 * Отправка запроса. Таймаут действует до получения заголовков ответа; при stream=false
 * вызывающий читает тело и затем вызывает release().
 */
export async function send(url: string, opts: RequestOptions = {}, stream = false): Promise<Sent> {
  const cancel = opts.cancel;
  if (cancel?.isCancelled) throw cancelledError();
  const ac = new AbortController();
  let timedOut = false;
  const onCancel = () => ac.abort();
  cancel?.signal.addEventListener('abort', onCancel);
  const timer = setTimeout(() => {
    timedOut = true;
    ac.abort();
  }, opts.timeoutMs ?? 25000);
  const release = () => {
    clearTimeout(timer);
    cancel?.signal.removeEventListener('abort', onCancel);
  };
  const host = hostName(url);
  let routed: ReturnType<typeof route>;
  try {
    routed = route(url, opts.headers ?? {});
  } catch (e) {
    release();
    throw e;
  }
  try {
    const resp = await fetch(routed.url, {
      method: opts.method ?? 'GET',
      headers: routed.headers,
      body: opts.body,
      signal: ac.signal,
      redirect: 'follow',
      credentials: 'omit',
      cache: 'no-store',
    });
    if (resp.headers.get('x-proxy-error')) {
      let msg = `ошибка сервера-посредника (${resp.status})`;
      try {
        const j = (await resp.json()) as { error?: string };
        if (j.error) msg = j.error;
      } catch {
        // тело не JSON
      }
      release();
      throw new NetError(`${host}: ${msg}`, { status: resp.status });
    }
    if (stream) clearTimeout(timer);
    return { resp, proxied: routed.proxied, release, timedOut: () => timedOut };
  } catch (e) {
    release();
    if (cancel?.isCancelled) throw cancelledError();
    if (e instanceof NetError) throw e;
    if (timedOut) throw new NetError(`${host}: нет ответа (таймаут)`, { timeout: true });
    const hint = routed.proxied
      ? ''
      : state.mode !== 'direct' && state.proxyOk === false
        ? ' — сайт не принимает запросы из браузера; откройте приложение со своего сервера'
        : '';
    throw new NetError(`${host}: нет связи${hint}`);
  }
}

export interface TextResponse {
  status: number;
  headers: Headers;
  text: string;
  host: string;
}

/** Определение кодировки: заголовок Content-Type, затем <meta charset>. */
export function decodeBody(buf: ArrayBuffer, contentType: string | null): string {
  const bytes = new Uint8Array(buf);
  let charset = /charset=["']?([\w-]+)/i.exec(contentType ?? '')?.[1]?.toLowerCase();
  if (!charset) {
    const head = new TextDecoder('latin1').decode(bytes.subarray(0, 4096));
    charset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1]?.toLowerCase();
  }
  const label = charset === 'cp1251' || charset === 'win-1251' ? 'windows-1251' : charset || 'utf-8';
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

/** Запрос с чтением всего ответа как текста (таймаут — на весь обмен). */
export async function fetchText(url: string, opts: RequestOptions = {}): Promise<TextResponse> {
  const s = await send(url, { ...opts, headers: { 'User-Agent': APP_UA, ...(opts.headers ?? {}) } });
  const host = hostName(url);
  try {
    const buf = await s.resp.arrayBuffer();
    return { status: s.resp.status, headers: s.resp.headers, text: decodeBody(buf, s.resp.headers.get('content-type')), host };
  } catch {
    if (opts.cancel?.isCancelled) throw cancelledError();
    if (s.timedOut()) throw new NetError(`${host}: нет ответа (таймаут)`, { timeout: true });
    throw new NetError(`${host}: обрыв связи`);
  } finally {
    s.release();
  }
}

export function decodeJson(r: TextResponse): unknown {
  if (r.status === 429) throw new NetError(`${r.host}: слишком много запросов (429), попробуйте позже`, { status: 429 });
  if (r.status === 401 || r.status === 403) throw new NetError(`${r.host}: доступ запрещён (${r.status})`, { status: r.status });
  if (r.status < 200 || r.status >= 300) throw new NetError(`${r.host}: ошибка ${r.status}`, { status: r.status });
  try {
    return JSON.parse(r.text);
  } catch {
    throw new NetError(`${r.host}: непонятный ответ`);
  }
}

export async function getJson(url: string, opts: RequestOptions = {}): Promise<unknown> {
  return decodeJson(await fetchText(url, { ...opts, headers: { Accept: 'application/json', ...(opts.headers ?? {}) } }));
}

export function buildUrl(base: string, params: Record<string, string | number | undefined>): string {
  const u = new URL(base);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') u.searchParams.set(k, String(v));
  return u.href;
}
