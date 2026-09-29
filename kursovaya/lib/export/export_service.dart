import 'dart:io';
import 'dart:isolate';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:open_filex/open_filex.dart';
import 'package:share_plus/share_plus.dart';

import '../core/storage.dart';
import '../core/text_utils.dart';
import '../models/coursework.dart';
import '../models/settings.dart';
import 'doc_model.dart';
import 'docx_builder.dart';
import 'pdf_builder.dart';
import 'title_layout.dart';

class ExportBundle {
  ExportBundle({this.pdf, this.docx, required this.layout});
  final Uint8List? pdf;
  final Uint8List? docx;
  final LayoutInfo layout;
}

/// Сборка документов в отдельном потоке (интерфейс не подвисает) и работа с файлами.
class ExportService {
  ExportService(this.storage);
  final Storage storage;

  static FontSet? _fonts;

  static Future<FontSet> fonts() async {
    if (_fonts != null) return _fonts!;
    Future<Uint8List> load(String n) async => (await rootBundle.load('assets/fonts/$n')).buffer.asUint8List();
    _fonts = FontSet(
      regular: await load('LiberationSerif-Regular.ttf'),
      bold: await load('LiberationSerif-Bold.ttf'),
      italic: await load('LiberationSerif-Italic.ttf'),
      boldItalic: await load('LiberationSerif-BoldItalic.ttf'),
    );
    return _fonts!;
  }

  /// Вёрстка PDF (нужна и для PDF, и для номеров страниц в оглавлении Word, и для проверки объёма).
  static Future<ExportBundle> build(Coursework cw, InstitutionSettings inst, {bool pdf = true, bool docx = true}) async {
    final f = await fonts();
    final model = DocModel.from(cw, inst);
    return Isolate.run(() => buildSync(model, f, pdf: pdf, docx: docx));
  }

  static Future<ExportBundle> buildSync(DocModel model, FontSet f, {bool pdf = true, bool docx = true}) async {
    final r = await PdfBuilder(f).build(model);
    Uint8List? d;
    if (docx) {
      d = DocxBuilder(TitleMeasure.fromFonts(f.regular, f.bold)).build(model, layout: r.layout, tableParts: r.tableParts);
    }
    return ExportBundle(pdf: pdf ? r.bytes : null, docx: d, layout: r.layout);
  }

  static String baseName(Coursework cw) {
    final who = parsePersonName(cw.meta.studentName);
    final name = who.surname.isEmpty ? 'Курсовая' : 'Курсовая_${who.surname}_${who.initials.replaceAll(RegExp(r'[.\s ]'), '')}';
    final topic = cw.meta.topic.trim().split(RegExp(r'\s+')).take(4).join(' ');
    return safeFileName('${name}_$topic');
  }

  Future<File> save(String fileName, Uint8List bytes) => storage.writeExport(fileName, bytes);

  static const String docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  static const String pdfMime = 'application/pdf';

  static Future<void> share(File f, {required String mime, String? text}) async {
    await SharePlus.instance.share(ShareParams(files: [XFile(f.path, mimeType: mime)], text: text, subject: text));
  }

  static Future<String?> open(File f, {required String mime}) async {
    final r = await OpenFilex.open(f.path, type: mime);
    return r.type == ResultType.done ? null : r.message;
  }

  /// «Сохранить как…» — системный диалог выбора папки (Загрузки, Google Диск, Файлы iPhone).
  static Future<bool> saveAs(String fileName, Uint8List bytes, {required String mime}) async {
    final uri = await FilePicker.saveFile(fileName: fileName, bytes: bytes, mimeType: mime, dialogTitle: 'Сохранить курсовую');
    return uri != null;
  }
}
