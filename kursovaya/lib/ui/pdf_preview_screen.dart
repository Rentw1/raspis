import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:printing/printing.dart';

/// Просмотр готового документа постранично (с печатью и отправкой).
class PdfPreviewScreen extends StatelessWidget {
  const PdfPreviewScreen({super.key, required this.bytes, required this.fileName});
  final Uint8List bytes;
  final String fileName;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Предпросмотр')),
      body: PdfPreview(
        build: (_) async => bytes,
        pdfFileName: fileName,
        canChangeOrientation: false,
        canChangePageFormat: false,
        canDebug: false,
        allowPrinting: true,
        allowSharing: true,
        maxPageWidth: 820,
        loadingWidget: const Center(child: CircularProgressIndicator()),
        onError: (c, e) => Center(child: Padding(padding: const EdgeInsets.all(24), child: Text('Не удалось показать документ: $e'))),
      ),
    );
  }
}
