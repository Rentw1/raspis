import 'dart:convert';

import 'package:html/dom.dart' as dom;
import 'package:html/parser.dart' as html_parser;

import '../core/net.dart';
import '../core/text_utils.dart';
import '../models/settings.dart';

class WebResult {
  WebResult({required this.title, required this.url, this.snippet = ''});
  final String title;
  final String url;
  final String snippet;

  String get host {
    try {
      return Uri.parse(url).host.replaceFirst(RegExp(r'^www\.'), '');
    } catch (_) {
      return '';
    }
  }
}

/// Веб-поиск: DuckDuckGo (без ключа), Tavily, Brave, SearXNG.
class WebSearch {
  WebSearch({required this.engine, this.key = '', this.searxngBase = ''});

  final WebEngine engine;
  final String key;
  final String searxngBase;

  bool get enabled => engine != WebEngine.none && (!engine.needsKey || key.isNotEmpty) && (engine != WebEngine.searxng || searxngBase.startsWith('http'));

  Future<List<WebResult>> search(Net net, String query, {int limit = 8}) async {
    switch (engine) {
      case WebEngine.none:
        return [];
      case WebEngine.duckduckgo:
        return _ddg(net, query, limit);
      case WebEngine.tavily:
        return _tavily(net, query, limit);
      case WebEngine.brave:
        return _brave(net, query, limit);
      case WebEngine.searxng:
        return _searx(net, query, limit);
    }
  }

  Future<List<WebResult>> _ddg(Net net, String query, int limit) async {
    final r = await net.post(
      Uri.https('html.duckduckgo.com', '/html/'),
      headers: {'User-Agent': Net.browserUa, 'Accept': 'text/html', 'Accept-Language': 'ru-RU,ru;q=0.9'},
      body: {'q': query, 'kl': 'ru-ru'},
    );
    if (r.statusCode != 200) throw NetException('DuckDuckGo: ошибка ${r.statusCode}${r.statusCode == 202 ? ' (временное ограничение)' : ''}', status: r.statusCode);
    final body = Net.decodeText(r);
    if (body.contains('anomaly-modal') || body.contains('challenge-form')) {
      throw NetException('DuckDuckGo временно ограничил запросы. Подождите или подключите Tavily в настройках.');
    }
    return parseDuckDuckGo(body).take(limit).toList();
  }

  static List<WebResult> parseDuckDuckGo(String body) {
    final doc = html_parser.parse(body);
    final out = <WebResult>[];
    for (final res in doc.querySelectorAll('.result')) {
      if (res.classes.contains('result--ad')) continue;
      final a = res.querySelector('a.result__a');
      if (a == null) continue;
      var href = a.attributes['href'] ?? '';
      if (href.contains('uddg=')) {
        final u = Uri.tryParse(href.startsWith('//') ? 'https:$href' : href);
        href = u?.queryParameters['uddg'] ?? href;
      }
      if (!href.startsWith('http') || href.contains('duckduckgo.com/y.js')) continue;
      out.add(WebResult(title: collapseSpaces(a.text), url: href, snippet: collapseSpaces(res.querySelector('.result__snippet')?.text ?? '')));
    }
    return out;
  }

  Future<List<WebResult>> _tavily(Net net, String query, int limit) async {
    final r = await net.post(
      Uri.https('api.tavily.com', '/search'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $key'},
      body: jsonEncode({'query': query, 'max_results': limit, 'search_depth': 'basic', 'include_answer': false, 'include_raw_content': false}),
      timeout: const Duration(seconds: 40),
    );
    final j = Net.decodeJson(r);
    return ((j is Map ? j['results'] : null) as List? ?? const [])
        .whereType<Map>()
        .map((e) => WebResult(title: (e['title'] ?? '').toString(), url: (e['url'] ?? '').toString(), snippet: (e['content'] ?? '').toString()))
        .where((e) => e.url.startsWith('http'))
        .toList();
  }

  Future<List<WebResult>> _brave(Net net, String query, int limit) async {
    final j = await net.getJson(
      Uri.https('api.search.brave.com', '/res/v1/web/search', {'q': query, 'count': '$limit', 'search_lang': 'ru', 'country': 'RU'}),
      headers: {'X-Subscription-Token': key, 'Accept': 'application/json'},
    );
    final results = ((j is Map ? j['web'] : null) as Map?)?['results'] as List? ?? const [];
    return results
        .whereType<Map>()
        .map((e) => WebResult(title: stripHtml((e['title'] ?? '').toString()), url: (e['url'] ?? '').toString(), snippet: stripHtml((e['description'] ?? '').toString())))
        .where((e) => e.url.startsWith('http'))
        .toList();
  }

  Future<List<WebResult>> _searx(Net net, String query, int limit) async {
    final base = searxngBase.trim().replaceAll(RegExp(r'/+$'), '');
    final j = await net.getJson(Uri.parse('$base/search?q=${Uri.encodeQueryComponent(query)}&format=json&language=ru'));
    final results = (j is Map ? j['results'] : null) as List? ?? const [];
    return results
        .whereType<Map>()
        .take(limit)
        .map((e) => WebResult(title: (e['title'] ?? '').toString(), url: (e['url'] ?? '').toString(), snippet: (e['content'] ?? '').toString()))
        .where((e) => e.url.startsWith('http'))
        .toList();
  }
}

/// Извлечение основного текста страницы.
class PageReader {
  static Future<(String title, String text)> read(Net net, String url, {int maxChars = 5000}) async {
    final r = await net.get(Uri.parse(url), headers: {'User-Agent': Net.browserUa, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'ru-RU,ru;q=0.9'});
    if (r.statusCode != 200) throw NetException('${Uri.parse(url).host}: ошибка ${r.statusCode}', status: r.statusCode);
    final ct = (r.headers['content-type'] ?? '').toLowerCase();
    if (!ct.contains('html') && !ct.contains('text')) throw NetException('${Uri.parse(url).host}: не текстовая страница');
    return extract(Net.decodeText(r), maxChars: maxChars);
  }

  static (String, String) extract(String html, {int maxChars = 5000}) {
    final doc = html_parser.parse(html);
    final title = collapseSpaces(doc.querySelector('title')?.text ?? '');
    for (final sel in ['script', 'style', 'noscript', 'nav', 'header', 'footer', 'aside', 'form', 'iframe', 'svg', 'button']) {
      for (final e in doc.querySelectorAll(sel)) {
        e.remove();
      }
    }
    final root = doc.querySelector('article') ?? doc.querySelector('main') ?? doc.body;
    if (root == null) return (title, '');
    final parts = <String>[];
    final seen = <String>{};
    void walk(dom.Element e) {
      final tag = e.localName;
      if (tag == 'p' || tag == 'li' || tag == 'h1' || tag == 'h2' || tag == 'h3' || tag == 'td' || tag == 'blockquote') {
        final t = collapseSpaces(e.text);
        if (t.length >= 25 && seen.add(t)) parts.add(t);
        return;
      }
      for (final c in e.children) {
        walk(c);
      }
    }

    walk(root);
    var text = parts.join('\n');
    if (text.length < 200) text = collapseSpaces(root.text);
    return (title, text.length > maxChars ? text.substring(0, maxChars) : text);
  }
}

/// Официальные сайты, на которые допустимо ссылаться в списке литературы.
bool isReputableHost(String host) {
  final h = host.toLowerCase();
  return h.endsWith('.gov.ru') ||
      h == 'gov.ru' ||
      h.endsWith('rosstat.gov.ru') ||
      h.endsWith('cbr.ru') ||
      h.endsWith('consultant.ru') ||
      h.endsWith('garant.ru') ||
      h.endsWith('pravo.gov.ru') ||
      h.endsWith('kremlin.ru') ||
      h.endsWith('government.ru') ||
      h.endsWith('tatarstan.ru') ||
      h.endsWith('tatstat.gks.ru') ||
      h.endsWith('gks.ru') ||
      h.endsWith('nalog.ru') ||
      h.endsWith('sfr.gov.ru') ||
      h.endsWith('cyberleninka.ru') ||
      h.endsWith('elibrary.ru') ||
      h.endsWith('.edu.ru') ||
      h.endsWith('minfin.ru') ||
      h.endsWith('economy.gov.ru') ||
      h.endsWith('mintrud.gov.ru');
}
