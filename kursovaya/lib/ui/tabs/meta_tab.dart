import 'package:flutter/material.dart';

import '../../core/regulation.dart';
import '../../core/text_utils.dart';
import '../../data/catalogs.dart';
import '../../models/coursework.dart';
import '../../state/app_state.dart';
import '../widgets.dart';

/// Метаданные курсовой (титульный лист по ПРИЛОЖЕНИЮ 4).
class MetaTab extends StatefulWidget {
  const MetaTab({super.key, required this.cw, required this.onNext});
  final Coursework cw;
  final VoidCallback onNext;

  @override
  State<MetaTab> createState() => _MetaTabState();
}

class _MetaTabState extends State<MetaTab> with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final s = AppScope.of(context);
    final m = widget.cw.meta;
    void changed() => s.saveSoon(widget.cw);
    final female = isFemaleName(m.studentName);
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        const SectionTitle('Тема и дисциплина'),
        ModelTextField(
          label: 'Тема курсовой работы',
          value: m.topic,
          maxLines: 4,
          minLines: 2,
          required: true,
          hint: 'Например: Анализ эффективности использования оборотных активов организации (на примере ООО «…»)',
          onChanged: (v) {
            m.topic = v;
            changed();
          },
        ),
        const Gap(12),
        SuggestField(
          label: 'Учебная дисциплина / МДК',
          value: m.discipline,
          options: disciplines,
          required: true,
          hint: 'Выберите из списка или введите',
          onChanged: (v) {
            m.discipline = v;
            changed();
          },
        ),
        const Gap(12),
        SuggestField(
          label: 'Специальность',
          value: m.specialty,
          options: specialties,
          required: true,
          hint: 'Код и название специальности',
          onChanged: (v) {
            m.specialty = v;
            changed();
          },
        ),
        const SectionTitle('Студент и руководитель'),
        ModelTextField(
          label: 'ФИО студента',
          value: m.studentName,
          required: true,
          hint: 'Иванова Анна Сергеевна',
          helper: m.studentName.trim().isEmpty ? null : 'На титульном листе: «${female ? 'выполнила' : 'выполнил'}: ${m.studentName.trim()}»',
          onChanged: (v) {
            m.studentName = v;
            changed();
            setState(() {});
          },
        ),
        const Gap(12),
        Row(children: [
          Expanded(
            child: ModelTextField(
              label: 'Номер группы',
              value: m.group,
              required: true,
              hint: '21-ЭБУ',
              onChanged: (v) {
                m.group = v;
                changed();
              },
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: DropdownButtonFormField<int>(
              initialValue: m.course.clamp(1, 4),
              decoration: const InputDecoration(labelText: 'Курс', border: OutlineInputBorder()),
              items: [for (var i = 1; i <= 4; i++) DropdownMenuItem(value: i, child: Text('$i курс'))],
              onChanged: (v) {
                m.course = v ?? 2;
                changed();
              },
            ),
          ),
        ]),
        const Gap(12),
        ModelTextField(
          label: 'ФИО руководителя',
          value: m.supervisor,
          required: true,
          hint: 'Петрова Е. В.',
          onChanged: (v) {
            m.supervisor = v;
            changed();
          },
        ),
        const Gap(12),
        ModelTextField(
          label: 'Учебный год',
          value: m.academicYear,
          hint: Reg.academicYear(DateTime.now()),
          onChanged: (v) {
            m.academicYear = v;
            changed();
          },
        ),
        const SectionTitle('Для практической части', subtitle: 'Необязательно, но так практическая глава будет точнее'),
        ModelTextField(
          label: 'Организация (база практики)',
          value: m.organization,
          hint: 'ООО «Ромашка», Лаишевский район',
          onChanged: (v) {
            m.organization = v;
            changed();
          },
        ),
        const Gap(12),
        ModelTextField(
          label: 'Исходные данные (цифры, отчётность)',
          value: m.practiceData,
          maxLines: 10,
          minLines: 4,
          helper: 'Вставьте показатели организации за 2–3 года (выручка, численность, баланс и т. п.) — ИИ проанализирует именно их. '
              'Без данных практическая часть строится на открытой статистике из интернета или на условном примере.',
          onChanged: (v) {
            m.practiceData = v;
            changed();
          },
        ),
        const Gap(12),
        ModelTextField(
          label: 'Пожелания к содержанию',
          value: m.wishes,
          maxLines: 5,
          minLines: 2,
          hint: 'Например: сделать акцент на цифровых технологиях; рассмотреть опыт Республики Татарстан',
          onChanged: (v) {
            m.wishes = v;
            changed();
          },
        ),
        const Gap(20),
        FilledButton.icon(onPressed: widget.onNext, icon: const Icon(Icons.arrow_forward), label: const Text('Далее: параметры')),
      ],
    );
  }
}
