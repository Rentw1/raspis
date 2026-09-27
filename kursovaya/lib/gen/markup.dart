import '../core/json_utils.dart';
import '../core/regulation.dart';
import '../core/text_utils.dart';

/// Блок документа после разбора разметки раздела.
sealed class DocBlock {
  const DocBlock();
}

class ParaBlock extends DocBlock {
  const ParaBlock(this.text);
  final String text;
}

class ListItemBlock extends DocBlock {
  const ListItemBlock(this.text, {this.marker = '–'});
  final String text;

  /// «–» или «1)».
  final String marker;
}

class TableBlock extends DocBlock {
  TableBlock({required this.title, required this.rows, this.number, this.headerRows = 1});
  final String title;

  /// Номер из подписи в тексте («Таблица 3 — …»), если был.
  final String? number;
  final List<List<String>> rows;
  final int headerRows;

  int get columns => rows.fold(0, (m, r) => r.length > m ? r.length : m);
}

/// Строка-примечание под таблицей (например, «Источник: …» или «Данные условные»).
class NoteBlock extends DocBlock {
  const NoteBlock(this.text);
  final String text;
}

class Markup {
  Markup._();

  static final RegExp tableCaption = RegExp(r'^\s*(?:\*\*)?Таблица\s+([0-9]+(?:\.[0-9]+)?|[А-ЯA-Z]\.[0-9]+|N)?\s*[—–\-:.]\s*(.+?)(?:\*\*)?\s*$', caseSensitive: false);
  static final RegExp _pipeLine = RegExp(r'^\s*\|.*\|\s*$');
  static final RegExp _sepLine = RegExp(r'^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$');
  static final RegExp _listLine = RegExp(r'^\s*(?:([–—\-•*·▪])|(\d{1,2})[.)])\s+(.+)$');
  static final RegExp _noteLine = RegExp(r'^\s*(Источник|Примечание|Составлено|Рассчитано|Данные условные)(?=[\s:.,]|$)', caseSensitive: false);

  /// Приводит ответ ИИ к «чистой» разметке: без Markdown, заголовков, служебных фраз; с русской типографикой.
  static String cleanAiText(String raw, {List<String> dropHeadings = const []}) {
    var t = stripThinking(raw).replaceAll('\r', '');
    t = t.replaceAll(RegExp(r'```[a-zA-Z]*\n?'), '');
    final lines = t.split('\n');
    final out = <String>[];
    final dropNorm = dropHeadings.map((h) => _norm(h)).where((h) => h.isNotEmpty).toSet();
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].trimRight();
      final plain = l.replaceAll(RegExp(r'[#*_]'), '').trim();
      // заголовки Markdown и «Глава N…», «Введение», «Заключение», «Параграф…»
      if (RegExp(r'^\s*#{1,6}\s').hasMatch(l)) continue;
      if (RegExp(r'^(глава|раздел|параграф)\s+\d+', caseSensitive: false).hasMatch(plain) && plain.length < 160 && !plain.contains('. ') ||
          RegExp(r'^(введение|заключение|выводы по главе|список литературы)\s*:?$', caseSensitive: false).hasMatch(plain)) {
        continue;
      }
      if (dropNorm.contains(_norm(plain))) continue;
      if (RegExp(r'^\s*(---+|\*\*\*+|___+)\s*$').hasMatch(l)) continue;
      if (RegExp(r'^(конечно|вот|ниже приведен|ниже представлен|надеюсь|если нужно|примечание автора)(?=[\s,:!.]|$).*$', caseSensitive: false).hasMatch(plain) && plain.length < 140 && out.every((e) => e.trim().isEmpty)) {
        continue;
      }
      if (!_pipeLine.hasMatch(l)) {
        l = l.replaceAllMapped(RegExp(r'\*\*(.+?)\*\*'), (m) => m[1]!);
        l = l.replaceAllMapped(RegExp(r'(?<![\w*])\*(?!\s)([^*\n]+?)\*(?![\w*])'), (m) => m[1]!);
        l = l.replaceAllMapped(RegExp(r'__(.+?)__'), (m) => m[1]!);
        l = l.replaceAll(RegExp(r'^\s*>\s?'), '');
        l = l.replaceAllMapped(RegExp(r'^\s*[*•·▪]\s+'), (m) => '– ');
        l = l.replaceAllMapped(RegExp(r'^\s*-\s+'), (m) => '– ');
      }
      out.add(l);
    }
    t = out.join('\n');
    t = t.replaceAll(RegExp(r'\n{3,}'), '\n\n').trim();
    t = normalizeCitations(t);
    t = t.split('\n').map((l) => _pipeLine.hasMatch(l) ? l : typography(l)).join('\n');
    return removePhrases(t);
  }

  static String _norm(String s) => s.toLowerCase().replaceAll('ё', 'е').replaceAll(RegExp(r'[^a-zа-я0-9]'), '');

  /// Фразы «как языковая модель…» и т. п.
  static String removePhrases(String t) {
    return t
        .replaceAll(RegExp(r'[^.!?\n]*(как (языковая модель|ИИ|искусственный интеллект)|I am an AI|as an AI)[^.!?\n]*[.!?]\s*', caseSensitive: false), '')
        .replaceAll(RegExp(r'\n{3,}'), '\n\n')
        .trim();
  }

  /// [3,с.45] / [3; с. 45] / [3, стр. 45] / [3 с. 45] → [3, с. 45]; [3,5] → [3; 5].
  static String normalizeCitations(String t) {
    var r = t.replaceAllMapped(RegExp(r'\[\s*(\d{1,3})\s*[,;]?\s*(?:с|c|стр|p|pp)\.?\s*(\d+(?:\s*[–—-]\s*\d+)?)\s*\]', caseSensitive: false), (m) {
      final pages = m[2]!.replaceAll(RegExp(r'\s*[–—-]\s*'), '–');
      return '[${m[1]}, с.$nbsp$pages]';
    });
    r = r.replaceAllMapped(RegExp(r'\[\s*(\d{1,3}(?:\s*[,;]\s*\d{1,3})+)\s*\]'), (m) {
      final nums = m[1]!.split(RegExp(r'[,;]')).map((e) => e.trim()).where((e) => e.isNotEmpty).join('; ');
      return '[$nums]';
    });
    r = r.replaceAllMapped(RegExp(r'\[\s*(?:источник|source)\s*(\d{1,3})\s*\]', caseSensitive: false), (m) => '[${m[1]}]');
    return r;
  }

  static List<String> _cells(String line) {
    var l = line.trim();
    if (l.startsWith('|')) l = l.substring(1);
    if (l.endsWith('|')) l = l.substring(0, l.length - 1);
    return l.split('|').map((c) => collapseSpaces(c.replaceAll('**', ''))).toList();
  }

  /// Разбор разметки раздела в блоки.
  static List<DocBlock> parse(String raw) {
    final lines = raw.replaceAll('\r', '').split('\n');
    final blocks = <DocBlock>[];
    final para = <String>[];
    String? pendingCaption;
    String? pendingNumber;

    void flushPara() {
      if (para.isEmpty) return;
      final text = collapseSpaces(para.join(' '));
      if (text.isNotEmpty) blocks.add(ParaBlock(text));
      para.clear();
    }

    var i = 0;
    while (i < lines.length) {
      final line = lines[i];
      final trimmed = line.trim();
      if (trimmed.isEmpty) {
        flushPara();
        i++;
        continue;
      }
      final cap = tableCaption.firstMatch(trimmed);
      if (cap != null && _nextIsTable(lines, i + 1)) {
        flushPara();
        pendingCaption = CaptionUtil.cleanCaption(cap.group(2)!);
        pendingNumber = cap.group(1);
        i++;
        continue;
      }
      if (_pipeLine.hasMatch(line)) {
        flushPara();
        final rows = <List<String>>[];
        var headerRows = 0;
        var sawSep = false;
        while (i < lines.length && (_pipeLine.hasMatch(lines[i]) || _sepLine.hasMatch(lines[i]) && lines[i].contains('|'))) {
          if (_sepLine.hasMatch(lines[i])) {
            if (!sawSep) headerRows = rows.length;
            sawSep = true;
          } else {
            rows.add(_cells(lines[i]));
          }
          i++;
        }
        if (rows.isNotEmpty) {
          final cols = rows.fold<int>(0, (m, r) => r.length > m ? r.length : m);
          for (final r in rows) {
            while (r.length < cols) {
              r.add('–');
            }
            for (var k = 0; k < r.length; k++) {
              if (r[k].isEmpty) r[k] = '–';
            }
          }
          blocks.add(TableBlock(title: pendingCaption ?? '', number: pendingNumber, rows: rows, headerRows: sawSep ? (headerRows == 0 ? 1 : headerRows) : 1));
        }
        pendingCaption = null;
        pendingNumber = null;
        continue;
      }
      final li = _listLine.firstMatch(line);
      if (li != null) {
        flushPara();
        final marker = li.group(2) != null ? '${li.group(2)})' : '–';
        var text = collapseSpaces(li.group(3)!);
        // продолжение пункта на следующих строках (без маркера и без пустой строки)
        while (i + 1 < lines.length && lines[i + 1].trim().isNotEmpty && _listLine.firstMatch(lines[i + 1]) == null && !_pipeLine.hasMatch(lines[i + 1]) && lines[i + 1].startsWith(RegExp(r'\s{2,}'))) {
          i++;
          text = '$text ${collapseSpaces(lines[i])}';
        }
        blocks.add(ListItemBlock(text, marker: marker));
        i++;
        continue;
      }
      if (_noteLine.hasMatch(trimmed) && blocks.isNotEmpty && blocks.last is TableBlock && para.isEmpty) {
        blocks.add(NoteBlock(collapseSpaces(trimmed)));
        i++;
        continue;
      }
      para.add(trimmed);
      i++;
    }
    flushPara();
    return blocks;
  }

  static bool _nextIsTable(List<String> lines, int from) {
    for (var k = from; k < lines.length && k < from + 3; k++) {
      final t = lines[k].trim();
      if (t.isEmpty) continue;
      return _pipeLine.hasMatch(lines[k]);
    }
    return false;
  }

  // ---------------- Ссылки на источники ----------------

  static final RegExp citationRe = RegExp(r'\[(\d{1,3}(?:\s*;\s*\d{1,3})*)(?:,\s*с\.[\s ]*[\d–-]+)?\]');

  /// Номера источников, на которые есть ссылки в тексте.
  static List<int> citedNumbers(String text) {
    final out = <int>[];
    for (final m in citationRe.allMatches(text)) {
      for (final n in m.group(1)!.split(';')) {
        final v = int.tryParse(n.trim());
        if (v != null) out.add(v);
      }
    }
    return out;
  }

  /// Перенумерация ссылок: map старый номер → новый (отсутствующие в map удаляются).
  static String renumberCitations(String text, Map<int, int> map) {
    return text.replaceAllMapped(citationRe, (m) {
      final nums = m.group(1)!.split(';').map((e) => int.tryParse(e.trim())).whereType<int>().map((n) => map[n]).whereType<int>().toList();
      if (nums.isEmpty) return '';
      final pagePart = m.group(0)!.contains('с.') ? m.group(0)!.substring(m.group(0)!.indexOf(',')).replaceAll(']', '') : '';
      return '[${nums.join('; ')}$pagePart]';
    }).replaceAllMapped(RegExp(r' +([.,;:])'), (m) => m[1]!);
  }

  /// Удаляет ссылки на номера вне диапазона 1..max.
  static String dropInvalidCitations(String text, int max) {
    final map = {for (var i = 1; i <= max; i++) i: i};
    return renumberCitations(text, map);
  }

  // ---------------- Таблицы ----------------

  /// Сквозная нумерация таблиц: подписи и ссылки «таблице N» в тексте.
  /// [start] — номер первой таблицы раздела. Возвращает (новый текст, следующий номер).
  static (String, int) renumberTables(String text, int start) {
    final lines = text.split('\n');
    var n = start;
    final map = <String, int>{};
    for (var i = 0; i < lines.length; i++) {
      final m = tableCaption.firstMatch(lines[i].trim());
      if (m != null && _nextIsTable(lines, i + 1)) {
        final old = m.group(1);
        if (old != null && old != 'N') map[old] = n;
        lines[i] = 'Таблица $n — ${CaptionUtil.cleanCaption(m.group(2)!)}';
        n++;
      }
    }
    var out = lines.join('\n');
    if (map.isNotEmpty) {
      out = out.replaceAllMapped(RegExp(r'(таблиц[аеуыи]|табл\.)(\s| )+(\d+(?:\.\d+)?)', caseSensitive: false), (m) {
        final nn = map[m.group(3)!];
        return nn == null ? m.group(0)! : '${m.group(1)}${m.group(2)}$nn';
      });
    }
    return (out, n);
  }
}

/// Вспомогательное: подпись таблицы без точки на конце и без кавычек-ёлочек по краям.
class CaptionUtil {
  static String cleanCaption(String s) {
    var t = Reg.stripTrailingPunct(collapseSpaces(s.replaceAll('**', '')));
    final q = RegExp(r'^«([^«»]*)»$').firstMatch(t);
    if (q != null) t = q.group(1)!;
    return capitalize(t);
  }
}
