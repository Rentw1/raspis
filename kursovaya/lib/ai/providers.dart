/// Каталог сервисов ИИ с бесплатным доступом (по образцу «Конструктора занятий»):
/// выбрать сервис → «Получить бесплатный ключ» → вставить ключ → «Проверить подключение».
library;

enum AuthScheme { bearer, gigachat }

class AiProvider {
  const AiProvider({
    required this.id,
    required this.name,
    required this.base,
    required this.keyUrl,
    required this.keyHint,
    required this.about,
    required this.prefer,
    this.freeSuffix,
    this.defaultModel = '',
    this.auth = AuthScheme.bearer,
    this.modelsUrl,
    this.needsKey = true,
    this.russia = RussiaAccess.unknown,
    this.maxOutput = 4096,
    this.steps = const [],
  });

  final String id;
  final String name;
  final String base;
  final String keyUrl;
  final String keyHint;
  final String about;

  /// Предпочтения при автоподборе модели (по порядку).
  final List<String> prefer;

  /// Для OpenRouter — только бесплатные модели с суффиксом «:free».
  final String? freeSuffix;
  final String defaultModel;
  final AuthScheme auth;

  /// Если список моделей лежит не по адресу base/models.
  final String? modelsUrl;
  final bool needsKey;
  final RussiaAccess russia;

  /// Разумный предел длины ответа (токенов) для бесплатного тарифа.
  final int maxOutput;

  /// Пошаговая подсказка, как получить ключ.
  final List<String> steps;

  List<RegExp> get preferRe => prefer.map((p) => RegExp(p, caseSensitive: false)).toList();
}

enum RussiaAccess { works, vpn, unknown }

extension RussiaAccessX on RussiaAccess {
  String get label => switch (this) {
        RussiaAccess.works => 'Работает в России без VPN',
        RussiaAccess.vpn => 'Из России может понадобиться VPN',
        RussiaAccess.unknown => '',
      };
}

/// Модели, не подходящие для текста (эмбеддинги, картинки, речь…).
final RegExp nonChatModel = RegExp(
  r'embed|whisper|tts|audio|image|imagen|vision-only|guard|moderation|rerank|transcri|speech|dall|flux|sdxl|video|veo|ocr|native-audio|live|computer-use|robotics|aqa|learnlm|lyria|search-preview',
  caseSensitive: false,
);

const List<AiProvider> aiProviders = [
  AiProvider(
    id: 'gemini',
    name: 'Google Gemini',
    base: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'AIza…',
    about: 'Бесплатный ключ Google AI Studio. Сильные модели Gemini Flash, умеют искать в Google.',
    prefer: [r'^gemini-[\d.]+-flash$', r'^gemini-[\d.]+-flash(?!.*(lite|image|tts|live|audio|thinking|exp|preview))', r'gemini.*flash(?!.*lite)', r'gemini.*pro', r'gemini'],
    russia: RussiaAccess.vpn,
    maxOutput: 8192,
    steps: ['Войдите в аккаунт Google на aistudio.google.com', 'Нажмите «Create API key»', 'Скопируйте ключ (начинается с AIza) и вставьте сюда'],
  ),
  AiProvider(
    id: 'openrouter',
    name: 'OpenRouter',
    base: 'https://openrouter.ai/api/v1',
    keyUrl: 'https://openrouter.ai/settings/keys',
    keyHint: 'sk-or-…',
    about: 'Десятки бесплатных моделей «:free» (DeepSeek, Qwen, Llama, Gemma). Около 50 запросов в день без пополнения.',
    prefer: [r'deepseek.*(chat|v3|v4)', r'qwen3.*(235|480|max|next)', r'gpt-oss-120b', r'llama-3\.3-70b|llama-4', r'kimi', r'glm', r'gemma-3.*27b', r'mistral', r'.'],
    freeSuffix: ':free',
    russia: RussiaAccess.works,
    steps: ['Зарегистрируйтесь на openrouter.ai (Google или e-mail)', 'Откройте Settings → Keys → «Create Key»', 'Скопируйте ключ (sk-or-…) и вставьте сюда'],
  ),
  AiProvider(
    id: 'github',
    name: 'GitHub Models',
    base: 'https://models.github.ai/inference',
    modelsUrl: 'https://models.github.ai/catalog/models',
    keyUrl: 'https://github.com/settings/personal-access-tokens/new',
    keyHint: 'github_pat_…',
    about: 'Бесплатно с аккаунтом GitHub: GPT-4.1, DeepSeek, Llama. Нужен токен с правом «Models: Read».',
    prefer: [r'^openai/gpt-4\.1$', r'^openai/gpt-4o$', r'deepseek-v3', r'gpt-4\.1-mini', r'llama', r'.'],
    russia: RussiaAccess.works,
    maxOutput: 4000,
    steps: ['Войдите на github.com', 'Создайте Fine-grained token, в Permissions включите «Models: Read-only»', 'Скопируйте токен и вставьте сюда'],
  ),
  AiProvider(
    id: 'groq',
    name: 'Groq',
    base: 'https://api.groq.com/openai/v1',
    keyUrl: 'https://console.groq.com/keys',
    keyHint: 'gsk_…',
    about: 'Бесплатный ключ, очень быстрые открытые модели (Llama, GPT-OSS, Qwen, Kimi).',
    prefer: [r'llama-3\.3-70b', r'gpt-oss-120b', r'kimi-k2', r'qwen3?-32b', r'llama-4', r'llama', r'.'],
    russia: RussiaAccess.vpn,
    maxOutput: 8000,
    steps: ['Зарегистрируйтесь на console.groq.com', 'API Keys → «Create API Key»', 'Скопируйте ключ (gsk_…) и вставьте сюда'],
  ),
  AiProvider(
    id: 'hf',
    name: 'Hugging Face',
    base: 'https://router.huggingface.co/v1',
    keyUrl: 'https://huggingface.co/settings/tokens',
    keyHint: 'hf_…',
    about: 'Бесплатный токен с ежемесячным лимитом, открытые модели Qwen, DeepSeek, Llama.',
    prefer: [r'deepseek-ai/deepseek-v3', r'qwen/qwen3-235b', r'qwen/qwen3', r'qwen/qwen2\.5-72b', r'llama-3\.3-70b', r'.'],
    russia: RussiaAccess.works,
    steps: ['Зарегистрируйтесь на huggingface.co', 'Settings → Access Tokens → «Create new token» (тип Read или Inference)', 'Скопируйте токен (hf_…) и вставьте сюда'],
  ),
  AiProvider(
    id: 'gigachat',
    name: 'GigaChat (Сбер)',
    base: 'https://gigachat.devices.sberbank.ru/api/v1',
    keyUrl: 'https://developers.sber.ru/studio/workspaces',
    keyHint: 'Ключ авторизации (Authorization key)',
    about: 'Российская модель, бесплатный лимит для физлиц. Нужен сертификат НУЦ Минцифры (gosuslugi.ru/crt).',
    prefer: [r'^GigaChat-2$', r'^GigaChat$', r'GigaChat-2-Pro', r'GigaChat-Pro', r'GigaChat-2-Max', r'GigaChat'],
    defaultModel: 'GigaChat-2',
    auth: AuthScheme.gigachat,
    russia: RussiaAccess.works,
    steps: [
      'Войдите в Studio: developers.sber.ru/studio (Сбер ID)',
      'Создайте проект GigaChat API (физлицо, Freemium)',
      'В «Настройках API» нажмите «Получить ключ» и скопируйте «Ключ авторизации»',
      'Скачайте сертификат «Russian Trusted Root CA» на gosuslugi.ru/crt и выберите файл ниже',
    ],
  ),
  AiProvider(
    id: 'mistral',
    name: 'Mistral AI',
    base: 'https://api.mistral.ai/v1',
    keyUrl: 'https://console.mistral.ai/api-keys',
    keyHint: 'ключ Mistral',
    about: 'Бесплатный тариф Experiment (нужно подтвердить телефон). Хорошо пишет по-русски.',
    prefer: [r'^mistral-large-latest$', r'^mistral-medium-latest$', r'^mistral-small-latest$', r'mistral-large', r'mistral-medium', r'.'],
    russia: RussiaAccess.vpn,
    steps: ['Зарегистрируйтесь на console.mistral.ai', 'Выберите бесплатный план Experiment', 'API Keys → «Create new key», скопируйте и вставьте сюда'],
  ),
  AiProvider(
    id: 'cerebras',
    name: 'Cerebras',
    base: 'https://api.cerebras.ai/v1',
    keyUrl: 'https://cloud.cerebras.ai/platform',
    keyHint: 'csk-…',
    about: 'Бесплатный доступ с дневным лимитом токенов, очень быстрые открытые модели.',
    prefer: [r'gpt-oss-120b', r'qwen-3-235b', r'llama-3\.3-70b', r'llama', r'.'],
    russia: RussiaAccess.vpn,
    steps: ['Зарегистрируйтесь на cloud.cerebras.ai', 'API Keys → «Generate API Key»', 'Скопируйте ключ и вставьте сюда'],
  ),
  AiProvider(
    id: 'pollinations',
    name: 'Pollinations',
    base: 'https://gen.pollinations.ai/v1',
    keyUrl: 'https://enter.pollinations.ai',
    keyHint: 'sk_…',
    about: 'Бесплатные кредиты, вход через GitHub или Google.',
    prefer: [r'gpt-5\.4-nano', r'gpt-5-nano', r'openai', r'mistral', r'.'],
    defaultModel: 'openai',
    russia: RussiaAccess.works,
    steps: ['Откройте enter.pollinations.ai и войдите через GitHub/Google', 'Создайте ключ (sk_…)', 'Скопируйте ключ и вставьте сюда'],
  ),
  AiProvider(
    id: 'deepseek',
    name: 'DeepSeek',
    base: 'https://api.deepseek.com/v1',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    keyHint: 'sk-…',
    about: 'Очень дешёвый API (нужно пополнить баланс, иногда дают бонус). Отлично пишет по-русски.',
    prefer: [r'^deepseek-chat$', r'deepseek'],
    defaultModel: 'deepseek-chat',
    russia: RussiaAccess.works,
    maxOutput: 8000,
    steps: ['Зарегистрируйтесь на platform.deepseek.com', 'Пополните баланс (от 2 \$) или используйте бонус', 'API keys → «Create new API key», скопируйте и вставьте сюда'],
  ),
  AiProvider(
    id: 'custom',
    name: 'Свой сервер',
    base: '',
    keyUrl: '',
    keyHint: 'ключ (если нужен)',
    about: 'Любой OpenAI-совместимый адрес https://…/v1 (LM Studio, Ollama через туннель, другие сервисы).',
    prefer: [r'.'],
    needsKey: false,
  ),
];

AiProvider? providerById(String id) {
  for (final p in aiProviders) {
    if (p.id == id) return p;
  }
  return null;
}
