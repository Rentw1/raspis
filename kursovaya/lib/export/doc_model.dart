import '../core/regulation.dart';
import '../core/text_utils.dart';
import '../gen/markup.dart';
import '../models/coursework.dart';
import '../models/settings.dart';
import 'gost.dart';

/// Таблица с присвоенным номером для вывода.
class NumberedTable {
  NumberedTable(this.label, this.table, this.key);

  /// «1» для основной части, «1.1» — для приложения 1.
  final String label;
  final TableBlock table;

  /// Уникальный ключ таблицы в документе (для «Продолжения таблицы» в DOCX).
  final String key;
}

/// Элемент содержимого структурной части.
sealed class DocItem {
  const DocItem();
}

class DocPara extends DocItem {
  const DocPara(this.text, {this.indent = true});
  final String text;
  final bool indent;
}

class DocListItem extends DocItem {
  const DocListItem(this.marker, this.text);
  final String marker;
  final String text;
}

class DocTable extends DocItem {
  const DocTable(this.table);
  final NumberedTable table;
}

class DocNote extends DocItem {
  const DocNote(this.text);
  final String text;
}

class DocBibItem extends DocItem {
  const DocBibItem(this.number, this.text);
  final int number;
  final String text;
}

class DocSignature extends DocItem {
  const DocSignature(this.initialsName, this.year);
  final String initialsName;
  final int year;
}

enum PartKind { introduction, chapter, conclusion, bibliography, appendix }

/// Структурная часть: начинается с новой страницы, имеет заголовок.
class DocPart {
  DocPart({required this.id, required this.kind, required this.heading, required this.tocText, required this.items, this.appendixNumber});
  final String id;
  final PartKind kind;

  /// Заголовок, как он печатается (для приложения — название под словом «Приложение N»).
  final String heading;
  final String tocText;
  final List<DocItem> items;
  final int? appendixNumber;
}

class TitlePageData {
  TitlePageData({
    required this.ministry,
    required this.org1,
    required this.org2,
    required this.discipline,
    required this.topic,
    required this.student,
    required this.female,
    required this.group,
    required this.course,
    required this.specialty,
    required this.supervisor,
    required this.academicYear,
  });

  final String ministry;
  final String org1;
  final String org2;
  final String discipline;
  final String topic;
  final String student;
  final bool female;
  final String group;
  final int course;
  final String specialty;
  final String supervisor;
  final String academicYear;

  String get yearLine {
    final m = RegExp(r'(\d{4})\D+(\d{4})').firstMatch(academicYear);
    return m == null ? '$academicYear уч. год.' : '${m[1]} - ${m[2]} уч. год.';
  }
}

/// Модель документа — общая для экспорта в PDF и DOCX.
class DocModel {
  DocModel({required this.title, required this.parts, required this.headerText, required this.docTitle, required this.author});

  final TitlePageData title;
  final List<DocPart> parts;
  final String headerText;
  final String docTitle;
  final String author;

  /// Части, входящие в обязательный объём (без приложений).
  List<DocPart> get mainParts => parts.where((p) => p.kind != PartKind.appendix).toList();

  static DocModel from(Coursework cw, InstitutionSettings inst) {
    final m = cw.meta;
    final title = TitlePageData(
      ministry: inst.ministry,
      org1: inst.orgLine1,
      org2: inst.orgLine2,
      discipline: m.discipline.trim(),
      topic: m.topic.trim(),
      student: m.studentName.trim(),
      female: isFemaleName(m.studentName),
      group: m.group.trim(),
      course: m.course,
      specialty: m.specialty.trim(),
      supervisor: m.supervisor.trim(),
      academicYear: m.academicYear,
    );
    final parts = <DocPart>[];
    var tableNo = 1;

    List<DocItem> items(String text, String keyPrefix, {String Function(int k)? tableLabel}) {
      final out = <DocItem>[];
      var k = 0;
      for (final b in Markup.parse(text)) {
        switch (b) {
          case ParaBlock():
            out.add(DocPara(b.text));
          case ListItemBlock():
            out.add(DocListItem(b.marker, b.text));
          case TableBlock():
            k++;
            final label = tableLabel != null ? tableLabel(k) : '${tableNo++}';
            out.add(DocTable(NumberedTable(label, b, '$keyPrefix-t$k')));
          case NoteBlock():
            out.add(DocNote(b.text));
        }
      }
      return out;
    }

    final intro = cw.introduction;
    if (intro != null) {
      parts.add(DocPart(id: 'introduction', kind: PartKind.introduction, heading: Reg.introTitle, tocText: Reg.introTitle, items: items(intro.text, 'intro')));
    }
    for (final c in cw.chapters) {
      final h = c.heading;
      parts.add(DocPart(id: 'chapter${c.number}', kind: PartKind.chapter, heading: h, tocText: h, items: items(c.text, 'ch${c.number}')));
    }
    final concl = cw.conclusion;
    if (concl != null) {
      parts.add(DocPart(id: 'conclusion', kind: PartKind.conclusion, heading: Reg.conclusionTitle, tocText: Reg.conclusionTitle, items: items(concl.text, 'concl')));
    }
    final ordered = Gost.ordered(cw.sources);
    final bib = <DocItem>[for (var i = 0; i < ordered.length; i++) DocBibItem(i + 1, Gost.format(ordered[i]))];
    final signature = DocSignature(parsePersonName(m.studentName).initialsSurname, DateTime.now().year);
    if (cw.options.signature == SignaturePlace.afterBibliography || cw.appendices.isEmpty) bib.add(signature);
    parts.add(DocPart(id: 'bibliography', kind: PartKind.bibliography, heading: Reg.bibliographyTitle, tocText: Reg.bibliographyTitle, items: bib));
    // Регламент: если приложение одно, оно не нумеруется.
    final single = cw.appendices.length == 1;
    for (final a in cw.appendices) {
      final t = Reg.cleanHeading(a.title);
      final it = items(a.text, 'app${a.number}', tableLabel: (k) => single ? 'П.$k' : '${a.number}.$k');
      if (identical(a, cw.appendices.last) && cw.options.signature == SignaturePlace.endOfWork) it.add(signature);
      parts.add(DocPart(
        id: 'appendix${a.number}',
        kind: PartKind.appendix,
        heading: t,
        tocText: single ? '${Reg.appendixLabel}. $t' : '${Reg.appendixLabel} ${a.number}. $t',
        items: it,
        appendixNumber: single ? null : a.number,
      ));
    }
    if (single) {
      final re = RegExp(r'(приложени[еияю])(\s|\u00A0)+1(?!\d)', caseSensitive: false);
      for (var i = 0; i < parts.length; i++) {
        final p = parts[i];
        if (p.kind == PartKind.appendix || p.kind == PartKind.bibliography) continue;
        parts[i] = DocPart(
          id: p.id,
          kind: p.kind,
          heading: p.heading,
          tocText: p.tocText,
          appendixNumber: p.appendixNumber,
          items: p.items.map((e) => switch (e) {
                DocPara() => DocPara(e.text.replaceAllMapped(re, (m) => m[1]!), indent: e.indent),
                DocListItem() => DocListItem(e.marker, e.text.replaceAllMapped(re, (m) => m[1]!)),
                _ => e,
              }).toList(),
        );
      }
    }
    return DocModel(title: title, parts: parts, headerText: inst.headerText, docTitle: m.topic.trim(), author: m.studentName.trim());
  }
}
