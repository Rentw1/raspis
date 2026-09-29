import 'package:flutter/material.dart';

import '../models/coursework.dart';
import '../state/app_state.dart';
import 'tabs/check_tab.dart';
import 'tabs/export_tab.dart';
import 'tabs/generate_tab.dart';
import 'tabs/meta_tab.dart';
import 'tabs/options_tab.dart';
import 'tabs/sources_tab.dart';
import 'widgets.dart';

class ProjectScreen extends StatefulWidget {
  const ProjectScreen({super.key, required this.cw});
  final Coursework cw;

  @override
  State<ProjectScreen> createState() => _ProjectScreenState();
}

class _ProjectScreenState extends State<ProjectScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 6, vsync: this);

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  void goTo(int i) => _tabs.animateTo(i);

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final cw = widget.cw;
    return PopScope(
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) s.saveNow(cw);
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(cw.meta.topic.trim().isEmpty ? 'Новая курсовая' : cw.meta.topic.trim(), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 16)),
          actions: [
            PopupMenuButton<String>(
              onSelected: (v) async {
                if (v == 'copy') {
                  final c = s.duplicate(cw);
                  if (context.mounted) {
                    Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => ProjectScreen(cw: c)));
                  }
                } else if (v == 'delete') {
                  if (await confirm(context, 'Удалить курсовую?', 'Работа будет удалена без возможности восстановления.', ok: 'Удалить', danger: true)) {
                    await s.deleteProject(cw);
                    if (context.mounted) Navigator.of(context).pop();
                  }
                }
              },
              itemBuilder: (c) => const [
                PopupMenuItem(value: 'copy', child: Text('Дублировать')),
                PopupMenuItem(value: 'delete', child: Text('Удалить')),
              ],
            ),
          ],
          bottom: TabBar(
            controller: _tabs,
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            tabs: const [
              Tab(icon: Icon(Icons.badge_outlined), text: 'Данные'),
              Tab(icon: Icon(Icons.tune), text: 'Параметры'),
              Tab(icon: Icon(Icons.menu_book_outlined), text: 'Источники'),
              Tab(icon: Icon(Icons.auto_awesome), text: 'Генерация'),
              Tab(icon: Icon(Icons.fact_check_outlined), text: 'Проверка'),
              Tab(icon: Icon(Icons.ios_share), text: 'Экспорт'),
            ],
          ),
        ),
        body: TabBarView(
          controller: _tabs,
          children: [
            MetaTab(cw: cw, onNext: () => goTo(1)),
            OptionsTab(cw: cw, onNext: () => goTo(2)),
            SourcesTab(cw: cw, onNext: () => goTo(3)),
            GenerateTab(cw: cw, onCheck: () => goTo(4)),
            CheckTab(cw: cw, onExport: () => goTo(5)),
            ExportTab(cw: cw, onCheck: () => goTo(4)),
          ],
        ),
      ),
    );
  }
}
