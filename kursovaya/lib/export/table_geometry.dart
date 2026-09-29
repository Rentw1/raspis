import 'dart:math' as math;

/// Ширины столбцов таблицы (одинаково для PDF и Word): каждый столбец не уже самого
/// длинного слова, остаток ширины делится пропорционально объёму текста.
List<double> columnWidths(List<List<String>> rows, int cols, double width, double Function(String) textWidth, {double padX = 5.4}) {
  if (cols <= 0) return const [];
  final minW = List<double>.filled(cols, 0);
  final want = List<double>.filled(cols, 0);
  for (final r in rows) {
    for (var i = 0; i < cols; i++) {
      final text = i < r.length ? r[i] : '';
      for (final w in text.split(RegExp(r'[ \t\r\n]+'))) {
        if (w.isEmpty) continue;
        minW[i] = math.max(minW[i], textWidth(w) + 2 * padX + 1);
      }
      want[i] = math.max(want[i], math.min(textWidth(text) + 2 * padX + 1, width));
    }
  }
  for (var i = 0; i < cols; i++) {
    minW[i] = math.max(minW[i], 2 * padX + 12);
  }
  final sumMin = minW.fold<double>(0, (a, b) => a + b);
  final widths = List<double>.from(minW);
  if (sumMin >= width) {
    for (var i = 0; i < cols; i++) {
      widths[i] = width * minW[i] / sumMin;
    }
    return widths;
  }
  final extra = width - sumMin;
  final growth = [for (var i = 0; i < cols; i++) math.max(0.0, want[i] - minW[i])];
  final g = growth.fold<double>(0, (a, b) => a + b);
  for (var i = 0; i < cols; i++) {
    widths[i] += g > 0 ? extra * growth[i] / g : extra / cols;
  }
  return widths;
}

final RegExp _num = RegExp(r'^[\s+\-–−]?[\d\s .,]+%?$');

bool isNumericCell(String s) {
  final t = s.trim();
  return t.isNotEmpty && _num.hasMatch(t) && RegExp(r'\d').hasMatch(t);
}

/// Столбцы, где все значения — числа (выравниваются по правому краю, разряды друг под другом).
List<bool> numericColumns(List<List<String>> rows, int cols, int headerRows) => List<bool>.generate(cols, (i) {
      final body = rows.skip(headerRows).map((r) => i < r.length ? r[i] : '').where((s) => s.trim().isNotEmpty && s.trim() != '–').toList();
      return body.isNotEmpty && body.every(isNumericCell);
    });
