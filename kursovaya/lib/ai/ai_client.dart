import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';

import '../core/json_utils.dart';
import '../core/text_utils.dart';
import '../models/settings.dart';
import 'providers.dart';

class ChatMessage {
  const ChatMessage(this.role, this.content);
  const ChatMessage.system(this.content) : role = 'system';
  const ChatMessage.user(this.content) : role = 'user';
  const ChatMessage.assistant(this.content) : role = 'assistant';

  final String role;
  final String content;

  Map<String, dynamic> toJson() => {'role': role, 'content': content};
}

enum AiErrorKind { auth, payment, notFound, rateLimit, server, network, timeout, badRequest, empty, cancelled, format, config, other }

class AiException implements Exception {
  AiException(this.message, {this.status, this.kind = AiErrorKind.other, this.retryable = false, this.retryAfter});

  final String message;
  final int? status;
  final AiErrorKind kind;
  final bool retryable;
  final Duration? retryAfter;

  @override
  String toString() => message;
}

/// Отмена долгих запросов: закрывает активные HTTP-клиенты и прерывает ожидания.
class CancelToken {
  bool _cancelled = false;
  final Set<http.Client> _clients = {};
  final Completer<void> _done = Completer<void>();

  bool get isCancelled => _cancelled;

  void cancel() {
    if (_cancelled) return;
    _cancelled = true;
    for (final c in _clients.toList()) {
      c.close();
    }
    _clients.clear();
    if (!_done.isCompleted) _done.complete();
  }

  void attach(http.Client c) {
    if (_cancelled) {
      c.close();
    } else {
      _clients.add(c);
    }
  }

  void detach(http.Client c) => _clients.remove(c);

  void throwIfCancelled() {
    if (_cancelled) throw AiException('Остановлено пользователем.', kind: AiErrorKind.cancelled);
  }

  /// Пауза, прерываемая отменой.
  Future<void> delay(Duration d) async {
    await Future.any([Future<void>.delayed(d), _done.future]);
    throwIfCancelled();
  }
}

class ChatResult {
  ChatResult(this.text, this.finishReason, this.model, this.provider);
  final String text;
  final String? finishReason;
  final String model;
  final String provider;

  bool get truncated => finishReason == 'length' || finishReason == 'max_tokens';
}

class PingResult {
  PingResult(this.ok, this.message, {this.model});
  final bool ok;
  final String message;
  final String? model;
}

class GroundedAnswer {
  GroundedAnswer(this.text, this.links);
  final String text;

  /// (заголовок, адрес)
  final List<(String, String)> links;
}

typedef StatusCallback = void Function(String message);
typedef ClientFactory = http.Client Function(AiProvider p);

/// Клиент OpenAI-совместимых сервисов ИИ (+ GigaChat с OAuth и сертификатом Минцифры).
class AiClient {
  AiClient({required this.settings, required this.readSecret, this.onSettingsChanged, this.clientFactory});

  final AiSettings settings;
  final Future<String> Function(String name) readSecret;
  final void Function()? onSettingsChanged;

  /// Для тестов: подмена HTTP-клиента.
  final ClientFactory? clientFactory;

  static String keyName(String providerId) => 'ai_key_$providerId';
  static const String gigachatCertName = 'gigachat_cert_pem';
  static const String gigachatOauthUrl = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';

  final Map<String, String> _sessionModel = {};
  final Map<String, List<String>> _modelCache = {};
  String? _gcToken;
  DateTime _gcExpires = DateTime(2000);

  AiProvider? get provider => providerById(settings.provider);

  /// Сбросить кэш (после смены ключа/сервиса).
  void resetSession() {
    _sessionModel.clear();
    _modelCache.clear();
    _gcToken = null;
  }

  String baseFor(AiProvider p) => (p.id == 'custom' ? settings.customBase : p.base).trim().replaceAll(RegExp(r'/+$'), '');

  String modelFor(AiProvider p) {
    final s = _sessionModel[p.id];
    if (s != null && s.isNotEmpty) return s;
    final m = (settings.models[p.id] ?? '').trim();
    return m.isNotEmpty ? m : p.defaultModel;
  }

  Future<bool> isReady([String? providerId]) async {
    final p = providerById(providerId ?? settings.provider);
    if (p == null) return false;
    final base = baseFor(p);
    if (!base.startsWith('https://') && !base.startsWith('http://')) return false;
    if (!p.needsKey) return true;
    return (await readSecret(keyName(p.id))).isNotEmpty;
  }

  String label([String? providerId]) {
    final p = providerById(providerId ?? settings.provider);
    if (p == null) return 'не подключён';
    final m = modelFor(p);
    return m.isEmpty ? p.name : '${p.name} · $m';
  }

  // ---------------- HTTP ----------------

  Future<http.Client> _newClient(AiProvider p) async {
    if (clientFactory != null) return clientFactory!(p);
    if (p.auth == AuthScheme.gigachat) {
      final pem = await readSecret(gigachatCertName);
      final ctx = SecurityContext(withTrustedRoots: true);
      if (pem.isNotEmpty) {
        try {
          ctx.setTrustedCertificatesBytes(utf8.encode(pem));
        } catch (e) {
          throw AiException('Файл сертификата НУЦ Минцифры не подходит: $e', kind: AiErrorKind.config);
        }
      }
      return IOClient(HttpClient(context: ctx)..connectionTimeout = const Duration(seconds: 30));
    }
    return IOClient(HttpClient()..connectionTimeout = const Duration(seconds: 30));
  }

  Future<Map<String, String>> _headers(AiProvider p, http.Client client) async {
    final h = <String, String>{'Content-Type': 'application/json', 'Accept': 'application/json'};
    if (p.auth == AuthScheme.gigachat) {
      h['Authorization'] = 'Bearer ${await _gigachatToken(p, client)}';
    } else {
      final k = await readSecret(keyName(p.id));
      if (k.isNotEmpty) h['Authorization'] = 'Bearer $k';
    }
    if (p.id == 'openrouter') {
      h['HTTP-Referer'] = 'https://github.com/Rentw1/raspis';
      h['X-Title'] = 'Kursovaya LTET';
    }
    if (p.id == 'github') {
      h['Accept'] = 'application/vnd.github+json';
      h['X-GitHub-Api-Version'] = '2022-11-28';
    }
    return h;
  }

  Future<String> _gigachatToken(AiProvider p, http.Client client) async {
    if (_gcToken != null && DateTime.now().isBefore(_gcExpires.subtract(const Duration(minutes: 1)))) return _gcToken!;
    var key = (await readSecret(keyName(p.id))).trim();
    if (key.isEmpty) throw AiException('Введите ключ авторизации GigaChat.', kind: AiErrorKind.config);
    key = key.replaceFirst(RegExp(r'^Basic\s+', caseSensitive: false), '');
    final r = await client
        .post(
          Uri.parse(gigachatOauthUrl),
          headers: {
            'Authorization': 'Basic $key',
            'RqUID': uuid4(),
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          body: 'scope=${Uri.encodeQueryComponent(settings.gigachatScope)}',
        )
        .timeout(const Duration(seconds: 40));
    if (r.statusCode != 200) throw errorFrom(r.statusCode, utf8.decode(r.bodyBytes, allowMalformed: true), r.headers);
    final j = jsonDecode(utf8.decode(r.bodyBytes)) as Map;
    final token = j['access_token'] as String?;
    if (token == null || token.isEmpty) throw AiException('GigaChat не выдал токен доступа.', kind: AiErrorKind.auth);
    final exp = j['expires_at'];
    if (exp is num) {
      final v = exp.toInt();
      _gcExpires = DateTime.fromMillisecondsSinceEpoch(v < 100000000000 ? v * 1000 : v);
    } else {
      _gcExpires = DateTime.now().add(const Duration(minutes: 25));
    }
    _gcToken = token;
    return token;
  }

  /// Ошибка HTTP → понятное сообщение.
  static AiException errorFrom(int status, String body, Map<String, String> headers) {
    var msg = '';
    try {
      final j = jsonDecode(body);
      final e = j is Map ? (j['error'] ?? j) : j;
      if (e is Map) {
        msg = (e['message'] ?? e['msg'] ?? e['detail'] ?? e['error'] ?? '').toString();
        final meta = e['metadata'];
        if (meta is Map && meta['raw'] != null) msg = '$msg ${meta['raw']}';
      } else if (e is List && e.isNotEmpty) {
        final f = e.first;
        msg = f is Map ? (f['error']?['message'] ?? f['message'] ?? '').toString() : f.toString();
      } else {
        msg = e.toString();
      }
    } catch (_) {
      msg = stripHtml(body);
    }
    msg = truncate(msg.replaceAll(RegExp(r'\s+'), ' ').trim(), 260);
    Duration? retryAfter;
    final ra = headers['retry-after'];
    if (ra != null) {
      final s = double.tryParse(ra.trim());
      if (s != null) retryAfter = Duration(seconds: s.ceil().clamp(1, 90));
    }
    final tail = msg.isEmpty ? '' : ' $msg';
    switch (status) {
      case 400:
      case 422:
        return AiException('Сервис отклонил запрос ($status).$tail', status: status, kind: AiErrorKind.badRequest);
      case 401:
        return AiException('Ошибка авторизации (401): ключ не принят.$tail', status: status, kind: AiErrorKind.auth);
      case 403:
        return AiException('Запрос отклонён (403): нет доступа к модели или сервис недоступен в вашем регионе.$tail', status: status, kind: AiErrorKind.auth);
      case 402:
        return AiException('Закончились бесплатные кредиты или нужна оплата (402).$tail', status: status, kind: AiErrorKind.payment);
      case 404:
        return AiException('Модель или адрес не найдены (404).$tail', status: status, kind: AiErrorKind.notFound);
      case 408:
        return AiException('Сервис не дождался запроса (408).$tail', status: status, kind: AiErrorKind.timeout, retryable: true);
      case 413:
        return AiException('Слишком длинный запрос (413).$tail', status: status, kind: AiErrorKind.badRequest);
      case 429:
        return AiException('Превышен лимит бесплатных запросов (429).$tail', status: status, kind: AiErrorKind.rateLimit, retryable: true, retryAfter: retryAfter);
      default:
        if (status >= 500) {
          return AiException('Ошибка сервера ИИ ($status).$tail', status: status, kind: AiErrorKind.server, retryable: true, retryAfter: retryAfter);
        }
        return AiException('Ошибка сервиса ИИ ($status).$tail', status: status, kind: AiErrorKind.other);
    }
  }

  AiException _netError(AiProvider p, Object e, CancelToken? cancel) {
    if (cancel?.isCancelled ?? false) return AiException('Остановлено пользователем.', kind: AiErrorKind.cancelled);
    if (e is AiException) return e;
    if (e is TimeoutException) return AiException('Сервис ${p.name} не ответил вовремя.', kind: AiErrorKind.timeout, retryable: true);
    if (e is HandshakeException || e is TlsException) {
      return AiException(
        p.auth == AuthScheme.gigachat
            ? 'Нет защищённого соединения с GigaChat: добавьте сертификат НУЦ Минцифры (Russian Trusted Root CA) в настройках.'
            : 'Ошибка защищённого соединения с ${p.name}: $e',
        kind: AiErrorKind.network,
      );
    }
    final vpn = p.russia == RussiaAccess.vpn ? ' или включите VPN' : '';
    if (e is SocketException) {
      return AiException('Нет связи с ${p.name} (${e.osError?.message ?? e.message}). Проверьте интернет$vpn.', kind: AiErrorKind.network, retryable: true);
    }
    if (e is http.ClientException) {
      return AiException('Нет связи с ${p.name}: ${e.message}. Проверьте интернет$vpn.', kind: AiErrorKind.network, retryable: true);
    }
    return AiException('Ошибка связи с ${p.name}: $e', kind: AiErrorKind.network, retryable: true);
  }

  // ---------------- Модели ----------------

  static List<String> rankModels(AiProvider p, List<String> ids) {
    final prefs = p.preferRe;
    int group(String id) {
      for (var i = 0; i < prefs.length; i++) {
        if (prefs[i].hasMatch(id)) return i;
      }
      return prefs.length;
    }

    double version(String id) {
      final m = RegExp(r'(\d+(?:\.\d+)?)').firstMatch(id.replaceAll(RegExp(r'^[a-z-]+/'), ''));
      return m == null ? 0 : double.tryParse(m.group(1)!) ?? 0;
    }

    final list = ids.toSet().toList();
    list.sort((a, b) {
      final ga = group(a), gb = group(b);
      if (ga != gb) return ga.compareTo(gb);
      final va = version(a), vb = version(b);
      if (va != vb) return vb.compareTo(va);
      return a.length != b.length ? a.length.compareTo(b.length) : a.compareTo(b);
    });
    return list;
  }

  Future<List<String>> listModels(String providerId, {bool refresh = false}) async {
    final p = providerById(providerId);
    if (p == null) throw AiException('Выберите сервис ИИ.', kind: AiErrorKind.config);
    if (!refresh && _modelCache[p.id] != null) return _modelCache[p.id]!;
    final base = baseFor(p);
    if (base.isEmpty) throw AiException('Укажите адрес сервера.', kind: AiErrorKind.config);
    final client = await _newClient(p);
    try {
      final url = p.modelsUrl ?? '$base/models';
      final r = await client.get(Uri.parse(url), headers: await _headers(p, client)).timeout(const Duration(seconds: 40));
      final body = utf8.decode(r.bodyBytes, allowMalformed: true);
      if (r.statusCode != 200) throw errorFrom(r.statusCode, body, r.headers);
      final j = jsonDecode(body);
      final raw = j is List ? j : (j is Map ? (j['data'] ?? j['models'] ?? const []) : const []) as List;
      var ids = <String>[];
      for (final m in raw) {
        if (m is String) {
          ids.add(m);
          continue;
        }
        if (m is! Map) continue;
        final out = m['supported_output_modalities'];
        if (out is List && !out.contains('text')) continue;
        final type = m['type']?.toString();
        if (type != null && type.isNotEmpty && type != 'chat' && type != 'model' && p.id == 'gigachat') continue;
        final id = (m['id'] ?? m['name'] ?? '').toString();
        if (id.isNotEmpty) ids.add(id);
      }
      ids = ids.map((s) => s.replaceFirst(RegExp(r'^models/'), '')).where((s) => s.isNotEmpty && !nonChatModel.hasMatch(s)).toList();
      if (p.freeSuffix != null) ids = ids.where((s) => s.endsWith(p.freeSuffix!)).toList();
      final ranked = rankModels(p, ids);
      _modelCache[p.id] = ranked;
      return ranked;
    } catch (e) {
      throw _netError(p, e, null);
    } finally {
      client.close();
    }
  }

  Future<String> ensureModel(AiProvider p) async {
    final m = modelFor(p);
    if (m.isNotEmpty) return m;
    final ids = await listModels(p.id);
    if (ids.isEmpty) {
      throw AiException('У сервиса ${p.name} не нашлось подходящей модели. Укажите модель вручную в настройках.', kind: AiErrorKind.config);
    }
    settings.models[p.id] = ids.first;
    onSettingsChanged?.call();
    return ids.first;
  }

  // ---------------- Текст ----------------

  Future<String> chat(
    List<ChatMessage> messages, {
    double temperature = 0.5,
    int? maxTokens,
    bool json = false,
    void Function(String delta)? onDelta,
    StatusCallback? onStatus,
    CancelToken? cancel,
  }) async =>
      (await chatFull(messages, temperature: temperature, maxTokens: maxTokens, json: json, onDelta: onDelta, onStatus: onStatus, cancel: cancel)).text;

  Future<ChatResult> chatFull(
    List<ChatMessage> messages, {
    double temperature = 0.5,
    int? maxTokens,
    bool json = false,
    void Function(String delta)? onDelta,
    StatusCallback? onStatus,
    CancelToken? cancel,
  }) async {
    final primary = provider;
    if (primary == null) throw AiException('ИИ не подключён. Откройте Настройки → Нейросеть.', kind: AiErrorKind.config);
    if (!await isReady(primary.id)) {
      throw AiException('Для сервиса ${primary.name} нужен ключ. Получите бесплатный ключ и вставьте его в настройках.', kind: AiErrorKind.config);
    }
    try {
      return await _withRetries(primary, messages, temperature, maxTokens, json, onDelta, onStatus, cancel);
    } on AiException catch (e) {
      if (e.kind == AiErrorKind.cancelled || e.kind == AiErrorKind.format) rethrow;
      final fb = providerById(settings.fallbackProvider);
      if (fb == null || fb.id == primary.id || !await isReady(fb.id)) rethrow;
      onStatus?.call('${primary.name}: ${e.message} Пробую запасной сервис ${fb.name}…');
      return _withRetries(fb, messages, temperature, maxTokens, json, onDelta, onStatus, cancel);
    }
  }

  Future<ChatResult> _withRetries(
    AiProvider p,
    List<ChatMessage> messages,
    double temperature,
    int? maxTokens,
    bool json,
    void Function(String delta)? onDelta,
    StatusCallback? onStatus,
    CancelToken? cancel,
  ) async {
    var model = await ensureModel(p);
    final tried = <String>{};
    var attempt = 0;
    var dropJson = false, dropMax = false, dropExtra = false, noStream = false;
    while (true) {
      cancel?.throwIfCancelled();
      try {
        return await _chatOnce(
          p,
          model,
          messages,
          temperature: temperature,
          maxTokens: dropMax ? null : maxTokens,
          json: json && !dropJson,
          extra: !dropExtra,
          stream: onDelta != null && !noStream,
          onDelta: onDelta,
          cancel: cancel,
        );
      } on AiException catch (e) {
        if (e.kind == AiErrorKind.cancelled) rethrow;
        if (e.kind == AiErrorKind.badRequest) {
          // Упрощаем запрос: без JSON-режима, без лимита длины, без доп. параметров, без потока.
          if (json && !dropJson) {
            dropJson = true;
            continue;
          }
          if (!dropExtra) {
            dropExtra = true;
            continue;
          }
          if (maxTokens != null && !dropMax) {
            dropMax = true;
            continue;
          }
          if (onDelta != null && !noStream) {
            noStream = true;
            continue;
          }
        }
        if (e.retryable && attempt < 2) {
          attempt++;
          final wait = e.retryAfter ?? Duration(seconds: attempt == 1 ? 6 : 20);
          onStatus?.call('${p.name}: ${e.message} Повтор через ${wait.inSeconds} с…');
          if (cancel != null) {
            await cancel.delay(wait);
          } else {
            await Future<void>.delayed(wait);
          }
          continue;
        }
        final canSwitch = settings.autoSwitchModel &&
            p.id != 'custom' &&
            const {AiErrorKind.rateLimit, AiErrorKind.notFound, AiErrorKind.payment, AiErrorKind.server, AiErrorKind.empty, AiErrorKind.timeout}.contains(e.kind);
        if (canSwitch && tried.length < 4) {
          tried.add(model);
          String next = '';
          try {
            final ids = await listModels(p.id);
            next = ids.firstWhere((m) => !tried.contains(m), orElse: () => '');
          } catch (_) {
            next = '';
          }
          if (next.isNotEmpty) {
            onStatus?.call('Модель $model недоступна (${e.message}). Переключаюсь на $next…');
            model = next;
            _sessionModel[p.id] = next;
            attempt = 0;
            continue;
          }
        }
        rethrow;
      }
    }
  }

  Future<ChatResult> _chatOnce(
    AiProvider p,
    String model,
    List<ChatMessage> messages, {
    required double temperature,
    int? maxTokens,
    bool json = false,
    bool extra = true,
    bool stream = false,
    void Function(String delta)? onDelta,
    CancelToken? cancel,
  }) async {
    final client = await _newClient(p);
    cancel?.attach(client);
    try {
      final body = <String, dynamic>{
        'model': model,
        'messages': messages.map((m) => m.toJson()).toList(),
        'temperature': temperature,
      };
      if (maxTokens != null) body['max_tokens'] = math.min(maxTokens, p.maxOutput);
      if (json && p.auth != AuthScheme.gigachat) body['response_format'] = {'type': 'json_object'};
      if (extra && p.id == 'gemini') body['reasoning_effort'] = 'low';
      if (stream) body['stream'] = true;
      final req = http.Request('POST', Uri.parse('${baseFor(p)}/chat/completions'))
        ..headers.addAll(await _headers(p, client))
        ..body = jsonEncode(body);
      final resp = await client.send(req).timeout(const Duration(seconds: 120));
      if (resp.statusCode < 200 || resp.statusCode >= 300) {
        final txt = await resp.stream.bytesToString().timeout(const Duration(seconds: 30), onTimeout: () => '');
        throw errorFrom(resp.statusCode, txt, resp.headers);
      }
      final ct = resp.headers['content-type'] ?? '';
      String content;
      String? finish;
      if (stream && ct.contains('event-stream')) {
        (content, finish) = await _readSse(resp.stream, onDelta);
      } else {
        final txt = await resp.stream.bytesToString().timeout(const Duration(seconds: 300));
        (content, finish) = _parseCompletion(txt);
        if (onDelta != null && content.isNotEmpty) onDelta(content);
      }
      content = stripThinking(content).trim();
      if (content.isEmpty) {
        throw AiException(
          finish == 'length' ? 'Ответ модели обрезан до начала текста (модель «думает» слишком долго).' : 'ИИ вернул пустой ответ.',
          kind: AiErrorKind.empty,
          retryable: true,
        );
      }
      return ChatResult(content, finish, model, p.id);
    } catch (e) {
      throw _netError(p, e, cancel);
    } finally {
      cancel?.detach(client);
      client.close();
    }
  }

  static (String, String?) _parseCompletion(String txt) {
    dynamic j;
    try {
      j = jsonDecode(txt);
    } catch (_) {
      throw AiException('Сервис ИИ прислал непонятный ответ.', kind: AiErrorKind.format);
    }
    if (j is Map && j['error'] != null) throw errorFrom(400, txt, const {});
    final choices = j is Map ? j['choices'] : null;
    if (choices is! List || choices.isEmpty) throw AiException('Сервис ИИ не прислал текст.', kind: AiErrorKind.empty, retryable: true);
    final ch = choices.first as Map;
    final msg = ch['message'];
    var content = msg is Map ? msg['content'] : ch['text'];
    if (content is List) {
      content = content.map((x) => x is String ? x : (x is Map ? (x['text'] ?? '') : '')).join();
    }
    return ((content ?? '').toString(), ch['finish_reason']?.toString());
  }

  static Future<(String, String?)> _readSse(Stream<List<int>> s, void Function(String)? onDelta) async {
    final sb = StringBuffer();
    String? finish;
    var pending = '';
    await for (final chunk in s.transform(utf8.decoder).timeout(const Duration(seconds: 150))) {
      pending += chunk;
      while (true) {
        final i = pending.indexOf('\n');
        if (i < 0) break;
        final line = pending.substring(0, i).trim();
        pending = pending.substring(i + 1);
        if (line.isEmpty || line.startsWith(':') || !line.startsWith('data:')) continue;
        final data = line.substring(5).trim();
        if (data == '[DONE]') return (sb.toString(), finish);
        dynamic j;
        try {
          j = jsonDecode(data);
        } catch (_) {
          continue;
        }
        if (j is! Map) continue;
        if (j['error'] != null) {
          final code = j['error'] is Map ? int.tryParse('${j['error']['code']}') : null;
          throw errorFrom(code ?? 500, data, const {});
        }
        final choices = j['choices'];
        if (choices is List && choices.isNotEmpty && choices.first is Map) {
          final ch = choices.first as Map;
          final delta = ch['delta'] ?? ch['message'];
          final c = delta is Map ? delta['content'] : null;
          if (c is String && c.isNotEmpty) {
            sb.write(c);
            onDelta?.call(c);
          }
          final f = ch['finish_reason'];
          if (f != null) finish = f.toString();
        }
      }
    }
    return (sb.toString(), finish);
  }

  // ---------------- Проверка подключения ----------------

  Future<PingResult> ping(String providerId) async {
    final p = providerById(providerId);
    if (p == null) return PingResult(false, 'Выберите сервис ИИ.');
    final base = baseFor(p);
    if (!base.startsWith('https://') && !base.startsWith('http://')) {
      return PingResult(false, 'Укажите адрес сервера (https://…/v1).');
    }
    if (p.needsKey && (await readSecret(keyName(p.id))).isEmpty) return PingResult(false, 'Введите ключ API.');
    resetSession();
    try {
      final model = await ensureModel(p);
      ChatResult r;
      try {
        r = await _chatOnce(p, model, const [ChatMessage.user('Ответь одним словом без пояснений: столица России?')], temperature: 0, maxTokens: 400);
      } on AiException catch (e) {
        if (e.kind != AiErrorKind.badRequest) rethrow;
        r = await _chatOnce(p, model, const [ChatMessage.user('Ответь одним словом без пояснений: столица России?')], temperature: 0, extra: false);
      }
      final answer = truncate(r.text.replaceAll(RegExp(r'\s+'), ' '), 60);
      return PingResult(true, 'Подключено успешно: ${p.name} · $model. Ответ модели: «$answer»', model: model);
    } on AiException catch (e) {
      if (e.kind == AiErrorKind.auth) return PingResult(false, 'Ошибка авторизации / запрос отклонён. ${e.message}');
      return PingResult(false, e.message);
    } catch (e) {
      return PingResult(false, 'Ошибка: $e');
    }
  }

  // ---------------- Gemini + поиск Google ----------------

  /// Ответ Gemini с поиском Google (grounding). Используется для сбора фактов.
  Future<GroundedAnswer> geminiSearch(String prompt, {CancelToken? cancel}) async {
    final p = providerById('gemini')!;
    final key = await readSecret(keyName('gemini'));
    if (key.isEmpty) throw AiException('Нет ключа Gemini.', kind: AiErrorKind.config);
    final model = await ensureModel(p);
    final client = await _newClient(p);
    cancel?.attach(client);
    try {
      final r = await client
          .post(
            Uri.parse('https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent'),
            headers: {'Content-Type': 'application/json', 'x-goog-api-key': key},
            body: jsonEncode({
              'contents': [
                {
                  'role': 'user',
                  'parts': [
                    {'text': prompt}
                  ]
                }
              ],
              'tools': [
                {'google_search': {}}
              ],
              'generationConfig': {'temperature': 0.2, 'maxOutputTokens': 4096},
            }),
          )
          .timeout(const Duration(seconds: 150));
      final body = utf8.decode(r.bodyBytes, allowMalformed: true);
      if (r.statusCode != 200) throw errorFrom(r.statusCode, body, r.headers);
      final j = jsonDecode(body) as Map;
      final cands = j['candidates'] as List? ?? const [];
      if (cands.isEmpty) throw AiException('Gemini не нашёл ответа.', kind: AiErrorKind.empty);
      final c = cands.first as Map;
      final parts = (c['content'] as Map?)?['parts'] as List? ?? const [];
      final text = parts.map((x) => x is Map ? (x['text'] ?? '') : '').join('\n').trim();
      final links = <(String, String)>[];
      final chunks = (c['groundingMetadata'] as Map?)?['groundingChunks'] as List? ?? const [];
      for (final ch in chunks) {
        final web = ch is Map ? ch['web'] : null;
        if (web is Map && web['uri'] != null) links.add(((web['title'] ?? '').toString(), web['uri'].toString()));
      }
      return GroundedAnswer(stripThinking(text), links);
    } catch (e) {
      throw _netError(p, e, cancel);
    } finally {
      cancel?.detach(client);
      client.close();
    }
  }

  /// Запрос с ответом в JSON (с повтором, если модель ответила не по формату).
  Future<dynamic> chatJson(
    String system,
    String user, {
    double temperature = 0.3,
    int? maxTokens,
    bool expectArray = false,
    StatusCallback? onStatus,
    CancelToken? cancel,
    void Function(String delta)? onDelta,
  }) async {
    final msgs = [ChatMessage.system(system), ChatMessage.user(user)];
    final first = await chat(msgs, temperature: temperature, maxTokens: maxTokens, json: !expectArray, onStatus: onStatus, cancel: cancel, onDelta: onDelta);
    try {
      return parseJsonLoose(first, expectArray: expectArray);
    } on AiFormatException {
      onStatus?.call('Ответ ИИ не в формате JSON — прошу повторить…');
      final retry = await chat(
        [...msgs, ChatMessage.assistant(truncate(first, 2000)), const ChatMessage.user('Ответь ещё раз: только JSON по заданной схеме, без пояснений и без Markdown.')],
        temperature: 0.2,
        maxTokens: maxTokens,
        json: !expectArray,
        onStatus: onStatus,
        cancel: cancel,
      );
      return parseJsonLoose(retry, expectArray: expectArray);
    }
  }
}
