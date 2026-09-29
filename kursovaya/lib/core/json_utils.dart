import 'dart:convert';

class AiFormatException implements Exception {
  AiFormatException(this.message);
  final String message;
  @override
  String toString() => message;
}

/// Удаляет из ответа модели «размышления» (`<think>…</think>`) и служебные обёртки.
String stripThinking(String s) {
  var t = s.replaceAll(RegExp(r'<think>[\s\S]*?</think>', caseSensitive: false), '');
  // незакрытый <think> в начале (обрезанный ответ)
  final open = t.toLowerCase().indexOf('<think>');
  if (open >= 0) t = t.substring(0, open);
  return t.trim();
}

/// Достаёт JSON-объект или массив из ответа модели:
/// с ограждениями ```json, пояснениями до/после, хвостовыми запятыми, «умными» кавычками.
dynamic parseJsonLoose(String text, {bool expectArray = false}) {
  var t = stripThinking(text).replaceFirst('﻿', '').trim();
  final fence = RegExp(r'```(?:json|JSON)?\s*([\s\S]*?)```').firstMatch(t);
  if (fence != null) t = fence.group(1)!.trim();
  final open = expectArray ? '[' : '{';
  final close = expectArray ? ']' : '}';
  var a = t.indexOf(open);
  var b = t.lastIndexOf(close);
  if (a < 0 || b <= a) {
    // допускаем объект, когда ждали массив, и наоборот
    final alt = expectArray ? ['{', '}'] : ['[', ']'];
    a = t.indexOf(alt[0]);
    b = t.lastIndexOf(alt[1]);
    if (a < 0 || b <= a) throw AiFormatException('ИИ ответил не в формате JSON. Повторите попытку или выберите другую модель.');
  }
  t = t.substring(a, b + 1);
  final noComma = t.replaceAllMapped(RegExp(r',\s*([}\]])'), (m) => m[1]!);
  final candidates = <String>[
    t,
    noComma,
    _fixQuotes(noComma),
    _escapeNewlinesInStrings(_fixQuotes(noComma)),
  ];
  for (final c in candidates) {
    try {
      return jsonDecode(c);
    } catch (_) {
      // следующая попытка
    }
  }
  throw AiFormatException('ИИ прислал повреждённый JSON. Повторите попытку или выберите другую модель.');
}

String _fixQuotes(String s) => s.replaceAll(RegExp(r'[“”„]'), '"').replaceAll(' ', ' ');

/// Переводы строк внутри строковых литералов → \n (частая ошибка моделей).
String _escapeNewlinesInStrings(String s) {
  final sb = StringBuffer();
  var inStr = false;
  var esc = false;
  for (var i = 0; i < s.length; i++) {
    final ch = s[i];
    if (inStr) {
      if (esc) {
        esc = false;
        sb.write(ch);
        continue;
      }
      if (ch == '\\') {
        esc = true;
        sb.write(ch);
        continue;
      }
      if (ch == '"') {
        inStr = false;
        sb.write(ch);
        continue;
      }
      if (ch == '\n') {
        sb.write(r'\n');
        continue;
      }
      if (ch == '\r') continue;
      if (ch == '\t') {
        sb.write(r'\t');
        continue;
      }
      sb.write(ch);
    } else {
      if (ch == '"') inStr = true;
      sb.write(ch);
    }
  }
  return sb.toString();
}

String jStr(dynamic v, [int max = 2000]) {
  if (v == null) return '';
  final s = (v is String ? v : v.toString()).replaceAll(RegExp(r'\s+'), ' ').trim();
  return s.length > max ? s.substring(0, max) : s;
}

List<String> jStrList(dynamic v, {int max = 30, int maxLen = 600}) {
  if (v == null) return [];
  final list = v is List ? v : [v];
  return list.map((e) => jStr(e is Map ? (e['text'] ?? e['title'] ?? e['name'] ?? e.values.first) : e, maxLen)).where((s) => s.isNotEmpty).take(max).toList();
}

int? jInt(dynamic v) {
  if (v is int) return v;
  if (v is double) return v.round();
  if (v is String) return int.tryParse(RegExp(r'-?\d+').firstMatch(v)?.group(0) ?? '');
  return null;
}
