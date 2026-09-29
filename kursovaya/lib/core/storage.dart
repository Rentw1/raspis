import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/coursework.dart';
import '../models/settings.dart';

/// Хранилище: настройки — SharedPreferences, ключи API — защищённое хранилище
/// (Keychain / Android Keystore), курсовые — JSON-файлы в папке приложения.
class Storage {
  Storage._(this._prefs, this._docs);

  static const _settingsKey = 'settings_v1';
  static const _secure = FlutterSecureStorage();

  final SharedPreferences _prefs;
  final Directory _docs;

  /// Если защищённое хранилище недоступно (редкие прошивки), ключи хранятся в настройках.
  bool _secureBroken = false;

  static Future<Storage> open() async => withDirectory(await SharedPreferences.getInstance(), await getApplicationDocumentsDirectory());

  /// Хранилище в заданной папке (используется и в тестах).
  static Future<Storage> withDirectory(SharedPreferences prefs, Directory docs) async {
    final s = Storage._(prefs, docs);
    await s.projectsDir.create(recursive: true);
    await s.exportsDir.create(recursive: true);
    return s;
  }

  Directory get projectsDir => Directory('${_docs.path}/projects');

  /// На iOS папка видна в приложении «Файлы» (UIFileSharingEnabled).
  Directory get exportsDir => Directory('${_docs.path}/Курсовые');

  // ---------- Настройки ----------

  AppSettings loadSettings() {
    final raw = _prefs.getString(_settingsKey);
    if (raw == null) return AppSettings();
    try {
      return AppSettings.fromJson(Map<String, dynamic>.from(jsonDecode(raw) as Map));
    } catch (e) {
      debugPrint('settings parse error: $e');
      return AppSettings();
    }
  }

  Future<void> saveSettings(AppSettings s) => _prefs.setString(_settingsKey, jsonEncode(s.toJson()));

  // ---------- Секреты (ключи API, сертификаты) ----------

  Future<String> readSecret(String name) async {
    if (!_secureBroken) {
      try {
        return await _secure.read(key: name) ?? _prefs.getString('plain_$name') ?? '';
      } catch (e) {
        debugPrint('secure read failed: $e');
        _secureBroken = true;
      }
    }
    return _prefs.getString('plain_$name') ?? '';
  }

  Future<void> writeSecret(String name, String value) async {
    final v = value.trim();
    if (!_secureBroken) {
      try {
        if (v.isEmpty) {
          await _secure.delete(key: name);
        } else {
          await _secure.write(key: name, value: v);
        }
        await _prefs.remove('plain_$name');
        return;
      } catch (e) {
        debugPrint('secure write failed: $e');
        _secureBroken = true;
      }
    }
    if (v.isEmpty) {
      await _prefs.remove('plain_$name');
    } else {
      await _prefs.setString('plain_$name', v);
    }
  }

  // ---------- Курсовые ----------

  File _projectFile(String id) => File('${projectsDir.path}/$id.json');

  Future<List<Coursework>> loadProjects() async {
    final out = <Coursework>[];
    if (!await projectsDir.exists()) return out;
    await for (final e in projectsDir.list()) {
      if (e is! File || !e.path.endsWith('.json')) continue;
      try {
        final j = jsonDecode(await e.readAsString());
        out.add(Coursework.fromJson(Map<String, dynamic>.from(j as Map)));
      } catch (err) {
        debugPrint('project parse error ${e.path}: $err');
      }
    }
    out.sort((a, b) => b.updated.compareTo(a.updated));
    return out;
  }

  /// Атомарная запись: сначала во временный файл, затем переименование.
  Future<void> saveProject(Coursework c) async {
    c.updated = DateTime.now();
    final f = _projectFile(c.id);
    final tmp = File('${f.path}.tmp');
    await tmp.writeAsString(jsonEncode(c.toJson()), flush: true);
    await tmp.rename(f.path);
  }

  Future<void> deleteProject(String id) async {
    final f = _projectFile(id);
    if (await f.exists()) await f.delete();
  }

  Future<File> writeExport(String fileName, List<int> bytes) async {
    await exportsDir.create(recursive: true);
    final f = File('${exportsDir.path}/$fileName');
    await f.writeAsBytes(bytes, flush: true);
    return f;
  }
}
