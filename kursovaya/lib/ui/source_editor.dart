import 'package:flutter/material.dart';

import '../core/text_utils.dart';
import '../export/gost.dart';
import '../models/source.dart';
import 'widgets.dart';

class SourceEditResult {
  SourceEditResult(this.source, {this.deleted = false});
  final Source source;
  final bool deleted;
}

/// Редактирование источника с предпросмотром описания по ГОСТ 7.1-2003.
class SourceEditorScreen extends StatefulWidget {
  const SourceEditorScreen({super.key, required this.source, this.isNew = false});
  final Source source;
  final bool isNew;

  @override
  State<SourceEditorScreen> createState() => _SourceEditorScreenState();
}

class _SourceEditorScreenState extends State<SourceEditorScreen> {
  Source get s => widget.source;
  late String _authorsRaw = widget.source.authors.join('\n');

  void _set(void Function() f) => setState(f);

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final isArticle = s.type == SourceType.article;
    final isBook = s.type == SourceType.book || s.type == SourceType.other;
    final isNorm = s.type == SourceType.normative;
    final isWeb = s.type == SourceType.web;
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.isNew ? 'Новый источник' : 'Источник'),
        actions: [
          if (!widget.isNew)
            IconButton(
              tooltip: 'Удалить',
              icon: const Icon(Icons.delete_outline),
              onPressed: () async {
                if (await confirm(context, 'Удалить источник?', 'Ссылки на него в тексте будут удалены.', ok: 'Удалить', danger: true)) {
                  if (context.mounted) Navigator.pop(context, SourceEditResult(s, deleted: true));
                }
              },
            ),
          IconButton(
            tooltip: 'Сохранить',
            icon: const Icon(Icons.check),
            onPressed: () {
              if (s.title.trim().isEmpty && (s.manual ?? '').trim().isEmpty) {
                snack(context, 'Укажите название или готовое описание.');
                return;
              }
              Navigator.pop(context, SourceEditResult(s));
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
        children: [
          Card(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Как будет в списке литературы:', style: t.labelLarge),
                const Gap(6),
                SelectableText(Gost.format(s), style: const TextStyle(fontFamily: 'serif', height: 1.35)),
              ]),
            ),
          ),
          const Gap(14),
          DropdownButtonFormField<SourceType>(
            initialValue: s.type,
            decoration: const InputDecoration(labelText: 'Вид источника', border: OutlineInputBorder()),
            items: [for (final x in SourceType.values) DropdownMenuItem(value: x, child: Text(x.label))],
            onChanged: (v) => _set(() => s.type = v ?? SourceType.book),
          ),
          const Gap(12),
          if (!isNorm && !isWeb) ...[
            ModelTextField(
              label: 'Авторы (каждый с новой строки: Фамилия И. О.)',
              value: _authorsRaw,
              maxLines: 5,
              minLines: 1,
              onChanged: (v) => _set(() {
                _authorsRaw = v;
                s.authors = v.split('\n').map((e) => e.trim()).where((e) => e.isNotEmpty).map((e) => parsePersonName(e).surnameInitials).toList();
              }),
            ),
            const Gap(12),
          ],
          ModelTextField(label: isNorm ? 'Название (без вида документа)' : 'Название', value: s.title, maxLines: 3, onChanged: (v) => _set(() => s.title = v)),
          const Gap(12),
          if (isBook) ...[
            ModelTextField(label: 'Сведения к названию (монография, сборник…)', value: s.subtitle ?? '', onChanged: (v) => _set(() => s.subtitle = v)),
            const Gap(12),
            Row(children: [
              Expanded(child: ModelTextField(label: 'Город', value: s.city ?? '', onChanged: (v) => _set(() => s.city = v))),
              const SizedBox(width: 10),
              Expanded(child: ModelTextField(label: 'Издательство', value: s.publisher ?? '', onChanged: (v) => _set(() => s.publisher = v))),
            ]),
            const Gap(12),
          ],
          if (isArticle || isWeb) ...[
            ModelTextField(label: isWeb ? 'Сайт' : 'Журнал / сборник', value: (isWeb ? s.siteName : s.container) ?? '', onChanged: (v) => _set(() => isWeb ? s.siteName = v : s.container = v)),
            const Gap(12),
          ],
          if (isNorm) ...[
            ModelTextField(label: 'Вид документа (федер. закон, постановление…)', value: s.docKind ?? '', onChanged: (v) => _set(() => s.docKind = v)),
            const Gap(12),
            Row(children: [
              Expanded(child: ModelTextField(label: 'Дата (ДД.ММ.ГГГГ)', value: s.docDate ?? '', onChanged: (v) => _set(() => s.docDate = v))),
              const SizedBox(width: 10),
              Expanded(child: ModelTextField(label: 'Номер', value: s.docNumber ?? '', onChanged: (v) => _set(() => s.docNumber = v))),
            ]),
            const Gap(12),
          ],
          if (!isNorm)
            Row(children: [
              Expanded(
                child: ModelTextField(
                  label: 'Год',
                  value: s.year?.toString() ?? '',
                  keyboardType: TextInputType.number,
                  onChanged: (v) => _set(() => s.year = int.tryParse(v.trim())),
                ),
              ),
              const SizedBox(width: 10),
              if (isArticle) ...[
                Expanded(child: ModelTextField(label: 'Том', value: s.volume ?? '', onChanged: (v) => _set(() => s.volume = v))),
                const SizedBox(width: 10),
                Expanded(child: ModelTextField(label: '№', value: s.issue ?? '', onChanged: (v) => _set(() => s.issue = v))),
              ],
              if (isBook)
                Expanded(
                  child: ModelTextField(
                    label: 'Страниц',
                    value: s.pageCount?.toString() ?? '',
                    keyboardType: TextInputType.number,
                    onChanged: (v) => _set(() => s.pageCount = int.tryParse(v.trim())),
                  ),
                ),
            ]),
          if (isArticle) ...[
            const Gap(12),
            ModelTextField(label: 'Страницы статьи (например, 45–52)', value: s.pages ?? '', onChanged: (v) => _set(() => s.pages = v)),
          ],
          const Gap(12),
          ModelTextField(label: 'Адрес в интернете (URL)', value: s.url ?? '', keyboardType: TextInputType.url, onChanged: (v) => _set(() => s.url = v.trim().isEmpty ? null : v.trim())),
          if ((s.url ?? '').startsWith('http'))
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(icon: const Icon(Icons.open_in_new), label: const Text('Открыть'), onPressed: () => openLink(context, s.url!)),
            ),
          const Gap(12),
          ModelTextField(
            label: 'Готовое описание по ГОСТ (необязательно)',
            helper: 'Если заполнено, в список литературы попадёт именно этот текст.',
            value: s.manual ?? '',
            maxLines: 4,
            onChanged: (v) => _set(() => s.manual = v.trim().isEmpty ? null : v),
          ),
          const Gap(8),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Источник проверен'),
            subtitle: Text(s.note ?? 'Отметьте, если убедились, что издание существует и выходные данные верны.'),
            value: s.verified,
            onChanged: (v) => _set(() {
              s.verified = v;
              if (v) s.note = null;
            }),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Включить в список литературы'),
            value: s.selected,
            onChanged: (v) => _set(() => s.selected = v),
          ),
          if ((s.annotation ?? '').isNotEmpty) ...[
            const SectionTitle('Аннотация'),
            Text(s.annotation!, style: t.bodySmall),
          ],
        ],
      ),
    );
  }
}
