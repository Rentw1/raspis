import '../core/regulation.dart';

/// Настройки подключения к ИИ. Ключи хранятся отдельно в защищённом хранилище.
class AiSettings {
  AiSettings({
    this.provider = '',
    Map<String, String>? models,
    this.customBase = '',
    this.fallbackProvider = '',
    this.autoSwitchModel = true,
    this.useGeminiSearch = false,
    this.gigachatScope = 'GIGACHAT_API_PERS',
  }) : models = models ?? {};

  String provider;
  Map<String, String> models;
  String customBase;

  /// Запасной сервис, если основной отказал (лимит, ошибка сервера).
  String fallbackProvider;

  /// Переключаться на другую бесплатную модель того же сервиса при лимите/перегрузке.
  bool autoSwitchModel;

  /// Для Gemini: поиск Google (grounding) при сборе фактов.
  bool useGeminiSearch;
  String gigachatScope;

  Map<String, dynamic> toJson() => {
        'provider': provider,
        'models': models,
        'customBase': customBase,
        'fallbackProvider': fallbackProvider,
        'autoSwitchModel': autoSwitchModel,
        'useGeminiSearch': useGeminiSearch,
        'gigachatScope': gigachatScope,
      };

  factory AiSettings.fromJson(Map<String, dynamic> j) => AiSettings(
        provider: j['provider'] as String? ?? '',
        models: (j['models'] as Map?)?.map((k, v) => MapEntry(k.toString(), v.toString())),
        customBase: j['customBase'] as String? ?? '',
        fallbackProvider: j['fallbackProvider'] as String? ?? '',
        autoSwitchModel: j['autoSwitchModel'] as bool? ?? true,
        useGeminiSearch: j['useGeminiSearch'] as bool? ?? false,
        gigachatScope: j['gigachatScope'] as String? ?? 'GIGACHAT_API_PERS',
      );
}

enum WebEngine { none, duckduckgo, tavily, brave, searxng }

extension WebEngineX on WebEngine {
  String get label => switch (this) {
        WebEngine.none => 'Выключен',
        WebEngine.duckduckgo => 'DuckDuckGo (без ключа)',
        WebEngine.tavily => 'Tavily (бесплатный ключ, 1000 запросов/мес)',
        WebEngine.brave => 'Brave Search (ключ)',
        WebEngine.searxng => 'SearXNG (свой адрес)',
      };

  bool get needsKey => this == WebEngine.tavily || this == WebEngine.brave;

  String get keyUrl => switch (this) {
        WebEngine.tavily => 'https://app.tavily.com/home',
        WebEngine.brave => 'https://api-dashboard.search.brave.com/app/keys',
        _ => '',
      };
}

/// Настройки поиска источников и фактов в интернете.
class SearchSettings {
  SearchSettings({
    this.openAlex = true,
    this.cyberLeninka = true,
    this.crossref = true,
    this.googleBooks = true,
    this.wikipedia = true,
    this.engine = WebEngine.duckduckgo,
    this.searxngBase = '',
    this.readPages = true,
    this.onlyRussian = true,
    this.contactEmail = '',
  });

  bool openAlex;
  bool cyberLeninka;
  bool crossref;
  bool googleBooks;

  /// Википедия — только как справочный контекст для ИИ (в список литературы не попадает).
  bool wikipedia;
  WebEngine engine;
  String searxngBase;

  /// Читать текст найденных страниц (для фактов практической части).
  bool readPages;
  bool onlyRussian;

  /// E-mail для «вежливого» доступа к OpenAlex/Crossref (необязательно).
  String contactEmail;

  bool get anyLiterature => openAlex || cyberLeninka || crossref || googleBooks;

  Map<String, dynamic> toJson() => {
        'openAlex': openAlex,
        'cyberLeninka': cyberLeninka,
        'crossref': crossref,
        'googleBooks': googleBooks,
        'wikipedia': wikipedia,
        'engine': engine.name,
        'searxngBase': searxngBase,
        'readPages': readPages,
        'onlyRussian': onlyRussian,
        'contactEmail': contactEmail,
      };

  factory SearchSettings.fromJson(Map<String, dynamic> j) => SearchSettings(
        openAlex: j['openAlex'] as bool? ?? true,
        cyberLeninka: j['cyberLeninka'] as bool? ?? true,
        crossref: j['crossref'] as bool? ?? true,
        googleBooks: j['googleBooks'] as bool? ?? true,
        wikipedia: j['wikipedia'] as bool? ?? true,
        engine: WebEngine.values.firstWhere((e) => e.name == j['engine'], orElse: () => WebEngine.duckduckgo),
        searxngBase: j['searxngBase'] as String? ?? '',
        readPages: j['readPages'] as bool? ?? true,
        onlyRussian: j['onlyRussian'] as bool? ?? true,
        contactEmail: j['contactEmail'] as String? ?? '',
      );
}

/// Реквизиты учреждения для титульного листа и колонтитула.
class InstitutionSettings {
  InstitutionSettings({
    this.ministry = Reg.ministry,
    this.orgLine1 = Reg.orgLine1,
    this.orgLine2 = Reg.orgLine2,
    this.headerText = Reg.headerText,
  });

  String ministry;
  String orgLine1;
  String orgLine2;
  String headerText;

  Map<String, dynamic> toJson() => {'ministry': ministry, 'orgLine1': orgLine1, 'orgLine2': orgLine2, 'headerText': headerText};

  factory InstitutionSettings.fromJson(Map<String, dynamic> j) => InstitutionSettings(
        ministry: j['ministry'] as String? ?? Reg.ministry,
        orgLine1: j['orgLine1'] as String? ?? Reg.orgLine1,
        orgLine2: j['orgLine2'] as String? ?? Reg.orgLine2,
        headerText: j['headerText'] as String? ?? Reg.headerText,
      );
}

class AppSettings {
  AppSettings({AiSettings? ai, SearchSettings? search, InstitutionSettings? institution, this.onboarded = false})
      : ai = ai ?? AiSettings(),
        search = search ?? SearchSettings(),
        institution = institution ?? InstitutionSettings();

  AiSettings ai;
  SearchSettings search;
  InstitutionSettings institution;
  bool onboarded;

  Map<String, dynamic> toJson() => {
        'ai': ai.toJson(),
        'search': search.toJson(),
        'institution': institution.toJson(),
        'onboarded': onboarded,
      };

  factory AppSettings.fromJson(Map<String, dynamic> j) => AppSettings(
        ai: AiSettings.fromJson(Map<String, dynamic>.from(j['ai'] as Map? ?? {})),
        search: SearchSettings.fromJson(Map<String, dynamic>.from(j['search'] as Map? ?? {})),
        institution: InstitutionSettings.fromJson(Map<String, dynamic>.from(j['institution'] as Map? ?? {})),
        onboarded: j['onboarded'] as bool? ?? false,
      );
}
