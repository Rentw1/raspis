import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';

import '../ai/ai_client.dart' show CancelToken;

class NetException implements Exception {
  NetException(this.message, {this.status});
  final String message;
  final int? status;
  @override
  String toString() => message;
}

/// HTTP-запросы для поиска источников: таймауты, отмена, кодировки (включая windows-1251).
class Net {
  Net({http.Client? client, this.cancel}) : _client = client ?? IOClient(HttpClient()..connectionTimeout = const Duration(seconds: 20));

  final http.Client _client;
  final CancelToken? cancel;

  static const String browserUa =
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';
  static const String appUa = 'KursovayaLTET/1.0 (+https://github.com/Rentw1/raspis)';

  void close() => _client.close();

  Future<http.Response> get(Uri url, {Map<String, String>? headers, Duration timeout = const Duration(seconds: 25)}) =>
      _send(http.Request('GET', url)..headers.addAll({'User-Agent': appUa, ...?headers}), timeout);

  Future<http.Response> post(Uri url, {Map<String, String>? headers, Object? body, Duration timeout = const Duration(seconds: 25)}) {
    final r = http.Request('POST', url)..headers.addAll({'User-Agent': appUa, ...?headers});
    if (body is String) {
      r.body = body;
    } else if (body is Map<String, String>) {
      r.bodyFields = body;
    }
    return _send(r, timeout);
  }

  Future<http.Response> _send(http.BaseRequest r, Duration timeout) async {
    if (cancel?.isCancelled ?? false) throw NetException('Остановлено');
    cancel?.attach(_client);
    try {
      final s = await _client.send(r).timeout(timeout);
      return await http.Response.fromStream(s).timeout(timeout);
    } on TimeoutException {
      throw NetException('${r.url.host}: нет ответа (таймаут)');
    } on SocketException catch (e) {
      throw NetException('${r.url.host}: нет связи (${e.osError?.message ?? e.message})');
    } on HandshakeException {
      throw NetException('${r.url.host}: ошибка защищённого соединения');
    } on http.ClientException catch (e) {
      if (cancel?.isCancelled ?? false) throw NetException('Остановлено');
      throw NetException('${r.url.host}: ${e.message}');
    } finally {
      cancel?.detach(_client);
    }
  }

  Future<dynamic> getJson(Uri url, {Map<String, String>? headers, Duration timeout = const Duration(seconds: 25)}) async {
    final r = await get(url, headers: {'Accept': 'application/json', ...?headers}, timeout: timeout);
    return decodeJson(r);
  }

  static dynamic decodeJson(http.Response r) {
    if (r.statusCode == 429) throw NetException('${r.request?.url.host}: слишком много запросов (429), попробуйте позже', status: 429);
    if (r.statusCode == 401 || r.statusCode == 403) {
      throw NetException('${r.request?.url.host}: доступ запрещён (${r.statusCode})', status: r.statusCode);
    }
    if (r.statusCode < 200 || r.statusCode >= 300) {
      throw NetException('${r.request?.url.host}: ошибка ${r.statusCode}', status: r.statusCode);
    }
    try {
      return jsonDecode(utf8.decode(r.bodyBytes, allowMalformed: true));
    } catch (_) {
      throw NetException('${r.request?.url.host}: непонятный ответ');
    }
  }

  /// Текст ответа с учётом кодировки (utf-8, windows-1251, koi8-r по заголовку или <meta charset>).
  static String decodeText(http.Response r) {
    final bytes = r.bodyBytes;
    var charset = RegExp(r'charset=([\w-]+)', caseSensitive: false).firstMatch(r.headers['content-type'] ?? '')?.group(1)?.toLowerCase();
    if (charset == null) {
      final head = latin1.decode(bytes.length > 4096 ? bytes.sublist(0, 4096) : bytes, allowInvalid: true);
      charset = RegExp(r'''<meta[^>]+charset=["']?([\w-]+)''', caseSensitive: false).firstMatch(head)?.group(1)?.toLowerCase();
    }
    switch (charset) {
      case 'windows-1251':
      case 'cp1251':
      case 'win-1251':
        return decodeCp1251(bytes);
      case 'koi8-r':
        return decodeKoi8r(bytes);
      default:
        return utf8.decode(bytes, allowMalformed: true);
    }
  }

  static const String _cp1251High =
      'ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏђ‘’“”•–—�™љ›њќћџ ЎўЈ¤Ґ¦§Ё©Є«¬­®Ї°±Ііґµ¶·ё№є»јЅѕї'
      'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя';

  static String decodeCp1251(List<int> bytes) {
    final sb = StringBuffer();
    for (final b in bytes) {
      sb.write(b < 0x80 ? String.fromCharCode(b) : _cp1251High[b - 0x80]);
    }
    return sb.toString();
  }

  static const String _koi8High =
      '─│┌┐└┘├┤┬┴┼▀▄█▌▐░▒▓⌠■∙√≈≤≥ ⌡°²·÷═║╒ё╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡Ё╢╣╤╥╦╧╨╩╪╫╬©'
      'юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ';

  static String decodeKoi8r(List<int> bytes) {
    final sb = StringBuffer();
    for (final b in bytes) {
      sb.write(b < 0x80 ? String.fromCharCode(b) : _koi8High[b - 0x80]);
    }
    return sb.toString();
  }
}
