import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../export/export_service.dart';
import '../../models/coursework.dart';
import '../../qa/checker.dart';
import '../../state/app_state.dart';
import '../pdf_preview_screen.dart';
import '../widgets.dart';

enum _Kind { docx, pdf }

class ExportTab extends StatefulWidget {
  const ExportTab({super.key, required this.cw, required this.onCheck});
  final Coursework cw;
  final VoidCallback onCheck;

  @override
  State<ExportTab> createState() => _ExportTabState();
}

class _ExportTabState extends State<ExportTab> {
  bool _busy = false;
  File? _file;
  Uint8List? _bytes;
  String _mime = ExportService.docxMime;
  late final TextEditingController _name = TextEditingController(text: ExportService.baseName(widget.cw));

  Coursework get cw => widget.cw;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<bool> _gate(AppState s) async {
    final r = s.qa[cw.id];
    if (!cw.hasText) {
      snack(context, 'В работе ещё нет текста — сначала сгенерируйте её.');
      return false;
    }
    if (r == null) {
      return confirm(context, 'Работа не проверена', 'Перед экспортом рекомендуется проверка по регламенту (вкладка «Проверка»). Экспортировать без проверки?', ok: 'Экспортировать');
    }
    if (r.fails > 0) {
      final list = r.blocking.map((i) => '• ${i.title}').join('\n');
      return confirm(context, 'Есть критичные нарушения', 'По п. 6.2 регламента работа может быть оценена «неудовлетворительно»:\n\n$list\n\nВсё равно экспортировать?',
          ok: 'Экспортировать', danger: true);
    }
    return true;
  }

  Future<void> _export(AppState s, _Kind kind) async {
    if (!await _gate(s)) return;
    setState(() => _busy = true);
    try {
      final b = await ExportService.build(cw, s.settings.institution, pdf: kind == _Kind.pdf, docx: kind == _Kind.docx);
      cw.layout = b.layout;
      await s.saveNow(cw);
      final bytes = kind == _Kind.pdf ? b.pdf! : b.docx!;
      final name = '${_name.text.trim().isEmpty ? ExportService.baseName(cw) : _name.text.trim()}.${kind == _Kind.pdf ? 'pdf' : 'docx'}';
      final f = await ExportService(s.storage).save(name, bytes);
      if (!mounted) return;
      setState(() {
        _file = f;
        _bytes = bytes;
        _mime = kind == _Kind.pdf ? ExportService.pdfMime : ExportService.docxMime;
      });
      snack(context, 'Файл готов: $name (${b.layout.totalPages} стр.)');
    } catch (e) {
      if (mounted) snack(context, 'Ошибка экспорта: $e', duration: const Duration(seconds: 6));
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _preview(AppState s) async {
    setState(() => _busy = true);
    try {
      final b = await ExportService.build(cw, s.settings.institution, pdf: true, docx: false);
      cw.layout = b.layout;
      await s.saveNow(cw);
      if (!mounted) return;
      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => PdfPreviewScreen(bytes: b.pdf!, fileName: '${ExportService.baseName(cw)}.pdf')));
    } catch (e) {
      if (mounted) snack(context, 'Не удалось построить предпросмотр: $e');
    }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final r = s.qa[cw.id];
    final t = Theme.of(context).textTheme;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        if (r == null)
          InfoBanner('Работа ещё не проверена по регламенту.', kind: BannerKind.warning, action: TextButton(onPressed: widget.onCheck, child: const Text('Проверить')))
        else if (r.fails > 0)
          InfoBanner('Критичных нарушений: ${r.fails}. Прогноз: «${r.grade}». Исправьте их на вкладке «Проверка».', kind: BannerKind.error,
              action: TextButton(onPressed: widget.onCheck, child: const Text('Открыть')))
        else
          InfoBanner('Проверка пройдена. Прогноз оценки: «${r.grade}».', kind: BannerKind.success),
        const Gap(8),
        Card(
          margin: EdgeInsets.zero,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Оформление файла', style: t.titleSmall),
              const Gap(6),
              const Text('А4 · поля 30/10/20/20 мм · Times New Roman 14 · интервал 1,5 (в таблицах 1,0) · по ширине · отступ 1,25 см'),
              const Text('Заголовки по центру без точек и переносов · каждая часть с новой страницы · 2 интервала после заголовка'),
              const Text('Колонтитул «ГАПОУ «ЛАИШЕВСКИЙ ТЕХНИКО - ЭКОНОМИЧЕСКИЙ ТЕХНИКУМ»» со 2-й страницы · номер страницы внизу по центру'),
              const Text('Титульный лист по ПРИЛОЖЕНИЮ 4 · содержание с номерами страниц · список литературы по ГОСТ 7.1-2003'),
              if (cw.layout != null) ...[
                const Gap(6),
                Text('Страниц: ${cw.layout!.mainPages} без приложений, всего ${cw.layout!.totalPages}', style: t.bodySmall),
              ],
            ]),
          ),
        ),
        const Gap(12),
        TextField(
          controller: _name,
          decoration: const InputDecoration(labelText: 'Имя файла', border: OutlineInputBorder(), helperText: 'Расширение добавится само'),
        ),
        const Gap(12),
        Row(children: [
          Expanded(
            child: SizedBox(
              height: 52,
              child: FilledButton.icon(icon: const Icon(Icons.description), label: const Text('Word (.docx)'), onPressed: _busy ? null : () => _export(s, _Kind.docx)),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: SizedBox(
              height: 52,
              child: FilledButton.tonalIcon(icon: const Icon(Icons.picture_as_pdf), label: const Text('PDF'), onPressed: _busy ? null : () => _export(s, _Kind.pdf)),
            ),
          ),
        ]),
        const Gap(10),
        OutlinedButton.icon(icon: const Icon(Icons.preview_outlined), label: const Text('Предпросмотр и печать'), onPressed: _busy ? null : () => _preview(s)),
        if (_busy) const Padding(padding: EdgeInsets.only(top: 12), child: LinearProgressIndicator()),
        if (_file != null && _bytes != null) ...[
          const Gap(16),
          Card(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Icon(_mime == ExportService.pdfMime ? Icons.picture_as_pdf : Icons.description, color: Theme.of(context).colorScheme.primary),
                  const SizedBox(width: 8),
                  Expanded(child: Text(_file!.uri.pathSegments.last, style: t.titleSmall)),
                ]),
                const Gap(4),
                Text('${(_bytes!.length / 1024).toStringAsFixed(0)} КБ · сохранён в папке приложения «Курсовые»', style: t.bodySmall),
                const Gap(10),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  FilledButton.tonalIcon(
                    icon: const Icon(Icons.open_in_new),
                    label: const Text('Открыть'),
                    onPressed: () async {
                      final err = await ExportService.open(_file!, mime: _mime);
                      if (err != null && context.mounted) snack(context, 'Нет приложения для открытия: $err. Установите Word, WPS или OnlyOffice.');
                    },
                  ),
                  FilledButton.tonalIcon(
                    icon: const Icon(Icons.share),
                    label: const Text('Поделиться'),
                    onPressed: () => ExportService.share(_file!, mime: _mime, text: cw.meta.topic),
                  ),
                  FilledButton.tonalIcon(
                    icon: const Icon(Icons.save_alt),
                    label: const Text('Сохранить в…'),
                    onPressed: () async {
                      final ok = await ExportService.saveAs(_file!.uri.pathSegments.last, _bytes!, mime: _mime);
                      if (ok && context.mounted) snack(context, 'Сохранено.');
                    },
                  ),
                ]),
              ]),
            ),
          ),
        ],
        const Gap(16),
        Text('PDF использует шрифт Liberation Serif — точную по метрикам замену Times New Roman (поэтому вёрстка и число страниц совпадают с Word). '
            'В файле Word указан Times New Roman.', style: t.bodySmall),
        if (r != null && r.items.any((i) => i.level == CheckLevel.warn)) ...[
          const Gap(8),
          Text('Замечаний: ${r.warnings}. Их можно исправить на вкладке «Проверка».', style: t.bodySmall),
        ],
      ],
    );
  }
}
