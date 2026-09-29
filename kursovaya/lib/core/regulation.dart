/// Требования «Положения о правилах написания и рецензирования курсовых работ
/// в ГАПОУ «Лаишевский технико-экономический техникум»» в виде констант.
///
/// Все размеры страницы — в пунктах PDF (1 pt = 1/72 дюйма) и в twips для Word
/// (1 twip = 1/20 pt). Значения используются и экспортом DOCX, и экспортом PDF,
/// и модулем проверки, поэтому менять их нужно только здесь.
library;

class Reg {
  Reg._();

  // ---------- Страница А4, односторонняя печать ----------
  static const double mm = 72.0 / 25.4;
  static const double pageWidthPt = 210 * mm;
  static const double pageHeightPt = 297 * mm;

  /// Поля: левое 30 мм, правое 10 мм, верхнее 20 мм, нижнее 20 мм.
  static const double marginLeftMm = 30;
  static const double marginRightMm = 10;
  static const double marginTopMm = 20;
  static const double marginBottomMm = 20;

  /// Расстояние от края листа до колонтитулов (помещаются внутри полей).
  static const double headerDistanceMm = 10;
  static const double footerDistanceMm = 10;

  static double get marginLeftPt => marginLeftMm * mm;
  static double get marginRightPt => marginRightMm * mm;
  static double get marginTopPt => marginTopMm * mm;
  static double get marginBottomPt => marginBottomMm * mm;
  static double get contentWidthPt => pageWidthPt - marginLeftPt - marginRightPt;
  static double get contentHeightPt => pageHeightPt - marginTopPt - marginBottomPt;

  static int twipsFromMm(double v) => (v * 1440 / 25.4).round();
  static int get pageWidthTw => 11906;
  static int get pageHeightTw => 16838;
  static int get marginLeftTw => twipsFromMm(marginLeftMm); // 1701
  static int get marginRightTw => twipsFromMm(marginRightMm); // 567
  static int get marginTopTw => twipsFromMm(marginTopMm); // 1134
  static int get marginBottomTw => twipsFromMm(marginBottomMm); // 1134
  static int get headerDistanceTw => twipsFromMm(headerDistanceMm); // 567
  static int get footerDistanceTw => twipsFromMm(footerDistanceMm); // 567
  static int get contentWidthTw => pageWidthTw - marginLeftTw - marginRightTw; // 9638

  // ---------- Шрифт и интервалы ----------
  static const String fontName = 'Times New Roman';
  static const double bodyFontPt = 14;
  static const double tableFontPt = 12;
  static const double headerFooterFontPt = 12;

  /// Междустрочный интервал: 1,5 — основной текст, 1,0 — таблицы.
  static const double bodyLineSpacing = 1.5;
  static const double tableLineSpacing = 1.0;

  /// Высота одинарной строки Times New Roman в Word (ascent + descent + lineGap)
  /// в долях кегля. У Liberation Serif, который используется в PDF, метрики те же.
  static const double tnrSingleLine = (1825 + 443 + 87) / 2048;

  /// Абзацный отступ 1,25 см.
  static const double firstLineIndentMm = 12.5;
  static double get firstLineIndentPt => firstLineIndentMm * mm;
  static int get firstLineIndentTw => twipsFromMm(firstLineIndentMm); // 709

  /// Расстояние между заголовком и текстом — 2 интервала
  /// (2 × 4,25 мм = 8,5 мм ≈ 24 пт, как в ГОСТ 2.105 для машинописного интервала).
  static const double headingAfterPt = 24;

  static double linePitch(double fontPt, double spacing) => fontPt * tnrSingleLine * spacing;

  // ---------- Объём ----------
  static const int minPages = 15;
  static const int maxPages = 30;
  static const double introMinPages = 2.0;
  static const double introMaxPages = 2.5;
  static const int minChapters = 2;
  static const int maxChapters = 3;

  // ---------- Тексты ----------
  static const String headerText = 'ГАПОУ «ЛАИШЕВСКИЙ ТЕХНИКО - ЭКОНОМИЧЕСКИЙ ТЕХНИКУМ»';
  static const String ministry = 'Министерство образования и науки Республики Татарстан';
  static const String orgLine1 = 'Государственное автономное профессиональное образовательное учреждение';
  static const String orgLine2 = '«Лаишевский технико-экономический техникум»';

  static const String tocTitle = 'СОДЕРЖАНИЕ';
  static const String introTitle = 'ВВЕДЕНИЕ';
  static const String conclusionTitle = 'ЗАКЛЮЧЕНИЕ';
  static const String bibliographyTitle = 'СПИСОК ЛИТЕРАТУРЫ';
  static const String appendixLabel = 'Приложение';

  static String chapterHeading(int n, String title) => 'ГЛАВА $n. ${cleanHeading(title).toUpperCase()}';

  /// Заголовок: без точки в конце, без лишних пробелов, без переносов.
  static String cleanHeading(String s) {
    var t = s.replaceAll(RegExp(r'[ \t\r\n]+'), ' ').trim();
    t = t.replaceAll(RegExp(r'^(глава|раздел)\s*\d+\s*[.:)]?\s*', caseSensitive: false), '');
    t = t.replaceAll(RegExp(r'^\d+(\.\d+)*[.)]?\s+'), '');
    t = stripTrailingPunct(t);
    final quoted = RegExp(r'^[«"“]([^«»"“”]*)[»"”]$').firstMatch(t);
    if (quoted != null) t = quoted.group(1)!.trim();
    return t;
  }

  /// Сокращения, после которых точка — часть слова, а не конец предложения.
  static final RegExp _abbrevEnd = RegExp(r'(^|[\s\u00A0(])(гг|г|вв|в|др|т\.\s?д|т\.\s?п|пр|руб|тыс|млн|млрд|ед|шт|им|ст|п|пп|ч|см|кв|обл|респ|стр)\.$', caseSensitive: false);

  /// Убирает точку (и ; : ,) в конце заголовка, но сохраняет точку сокращения («2023–2025 гг.»).
  static String stripTrailingPunct(String s) {
    var t = s.trimRight();
    while (t.isNotEmpty && '.;:,'.contains(t[t.length - 1])) {
      if (t.endsWith('.') && !t.endsWith('..') && _abbrevEnd.hasMatch(t)) break;
      t = t.substring(0, t.length - 1).trimRight();
    }
    return t;
  }

  /// Учебный год по дате: с сентября — текущий/следующий.
  static String academicYear(DateTime d) {
    final start = d.month >= 8 ? d.year : d.year - 1;
    return '$start-${start + 1}';
  }
}
