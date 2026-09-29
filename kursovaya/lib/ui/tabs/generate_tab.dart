import 'package:flutter/material.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../gen/generator.dart';
import '../../models/coursework.dart';
import '../../models/source.dart';
import '../../state/app_state.dart';
import '../plan_editor.dart';
import '../section_editor.dart';
import '../settings_screen.dart';
import '../widgets.dart';

class GenerateTab extends StatefulWidget {
  const GenerateTab({super.key, required this.cw, required this.onCheck});
  final Coursework cw;
  final VoidCallback onCheck;

  @override
  State<GenerateTab> createState() => _GenerateTabState();
}

class _GenerateTabState extends State<GenerateTab> {
  final ScrollController _live = ScrollController();

  Coursework get cw => widget.cw;

  @override
  void dispose() {
    _live.dispose();
    super.dispose();
  }

  Future<void> _run(AppState s, {Set<String>? only}) async {
    if (!s.aiReady) {
      snack(context, 'Сначала подключите ИИ в настройках.');
      return;
    }
    if (cw.meta.topic.trim().length < 5) {
      snack(context, 'Укажите тему курсовой на вкладке «Данные».');
      return;
    }
    final gen = s.generatorFor(cw);
    try {
      await WakelockPlus.enable();
    } catch (_) {
      // экран может погаснуть — генерация продолжится при возврате в приложение
    }
    await gen.run(only: only);
    try {
      await WakelockPlus.disable();
    } catch (_) {
      // игнорируем
    }
    if (!mounted) return;
    final all = Generator.stepsFor(cw).every((st) => cw.steps[st.id] == 'done');
    if (all) {
      snack(context, 'Курсовая сгенерирована. Проверьте её по регламенту.', action: SnackBarAction(label: 'Проверить', onPressed: widget.onCheck));
    }
  }

  String _detail(String id) {
    if (id == 'plan') return cw.plan == null ? 'объект, предмет, цель, задачи, главы' : 'Глав: ${cw.plan!.chapters.length}, приложений: ${cw.plan!.appendices.length}';
    if (id == 'sources') {
      final sel = cw.selectedSources;
      return sel.isEmpty ? 'литература из интернета, нормативные акты' : 'В списке: ${sel.length} (статей ${sel.where((x) => x.type == SourceType.article).length}, книг ${sel.where((x) => x.type == SourceType.book).length})';
    }
    if (id == 'facts') return cw.facts.isEmpty ? 'статистика и факты для практической главы' : 'Фактов: ${cw.facts.length}';
    if (id.startsWith('chapter')) {
      final n = int.parse(id.substring(7));
      final c = cw.chapters.where((x) => x.number == n).firstOrNull;
      if (c == null) return '';
      return '${c.title.isEmpty ? '' : '«${c.title}» · '}${c.words}${c.targetWords > 0 ? ' из ≈${c.targetWords}' : ''} слов';
    }
    if (id == 'conclusion') return _words(cw.conclusion);
    if (id == 'introduction') return '${_words(cw.introduction)} · пишется после основной части';
    if (id == 'appendices') return 'Готово: ${cw.appendices.where((a) => a.text.trim().isNotEmpty).length} из ${cw.appendices.length}';
    if (id == 'finalize') return 'сквозная нумерация таблиц, ссылки на приложения и источники';
    return '';
  }

  String _words(Section? sec) => sec == null ? '' : '${sec.words}${sec.targetWords > 0 ? ' из ≈${sec.targetWords}' : ''} слов';

  Future<void> _regenerate(AppState s, String id) async {
    final gen = s.generatorFor(cw);
    if (id == 'plan') {
      if (!await confirm(context, 'Пересоставить план?', 'Текст всех глав, введения и заключения будет удалён и написан заново.', ok: 'Пересоставить', danger: true)) return;
      gen.resetFrom('plan');
      await s.saveNow(cw);
      await _run(s);
      return;
    }
    if (id.startsWith('chapter') || id == 'conclusion' || id == 'introduction') {
      final sec = id == 'conclusion' ? cw.conclusion : (id == 'introduction' ? cw.introduction : cw.chapters.where((x) => 'chapter${x.number}' == id).firstOrNull);
      if (sec == null) return;
      if (sec.text.trim().isNotEmpty && !await confirm(context, 'Написать заново?', 'Текущий текст раздела «${sec.shortName}» будет заменён.', ok: 'Заново')) return;
      sec.text = '';
      sec.parts.clear();
    }
    if (id == 'appendices') {
      for (final a in cw.appendices) {
        a.text = '';
        a.status = PartStatus.pending;
      }
    }
    cw.steps.remove(id);
    await s.saveNow(cw);
    await _run(s, only: {id});
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final prog = s.progressFor(cw);
    final gen = s.generatorFor(cw);
    return ListenableBuilder(
      listenable: prog,
      builder: (context, _) {
        final steps = Generator.stepsFor(cw);
        final done = steps.where((x) => cw.steps[x.id] == 'done').length;
        final running = prog.running;
        if (running) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (_live.hasClients) _live.jumpTo(_live.position.maxScrollExtent);
          });
        }
        final t = Theme.of(context).textTheme;
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
          children: [
            if (!s.aiReady)
              InfoBanner(
                'Нейросеть не подключена. Подключите бесплатный сервис — это займёт пару минут.',
                kind: BannerKind.warning,
                action: TextButton(
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SettingsScreen())),
                  child: const Text('Подключить'),
                ),
              )
            else
              Text('Нейросеть: ${s.ai.label()}', style: t.bodySmall),
            const Gap(10),
            SizedBox(
              height: 54,
              child: running
                  ? FilledButton.icon(
                      style: FilledButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.error),
                      icon: const Icon(Icons.stop_circle_outlined),
                      label: const Text('Остановить'),
                      onPressed: gen.stop,
                    )
                  : FilledButton.icon(
                      icon: const Icon(Icons.auto_awesome),
                      label: Text(done == 0 ? 'Сгенерировать курсовую' : (done < steps.length ? 'Продолжить генерацию ($done из ${steps.length})' : 'Всё готово — проверить')),
                      onPressed: done == steps.length ? widget.onCheck : () => _run(s),
                    ),
            ),
            const Gap(6),
            LinearProgressIndicator(value: steps.isEmpty ? 0 : done / steps.length, minHeight: 6, borderRadius: BorderRadius.circular(4)),
            const Gap(4),
            Text(
              running ? prog.status : (done == steps.length ? 'Все шаги выполнены.' : 'Генерация идёт по шагам и сохраняется после каждого — её можно остановить и продолжить позже.'),
              style: t.bodySmall,
            ),
            if (prog.error != null && !running)
              InfoBanner(prog.error!, kind: BannerKind.error, action: TextButton(onPressed: () => _run(s), child: const Text('Повторить'))),
            if (running || prog.live.isNotEmpty) ...[
              const Gap(10),
              Card(
                margin: EdgeInsets.zero,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        if (running) const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
                        if (running) const SizedBox(width: 8),
                        Expanded(child: Text(running ? 'ИИ пишет…' : 'Последний ответ ИИ', style: t.labelLarge)),
                      ]),
                      const Gap(6),
                      SizedBox(
                        height: 180,
                        child: SingleChildScrollView(
                          controller: _live,
                          child: Text(prog.live.isEmpty ? '…' : prog.live, style: t.bodySmall?.copyWith(height: 1.35)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            if (cw.plan != null) _PlanCard(cw: cw, onEdit: () async {
              await Navigator.of(context).push(MaterialPageRoute(builder: (_) => PlanEditorScreen(cw: cw)));
              await s.saveNow(cw);
              if (mounted) setState(() {});
            }),
            const SectionTitle('Шаги'),
            for (final st in steps)
              _StepTile(
                title: st.title,
                detail: _detail(st.id),
                state: gen.stateOf(st.id),
                enabled: !running,
                onRegenerate: () => _regenerate(s, st.id),
              ),
            const SectionTitle('Текст работы', subtitle: 'Нажмите, чтобы прочитать или отредактировать'),
            for (final sec in cw.orderedSections)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(sec.text.trim().isEmpty ? Icons.radio_button_unchecked : Icons.description_outlined),
                title: Text(sec.kind == SectionKind.chapter ? 'Глава ${sec.number}. ${sec.title}' : sec.shortName, maxLines: 2, overflow: TextOverflow.ellipsis),
                subtitle: Text('${sec.words} слов'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () async {
                  await Navigator.of(context).push(MaterialPageRoute(builder: (_) => SectionEditorScreen(cw: cw, section: sec)));
                  if (mounted) setState(() {});
                },
              ),
            for (final a in cw.appendices)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(a.text.trim().isEmpty ? Icons.radio_button_unchecked : Icons.attach_file),
                title: Text('Приложение ${a.number}. ${a.title}', maxLines: 2, overflow: TextOverflow.ellipsis),
                trailing: const Icon(Icons.chevron_right),
                onTap: () async {
                  await Navigator.of(context).push(MaterialPageRoute(builder: (_) => SectionEditorScreen(cw: cw, appendix: a)));
                  if (mounted) setState(() {});
                },
              ),
            if (prog.log.isNotEmpty)
              ExpansionTile(
                tilePadding: EdgeInsets.zero,
                title: const Text('Журнал'),
                children: [
                  for (final l in prog.log.reversed.take(80))
                    Align(alignment: Alignment.centerLeft, child: Padding(padding: const EdgeInsets.symmetric(vertical: 2), child: Text(l, style: t.bodySmall))),
                ],
              ),
          ],
        );
      },
    );
  }
}

class _StepTile extends StatelessWidget {
  const _StepTile({required this.title, required this.detail, required this.state, required this.enabled, required this.onRegenerate});
  final String title;
  final String detail;
  final GenStepState state;
  final bool enabled;
  final VoidCallback onRegenerate;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final icon = switch (state) {
      GenStepState.done => const Icon(Icons.check_circle, color: Color(0xFF2E7D32)),
      GenStepState.running => const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5)),
      GenStepState.error => Icon(Icons.error, color: cs.error),
      GenStepState.skipped => Icon(Icons.remove_circle_outline, color: cs.outline),
      GenStepState.pending => Icon(Icons.radio_button_unchecked, color: cs.outline),
    };
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: SizedBox(width: 28, child: Center(child: icon)),
      title: Text(title),
      subtitle: detail.isEmpty ? null : Text(detail, maxLines: 3, overflow: TextOverflow.ellipsis),
      trailing: state == GenStepState.done || state == GenStepState.error
          ? IconButton(tooltip: 'Сделать заново', icon: const Icon(Icons.refresh), onPressed: enabled ? onRegenerate : null)
          : null,
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({required this.cw, required this.onEdit});
  final Coursework cw;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final p = cw.plan!;
    final t = Theme.of(context).textTheme;
    return Card(
      margin: const EdgeInsets.only(top: 14),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(child: Text('План работы', style: t.titleSmall)),
              TextButton.icon(onPressed: onEdit, icon: const Icon(Icons.edit_outlined, size: 18), label: const Text('Изменить')),
            ]),
            if (p.object.isNotEmpty) Text('Объект: ${p.object}', style: t.bodySmall),
            if (p.subject.isNotEmpty) Text('Предмет: ${p.subject}', style: t.bodySmall),
            if (p.goal.isNotEmpty) Text('Цель: ${p.goal}', style: t.bodySmall),
            const Gap(6),
            for (var i = 0; i < p.chapters.length; i++)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text('Глава ${i + 1}. ${p.chapters[i].title} (${p.chapters[i].role == 'theory' ? 'теория' : 'практика'})', style: t.bodyMedium),
              ),
            for (final a in cw.appendices) Text('Приложение ${a.number}. ${a.title}', style: t.bodySmall),
          ],
        ),
      ),
    );
  }
}
