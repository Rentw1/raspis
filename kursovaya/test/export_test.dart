import 'dart:convert';
import 'dart:io';

import 'package:archive/archive.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kursovaya/export/doc_model.dart';
import 'package:kursovaya/export/export_service.dart';
import 'package:kursovaya/models/settings.dart';

import 'fixtures/sample.dart';

void main() {
  final out = Platform.environment['EXPORT_OUT'];

  test('PDF и DOCX: страницы, оглавление, поля, колонтитулы', () async {
    final cw = sampleCoursework();
    final model = DocModel.from(cw, InstitutionSettings());
    final r = await ExportService.buildSync(model, loadTestFonts());
    final layout = r.layout;
    expect(layout.totalPages, greaterThan(10));
    expect(layout.startPage['toc'], 2, reason: 'содержание — на 2-й странице (титульный — 1-я)');
    expect(layout.startPage['introduction'], greaterThan(2));
    expect(layout.startPage['chapter1']! > layout.startPage['introduction']!, isTrue);
    expect(layout.volume['introduction'], isNotNull);
    expect(layout.mainPages, lessThanOrEqualTo(layout.totalPages));

    final zip = ZipDecoder().decodeBytes(r.docx!);
    String file(String n) => utf8.decode(zip.findFile(n)!.content as List<int>);
    final doc = file('word/document.xml');
    expect(doc, contains('w:pgMar w:top="1134" w:right="567" w:bottom="1134" w:left="1701"'));
    expect(doc, contains('<w:pgSz w:w="11906" w:h="16838"/>'));
    expect(doc, contains('<w:titlePg/>'));
    expect(doc, contains('TOC \\o'));
    expect(doc, contains('Таблица 1 — Динамика показателей'));
    final styles = file('word/styles.xml');
    expect(styles, contains('w:ascii="Times New Roman"'));
    expect(styles, contains('<w:sz w:val="28"/>'));
    expect(styles, contains('w:line="360"'));
    expect(styles, contains('<w:jc w:val="both"/>'));
    expect(file('word/header1.xml'), contains('ГАПОУ «ЛАИШЕВСКИЙ ТЕХНИКО - ЭКОНОМИЧЕСКИЙ ТЕХНИКУМ»'));
    expect(file('word/footer1.xml'), contains(' PAGE '));
    // номера страниц оглавления совпадают с вёрсткой
    expect(doc, contains('<w:t xml:space="preserve">${layout.startPage['introduction']}</w:t>'));

    if (out != null) {
      File('$out/sample.pdf').writeAsBytesSync(r.pdf!);
      File('$out/sample.docx').writeAsBytesSync(r.docx!);
      File('$out/layout.json').writeAsStringSync(jsonEncode(layout.toJson()));
    }
  });

  test('Длинная таблица переносится с «Продолжением таблицы»', () async {
    final cw = sampleCoursework(bigTableRows: 70, appendices: 1, appendixRows: 10);
    final model = DocModel.from(cw, InstitutionSettings());
    final r = await ExportService.buildSync(model, loadTestFonts());
    final zip = ZipDecoder().decodeBytes(r.docx!);
    final doc = utf8.decode(zip.findFile('word/document.xml')!.content as List<int>);
    expect(doc, contains('Продолжение таблицы 1'));
    // одно приложение не нумеруется
    expect(doc, contains('>Приложение</w:t>'));
    if (out != null) {
      File('$out/longtable.pdf').writeAsBytesSync(r.pdf!);
      File('$out/longtable.docx').writeAsBytesSync(r.docx!);
    }
  });
}
