import 'package:flutter/material.dart';

import '../../ai/ai_client.dart';
import '../../ai/prompts.dart';
import '../../core/json_utils.dart';
import '../../core/text_utils.dart';
import '../../gen/generator.dart';
import '../../models/coursework.dart';
import '../../qa/checker.dart';
import '../../state/app_state.dart';
import '../widgets.dart';

class CheckTab extends StatefulWidget {
  const CheckTab({super.key, required this.cw, required this.onExport});
  final Coursework cw;
  final VoidCallback onExport;

  @override
  State<CheckTab> createState() => _CheckTabState();
}

class _CheckTabState extends State<CheckTab> {
  bool _checking = false;
  bool _reviewing = false;
  String? _error;

  Coursework get cw => widget.cw;

  Future<void> _check(AppState s) async {
    setState(() {
      _checking = true;
      _error = null;
    });
    try {
      await s.runQa(cw);
    } catch (e) {
      _error = 'Не удалось проверить: $e';
    }
    if (mounted) setState(() => _checking = false);
  }

  Future<void> _withProgress(AppState s, Future<void> Function() action) async {
    final prog = s.progressFor(cw);
    final gen = s.generatorFor(cw);
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (c) => AlertDialog(
        title: const Text('Исправляю…'),
        content: SizedBox(
          width: 400,
          height: 200,
          child: ListenableBuilder(
            listenable: prog,
            builder: (c, _) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(prog.status, style: Theme.of(context).textTheme.bodySmall),
              const Gap(8),
              const LinearProgressIndicator(),
              const Gap(8),
              Expanded(child: SingleChildScrollView(reverse: true, child: Text(prog.live, style: Theme.of(context).textTheme.bodySmall))),
            ]),
          ),
        ),
        actions: [TextButton(onPressed: gen.stop, child: const Text('Остановить'))],
      ),
    );
    try {
      await action();
    } finally {
      if (mounted) Navigator.of(context, rootNavigator: true).pop();
    }
    if (prog.error != null && mounted) snack(context, prog.error!);
  }

  Future<void> _fix(AppState s, CheckItem item) async {
    final fix = item.fix!;
    if (!item.aiFix) {
      final msg = QaChecker.applyFix(fix, cw);
      await s.saveNow(cw);
      if (mounted && msg != null) snack(context, msg);
      await _check(s);
      return;
    }
    if (!s.aiReady) {
      snack(context, 'Для этого исправления нужен ИИ — подключите его в настройках.');
      return;
    }
    final gen = s.generatorFor(cw);
    await _withProgress(s, () async {
      if (fix.startsWith('gen:')) {
        final step = fix.substring(4);
        final sec = step == 'introduction'
            ? cw.introduction
            : (step == 'conclusion' ? cw.conclusion : cw.chapters.where((c) => 'chapter${c.number}' == step).firstOrNull);
        if (sec != null) {
          await gen.regenerateSection(sec);
        } else {
          cw.steps.remove(step);
          await gen.run(only: {step});
        }
      } else if (fix.startsWith('ai:extend:') || fix.startsWith('ai:shorten:')) {
        final mode = fix.startsWith('ai:extend:') ? 'extend' : 'shorten';
        final id = fix.substring(fix.lastIndexOf(':') + 1);
        final targets = id == 'all' ? cw.chapters : cw.orderedSections.where((x) => x.id == id).toList();
        for (final sec in targets) {
          await gen.rewriteSection(sec, mode);
          if (s.progressFor(cw).error != null) break;
        }
      } else if (fix == 'ai:paraphrase_cite') {
        for (final c in cw.chapters) {
          await gen.rewriteSection(c, 'extend');
        }
      } else if (fix == 'ai:paraphrase_copied') {
        await _paraphraseCopied(s, gen);
      } else if (fix == 'enable_appendices') {
        cw.options.appendices = true;
        if (cw.options.appendixCount < 1) cw.options.appendixCount = 2;
        final plan = cw.plan;
        if (plan != null && plan.appendices.isEmpty) {
          plan.appendices.addAll([
            PlanAppendix(title: 'Исходные данные для анализа', content: 'таблица исходных данных', chapter: cw.chapters.length >= 2 ? 2 : 1),
            if (cw.options.appendixCount > 1) PlanAppendix(title: 'Дополнительные материалы по теме исследования', content: 'таблица или схема', chapter: cw.chapters.length >= 2 ? 2 : 1),
          ]);
        }
        Generator.syncSectionsWithPlan(cw);
        cw.steps.remove('appendices');
        await gen.run(only: {'appendices'});
        Generator.ensureAppendixReferences(cw);
      }
      await s.saveNow(cw);
    });
    await _check(s);
  }

  Future<void> _paraphraseCopied(AppState s, Generator gen) async {
    final corpus = <String>{
      for (final src in cw.sources)
        if ((src.annotation ?? '').length > 80) ...shingles(src.annotation!),
      for (final f in cw.facts) ...shingles(f.text),
      if (cw.wikiContext.isNotEmpty) ...shingles(cw.wikiContext),
    };
    final prog = s.progressFor(cw);
    for (final sec in cw.orderedSections) {
      final paras = sec.text.split(RegExp(r'\n\s*\n'));
      var changed = false;
      for (var i = 0; i < paras.length; i++) {
        final p = paras[i];
        if (p.trim().startsWith('|') || wordCount(p) < 25) continue;
        if (containment(shingles(p), corpus) <= 0.3) continue;
        prog.setStatus('Перефразирую абзац: ${sec.shortName}');
        try {
          paras[i] = await gen.paraphrase(p);
          changed = true;
        } on AiException catch (e) {
          prog.error = e.message;
          return;
        }
      }
      if (changed) sec.text = paras.join('\n\n');
    }
  }

  Future<void> _review(AppState s, QaReport r) async {
    if (!s.aiReady) {
      snack(context, 'Подключите ИИ в настройках.');
      return;
    }
    setState(() => _reviewing = true);
    try {
      final qaSummary = r.items
          .where((i) => i.level == CheckLevel.fail || i.level == CheckLevel.warn)
          .map((i) => '- ${i.title}: ${i.detail}')
          .join('\n');
      final ex = StringBuffer();
      if (cw.introduction != null) ex.writeln('ВВЕДЕНИЕ: ${truncate(cw.introduction!.text, 1500)}');
      for (final c in cw.chapters) {
        final t = c.text;
        ex.writeln('ГЛАВА ${c.number} «${c.title}»: ${truncate(t, 900)} … ${t.length > 700 ? t.substring(t.length - 700) : ''}');
      }
      if (cw.conclusion != null) ex.writeln('ЗАКЛЮЧЕНИЕ: ${truncate(cw.conclusion!.text, 1200)}');
      ex.writeln('Источников в списке: ${cw.selectedSources.length}; страниц: ${cw.layout?.mainPages ?? '—'}.');
      final j = await s.ai.chatJson(Prompts.jsonSystem, Prompts.reviewRequest(cw, qaSummary.isEmpty ? 'нарушений не найдено' : qaSummary, ex.toString()),
          temperature: 0.3, maxTokens: 2500);
      if (j is! Map) throw AiException('ИИ не прислал рецензию.', kind: AiErrorKind.format);
      final b = StringBuffer()
        ..writeln('Соответствие работы теме и характер раскрытия: ${jStr(j['topic_fit'])}')
        ..writeln()
        ..writeln('Полнота раскрытия теоретической части: ${jStr(j['theory'])}')
        ..writeln()
        ..writeln('Характер выполнения аналитической, практической части: ${jStr(j['practice'])}')
        ..writeln()
        ..writeln('Творческий характер работы: ${jStr(j['creativity'])}')
        ..writeln()
        ..writeln('Соблюдение требований к оформлению: ${jStr(j['formatting'])}')
        ..writeln()
        ..writeln('Замечания и рекомендации:');
      for (final rm in jStrList(j['remarks'], max: 12)) {
        b.writeln('– $rm');
      }
      b
        ..writeln()
        ..writeln('Оценка: ${jStr(j['grade'])}. Допуск к защите: ${j['admit'] == false ? 'нет' : 'да'}.');
      cw.aiReview = b.toString().trim();
      await s.saveNow(cw);
    } on AiException catch (e) {
      if (mounted) snack(context, e.message);
    } catch (e) {
      if (mounted) snack(context, 'Не удалось получить рецензию: $e');
    }
    if (mounted) setState(() => _reviewing = false);
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final r = s.qa[cw.id];
    final t = Theme.of(context).textTheme;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        const InfoBanner('Симуляция оценки: работа проверяется по негативным критериям п. 6.2 регламента (структура, объём, оформление, ссылки, плагиат) '
            'и требованиям к оформлению. Проверка вёрстки считает реальные страницы документа.'),
        const Gap(8),
        SizedBox(
          height: 52,
          child: FilledButton.icon(
            icon: _checking ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white)) : const Icon(Icons.fact_check),
            label: Text(r == null ? 'Проверить по регламенту' : 'Проверить ещё раз'),
            onPressed: _checking || s.isGenerating(cw) ? null : () => _check(s),
          ),
        ),
        if (_error != null) InfoBanner(_error!, kind: BannerKind.error),
        if (r != null) ...[
          const Gap(12),
          _GradeCard(report: r),
          for (final g in CheckGroup.values)
            if (r.items.any((i) => i.group == g)) ...[
              SectionTitle(g.label),
              Card(
                margin: EdgeInsets.zero,
                child: Column(children: [
                  for (final i in r.items.where((i) => i.group == g))
                    ListTile(
                      leading: _levelIcon(i.level, context),
                      title: Text(i.title),
                      subtitle: Text(i.detail),
                      isThreeLine: i.detail.length > 60,
                      trailing: i.fix == null
                          ? null
                          : TextButton(onPressed: _checking ? null : () => _fix(s, i), child: Text(i.fixLabel ?? 'Исправить', textAlign: TextAlign.center)),
                    ),
                ]),
              ),
            ],
          const SectionTitle('Рецензия', subtitle: 'По форме ПРИЛОЖЕНИЯ 3 регламента — как её напишет руководитель'),
          if (cw.aiReview != null) Card(margin: EdgeInsets.zero, child: Padding(padding: const EdgeInsets.all(14), child: SelectableText(cw.aiReview!, style: t.bodyMedium))),
          const Gap(8),
          OutlinedButton.icon(
            icon: _reviewing ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.rate_review_outlined),
            label: Text(cw.aiReview == null ? 'Получить рецензию ИИ' : 'Обновить рецензию'),
            onPressed: _reviewing ? null : () => _review(s, r),
          ),
          const Gap(20),
          FilledButton.icon(onPressed: widget.onExport, icon: const Icon(Icons.arrow_forward), label: const Text('Далее: экспорт')),
        ],
      ],
    );
  }

  Widget _levelIcon(CheckLevel l, BuildContext context) => switch (l) {
        CheckLevel.ok => const Icon(Icons.check_circle, color: Color(0xFF2E7D32)),
        CheckLevel.info => Icon(Icons.info_outline, color: Theme.of(context).colorScheme.primary),
        CheckLevel.warn => const Icon(Icons.warning_amber_rounded, color: Color(0xFFE09B00)),
        CheckLevel.fail => Icon(Icons.cancel, color: Theme.of(context).colorScheme.error),
      };
}

class _GradeCard extends StatelessWidget {
  const _GradeCard({required this.report});
  final QaReport report;

  @override
  Widget build(BuildContext context) {
    final g = report.grade;
    final color = switch (g) {
      'отлично' => const Color(0xFF2E7D32),
      'хорошо' => const Color(0xFF1565C0),
      'удовлетворительно' => const Color(0xFFE09B00),
      _ => Theme.of(context).colorScheme.error,
    };
    final l = report.layout;
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Прогноз оценки', style: Theme.of(context).textTheme.labelLarge),
            const Gap(4),
            Text('«$g»', style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: color, fontWeight: FontWeight.w700)),
            const Gap(6),
            Text(report.gradeNote),
            const Gap(8),
            Wrap(spacing: 8, runSpacing: 6, children: [
              Chip(avatar: const Icon(Icons.cancel, size: 18), label: Text('Критичных: ${report.fails}')),
              Chip(avatar: const Icon(Icons.warning_amber_rounded, size: 18), label: Text('Замечаний: ${report.warnings}')),
              if (l != null) Chip(avatar: const Icon(Icons.description_outlined, size: 18), label: Text('Страниц: ${l.mainPages} (+ прил. ${l.totalPages - l.mainPages})')),
            ]),
          ],
        ),
      ),
    );
  }
}
