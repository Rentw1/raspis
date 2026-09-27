import 'package:flutter/material.dart';

import '../core/regulation.dart';
import '../core/text_utils.dart';
import '../gen/generator.dart';
import '../models/coursework.dart';
import '../state/app_state.dart';
import 'widgets.dart';

/// Просмотр и правка текста раздела или приложения (простая разметка).
class SectionEditorScreen extends StatefulWidget {
  const SectionEditorScreen({super.key, required this.cw, this.section, this.appendix}) : assert(section != null || appendix != null);
  final Coursework cw;
  final Section? section;
  final Appendix? appendix;

  @override
  State<SectionEditorScreen> createState() => _SectionEditorScreenState();
}

class _SectionEditorScreenState extends State<SectionEditorScreen> {
  late final TextEditingController _text = TextEditingController(text: widget.section?.text ?? widget.appendix!.text);
  late final TextEditingController _title = TextEditingController(text: widget.section?.title ?? widget.appendix!.title);
  bool _busy = false;

  bool get _hasTitle => widget.appendix != null || widget.section!.kind == SectionKind.chapter;

  @override
  void dispose() {
    _text.dispose();
    _title.dispose();
    super.dispose();
  }

  void _save(AppState s) {
    if (widget.section != null) {
      widget.section!.text = _text.text;
      if (_hasTitle) {
        widget.section!.title = _title.text;
        final pc = widget.cw.plan?.chapters;
        final n = widget.section!.number;
        if (pc != null && n >= 1 && n <= pc.length) pc[n - 1].title = _title.text;
      }
    } else {
      widget.appendix!.text = _text.text;
      widget.appendix!.title = _title.text;
    }
    s.saveSoon(widget.cw);
  }

  Future<void> _ai(AppState s, String mode) async {
    final sec = widget.section;
    if (sec == null) return;
    if (!s.aiReady) {
      snack(context, 'Подключите ИИ в настройках.');
      return;
    }
    _save(s);
    setState(() => _busy = true);
    final gen = s.generatorFor(widget.cw);
    final prog = s.progressFor(widget.cw);
    if (mode == 'regenerate') {
      showDialog<void>(context: context, barrierDismissible: false, builder: (_) => _ProgressDialog(onStop: gen.stop, progress: prog));
      await gen.regenerateSection(sec);
    } else {
      showDialog<void>(context: context, barrierDismissible: false, builder: (_) => _ProgressDialog(onStop: gen.stop, progress: prog));
      await gen.rewriteSection(sec, mode);
    }
    if (!mounted) return;
    Navigator.of(context, rootNavigator: true).pop();
    setState(() {
      _busy = false;
      _text.text = sec.text;
    });
    if (prog.error != null) snack(context, prog.error!);
  }

  void _help() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (c) => const Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Как оформлять текст', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            SizedBox(height: 10),
            Text('• Абзацы разделяйте пустой строкой — отступ 1,25 см и выравнивание по ширине добавятся сами.'),
            Text('• Перечисление: каждая строка начинается с «– ».'),
            Text('• Таблица: строка «Таблица 2 — Название», ниже строки вида «| Показатель | 2024 | 2025 |».'),
            Text('• Ссылка на источник: [3, с. 45] — номер из списка литературы.'),
            Text('• Заголовки внутри глав не нужны: по регламенту главы не делятся на параграфы.'),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final sec = widget.section;
    final name = sec?.shortName ?? 'Приложение ${widget.appendix!.number}';
    final words = wordCount(_text.text);
    final target = sec?.targetWords ?? 0;
    return PopScope(
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) _save(s);
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(name),
          actions: [
            IconButton(tooltip: 'Как оформлять', icon: const Icon(Icons.help_outline), onPressed: _help),
            if (sec != null)
              PopupMenuButton<String>(
                enabled: !_busy,
                onSelected: (v) => _ai(s, v),
                itemBuilder: (c) => const [
                  PopupMenuItem(value: 'extend', child: ListTile(leading: Icon(Icons.unfold_more), title: Text('Расширить (ИИ)'))),
                  PopupMenuItem(value: 'shorten', child: ListTile(leading: Icon(Icons.unfold_less), title: Text('Сократить (ИИ)'))),
                  PopupMenuItem(value: 'rephrase', child: ListTile(leading: Icon(Icons.autorenew), title: Text('Перефразировать (ИИ)'))),
                  PopupMenuItem(value: 'regenerate', child: ListTile(leading: Icon(Icons.auto_awesome), title: Text('Написать заново (ИИ)'))),
                ],
              ),
          ],
        ),
        body: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
          child: Column(
            children: [
              if (_hasTitle) ...[
                TextField(
                  controller: _title,
                  maxLines: 2,
                  minLines: 1,
                  decoration: InputDecoration(
                    labelText: sec != null ? 'Название главы' : 'Название приложения',
                    helperText: sec != null ? 'В документе: ${Reg.chapterHeading(sec.number, _title.text)}' : null,
                    border: const OutlineInputBorder(),
                  ),
                  onChanged: (_) {
                    _save(s);
                    setState(() {});
                  },
                ),
                const Gap(8),
              ],
              Row(children: [
                Text('Слов: $words${target > 0 ? ' из ≈$target' : ''}', style: Theme.of(context).textTheme.bodySmall),
                const Spacer(),
                if (_busy) const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
              ]),
              const Gap(6),
              Expanded(
                child: TextField(
                  controller: _text,
                  expands: true,
                  maxLines: null,
                  minLines: null,
                  textAlignVertical: TextAlignVertical.top,
                  keyboardType: TextInputType.multiline,
                  textCapitalization: TextCapitalization.sentences,
                  style: const TextStyle(height: 1.4, fontSize: 15),
                  decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'Текст раздела…'),
                  onChanged: (_) {
                    _save(s);
                    setState(() {});
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProgressDialog extends StatelessWidget {
  const _ProgressDialog({required this.onStop, required this.progress});
  final VoidCallback onStop;
  final GenProgress progress;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('ИИ пишет…'),
      content: SizedBox(
        width: 400,
        height: 220,
        child: ListenableBuilder(
          listenable: progress,
          builder: (c, _) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(progress.status, style: Theme.of(context).textTheme.bodySmall),
            const Gap(8),
            const LinearProgressIndicator(),
            const Gap(8),
            Expanded(child: SingleChildScrollView(reverse: true, child: Text(progress.live, style: Theme.of(context).textTheme.bodySmall))),
          ]),
        ),
      ),
      actions: [TextButton(onPressed: onStop, child: const Text('Остановить'))],
    );
  }
}
