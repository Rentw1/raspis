import '../core/regulation.dart';
import '../core/text_utils.dart';
import 'source.dart';

/// Данные титульного листа (ПРИЛОЖЕНИЕ 4 регламента).
class Meta {
  Meta({
    this.topic = '',
    this.studentName = '',
    this.group = '',
    this.course = 2,
    this.specialty = '',
    this.discipline = '',
    this.supervisor = '',
    String? academicYear,
    this.organization = '',
    this.wishes = '',
    this.practiceData = '',
  }) : academicYear = academicYear ?? Reg.academicYear(DateTime.now());

  String topic;
  String studentName;
  String group;
  int course;
  String specialty;
  String discipline;
  String supervisor;
  String academicYear;

  /// База практики / организация для практической части (необязательно).
  String organization;

  /// Пожелания к содержанию.
  String wishes;

  /// Фактические данные для анализа в практической главе (цифры из отчётности и т. п.).
  String practiceData;

  List<String> get missingForTitle => [
        if (topic.trim().isEmpty) 'тема',
        if (studentName.trim().isEmpty) 'ФИО студента',
        if (group.trim().isEmpty) 'группа',
        if (specialty.trim().isEmpty) 'специальность',
        if (discipline.trim().isEmpty) 'дисциплина',
        if (supervisor.trim().isEmpty) 'ФИО руководителя',
      ];

  Map<String, dynamic> toJson() => {
        'topic': topic,
        'studentName': studentName,
        'group': group,
        'course': course,
        'specialty': specialty,
        'discipline': discipline,
        'supervisor': supervisor,
        'academicYear': academicYear,
        'organization': organization,
        'wishes': wishes,
        'practiceData': practiceData,
      };

  factory Meta.fromJson(Map<String, dynamic> j) => Meta(
        topic: j['topic'] as String? ?? '',
        studentName: j['studentName'] as String? ?? '',
        group: j['group'] as String? ?? '',
        course: j['course'] as int? ?? 2,
        specialty: j['specialty'] as String? ?? '',
        discipline: j['discipline'] as String? ?? '',
        supervisor: j['supervisor'] as String? ?? '',
        academicYear: j['academicYear'] as String?,
        organization: j['organization'] as String? ?? '',
        wishes: j['wishes'] as String? ?? '',
        practiceData: j['practiceData'] as String? ?? '',
      );
}

enum SignaturePlace { afterBibliography, endOfWork }

/// Тонкие настройки генерации.
class GenOptions {
  GenOptions({
    this.theoryPercent = 45,
    this.chapters = 2,
    this.targetPages = 25,
    this.tables = true,
    this.maxTables = 3,
    this.appendices = true,
    this.appendixCount = 2,
    this.internetSources = true,
    this.webFacts = true,
    this.normativeActs = true,
    this.sourcesCount = 20,
    this.recentYears = 7,
    this.excludeTextbooks = true,
    this.creativity = 0.5,
    this.signature = SignaturePlace.afterBibliography,
  });

  /// Доля теории в основной части, %.
  int theoryPercent;
  int chapters;

  /// Желаемый объём без приложений, страниц (15–30).
  int targetPages;
  bool tables;
  int maxTables;
  bool appendices;
  int appendixCount;
  bool internetSources;
  bool webFacts;
  bool normativeActs;
  int sourcesCount;

  /// Предпочтительная «свежесть» литературы, лет.
  int recentYears;
  bool excludeTextbooks;
  double creativity;
  SignaturePlace signature;

  Map<String, dynamic> toJson() => {
        'theoryPercent': theoryPercent,
        'chapters': chapters,
        'targetPages': targetPages,
        'tables': tables,
        'maxTables': maxTables,
        'appendices': appendices,
        'appendixCount': appendixCount,
        'internetSources': internetSources,
        'webFacts': webFacts,
        'normativeActs': normativeActs,
        'sourcesCount': sourcesCount,
        'recentYears': recentYears,
        'excludeTextbooks': excludeTextbooks,
        'creativity': creativity,
        'signature': signature.name,
      };

  factory GenOptions.fromJson(Map<String, dynamic> j) => GenOptions(
        theoryPercent: (j['theoryPercent'] as int? ?? 45).clamp(25, 75),
        chapters: (j['chapters'] as int? ?? 2).clamp(Reg.minChapters, Reg.maxChapters),
        targetPages: (j['targetPages'] as int? ?? 25).clamp(Reg.minPages, Reg.maxPages),
        tables: j['tables'] as bool? ?? true,
        maxTables: (j['maxTables'] as int? ?? 3).clamp(1, 8),
        appendices: j['appendices'] as bool? ?? true,
        appendixCount: (j['appendixCount'] as int? ?? 2).clamp(1, 5),
        internetSources: j['internetSources'] as bool? ?? true,
        webFacts: j['webFacts'] as bool? ?? true,
        normativeActs: j['normativeActs'] as bool? ?? true,
        sourcesCount: (j['sourcesCount'] as int? ?? 20).clamp(8, 40),
        recentYears: (j['recentYears'] as int? ?? 7).clamp(3, 30),
        excludeTextbooks: j['excludeTextbooks'] as bool? ?? true,
        creativity: (j['creativity'] as num? ?? 0.5).toDouble().clamp(0.1, 1.0),
        signature: SignaturePlace.values.firstWhere((e) => e.name == j['signature'], orElse: () => SignaturePlace.afterBibliography),
      );
}

class PlanChapter {
  PlanChapter({required this.title, this.role = 'theory', List<String>? points, List<String>? tables})
      : points = points ?? [],
        tables = tables ?? [];
  String title;

  /// theory | practice
  String role;
  List<String> points;
  List<String> tables;

  Map<String, dynamic> toJson() => {'title': title, 'role': role, 'points': points, 'tables': tables};

  factory PlanChapter.fromJson(Map<String, dynamic> j) => PlanChapter(
        title: j['title'] as String? ?? '',
        role: j['role'] as String? ?? 'theory',
        points: (j['points'] as List?)?.map((e) => e.toString()).toList(),
        tables: (j['tables'] as List?)?.map((e) => e.toString()).toList(),
      );
}

class PlanAppendix {
  PlanAppendix({required this.title, this.content = '', this.chapter = 2});
  String title;
  String content;

  /// В какой главе сослаться на приложение.
  int chapter;

  Map<String, dynamic> toJson() => {'title': title, 'content': content, 'chapter': chapter};

  factory PlanAppendix.fromJson(Map<String, dynamic> j) => PlanAppendix(
        title: j['title'] as String? ?? '',
        content: j['content'] as String? ?? '',
        chapter: j['chapter'] as int? ?? 2,
      );
}

/// План работы (составляется ИИ, можно править вручную).
class Plan {
  Plan({
    this.object = '',
    this.subject = '',
    this.goal = '',
    List<String>? tasks,
    List<String>? methods,
    List<String>? keywords,
    List<String>? searchQueries,
    List<PlanChapter>? chapters,
    List<PlanAppendix>? appendices,
  })  : tasks = tasks ?? [],
        methods = methods ?? [],
        keywords = keywords ?? [],
        searchQueries = searchQueries ?? [],
        chapters = chapters ?? [],
        appendices = appendices ?? [];

  String object;
  String subject;
  String goal;
  List<String> tasks;
  List<String> methods;
  List<String> keywords;
  List<String> searchQueries;
  List<PlanChapter> chapters;
  List<PlanAppendix> appendices;

  Map<String, dynamic> toJson() => {
        'object': object,
        'subject': subject,
        'goal': goal,
        'tasks': tasks,
        'methods': methods,
        'keywords': keywords,
        'searchQueries': searchQueries,
        'chapters': chapters.map((e) => e.toJson()).toList(),
        'appendices': appendices.map((e) => e.toJson()).toList(),
      };

  factory Plan.fromJson(Map<String, dynamic> j) => Plan(
        object: j['object'] as String? ?? '',
        subject: j['subject'] as String? ?? '',
        goal: j['goal'] as String? ?? '',
        tasks: (j['tasks'] as List?)?.map((e) => e.toString()).toList(),
        methods: (j['methods'] as List?)?.map((e) => e.toString()).toList(),
        keywords: (j['keywords'] as List?)?.map((e) => e.toString()).toList(),
        searchQueries: (j['searchQueries'] as List?)?.map((e) => e.toString()).toList(),
        chapters: (j['chapters'] as List?)?.map((e) => PlanChapter.fromJson(Map<String, dynamic>.from(e as Map))).toList(),
        appendices: (j['appendices'] as List?)?.map((e) => PlanAppendix.fromJson(Map<String, dynamic>.from(e as Map))).toList(),
      );
}

enum SectionKind { introduction, chapter, conclusion }

enum PartStatus { pending, running, done, error }

/// Структурная часть: введение, глава, заключение. Текст хранится в простой разметке:
/// абзацы через пустую строку, перечисления — строки с «– », таблицы — строка
/// «Таблица N — Название» и строки вида «| … | … |».
class Section {
  Section({
    required this.id,
    required this.kind,
    this.number = 0,
    this.title = '',
    this.role = 'theory',
    this.text = '',
    this.targetWords = 0,
    this.status = PartStatus.pending,
    this.error,
    List<String>? parts,
  }) : parts = parts ?? [];

  final String id;
  final SectionKind kind;
  int number;
  String title;
  String role;
  String text;
  int targetWords;
  PartStatus status;
  String? error;

  /// Сгенерированные части (для продолжения после обрыва).
  List<String> parts;

  String get heading => switch (kind) {
        SectionKind.introduction => Reg.introTitle,
        SectionKind.conclusion => Reg.conclusionTitle,
        SectionKind.chapter => Reg.chapterHeading(number, title),
      };

  String get shortName => switch (kind) {
        SectionKind.introduction => 'Введение',
        SectionKind.conclusion => 'Заключение',
        SectionKind.chapter => 'Глава $number',
      };

  int get words => wordCount(text);

  Map<String, dynamic> toJson() => {
        'id': id,
        'kind': kind.name,
        'number': number,
        'title': title,
        'role': role,
        'text': text,
        'targetWords': targetWords,
        'status': status.name,
        'error': error,
        'parts': parts,
      };

  factory Section.fromJson(Map<String, dynamic> j) => Section(
        id: j['id'] as String? ?? newId('sec'),
        kind: SectionKind.values.firstWhere((e) => e.name == j['kind'], orElse: () => SectionKind.chapter),
        number: j['number'] as int? ?? 0,
        title: j['title'] as String? ?? '',
        role: j['role'] as String? ?? 'theory',
        text: j['text'] as String? ?? '',
        targetWords: j['targetWords'] as int? ?? 0,
        status: PartStatus.values.firstWhere((e) => e.name == j['status'], orElse: () => PartStatus.pending),
        error: j['error'] as String?,
        parts: (j['parts'] as List?)?.map((e) => e.toString()).toList(),
      );
}

class Appendix {
  Appendix({required this.id, required this.number, this.title = '', this.text = '', this.status = PartStatus.pending, this.error, this.brief = '', this.chapter = 2});

  final String id;
  int number;
  String title;
  String text;
  PartStatus status;
  String? error;

  /// Что должно быть в приложении (из плана).
  String brief;
  int chapter;

  Map<String, dynamic> toJson() => {
        'id': id,
        'number': number,
        'title': title,
        'text': text,
        'status': status.name,
        'error': error,
        'brief': brief,
        'chapter': chapter,
      };

  factory Appendix.fromJson(Map<String, dynamic> j) => Appendix(
        id: j['id'] as String? ?? newId('app'),
        number: j['number'] as int? ?? 1,
        title: j['title'] as String? ?? '',
        text: j['text'] as String? ?? '',
        status: PartStatus.values.firstWhere((e) => e.name == j['status'], orElse: () => PartStatus.pending),
        error: j['error'] as String?,
        brief: j['brief'] as String? ?? '',
        chapter: j['chapter'] as int? ?? 2,
      );
}

/// Факт из интернета для практической части.
class WebFact {
  WebFact({required this.text, this.url = '', this.sourceTitle = ''});
  final String text;
  final String url;
  final String sourceTitle;

  Map<String, dynamic> toJson() => {'text': text, 'url': url, 'sourceTitle': sourceTitle};
  factory WebFact.fromJson(Map<String, dynamic> j) =>
      WebFact(text: j['text'] as String? ?? '', url: j['url'] as String? ?? '', sourceTitle: j['sourceTitle'] as String? ?? '');
}

/// Результат вёрстки (страницы разделов) — для оглавления и проверки объёма.
class LayoutInfo {
  LayoutInfo({
    this.totalPages = 0,
    this.mainPages = 0,
    Map<String, int>? startPage,
    Map<String, double>? volume,
    DateTime? at,
  })  : startPage = startPage ?? {},
        volume = volume ?? {},
        at = at ?? DateTime.now();

  int totalPages;

  /// Страниц без приложений (включая титульный лист).
  int mainPages;
  Map<String, int> startPage;

  /// Объём раздела в страницах (с дробной частью).
  Map<String, double> volume;
  DateTime at;

  Map<String, dynamic> toJson() => {
        'totalPages': totalPages,
        'mainPages': mainPages,
        'startPage': startPage,
        'volume': volume,
        'at': at.toIso8601String(),
      };

  factory LayoutInfo.fromJson(Map<String, dynamic> j) => LayoutInfo(
        totalPages: j['totalPages'] as int? ?? 0,
        mainPages: j['mainPages'] as int? ?? 0,
        startPage: (j['startPage'] as Map?)?.map((k, v) => MapEntry(k.toString(), (v as num).toInt())),
        volume: (j['volume'] as Map?)?.map((k, v) => MapEntry(k.toString(), (v as num).toDouble())),
        at: DateTime.tryParse(j['at'] as String? ?? ''),
      );
}

class Coursework {
  Coursework({
    required this.id,
    DateTime? created,
    DateTime? updated,
    Meta? meta,
    GenOptions? options,
    this.plan,
    List<Source>? sources,
    List<Section>? sections,
    List<Appendix>? appendices,
    List<WebFact>? facts,
    this.wikiContext = '',
    Map<String, String>? steps,
    this.layout,
    this.aiReview,
    this.generatedBy = '',
  })  : created = created ?? DateTime.now(),
        updated = updated ?? DateTime.now(),
        meta = meta ?? Meta(),
        options = options ?? GenOptions(),
        sources = sources ?? [],
        sections = sections ?? [],
        appendices = appendices ?? [],
        facts = facts ?? [],
        steps = steps ?? {};

  final String id;
  final DateTime created;
  DateTime updated;
  Meta meta;
  GenOptions options;
  Plan? plan;
  List<Source> sources;
  List<Section> sections;
  List<Appendix> appendices;
  List<WebFact> facts;
  String wikiContext;

  /// Состояние шагов генерации: id шага → done | error.
  Map<String, String> steps;
  LayoutInfo? layout;
  String? aiReview;
  String generatedBy;

  List<Source> get selectedSources => sources.where((s) => s.selected).toList();

  Section? get introduction => sections.where((s) => s.kind == SectionKind.introduction).firstOrNull;
  Section? get conclusion => sections.where((s) => s.kind == SectionKind.conclusion).firstOrNull;
  List<Section> get chapters => sections.where((s) => s.kind == SectionKind.chapter).toList()..sort((a, b) => a.number.compareTo(b.number));

  /// Разделы в порядке следования в работе.
  List<Section> get orderedSections => [?introduction, ...chapters, ?conclusion];

  bool get hasText => sections.any((s) => s.text.trim().isNotEmpty);

  int get totalWords => sections.fold(0, (a, s) => a + s.words);

  String get title => meta.topic.trim().isEmpty ? 'Без темы' : meta.topic.trim();

  Map<String, dynamic> toJson() => {
        'id': id,
        'created': created.toIso8601String(),
        'updated': updated.toIso8601String(),
        'meta': meta.toJson(),
        'options': options.toJson(),
        'plan': plan?.toJson(),
        'sources': sources.map((e) => e.toJson()).toList(),
        'sections': sections.map((e) => e.toJson()).toList(),
        'appendices': appendices.map((e) => e.toJson()).toList(),
        'facts': facts.map((e) => e.toJson()).toList(),
        'wikiContext': wikiContext,
        'steps': steps,
        'layout': layout?.toJson(),
        'aiReview': aiReview,
        'generatedBy': generatedBy,
        'version': 1,
      };

  factory Coursework.fromJson(Map<String, dynamic> j) => Coursework(
        id: j['id'] as String? ?? newId('cw'),
        created: DateTime.tryParse(j['created'] as String? ?? ''),
        updated: DateTime.tryParse(j['updated'] as String? ?? ''),
        meta: Meta.fromJson(Map<String, dynamic>.from(j['meta'] as Map? ?? {})),
        options: GenOptions.fromJson(Map<String, dynamic>.from(j['options'] as Map? ?? {})),
        plan: j['plan'] == null ? null : Plan.fromJson(Map<String, dynamic>.from(j['plan'] as Map)),
        sources: (j['sources'] as List?)?.map((e) => Source.fromJson(Map<String, dynamic>.from(e as Map))).toList(),
        sections: (j['sections'] as List?)?.map((e) => Section.fromJson(Map<String, dynamic>.from(e as Map))).toList(),
        appendices: (j['appendices'] as List?)?.map((e) => Appendix.fromJson(Map<String, dynamic>.from(e as Map))).toList(),
        facts: (j['facts'] as List?)?.map((e) => WebFact.fromJson(Map<String, dynamic>.from(e as Map))).toList(),
        wikiContext: j['wikiContext'] as String? ?? '',
        steps: (j['steps'] as Map?)?.map((k, v) => MapEntry(k.toString(), v.toString())),
        layout: j['layout'] == null ? null : LayoutInfo.fromJson(Map<String, dynamic>.from(j['layout'] as Map)),
        aiReview: j['aiReview'] as String?,
        generatedBy: j['generatedBy'] as String? ?? '',
      );

  Coursework copyAsNew() {
    final j = toJson();
    j['id'] = newId('cw');
    j['created'] = DateTime.now().toIso8601String();
    final c = Coursework.fromJson(j);
    return c;
  }
}
