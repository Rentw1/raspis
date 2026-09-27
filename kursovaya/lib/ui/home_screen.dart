import 'package:flutter/material.dart';

import '../core/text_utils.dart';
import '../models/coursework.dart';
import '../state/app_state.dart';
import 'project_screen.dart';
import 'settings_screen.dart';
import 'widgets.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  void _open(BuildContext context, Coursework c) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => ProjectScreen(cw: c)));
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Курсовая ЛТЭТ'),
            Text('по регламенту ГАПОУ «Лаишевский технико-экономический техникум»', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w400)),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Настройки',
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SettingsScreen())),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.add),
        label: const Text('Новая курсовая'),
        onPressed: () => _open(context, s.createProject()),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
        children: [
          _AiCard(state: s),
          if (s.projects.isEmpty) const _Welcome(),
          for (final c in s.projects) _ProjectCard(cw: c, onOpen: () => _open(context, c)),
        ],
      ),
    );
  }
}

class _AiCard extends StatelessWidget {
  const _AiCard({required this.state});
  final AppState state;

  @override
  Widget build(BuildContext context) {
    final ready = state.aiReady;
    final dot = ready ? state.aiState : ConnState.error;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SettingsScreen())),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Icon(Icons.auto_awesome, color: Theme.of(context).colorScheme.primary, size: 28),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Нейросеть', style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: 2),
                    Text(
                      ready ? 'Подключена: ${state.ai.label()}' : 'Не подключена — нажмите, чтобы выбрать сервис и вставить бесплатный ключ',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              StatusDot(dot),
            ],
          ),
        ),
      ),
    );
  }
}

class _Welcome extends StatelessWidget {
  const _Welcome();

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    Widget step(IconData i, String title, String text) => ListTile(
          contentPadding: EdgeInsets.zero,
          leading: CircleAvatar(child: Icon(i, size: 20)),
          title: Text(title),
          subtitle: Text(text),
        );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Как это работает', style: t.titleMedium),
            const SizedBox(height: 8),
            step(Icons.key, '1. Подключите бесплатный ИИ', 'Настройки → сервис → «Получить бесплатный ключ» → «Проверить подключение».'),
            step(Icons.edit_note, '2. Заполните данные', 'Тема, ФИО, группа, курс, специальность, дисциплина, руководитель.'),
            step(Icons.travel_explore, '3. Источники из интернета', 'Приложение найдёт реальные статьи и книги и оформит список по ГОСТ 7.1-2003.'),
            step(Icons.auto_awesome, '4. Генерация', 'План → главы → заключение → введение (после основной части) → приложения.'),
            step(Icons.fact_check, '5. Проверка и экспорт', 'Чек-лист по регламенту, прогноз оценки, файл Word или PDF.'),
            const SizedBox(height: 4),
            Text('Текст создаётся ИИ как черновик: проверьте факты, цифры и источники перед сдачей.', style: t.bodySmall),
          ],
        ),
      ),
    );
  }
}

class _ProjectCard extends StatelessWidget {
  const _ProjectCard({required this.cw, required this.onOpen});
  final Coursework cw;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final running = s.isGenerating(cw);
    final total = cw.sections.length;
    final done = cw.sections.where((x) => x.text.trim().isNotEmpty).length;
    final status = running
        ? 'Генерация…'
        : (total == 0 ? 'Черновик' : (done == total ? 'Текст готов${cw.layout != null ? ' · ${cw.layout!.mainPages} стр.' : ''}' : 'Готово разделов: $done из $total'));
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onOpen,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 4, 12),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(cw.title, style: Theme.of(context).textTheme.titleSmall, maxLines: 3, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 4),
                    Text(
                      [if (cw.meta.studentName.isNotEmpty) cw.meta.studentName, if (cw.meta.discipline.isNotEmpty) cw.meta.discipline].join(' · '),
                      style: Theme.of(context).textTheme.bodySmall,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Row(children: [
                      if (running) const Padding(padding: EdgeInsets.only(right: 6), child: SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2))),
                      Text(status, style: TextStyle(color: Theme.of(context).colorScheme.primary, fontSize: 12, fontWeight: FontWeight.w600)),
                      const Spacer(),
                      Text(dateRu(cw.updated), style: Theme.of(context).textTheme.bodySmall),
                    ]),
                  ],
                ),
              ),
              PopupMenuButton<String>(
                onSelected: (v) async {
                  if (v == 'copy') {
                    s.duplicate(cw);
                  } else if (v == 'delete') {
                    if (await confirm(context, 'Удалить курсовую?', '«${cw.title}» будет удалена без возможности восстановления.', ok: 'Удалить', danger: true)) {
                      await s.deleteProject(cw);
                    }
                  }
                },
                itemBuilder: (c) => const [
                  PopupMenuItem(value: 'copy', child: Text('Дублировать')),
                  PopupMenuItem(value: 'delete', child: Text('Удалить')),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
