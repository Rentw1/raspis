import 'package:flutter/material.dart';

import '../../ai/ai_client.dart';
import '../../core/text_utils.dart';
import '../../export/gost.dart';
import '../../models/coursework.dart';
import '../../models/source.dart';
import '../../qa/checker.dart';
import '../../state/app_state.dart';
import '../source_editor.dart';
import '../widgets.dart';

enum _Filter { selected, reserve, all }

class SourcesTab extends StatefulWidget {
  const SourcesTab({super.key, required this.cw, required this.onNext});
  final Coursework cw;
  final VoidCallback onNext;

  @override
  State<SourcesTab> createState() => _SourcesTabState();
}

class _SourcesTabState extends State<SourcesTab> {
  _Filter _filter = _Filter.selected;
  bool _busy = false;
  String _status = '';
  CancelToken? _cancel;

  Coursework get cw => widget.cw;

  void _mutateSources(AppState s, void Function() change) {
    final before = Gost.ordered(cw.sources);
    change();
    QaChecker.renumberAfterSourceChange(cw, before);
    s.saveSoon(cw);
    setState(() {});
  }

  Future<void> _search(AppState s) async {
    final cancel = CancelToken();
    setState(() {
      _busy = true;
      _cancel = cancel;
      _status = 'Ищу литературу…';
    });
    void log(String m) {
      if (mounted) setState(() => _status = m);
    }

    try {
      final f = s.finder(cancel);
      final need = cw.options.sourcesCount;
      final candidates = await f.findLiterature(cw, progress: log);
      final have = cw.sources.where((x) => x.selected && x.type != SourceType.normative && x.type != SourceType.web).length;
      final best = await f.selectBest(cw, candidates, (need - have).clamp(0, need), progress: log);
      final known = cw.sources.map((x) => x.dedupKey).toSet();
      var added = 0;
      final before = Gost.ordered(cw.sources);
      for (final x in best) {
        if (known.add(x.dedupKey)) {
          cw.sources.add(x..selected = true);
          added++;
        }
      }
      for (final x in candidates.take(40)) {
        if (known.add(x.dedupKey)) cw.sources.add(x..selected = false);
      }
      if (added == 0 && candidates.isEmpty && s.aiReady) {
        final ai = await f.aiLiterature(cw, need, progress: log);
        for (final x in ai) {
          if (known.add(x.dedupKey)) {
            cw.sources.add(x);
            added++;
          }
        }
      }
      if (cw.options.normativeActs && s.aiReady && !cw.sources.any((x) => x.type == SourceType.normative)) {
        try {
          final acts = await f.normativeActs(cw, progress: log);
          cw.sources.addAll(acts);
          added += acts.length;
        } on AiException catch (e) {
          if (e.kind == AiErrorKind.cancelled) rethrow;
          log('Нормативные акты: ${e.message}');
        }
      }
      QaChecker.renumberAfterSourceChange(cw, before);
      await s.saveNow(cw);
      if (mounted) snack(context, 'Добавлено в список: $added. В резерве — остальные найденные.');
      log(candidates.isEmpty ? 'Базы литературы не ответили. Проверьте интернет (Настройки → Интернет → «Проверить источники»).' : 'Готово.');
    } on AiException catch (e) {
      log(e.kind == AiErrorKind.cancelled ? 'Остановлено.' : e.message);
    } catch (e) {
      log('Ошибка поиска: $e');
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _cancel = null;
        });
      }
    }
  }

  Future<void> _edit(AppState s, Source src, {bool isNew = false}) async {
    final result = await Navigator.of(context).push<SourceEditResult>(MaterialPageRoute(builder: (_) => SourceEditorScreen(source: src.copy(), isNew: isNew)));
    if (result == null) return;
    _mutateSources(s, () {
      final i = cw.sources.indexWhere((x) => x.id == src.id);
      if (result.deleted) {
        if (i >= 0) cw.sources.removeAt(i);
      } else if (i >= 0) {
        cw.sources[i] = result.source;
      } else {
        cw.sources.add(result.source);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final ordered = Gost.ordered(cw.sources);
    final numberOf = {for (var i = 0; i < ordered.length; i++) ordered[i].id: i + 1};
    final list = switch (_filter) {
      _Filter.selected => ordered,
      _Filter.reserve => cw.sources.where((x) => !x.selected).toList(),
      _Filter.all => [...ordered, ...cw.sources.where((x) => !x.selected)],
    };
    int count(SourceType t) => ordered.where((x) => x.type == t).length;
    final t = Theme.of(context).textTheme;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('В списке литературы: ${ordered.length}', style: t.titleMedium),
              Text('статей ${count(SourceType.article)}, книг ${count(SourceType.book)}, нормативных актов ${count(SourceType.normative)}, сайтов ${count(SourceType.web)} · по алфавиту, ГОСТ 7.1-2003',
                  style: t.bodySmall),
              const Gap(10),
              Row(children: [
                Expanded(
                  child: FilledButton.icon(
                    icon: const Icon(Icons.travel_explore),
                    label: const Text('Найти в интернете'),
                    onPressed: _busy ? null : () => _search(s),
                  ),
                ),
                const SizedBox(width: 8),
                OutlinedButton.icon(
                  icon: const Icon(Icons.add),
                  label: const Text('Вручную'),
                  onPressed: _busy ? null : () => _edit(s, Source(id: newId('m'), type: SourceType.book, title: '', origin: SourceOrigin.manual, verified: true), isNew: true),
                ),
              ]),
              if (_busy) ...[
                const Gap(8),
                const LinearProgressIndicator(),
                const Gap(4),
                Row(children: [
                  Expanded(child: Text(_status, style: t.bodySmall, maxLines: 2, overflow: TextOverflow.ellipsis)),
                  TextButton(onPressed: () => _cancel?.cancel(), child: const Text('Стоп')),
                ]),
              ] else if (_status.isNotEmpty)
                Padding(padding: const EdgeInsets.only(top: 6), child: Text(_status, style: t.bodySmall)),
              const Gap(8),
              SegmentedButton<_Filter>(
                segments: [
                  ButtonSegment(value: _Filter.selected, label: Text('В списке (${ordered.length})')),
                  ButtonSegment(value: _Filter.reserve, label: Text('Резерв (${cw.sources.length - ordered.length})')),
                  const ButtonSegment(value: _Filter.all, label: Text('Все')),
                ],
                selected: {_filter},
                onSelectionChanged: (v) => setState(() => _filter = v.first),
              ),
            ],
          ),
        ),
        Expanded(
          child: list.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      _filter == _Filter.reserve
                          ? 'Резерв пуст. Найденные, но не выбранные публикации появятся здесь.'
                          : 'Пока нет источников. Нажмите «Найти в интернете» — или они подберутся автоматически при генерации.',
                      textAlign: TextAlign.center,
                    ),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
                  itemCount: list.length,
                  itemBuilder: (c, i) {
                    final src = list[i];
                    final n = numberOf[src.id];
                    return Card(
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () => _edit(s, src),
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(4, 8, 12, 8),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Checkbox(value: src.selected, onChanged: (v) => _mutateSources(s, () => src.selected = v ?? false)),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('${n != null ? '$n. ' : ''}${Gost.format(src)}', style: t.bodyMedium),
                                    const Gap(6),
                                    Wrap(spacing: 6, runSpacing: 4, children: [
                                      _Tag(src.type.label),
                                      _Tag(src.origin),
                                      if (src.year != null) _Tag('${src.year}'),
                                      if (!src.verified) _Tag(src.note ?? 'не проверено', warn: true),
                                    ]),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag(this.text, {this.warn = false});
  final String text;
  final bool warn;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: warn ? const Color(0xFFFFF0C2) : cs.surfaceContainerHighest, borderRadius: BorderRadius.circular(8)),
      child: Text(text, style: TextStyle(fontSize: 11, color: warn ? const Color(0xFF6D4C00) : cs.onSurfaceVariant)),
    );
  }
}
