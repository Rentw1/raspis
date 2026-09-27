import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kursovaya/core/storage.dart';
import 'package:kursovaya/main.dart';
import 'package:kursovaya/state/app_state.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'fixtures/sample.dart';

/// Шрифты Roboto и иконки Material из SDK — чтобы скриншоты были с настоящим текстом.
Future<void> _loadFonts() async {
  final root = Platform.environment['FLUTTER_ROOT'] ?? '/opt/flutter';
  final dir = '$root/bin/cache/artifacts/material_fonts';
  if (!Directory(dir).existsSync()) return;
  Future<void> load(String family, List<String> files) async {
    final l = FontLoader(family);
    for (final f in files) {
      final bytes = File('$dir/$f').readAsBytesSync();
      l.addFont(Future.value(ByteData.sublistView(bytes)));
    }
    await l.load();
  }

  await load('Roboto', ['Roboto-Regular.ttf', 'Roboto-Medium.ttf', 'Roboto-Bold.ttf']);
  await load('MaterialIcons', ['MaterialIcons-Regular.otf']);
}

void main() {
  final shots = Platform.environment['SHOTS_OUT'];

  Future<AppState> makeState() async {
    SharedPreferences.setMockInitialValues({});
    final dir = Directory.systemTemp.createTempSync('kursovaya_ui');
    final storage = await Storage.withDirectory(await SharedPreferences.getInstance(), dir);
    final state = await AppState.withStorage(storage);
    final cw = sampleCoursework();
    state.projects.add(cw);
    return state;
  }

  Future<void> shot(WidgetTester t, String name) async {
    if (shots == null) return;
    await t.pumpAndSettle();
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('$shots/$name.png'));
  }

  testWidgets('Главный экран, настройки, вкладки курсовой открываются без ошибок', (t) async {
    await t.runAsync(_loadFonts);
    t.view.physicalSize = const Size(1080, 2280);
    t.view.devicePixelRatio = 2.6;
    addTearDown(t.view.reset);
    final state = await t.runAsync(makeState);
    await t.pumpWidget(KursovayaApp(state: state!));
    await t.pumpAndSettle();
    expect(find.text('Курсовая ЛТЭТ'), findsOneWidget);
    expect(find.textContaining('Анализ эффективности'), findsWidgets);
    await shot(t, '01_home');

    // Настройки: три вкладки
    await t.tap(find.byTooltip('Настройки'));
    await t.pumpAndSettle();
    expect(find.text('Проверить подключение'), findsNothing, reason: 'сервис ещё не выбран');
    await shot(t, '02_settings_ai');
    await t.tap(find.byType(DropdownButtonFormField<String>).first);
    await t.pumpAndSettle();
    await t.tap(find.textContaining('OpenRouter').last);
    await t.pumpAndSettle();
    expect(find.text('Проверить подключение'), findsOneWidget);
    expect(find.textContaining('Получить бесплатный ключ'), findsOneWidget);
    await shot(t, '03_settings_openrouter');
    await t.tap(find.text('Интернет'));
    await t.pumpAndSettle();
    expect(find.text('КиберЛенинка'), findsOneWidget);
    await shot(t, '04_settings_internet');
    await t.tap(find.text('Учреждение'));
    await t.pumpAndSettle();
    await shot(t, '05_settings_institution');
    await t.tap(find.byType(BackButton));
    await t.pumpAndSettle();

    // Курсовая: все вкладки
    await t.tap(find.textContaining('Анализ эффективности').first);
    await t.pumpAndSettle();
    await shot(t, '06_meta');
    for (final (tab, name) in [('Параметры', '07_options'), ('Источники', '08_sources'), ('Генерация', '09_generate'), ('Проверка', '10_check'), ('Экспорт', '11_export')]) {
      await t.tap(find.text(tab));
      await t.pumpAndSettle();
      await shot(t, name);
    }
    expect(t.takeException(), isNull);
  });
}
