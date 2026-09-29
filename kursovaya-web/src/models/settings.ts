import { Reg } from '../core/regulation';

/** Настройки подключения к ИИ. Ключи хранятся отдельно (только на этом устройстве). */
export interface AiSettings {
  provider: string;
  models: Record<string, string>;
  customBase: string;
  /** Запасной сервис, если основной отказал (лимит, ошибка сервера). */
  fallbackProvider: string;
  /** Переключаться на другую бесплатную модель того же сервиса при лимите/перегрузке. */
  autoSwitchModel: boolean;
  /** Для Gemini: поиск Google (grounding) при сборе фактов. */
  useGeminiSearch: boolean;
  gigachatScope: string;
}

export type WebEngine = 'none' | 'duckduckgo' | 'tavily' | 'brave' | 'searxng';

export const WEB_ENGINES: WebEngine[] = ['duckduckgo', 'tavily', 'brave', 'searxng', 'none'];

export const WEB_ENGINE_LABEL: Record<WebEngine, string> = {
  none: 'Выключен',
  duckduckgo: 'DuckDuckGo (без ключа)',
  tavily: 'Tavily (бесплатный ключ, 1000 запросов/мес)',
  brave: 'Brave Search (ключ)',
  searxng: 'SearXNG (свой адрес)',
};

export const webEngineNeedsKey = (e: WebEngine) => e === 'tavily' || e === 'brave';

export const WEB_ENGINE_KEY_URL: Partial<Record<WebEngine, string>> = {
  tavily: 'https://app.tavily.com/home',
  brave: 'https://api-dashboard.search.brave.com/app/keys',
};

/** Настройки поиска источников и фактов в интернете. */
export interface SearchSettings {
  openAlex: boolean;
  cyberLeninka: boolean;
  crossref: boolean;
  googleBooks: boolean;
  /** Википедия — только справочный контекст для ИИ (в список литературы не попадает). */
  wikipedia: boolean;
  engine: WebEngine;
  searxngBase: string;
  /** Читать текст найденных страниц (для фактов практической части). */
  readPages: boolean;
  onlyRussian: boolean;
  /** E-mail для «вежливого» доступа к OpenAlex/Crossref (необязательно). */
  contactEmail: string;
}

/** Реквизиты учреждения для титульного листа и колонтитула. */
export interface InstitutionSettings {
  ministry: string;
  orgLine1: string;
  orgLine2: string;
  headerText: string;
}

/**
 * Сеть: запросы к нейросетям и базам идут через свой сервер (без ограничений CORS браузера)
 * или напрямую из браузера (для статического хостинга без сервера).
 */
export type NetMode = 'auto' | 'proxy' | 'direct';

export interface NetSettings {
  mode: NetMode;
  /** Адрес сервера-посредника; пусто — тот же сервер, откуда открыто приложение. */
  proxyBase: string;
}

export type PlagiarismMethod = 'web' | 'textru';

export interface PlagiarismSettings {
  method: PlagiarismMethod;
  /** Сколько предложений проверять поиском (метод «web»). */
  sentences: number;
}

export interface AppSettings {
  ai: AiSettings;
  search: SearchSettings;
  institution: InstitutionSettings;
  net: NetSettings;
  plagiarism: PlagiarismSettings;
  onboarded: boolean;
}

export function defaultSettings(): AppSettings {
  return {
    ai: {
      provider: '',
      models: {},
      customBase: '',
      fallbackProvider: '',
      autoSwitchModel: true,
      useGeminiSearch: false,
      gigachatScope: 'GIGACHAT_API_PERS',
    },
    search: {
      openAlex: true,
      cyberLeninka: true,
      crossref: true,
      googleBooks: true,
      wikipedia: true,
      engine: 'duckduckgo',
      searxngBase: '',
      readPages: true,
      onlyRussian: true,
      contactEmail: '',
    },
    institution: { ministry: Reg.ministry, orgLine1: Reg.orgLine1, orgLine2: Reg.orgLine2, headerText: Reg.headerText },
    net: { mode: 'auto', proxyBase: '' },
    plagiarism: { method: 'web', sentences: 12 },
    onboarded: false,
  };
}

type J = Record<string, unknown>;
const obj = (v: unknown): J => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as J) : {});
const s = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
const b = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

export function normalizeSettings(raw: unknown): AppSettings {
  const d = defaultSettings();
  const j = obj(raw);
  const ai = obj(j.ai);
  const se = obj(j.search);
  const inst = obj(j.institution);
  const net = obj(j.net);
  const pl = obj(j.plagiarism);
  const models: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj(ai.models))) if (typeof v === 'string') models[k] = v;
  const engine = (['none', 'duckduckgo', 'tavily', 'brave', 'searxng'] as WebEngine[]).includes(se.engine as WebEngine)
    ? (se.engine as WebEngine)
    : d.search.engine;
  const sentences = typeof pl.sentences === 'number' && Number.isFinite(pl.sentences) ? Math.min(30, Math.max(4, Math.round(pl.sentences))) : 12;
  return {
    ai: {
      provider: s(ai.provider, ''),
      models,
      customBase: s(ai.customBase, ''),
      fallbackProvider: s(ai.fallbackProvider, ''),
      autoSwitchModel: b(ai.autoSwitchModel, true),
      useGeminiSearch: b(ai.useGeminiSearch, false),
      gigachatScope: s(ai.gigachatScope, d.ai.gigachatScope) || d.ai.gigachatScope,
    },
    search: {
      openAlex: b(se.openAlex, true),
      cyberLeninka: b(se.cyberLeninka, true),
      crossref: b(se.crossref, true),
      googleBooks: b(se.googleBooks, true),
      wikipedia: b(se.wikipedia, true),
      engine,
      searxngBase: s(se.searxngBase, ''),
      readPages: b(se.readPages, true),
      onlyRussian: b(se.onlyRussian, true),
      contactEmail: s(se.contactEmail, ''),
    },
    institution: {
      ministry: s(inst.ministry, Reg.ministry) || Reg.ministry,
      orgLine1: s(inst.orgLine1, Reg.orgLine1) || Reg.orgLine1,
      orgLine2: s(inst.orgLine2, Reg.orgLine2) || Reg.orgLine2,
      headerText: s(inst.headerText, Reg.headerText) || Reg.headerText,
    },
    net: {
      mode: net.mode === 'proxy' || net.mode === 'direct' ? net.mode : 'auto',
      proxyBase: s(net.proxyBase, ''),
    },
    plagiarism: { method: pl.method === 'textru' ? 'textru' : 'web', sentences },
    onboarded: b(j.onboarded, false),
  };
}

export const anyLiterature = (s: SearchSettings) => s.openAlex || s.cyberLeninka || s.crossref || s.googleBooks;
