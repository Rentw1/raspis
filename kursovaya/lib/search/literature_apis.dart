import 'dart:convert';

import '../core/net.dart';
import '../core/text_utils.dart';
import '../models/source.dart';

/// Клиенты открытых библиографических баз. Каждый возвращает список [Source]
/// с реальными выходными данными (без ключей API).
abstract class LiteratureApi {
  String get name;
  Future<List<Source>> search(Net net, String query, {int limit = 20, int? fromYear});
}

// ---------------- OpenAlex ----------------

class OpenAlexApi implements LiteratureApi {
  OpenAlexApi({this.email = '', this.onlyRussian = true});
  final String email;
  final bool onlyRussian;

  @override
  String get name => SourceOrigin.openAlex;

  @override
  Future<List<Source>> search(Net net, String query, {int limit = 20, int? fromYear}) async {
    final filters = <String>[
      'type:article|book|book-chapter|review',
      if (onlyRussian) 'language:ru',
      if (fromYear != null) 'from_publication_date:$fromYear-01-01',
    ];
    final url = Uri.https('api.openalex.org', '/works', {
      'search': query,
      'filter': filters.join(','),
      'per_page': '$limit',
      'select': 'id,doi,display_name,publication_year,authorships,primary_location,biblio,type,language,abstract_inverted_index,cited_by_count',
      if (email.isNotEmpty) 'mailto': email,
    });
    final j = await net.getJson(url);
    return parse(j);
  }

  static String abstractFromIndex(dynamic idx) {
    if (idx is! Map) return '';
    final words = <int, String>{};
    idx.forEach((w, pos) {
      if (pos is List) {
        for (final p in pos) {
          if (p is int) words[p] = w.toString();
        }
      }
    });
    final keys = words.keys.toList()..sort();
    return keys.map((k) => words[k]).join(' ');
  }

  static List<Source> parse(dynamic j) {
    final out = <Source>[];
    final results = j is Map ? j['results'] as List? ?? const [] : const [];
    for (final r in results) {
      if (r is! Map) continue;
      final title = (r['display_name'] ?? r['title'] ?? '').toString().trim();
      if (title.length < 6) continue;
      final type = r['type']?.toString() ?? 'article';
      final loc = r['primary_location'] as Map?;
      final src = loc?['source'] as Map?;
      final biblio = r['biblio'] as Map? ?? const {};
      final fp = biblio['first_page']?.toString();
      final lp = biblio['last_page']?.toString();
      String? pages;
      if (fp != null && fp.isNotEmpty) pages = lp != null && lp.isNotEmpty && lp != fp ? '$fp–$lp' : fp;
      final doiUrl = r['doi']?.toString();
      final doi = doiUrl?.replaceFirst(RegExp(r'^https?://(dx\.)?doi\.org/'), '');
      final authors = <String>[];
      for (final a in (r['authorships'] as List? ?? const [])) {
        final author = a is Map ? a['author'] : null;
        final n = author is Map ? author['display_name']?.toString() : null;
        if (n != null && n.trim().isNotEmpty) authors.add(parsePersonName(n).surnameInitials);
      }
      final isBook = type == 'book';
      out.add(Source(
        id: newId('oa'),
        type: isBook ? SourceType.book : SourceType.article,
        title: title,
        authors: authors,
        container: isBook ? null : src?['display_name']?.toString(),
        publisher: src?['host_organization_name']?.toString(),
        year: r['publication_year'] is int ? r['publication_year'] as int : null,
        volume: biblio['volume']?.toString(),
        issue: biblio['issue']?.toString(),
        pages: isBook ? null : pages,
        doi: doi,
        url: doiUrl ?? loc?['landing_page_url']?.toString(),
        annotation: truncate(abstractFromIndex(r['abstract_inverted_index']), 700),
        origin: SourceOrigin.openAlex,
        verified: true,
        score: ((r['cited_by_count'] as num?)?.toDouble() ?? 0).clamp(0, 50) / 50,
      ));
    }
    return out;
  }
}

// ---------------- Crossref ----------------

class CrossrefApi implements LiteratureApi {
  CrossrefApi({this.email = '', this.onlyRussian = true});
  final String email;
  final bool onlyRussian;

  @override
  String get name => SourceOrigin.crossref;

  @override
  Future<List<Source>> search(Net net, String query, {int limit = 20, int? fromYear}) async {
    final url = Uri.https('api.crossref.org', '/works', {
      'query.bibliographic': query,
      'rows': '$limit',
      'filter': ['type:journal-article', if (fromYear != null) 'from-pub-date:$fromYear'].join(','),
      'select': 'DOI,title,author,issued,container-title,page,volume,issue,publisher,type,abstract,URL',
      if (email.isNotEmpty) 'mailto': email,
    });
    final j = await net.getJson(url, headers: {'User-Agent': '${Net.appUa}${email.isNotEmpty ? ' (mailto:$email)' : ''}'});
    final list = parse(j);
    return onlyRussian ? list.where((s) => hasCyrillic(s.title)).toList() : list;
  }

  static List<Source> parse(dynamic j) {
    final out = <Source>[];
    final items = j is Map ? ((j['message'] as Map?)?['items'] as List? ?? const []) : const [];
    for (final it in items) {
      if (it is! Map) continue;
      final titles = it['title'] as List? ?? const [];
      if (titles.isEmpty) continue;
      final title = stripHtml(titles.first.toString());
      if (title.length < 6) continue;
      final authors = <String>[];
      for (final a in (it['author'] as List? ?? const [])) {
        if (a is! Map) continue;
        final fam = (a['family'] ?? '').toString().trim();
        final giv = (a['given'] ?? '').toString().trim();
        if (fam.isEmpty && (a['name'] ?? '').toString().isEmpty) continue;
        authors.add(parsePersonName(fam.isEmpty ? a['name'].toString() : '$fam, $giv').surnameInitials);
      }
      int? year;
      final issued = it['issued'] as Map?;
      final dp = issued?['date-parts'] as List?;
      if (dp != null && dp.isNotEmpty && dp.first is List && (dp.first as List).isNotEmpty) {
        final y = (dp.first as List).first;
        if (y is int) year = y;
      }
      final containers = it['container-title'] as List? ?? const [];
      out.add(Source(
        id: newId('cr'),
        type: SourceType.article,
        title: title,
        authors: authors,
        container: containers.isEmpty ? null : stripHtml(containers.first.toString()),
        publisher: it['publisher']?.toString(),
        year: year,
        volume: it['volume']?.toString(),
        issue: it['issue']?.toString(),
        pages: it['page']?.toString(),
        doi: it['DOI']?.toString(),
        url: it['URL']?.toString(),
        annotation: truncate(stripHtml((it['abstract'] ?? '').toString()), 700),
        origin: SourceOrigin.crossref,
        verified: true,
      ));
    }
    return out;
  }
}

// ---------------- КиберЛенинка ----------------

class CyberLeninkaApi implements LiteratureApi {
  @override
  String get name => SourceOrigin.cyberLeninka;

  @override
  Future<List<Source>> search(Net net, String query, {int limit = 20, int? fromYear}) async {
    final r = await net.post(
      Uri.https('cyberleninka.ru', '/api/search'),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': Net.browserUa,
        'Origin': 'https://cyberleninka.ru',
        'Referer': 'https://cyberleninka.ru/search?q=${Uri.encodeQueryComponent(query)}',
      },
      body: jsonEncode({'mode': 'articles', 'q': query, 'size': limit, 'from': 0}),
    );
    final list = parse(Net.decodeJson(r));
    return fromYear == null ? list : list.where((s) => s.year == null || s.year! >= fromYear).toList();
  }

  static List<Source> parse(dynamic j) {
    final out = <Source>[];
    final arts = j is Map ? j['articles'] as List? ?? const [] : const [];
    for (final a in arts) {
      if (a is! Map) continue;
      final title = stripHtml((a['name'] ?? '').toString());
      if (title.length < 6) continue;
      final link = (a['link'] ?? '').toString();
      final authors = (a['authors'] as List? ?? const []).map((e) => parsePersonName(e.toString()).surnameInitials).where((e) => e.isNotEmpty).toList();
      out.add(Source(
        id: newId('cl'),
        type: SourceType.article,
        title: title,
        authors: authors,
        container: a['journal'] == null ? null : stripHtml(a['journal'].toString()),
        year: a['year'] is int ? a['year'] as int : int.tryParse('${a['year']}'),
        url: link.isEmpty ? null : (link.startsWith('http') ? link : 'https://cyberleninka.ru$link'),
        annotation: truncate(stripHtml((a['annotation'] ?? '').toString()), 700),
        origin: SourceOrigin.cyberLeninka,
        verified: true,
        accessed: DateTime.now(),
      ));
    }
    return out;
  }
}

// ---------------- Google Книги ----------------

class GoogleBooksApi implements LiteratureApi {
  GoogleBooksApi({this.onlyRussian = true});
  final bool onlyRussian;

  @override
  String get name => SourceOrigin.googleBooks;

  @override
  Future<List<Source>> search(Net net, String query, {int limit = 20, int? fromYear}) async {
    final url = Uri.https('www.googleapis.com', '/books/v1/volumes', {
      'q': query,
      if (onlyRussian) 'langRestrict': 'ru',
      'printType': 'books',
      'maxResults': '${limit.clamp(1, 40)}',
      'orderBy': 'relevance',
    });
    final list = parse(await net.getJson(url));
    return fromYear == null ? list : list.where((s) => s.year == null || s.year! >= fromYear - 5).toList();
  }

  static List<Source> parse(dynamic j) {
    final out = <Source>[];
    final items = j is Map ? j['items'] as List? ?? const [] : const [];
    for (final it in items) {
      if (it is! Map) continue;
      final vi = it['volumeInfo'] as Map?;
      if (vi == null) continue;
      final title = (vi['title'] ?? '').toString().trim();
      if (title.length < 4) continue;
      final date = (vi['publishedDate'] ?? '').toString();
      final year = int.tryParse(RegExp(r'\d{4}').firstMatch(date)?.group(0) ?? '');
      String? isbn;
      for (final id in (vi['industryIdentifiers'] as List? ?? const [])) {
        if (id is Map && id['type'] == 'ISBN_13') isbn = id['identifier']?.toString();
      }
      final pc = vi['pageCount'];
      out.add(Source(
        id: newId('gb'),
        type: SourceType.book,
        title: title,
        subtitle: vi['subtitle']?.toString(),
        authors: (vi['authors'] as List? ?? const []).map((e) => parsePersonName(e.toString()).surnameInitials).toList(),
        publisher: vi['publisher']?.toString(),
        year: year,
        pageCount: pc is int && pc > 0 ? pc : null,
        isbn: isbn,
        url: (vi['canonicalVolumeLink'] ?? vi['infoLink'])?.toString(),
        annotation: truncate(stripHtml((vi['description'] ?? '').toString()), 700),
        origin: SourceOrigin.googleBooks,
        verified: true,
      ));
    }
    return out;
  }
}

// ---------------- Википедия (только справочный контекст) ----------------

class WikipediaApi {
  static Future<String> context(Net net, String query, {int pages = 2, int chars = 2500}) async {
    final s = await net.getJson(Uri.https('ru.wikipedia.org', '/w/api.php', {
      'action': 'query',
      'list': 'search',
      'srsearch': query,
      'srlimit': '$pages',
      'format': 'json',
      'utf8': '1',
    }));
    final hits = ((s is Map ? s['query'] : null) as Map?)?['search'] as List? ?? const [];
    final titles = hits.map((e) => (e as Map)['title'].toString()).toList();
    if (titles.isEmpty) return '';
    final e = await net.getJson(Uri.https('ru.wikipedia.org', '/w/api.php', {
      'action': 'query',
      'prop': 'extracts',
      'explaintext': '1',
      'exchars': '$chars',
      'titles': titles.join('|'),
      'format': 'json',
      'utf8': '1',
    }));
    return parseExtracts(e);
  }

  static String parseExtracts(dynamic j) {
    final pages = ((j is Map ? j['query'] : null) as Map?)?['pages'] as Map? ?? const {};
    final b = StringBuffer();
    for (final p in pages.values) {
      if (p is! Map) continue;
      final ex = (p['extract'] ?? '').toString().trim();
      if (ex.isEmpty) continue;
      b.writeln('${p['title']}: ${ex.replaceAll(RegExp(r'\n{2,}'), '\n')}');
    }
    return b.toString().trim();
  }
}

/// Признаки изданий, запрещённых регламентом в списке литературы
/// (учебники по дисциплине, энциклопедии, словари, газеты).
final RegExp forbiddenSourceRe = RegExp(
  r'учебник|учебное пособие|учеб\.\s*пособ|учебно-методическ|пособие для (студентов|учащихся|спо|вузов)|для студентов|для бакалавр|для спо|'
  r'среднего профессионального образования|хрестомат|энциклопед|словар|справочник|газет|википеди|конспект лекций|курс лекций|практикум',
  caseSensitive: false,
);

bool isForbiddenSource(Source s) {
  final text = '${s.title} ${s.subtitle ?? ''} ${s.container ?? ''} ${(s.annotation ?? '').length > 300 ? s.annotation!.substring(0, 300) : s.annotation ?? ''}';
  return forbiddenSourceRe.hasMatch(text);
}
