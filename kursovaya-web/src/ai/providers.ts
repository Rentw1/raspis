/**
 * Каталог сервисов ИИ с бесплатным доступом (как в «Конструкторе занятий»):
 * выбрать сервис → «Получить бесплатный ключ» → вставить ключ → «Проверить подключение».
 */

export type AuthScheme = 'bearer' | 'gigachat';
export type RussiaAccess = 'works' | 'vpn' | 'unknown';

export interface AiProvider {
  id: string;
  name: string;
  base: string;
  keyUrl: string;
  keyHint: string;
  about: string;
  /** Предпочтения при автоподборе модели (регулярные выражения по порядку). */
  prefer: string[];
  /** Для OpenRouter — только бесплатные модели с суффиксом «:free». */
  freeSuffix?: string;
  defaultModel: string;
  auth: AuthScheme;
  /** Если список моделей лежит не по адресу base/models. */
  modelsUrl?: string;
  needsKey: boolean;
  russia: RussiaAccess;
  /** Сервис принимает запросы прямо из браузера (работает и без своего сервера). */
  browserOk: boolean;
  /** Разумный предел длины ответа (токенов) для бесплатного тарифа. */
  maxOutput: number;
  /** Пошаговая подсказка, как получить ключ. */
  steps: string[];
}

export const RUSSIA_LABEL: Record<RussiaAccess, string> = {
  works: 'Работает в России без VPN',
  vpn: 'Из России может понадобиться VPN (или сервер за рубежом)',
  unknown: '',
};

/** Модели, не подходящие для текста (эмбеддинги, картинки, речь…). */
export const NON_CHAT_MODEL =
  /embed|whisper|tts|audio|image|imagen|vision-only|guard|moderation|rerank|transcri|speech|dall|flux|sdxl|video|veo|ocr|native-audio|live|computer-use|robotics|aqa|learnlm|lyria|search-preview/i;

const P = (p: Partial<AiProvider> & Pick<AiProvider, 'id' | 'name' | 'base' | 'keyUrl' | 'keyHint' | 'about' | 'prefer'>): AiProvider => ({
  defaultModel: '',
  auth: 'bearer',
  needsKey: true,
  russia: 'unknown',
  browserOk: false,
  maxOutput: 4096,
  steps: [],
  ...p,
});

export const AI_PROVIDERS: AiProvider[] = [
  P({
    id: 'gemini',
    name: 'Google Gemini',
    base: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'AIza…',
    about: 'Бесплатный ключ Google AI Studio. Сильные модели Gemini Flash, умеют искать в Google.',
    prefer: [
      '^gemini-[\\d.]+-flash$',
      '^gemini-[\\d.]+-flash(?!.*(lite|image|tts|live|audio|thinking|exp|preview))',
      'gemini.*flash(?!.*lite)',
      'gemini.*pro',
      'gemini',
    ],
    russia: 'vpn',
    browserOk: true,
    maxOutput: 8192,
    steps: ['Войдите в аккаунт Google на aistudio.google.com', 'Нажмите «Create API key»', 'Скопируйте ключ (начинается с AIza) и вставьте сюда'],
  }),
  P({
    id: 'openrouter',
    name: 'OpenRouter',
    base: 'https://openrouter.ai/api/v1',
    keyUrl: 'https://openrouter.ai/settings/keys',
    keyHint: 'sk-or-…',
    about: 'Десятки бесплатных моделей «:free» (DeepSeek, Qwen, Llama, Gemma). Около 50 запросов в день без пополнения.',
    prefer: ['deepseek.*(chat|v3|v4)', 'qwen3.*(235|480|max|next)', 'gpt-oss-120b', 'llama-3\\.3-70b|llama-4', 'kimi', 'glm', 'gemma-3.*27b', 'mistral', '.'],
    freeSuffix: ':free',
    russia: 'works',
    browserOk: true,
    steps: ['Зарегистрируйтесь на openrouter.ai (Google или e-mail)', 'Откройте Settings → Keys → «Create Key»', 'Скопируйте ключ (sk-or-…) и вставьте сюда'],
  }),
  P({
    id: 'github',
    name: 'GitHub Models',
    base: 'https://models.github.ai/inference',
    modelsUrl: 'https://models.github.ai/catalog/models',
    keyUrl: 'https://github.com/settings/personal-access-tokens/new',
    keyHint: 'github_pat_…',
    about: 'Бесплатно с аккаунтом GitHub: GPT-4.1, DeepSeek, Llama. Нужен токен с правом «Models: Read».',
    prefer: ['^openai/gpt-4\\.1$', '^openai/gpt-4o$', 'deepseek-v3', 'gpt-4\\.1-mini', 'llama', '.'],
    russia: 'works',
    maxOutput: 4000,
    steps: ['Войдите на github.com', 'Создайте Fine-grained token, в Permissions включите «Models: Read-only»', 'Скопируйте токен и вставьте сюда'],
  }),
  P({
    id: 'groq',
    name: 'Groq',
    base: 'https://api.groq.com/openai/v1',
    keyUrl: 'https://console.groq.com/keys',
    keyHint: 'gsk_…',
    about: 'Бесплатный ключ, очень быстрые открытые модели (Llama, GPT-OSS, Qwen, Kimi).',
    prefer: ['llama-3\\.3-70b', 'gpt-oss-120b', 'kimi-k2', 'qwen3?-32b', 'llama-4', 'llama', '.'],
    russia: 'vpn',
    browserOk: true,
    maxOutput: 8000,
    steps: ['Зарегистрируйтесь на console.groq.com', 'API Keys → «Create API Key»', 'Скопируйте ключ (gsk_…) и вставьте сюда'],
  }),
  P({
    id: 'hf',
    name: 'Hugging Face',
    base: 'https://router.huggingface.co/v1',
    keyUrl: 'https://huggingface.co/settings/tokens',
    keyHint: 'hf_…',
    about: 'Бесплатный токен с ежемесячным лимитом, открытые модели Qwen, DeepSeek, Llama.',
    prefer: ['deepseek-ai/deepseek-v3', 'qwen/qwen3-235b', 'qwen/qwen3', 'qwen/qwen2\\.5-72b', 'llama-3\\.3-70b', '.'],
    russia: 'works',
    browserOk: true,
    steps: ['Зарегистрируйтесь на huggingface.co', 'Settings → Access Tokens → «Create new token» (тип Read или Inference)', 'Скопируйте токен (hf_…) и вставьте сюда'],
  }),
  P({
    id: 'gigachat',
    name: 'GigaChat (Сбер)',
    base: 'https://gigachat.devices.sberbank.ru/api/v1',
    keyUrl: 'https://developers.sber.ru/studio/workspaces',
    keyHint: 'Ключ авторизации (Authorization key)',
    about: 'Российская модель, бесплатный лимит для физлиц. Работает только через свой сервер (сертификат НУЦ Минцифры).',
    prefer: ['^GigaChat-2$', '^GigaChat$', 'GigaChat-2-Pro', 'GigaChat-Pro', 'GigaChat-2-Max', 'GigaChat'],
    defaultModel: 'GigaChat-2',
    auth: 'gigachat',
    russia: 'works',
    steps: [
      'Войдите в Studio: developers.sber.ru/studio (Сбер ID)',
      'Создайте проект GigaChat API (физлицо, Freemium)',
      'В «Настройках API» нажмите «Получить ключ» и скопируйте «Ключ авторизации»',
      'Если сервер не знает сертификат Минцифры — скачайте «Russian Trusted Root CA» на gosuslugi.ru/crt и выберите файл ниже',
    ],
  }),
  P({
    id: 'mistral',
    name: 'Mistral AI',
    base: 'https://api.mistral.ai/v1',
    keyUrl: 'https://console.mistral.ai/api-keys',
    keyHint: 'ключ Mistral',
    about: 'Бесплатный тариф Experiment (нужно подтвердить телефон). Хорошо пишет по-русски.',
    prefer: ['^mistral-large-latest$', '^mistral-medium-latest$', '^mistral-small-latest$', 'mistral-large', 'mistral-medium', '.'],
    russia: 'vpn',
    steps: ['Зарегистрируйтесь на console.mistral.ai', 'Выберите бесплатный план Experiment', 'API Keys → «Create new key», скопируйте и вставьте сюда'],
  }),
  P({
    id: 'cerebras',
    name: 'Cerebras',
    base: 'https://api.cerebras.ai/v1',
    keyUrl: 'https://cloud.cerebras.ai/platform',
    keyHint: 'csk-…',
    about: 'Бесплатный доступ с дневным лимитом токенов, очень быстрые открытые модели.',
    prefer: ['gpt-oss-120b', 'qwen-3-235b', 'llama-3\\.3-70b', 'llama', '.'],
    russia: 'vpn',
    steps: ['Зарегистрируйтесь на cloud.cerebras.ai', 'API Keys → «Generate API Key»', 'Скопируйте ключ и вставьте сюда'],
  }),
  P({
    id: 'pollinations',
    name: 'Pollinations',
    base: 'https://gen.pollinations.ai/v1',
    keyUrl: 'https://enter.pollinations.ai',
    keyHint: 'sk_…',
    about: 'Бесплатные кредиты, вход через GitHub или Google.',
    prefer: ['gpt-5\\.4-nano', 'gpt-5-nano', 'openai', 'mistral', '.'],
    defaultModel: 'openai',
    russia: 'works',
    browserOk: true,
    steps: ['Откройте enter.pollinations.ai и войдите через GitHub/Google', 'Создайте ключ (sk_…)', 'Скопируйте ключ и вставьте сюда'],
  }),
  P({
    id: 'deepseek',
    name: 'DeepSeek',
    base: 'https://api.deepseek.com/v1',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    keyHint: 'sk-…',
    about: 'Очень дешёвый API (нужно пополнить баланс, иногда дают бонус). Отлично пишет по-русски.',
    prefer: ['^deepseek-chat$', 'deepseek'],
    defaultModel: 'deepseek-chat',
    russia: 'works',
    maxOutput: 8000,
    steps: ['Зарегистрируйтесь на platform.deepseek.com', 'Пополните баланс (от 2 $) или используйте бонус', 'API keys → «Create new API key», скопируйте и вставьте сюда'],
  }),
  P({
    id: 'custom',
    name: 'Свой сервер',
    base: '',
    keyUrl: '',
    keyHint: 'ключ (если нужен)',
    about: 'Любой OpenAI-совместимый адрес https://…/v1 (LM Studio, Ollama через туннель, другие сервисы).',
    prefer: ['.'],
    needsKey: false,
    browserOk: true,
  }),
];

export function providerById(id: string): AiProvider | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}
