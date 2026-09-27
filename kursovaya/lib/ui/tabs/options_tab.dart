import 'package:flutter/material.dart';

import '../../gen/budget.dart';
import '../../gen/generator.dart';
import '../../models/coursework.dart';
import '../../state/app_state.dart';
import '../widgets.dart';

/// Тонкие настройки генерации.
class OptionsTab extends StatefulWidget {
  const OptionsTab({super.key, required this.cw, required this.onNext});
  final Coursework cw;
  final VoidCallback onNext;

  @override
  State<OptionsTab> createState() => _OptionsTabState();
}

class _OptionsTabState extends State<OptionsTab> {
  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final o = widget.cw.options;
    void changed() {
      if (widget.cw.plan != null) Generator.syncSectionsWithPlan(widget.cw);
      s.saveSoon(widget.cw);
      setState(() {});
    }

    final b = Budget.compute(o, sources: o.sourcesCount);
    final t = Theme.of(context).textTheme;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        const SectionTitle('Основная часть'),
        Text('Соотношение «Теория / Практика»: ${o.theoryPercent}% / ${100 - o.theoryPercent}%', style: t.bodyLarge),
        Slider(
          value: o.theoryPercent.toDouble(),
          min: 25,
          max: 75,
          divisions: 10,
          label: 'Теория ${o.theoryPercent}%',
          onChanged: (v) {
            o.theoryPercent = v.round();
            changed();
          },
        ),
        if (o.theoryPercent < 35 || o.theoryPercent > 65)
          const InfoBanner('Регламент требует соразмерности глав по объёму — сильный перекос может стать замечанием.', kind: BannerKind.warning),
        const Gap(8),
        Text('Число глав (без параграфов)', style: t.bodyLarge),
        const Gap(6),
        SegmentedButton<int>(
          segments: const [
            ButtonSegment(value: 2, label: Text('2 главы'), icon: Icon(Icons.looks_two_outlined)),
            ButtonSegment(value: 3, label: Text('3 главы'), icon: Icon(Icons.looks_3_outlined)),
          ],
          selected: {o.chapters},
          onSelectionChanged: (v) {
            o.chapters = v.first;
            changed();
          },
        ),
        const Gap(4),
        Text(o.chapters == 2 ? 'Глава 1 — теоретическая, глава 2 — практическая (анализ фактического материала).' : 'Глава 1 — теория, глава 2 — анализ, глава 3 — рекомендации.',
            style: t.bodySmall),
        const Gap(14),
        Text('Объём без приложений: ${o.targetPages} стр. (регламент: 15–30)', style: t.bodyLarge),
        Slider(
          value: o.targetPages.toDouble(),
          min: 15,
          max: 30,
          divisions: 15,
          label: '${o.targetPages} стр.',
          onChanged: (v) {
            o.targetPages = v.round();
            changed();
          },
        ),
        Card(
          margin: EdgeInsets.zero,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('План объёма', style: t.titleSmall),
                const Gap(4),
                Text('Введение ≈ ${b.introWords} слов (2–2,5 стр.)'),
                for (var i = 0; i < b.chapterWords.length; i++)
                  Text('Глава ${i + 1} (${i == 0 ? 'теория' : 'практика'}) ≈ ${b.chapterWords[i]} слов (≈${(b.chapterWords[i] / Budget.wordsPerPage).toStringAsFixed(1)} стр.)'),
                Text('Заключение ≈ ${b.conclusionWords} слов (≈ как введение)'),
              ],
            ),
          ),
        ),
        const SectionTitle('Таблицы и приложения'),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Таблицы в тексте'),
          subtitle: const Text('«Таблица N — Название» над таблицей, сразу после первого упоминания'),
          value: o.tables,
          onChanged: (v) {
            o.tables = v;
            changed();
          },
        ),
        if (o.tables) _Stepper(label: 'Не больше таблиц', value: o.maxTables, min: 1, max: 6, onChanged: (v) {
          o.maxTables = v;
          changed();
        }),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Приложения'),
          subtitle: const Text('По регламенту приложения обязательны; не входят в 15–30 страниц'),
          value: o.appendices,
          onChanged: (v) {
            o.appendices = v;
            changed();
          },
        ),
        if (!o.appendices) const InfoBanner('Без приложений работа не пройдёт проверку: п. 4.6 регламента называет их обязательным компонентом.', kind: BannerKind.warning),
        if (o.appendices) _Stepper(label: 'Число приложений', value: o.appendixCount, min: 1, max: 4, onChanged: (v) {
          o.appendixCount = v;
          changed();
        }),
        const SectionTitle('Интернет'),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Искать литературу в интернете'),
          subtitle: const Text('Реальные статьи и книги из КиберЛенинки, OpenAlex, Google Книг, Crossref'),
          value: o.internetSources,
          onChanged: (v) {
            o.internetSources = v;
            changed();
          },
        ),
        _Stepper(label: 'Источников в списке', value: o.sourcesCount, min: 10, max: 30, step: 2, onChanged: (v) {
          o.sourcesCount = v;
          changed();
        }),
        _Stepper(label: 'Литература не старше, лет', value: o.recentYears, min: 3, max: 15, onChanged: (v) {
          o.recentYears = v;
          changed();
        }),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Факты и статистика из интернета'),
          subtitle: const Text('Для практической главы: поиск в интернете и выписка цифр со ссылками'),
          value: o.webFacts,
          onChanged: (v) {
            o.webFacts = v;
            changed();
          },
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Нормативные акты'),
          subtitle: const Text('Законы, кодексы, постановления — с проверкой реквизитов поиском'),
          value: o.normativeActs,
          onChanged: (v) {
            o.normativeActs = v;
            changed();
          },
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Без учебников, энциклопедий и газет'),
          subtitle: const Text('Требование регламента к списку литературы'),
          value: o.excludeTextbooks,
          onChanged: (v) {
            o.excludeTextbooks = v;
            changed();
          },
        ),
        const SectionTitle('Стиль'),
        Text('Строгость ↔ творческий стиль: ${(o.creativity * 10).round()}/10', style: t.bodyLarge),
        Slider(
          value: o.creativity,
          min: 0.2,
          max: 0.9,
          divisions: 7,
          onChanged: (v) {
            o.creativity = v;
            changed();
          },
        ),
        const Gap(8),
        Text('Подпись автора', style: t.bodyLarge),
        RadioGroup<SignaturePlace>(
          groupValue: o.signature,
          onChanged: (v) {
            o.signature = v ?? SignaturePlace.afterBibliography;
            changed();
          },
          child: const Column(children: [
            RadioListTile(contentPadding: EdgeInsets.zero, value: SignaturePlace.afterBibliography, title: Text('После списка литературы (последняя страница работы)')),
            RadioListTile(contentPadding: EdgeInsets.zero, value: SignaturePlace.endOfWork, title: Text('В самом конце, после приложений')),
          ]),
        ),
        const Gap(16),
        FilledButton.icon(onPressed: widget.onNext, icon: const Icon(Icons.arrow_forward), label: const Text('Далее: источники')),
      ],
    );
  }
}

class _Stepper extends StatelessWidget {
  const _Stepper({required this.label, required this.value, required this.min, required this.max, required this.onChanged, this.step = 1});
  final String label;
  final int value;
  final int min;
  final int max;
  final int step;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Expanded(child: Text(label)),
      IconButton.outlined(onPressed: value - step >= min ? () => onChanged(value - step) : null, icon: const Icon(Icons.remove)),
      SizedBox(width: 44, child: Text('$value', textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium)),
      IconButton.outlined(onPressed: value + step <= max ? () => onChanged(value + step) : null, icon: const Icon(Icons.add)),
    ]);
  }
}
