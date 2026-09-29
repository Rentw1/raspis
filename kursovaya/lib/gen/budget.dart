import 'dart:math' as math;

import '../models/coursework.dart';

/// Расчёт объёма разделов (в словах) под желаемое число страниц.
///
/// Страница основного текста (Times New Roman 14, интервал 1,5, поля 30/10/20/20 мм)
/// вмещает около 30 строк по ~75 знаков — примерно 270 слов с учётом абзацных отступов.
class Budget {
  Budget._(this.introWords, this.conclusionWords, this.chapterWords);

  static const int wordsPerPage = 270;

  /// Введение: 2–2,5 страницы.
  static const double introPages = 2.2;

  final int introWords;
  final int conclusionWords;
  final List<int> chapterWords;

  static Budget compute(GenOptions o, {int sources = 20}) {
    final n = o.chapters.clamp(2, 3);
    // Титульный лист + содержание + введение (3 листа с учётом начала с новой страницы)
    // + заключение (3 листа) + список литературы.
    final bibPages = math.max(1, (sources * 2.6 / 29 + 0.3).ceil());
    final fixed = 1 + 1 + 3 + 3 + bibPages;
    final chapterPages = math.max(n * 3.0, o.targetPages - fixed - 0.5 * n);
    final chapterTotal = (chapterPages * wordsPerPage).round();
    final theory = (chapterTotal * o.theoryPercent / 100).round();
    final practice = chapterTotal - theory;
    final List<int> ch;
    if (n == 2) {
      ch = [theory, practice];
    } else {
      final p2 = (practice * 0.55).round();
      ch = [theory, p2, practice - p2];
    }
    final intro = (introPages * wordsPerPage).round() - 20;
    return Budget._(intro, intro - 20, ch);
  }

  /// На сколько частей делить главу (часть ≈ 700–900 слов — надёжно для бесплатных моделей).
  static int partsFor(int words) => math.max(2, (words / 850).ceil());
}
