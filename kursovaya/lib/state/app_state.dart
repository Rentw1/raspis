import 'dart:async';

import 'package:flutter/widgets.dart';

import '../ai/ai_client.dart';
import '../core/storage.dart';
import '../core/text_utils.dart';
import '../export/export_service.dart';
import '../gen/generator.dart';
import '../models/coursework.dart';
import '../models/settings.dart';
import '../qa/checker.dart';
import '../search/source_finder.dart';

enum ConnState { unknown, checking, ok, error }

/// Состояние приложения: настройки, ключи, курсовые, генераторы.
class AppState extends ChangeNotifier {
  AppState._(this.storage, this.settings, this.projects) {
    ai = AiClient(settings: settings.ai, readSecret: storage.readSecret, onSettingsChanged: () => unawaited(saveSettings()));
  }

  final Storage storage;
  AppSettings settings;
  List<Coursework> projects;
  late final AiClient ai;

  ConnState aiState = ConnState.unknown;
  String aiMessage = '';
  bool aiReady = false;
  String webKey = '';

  final Map<String, GenProgress> _progress = {};
  final Map<String, Generator> _generators = {};
  final Map<String, QaReport> qa = {};
  final Map<String, Timer> _saveTimers = {};

  static Future<AppState> load() async => withStorage(await Storage.open());

  static Future<AppState> withStorage(Storage storage) async {
    final s = AppState._(storage, storage.loadSettings(), await storage.loadProjects());
    await s.refreshAiReady();
    s.webKey = await storage.readSecret(webKeyName(s.settings.search.engine));
    return s;
  }

  static String webKeyName(WebEngine e) => 'web_key_${e.name}';

  Future<void> refreshAiReady() async {
    aiReady = await ai.isReady();
    notifyListeners();
  }

  Future<void> saveSettings() async {
    await storage.saveSettings(settings);
    notifyListeners();
  }

  // ---------------- Ключи ----------------

  Future<String> readAiKey(String providerId) => storage.readSecret(AiClient.keyName(providerId));

  Future<void> writeAiKey(String providerId, String key) async {
    await storage.writeSecret(AiClient.keyName(providerId), key);
    ai.resetSession();
    aiState = ConnState.unknown;
    aiMessage = '';
    await refreshAiReady();
  }

  Future<void> writeWebKey(WebEngine e, String key) async {
    await storage.writeSecret(webKeyName(e), key);
    if (e == settings.search.engine) webKey = key.trim();
    notifyListeners();
  }

  Future<void> setWebEngine(WebEngine e) async {
    settings.search.engine = e;
    webKey = await storage.readSecret(webKeyName(e));
    await saveSettings();
  }

  Future<PingResult> pingAi() async {
    aiState = ConnState.checking;
    aiMessage = 'Проверяю…';
    notifyListeners();
    final r = await ai.ping(settings.ai.provider);
    aiState = r.ok ? ConnState.ok : ConnState.error;
    aiMessage = r.message;
    await refreshAiReady();
    return r;
  }

  // ---------------- Курсовые ----------------

  Coursework createProject() {
    final c = Coursework(id: newId('cw'));
    projects.insert(0, c);
    unawaited(storage.saveProject(c));
    notifyListeners();
    return c;
  }

  Coursework duplicate(Coursework c) {
    final copy = c.copyAsNew();
    copy.meta.topic = '${c.meta.topic} (копия)';
    projects.insert(0, copy);
    unawaited(storage.saveProject(copy));
    notifyListeners();
    return copy;
  }

  Future<void> deleteProject(Coursework c) async {
    _generators[c.id]?.stop();
    projects.removeWhere((p) => p.id == c.id);
    _generators.remove(c.id);
    _progress.remove(c.id);
    qa.remove(c.id);
    await storage.deleteProject(c.id);
    notifyListeners();
  }

  Future<void> saveNow(Coursework c) async {
    _saveTimers.remove(c.id)?.cancel();
    await storage.saveProject(c);
    notifyListeners();
  }

  /// Отложенное сохранение (при вводе текста).
  void saveSoon(Coursework c) {
    _saveTimers[c.id]?.cancel();
    _saveTimers[c.id] = Timer(const Duration(milliseconds: 700), () {
      _saveTimers.remove(c.id);
      unawaited(storage.saveProject(c));
    });
    notifyListeners();
  }

  GenProgress progressFor(Coursework c) => _progress.putIfAbsent(c.id, GenProgress.new);

  SourceFinder finder(CancelToken cancel) => SourceFinder(settings: settings.search, webKey: webKey, ai: ai, cancel: cancel);

  Generator generatorFor(Coursework c) => _generators.putIfAbsent(
        c.id,
        () => Generator(cw: c, ai: ai, finderFactory: finder, save: () => saveNow(c), progress: progressFor(c)),
      );

  bool isGenerating(Coursework c) => _progress[c.id]?.running ?? false;

  // ---------------- Проверка ----------------

  Future<QaReport> runQa(Coursework c) async {
    final bundle = await ExportService.build(c, settings.institution, pdf: false, docx: true);
    c.layout = bundle.layout;
    await saveNow(c);
    final r = QaChecker.check(c, layout: bundle.layout, docx: bundle.docx, inst: settings.institution);
    qa[c.id] = r;
    notifyListeners();
    return r;
  }
}

/// Доступ к состоянию из виджетов.
class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child}) : super(notifier: state);

  static AppState of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppScope>()!.notifier!;

  static AppState read(BuildContext context) => context.getInheritedWidgetOfExactType<AppScope>()!.notifier!;
}
