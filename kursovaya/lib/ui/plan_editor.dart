import 'package:flutter/material.dart';

import '../core/regulation.dart';
import '../gen/generator.dart';
import '../models/coursework.dart';
import '../state/app_state.dart';
import 'widgets.dart';

/// Правка плана: объект, предмет, цель, задачи, названия и пункты глав, приложения.
class PlanEditorScreen extends StatefulWidget {
  const PlanEditorScreen({super.key, required this.cw});
  final Coursework cw;

  @override
  State<PlanEditorScreen> createState() => _PlanEditorScreenState();
}

class _PlanEditorScreenState extends State<PlanEditorScreen> {
  Plan get p => widget.cw.plan!;

  List<String> _lines(String v) => v.split('\n').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();

  void _save(AppState s) {
    for (final c in p.chapters) {
      c.title = Reg.cleanHeading(c.title);
    }
    Generator.syncSectionsWithPlan(widget.cw);
    s.saveSoon(widget.cw);
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    return PopScope(
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) _save(s);
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('План работы')),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
          children: [
            const InfoBanner('Изменения плана учитываются при следующей генерации глав. Уже написанный текст не меняется — перегенерируйте нужные главы.'),
            const Gap(8),
            ModelTextField(label: 'Объект исследования', value: p.object, maxLines: 3, onChanged: (v) => p.object = v),
            const Gap(12),
            ModelTextField(label: 'Предмет исследования', value: p.subject, maxLines: 3, onChanged: (v) => p.subject = v),
            const Gap(12),
            ModelTextField(label: 'Цель работы', value: p.goal, maxLines: 3, onChanged: (v) => p.goal = v),
            const Gap(12),
            ModelTextField(label: 'Задачи (каждая с новой строки)', value: p.tasks.join('\n'), maxLines: 8, minLines: 3, onChanged: (v) => p.tasks = _lines(v)),
            const Gap(12),
            ModelTextField(label: 'Методы исследования (каждый с новой строки)', value: p.methods.join('\n'), maxLines: 6, minLines: 2, onChanged: (v) => p.methods = _lines(v)),
            for (var i = 0; i < p.chapters.length; i++) ...[
              SectionTitle('Глава ${i + 1} — ${p.chapters[i].role == 'theory' ? 'теоретическая' : 'практическая'}'),
              ModelTextField(label: 'Название главы', value: p.chapters[i].title, maxLines: 3, onChanged: (v) => p.chapters[i].title = v),
              const Gap(12),
              ModelTextField(
                label: 'Смысловые пункты (каждый с новой строки, без подзаголовков в тексте)',
                value: p.chapters[i].points.join('\n'),
                maxLines: 10,
                minLines: 3,
                onChanged: (v) => p.chapters[i].points = _lines(v),
              ),
              const Gap(12),
              ModelTextField(
                label: 'Таблицы в главе (названия, каждое с новой строки)',
                value: p.chapters[i].tables.join('\n'),
                maxLines: 4,
                minLines: 1,
                onChanged: (v) => p.chapters[i].tables = _lines(v),
              ),
            ],
            if (p.appendices.isNotEmpty) const SectionTitle('Приложения'),
            for (var i = 0; i < p.appendices.length; i++) ...[
              ModelTextField(label: 'Приложение ${i + 1}: название', value: p.appendices[i].title, onChanged: (v) => p.appendices[i].title = v),
              const Gap(8),
              ModelTextField(label: 'Что в нём', value: p.appendices[i].content, maxLines: 3, onChanged: (v) => p.appendices[i].content = v),
              const Gap(12),
            ],
          ],
        ),
      ),
    );
  }
}
