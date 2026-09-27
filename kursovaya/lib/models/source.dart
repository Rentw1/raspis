import '../core/text_utils.dart';

enum SourceType { article, book, normative, web, other }

extension SourceTypeX on SourceType {
  String get label => switch (this) {
        SourceType.article => 'Статья',
        SourceType.book => 'Книга',
        SourceType.normative => 'Нормативный акт',
        SourceType.web => 'Сайт',
        SourceType.other => 'Другое',
      };
}

/// Откуда взят источник.
class SourceOrigin {
  static const openAlex = 'OpenAlex';
  static const crossref = 'Crossref';
  static const cyberLeninka = 'КиберЛенинка';
  static const googleBooks = 'Google Книги';
  static const web = 'Интернет';
  static const ai = 'ИИ';
  static const manual = 'Вручную';
}

/// Библиографический источник (для списка литературы по ГОСТ 7.1-2003).
class Source {
  Source({
    required this.id,
    required this.type,
    required this.title,
    List<String>? authors,
    this.subtitle,
    this.container,
    this.city,
    this.publisher,
    this.year,
    this.volume,
    this.issue,
    this.pages,
    this.pageCount,
    this.url,
    this.doi,
    this.isbn,
    this.annotation,
    this.origin = SourceOrigin.manual,
    this.verified = false,
    this.selected = true,
    this.manual,
    this.docKind,
    this.docDate,
    this.docNumber,
    this.accessed,
    this.note,
    this.score = 0,
    this.siteName,
  }) : authors = authors ?? [];

  final String id;
  SourceType type;

  /// Авторы в виде «Фамилия И. О.».
  List<String> authors;
  String title;
  String? subtitle;

  /// Журнал / сборник (для статей), сайт — для веб-ресурсов.
  String? container;
  String? city;
  String? publisher;
  int? year;
  String? volume;
  String? issue;

  /// Страницы статьи: «45–52».
  String? pages;

  /// Объём книги в страницах.
  int? pageCount;
  String? url;
  String? doi;
  String? isbn;

  /// Аннотация / фрагмент текста — контекст для ИИ.
  String? annotation;
  String origin;

  /// true — найден в реальной базе (OpenAlex, КиберЛенинка…) или подтверждён поиском.
  bool verified;
  bool selected;

  /// Готовое описание по ГОСТ, введённое вручную (заменяет автоматическое).
  String? manual;

  // Нормативные акты
  String? docKind;
  String? docDate;
  String? docNumber;
  DateTime? accessed;
  String? note;
  double score;
  String? siteName;

  bool get isElectronic => url != null && url!.isNotEmpty && (type == SourceType.web || origin == SourceOrigin.cyberLeninka || type == SourceType.normative);

  /// Ключ для поиска дублей.
  String get dedupKey {
    if (doi != null && doi!.isNotEmpty) return 'doi:${doi!.toLowerCase()}';
    final t = title.toLowerCase().replaceAll('ё', 'е').replaceAll(RegExp(r'[^a-zа-я0-9]'), '');
    return 't:${t.length > 60 ? t.substring(0, 60) : t}';
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type.name,
        'authors': authors,
        'title': title,
        'subtitle': subtitle,
        'container': container,
        'city': city,
        'publisher': publisher,
        'year': year,
        'volume': volume,
        'issue': issue,
        'pages': pages,
        'pageCount': pageCount,
        'url': url,
        'doi': doi,
        'isbn': isbn,
        'annotation': annotation,
        'origin': origin,
        'verified': verified,
        'selected': selected,
        'manual': manual,
        'docKind': docKind,
        'docDate': docDate,
        'docNumber': docNumber,
        'accessed': accessed?.toIso8601String(),
        'note': note,
        'score': score,
        'siteName': siteName,
      };

  factory Source.fromJson(Map<String, dynamic> j) => Source(
        id: j['id'] as String? ?? newId('s'),
        type: SourceType.values.firstWhere((e) => e.name == j['type'], orElse: () => SourceType.other),
        authors: (j['authors'] as List?)?.map((e) => e.toString()).toList(),
        title: j['title'] as String? ?? '',
        subtitle: j['subtitle'] as String?,
        container: j['container'] as String?,
        city: j['city'] as String?,
        publisher: j['publisher'] as String?,
        year: j['year'] as int?,
        volume: j['volume'] as String?,
        issue: j['issue'] as String?,
        pages: j['pages'] as String?,
        pageCount: j['pageCount'] as int?,
        url: j['url'] as String?,
        doi: j['doi'] as String?,
        isbn: j['isbn'] as String?,
        annotation: j['annotation'] as String?,
        origin: j['origin'] as String? ?? SourceOrigin.manual,
        verified: j['verified'] as bool? ?? false,
        selected: j['selected'] as bool? ?? true,
        manual: j['manual'] as String?,
        docKind: j['docKind'] as String?,
        docDate: j['docDate'] as String?,
        docNumber: j['docNumber'] as String?,
        accessed: DateTime.tryParse(j['accessed'] as String? ?? ''),
        note: j['note'] as String?,
        score: (j['score'] as num?)?.toDouble() ?? 0,
        siteName: j['siteName'] as String?,
      );

  Source copy() => Source.fromJson(toJson());
}
