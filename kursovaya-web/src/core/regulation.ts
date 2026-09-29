/**
 * Требования «Положения о правилах написания и рецензирования курсовых работ
 * в ГАПОУ «Лаишевский технико-экономический техникум»» в виде констант.
 *
 * Размеры — в пунктах (1 pt = 1/72 дюйма) для вёрстки и в twips для Word (1 twip = 1/20 pt).
 * Значения используются экспортом DOCX/PDF и проверкой, поэтому менять их нужно только здесь.
 */

export const MM = 72 / 25.4;

const twipsFromMm = (v: number) => Math.round((v * 1440) / 25.4);

/** Сокращения, после которых точка — часть слова, а не конец предложения. */
const ABBREV_END =
  /(^|[\s (])(гг|г|вв|в|др|т\.\s?д|т\.\s?п|пр|руб|тыс|млн|млрд|ед|шт|им|ст|п|пп|ч|см|кв|обл|респ|стр)\.$/i;

export const Reg = {
  // ---------- Страница А4, односторонняя печать ----------
  pageWidthPt: 210 * MM,
  pageHeightPt: 297 * MM,

  /** Поля: левое 30 мм, правое 10 мм, верхнее 20 мм, нижнее 20 мм. */
  marginLeftMm: 30,
  marginRightMm: 10,
  marginTopMm: 20,
  marginBottomMm: 20,

  /** Расстояние от края листа до колонтитулов (внутри полей). */
  headerDistanceMm: 10,
  footerDistanceMm: 10,

  get marginLeftPt() { return this.marginLeftMm * MM; },
  get marginRightPt() { return this.marginRightMm * MM; },
  get marginTopPt() { return this.marginTopMm * MM; },
  get marginBottomPt() { return this.marginBottomMm * MM; },
  get contentWidthPt() { return this.pageWidthPt - this.marginLeftPt - this.marginRightPt; },
  get contentHeightPt() { return this.pageHeightPt - this.marginTopPt - this.marginBottomPt; },

  pageWidthTw: 11906,
  pageHeightTw: 16838,
  get marginLeftTw() { return twipsFromMm(this.marginLeftMm); }, // 1701
  get marginRightTw() { return twipsFromMm(this.marginRightMm); }, // 567
  get marginTopTw() { return twipsFromMm(this.marginTopMm); }, // 1134
  get marginBottomTw() { return twipsFromMm(this.marginBottomMm); }, // 1134
  get headerDistanceTw() { return twipsFromMm(this.headerDistanceMm); }, // 567
  get footerDistanceTw() { return twipsFromMm(this.footerDistanceMm); }, // 567
  get contentWidthTw() { return this.pageWidthTw - this.marginLeftTw - this.marginRightTw; }, // 9638

  // ---------- Шрифт и интервалы ----------
  fontName: 'Times New Roman',
  bodyFontPt: 14,
  tableFontPt: 12,
  headerFooterFontPt: 12,

  /** Междустрочный интервал: 1,5 — основной текст, 1,0 — таблицы. */
  bodyLineSpacing: 1.5,
  tableLineSpacing: 1.0,

  /** Высота одинарной строки Times New Roman в Word (ascent + descent + lineGap) в долях кегля. */
  tnrSingleLine: (1825 + 443 + 87) / 2048,

  /** Абзацный отступ 1,25 см. */
  firstLineIndentMm: 12.5,
  get firstLineIndentPt() { return this.firstLineIndentMm * MM; },
  get firstLineIndentTw() { return twipsFromMm(this.firstLineIndentMm); }, // 709

  /** Между заголовком и текстом — 2 интервала (2 × 4,25 мм ≈ 24 пт, машинописный интервал). */
  headingAfterPt: 24,

  linePitch(fontPt: number, spacing: number) {
    return fontPt * this.tnrSingleLine * spacing;
  },

  // ---------- Объём ----------
  minPages: 15,
  maxPages: 30,
  introMinPages: 2.0,
  introMaxPages: 2.5,
  minChapters: 2,
  maxChapters: 3,

  // ---------- Тексты ----------
  headerText: 'ГАПОУ «ЛАИШЕВСКИЙ ТЕХНИКО - ЭКОНОМИЧЕСКИЙ ТЕХНИКУМ»',
  ministry: 'Министерство образования и науки Республики Татарстан',
  orgLine1: 'Государственное автономное профессиональное образовательное учреждение',
  orgLine2: '«Лаишевский технико-экономический техникум»',

  tocTitle: 'СОДЕРЖАНИЕ',
  introTitle: 'ВВЕДЕНИЕ',
  conclusionTitle: 'ЗАКЛЮЧЕНИЕ',
  bibliographyTitle: 'СПИСОК ЛИТЕРАТУРЫ',
  appendixLabel: 'Приложение',

  chapterHeading(n: number, title: string) {
    return `ГЛАВА ${n}. ${cleanHeading(title).toUpperCase()}`;
  },
  cleanHeading,
  stripTrailingPunct,
  academicYear,
};

/** Заголовок: без точки в конце, без лишних пробелов, без номера и слова «Глава». */
export function cleanHeading(s: string): string {
  let t = s.replace(/[ \t\r\n]+/g, ' ').trim();
  t = t.replace(/^(глава|раздел)\s*\d+\s*[.:)]?\s*/i, '');
  t = t.replace(/^\d+(\.\d+)*[.)]?\s+/, '');
  t = stripTrailingPunct(t);
  const quoted = /^[«"“]([^«»"“”]*)[»"”]$/.exec(t);
  if (quoted) t = quoted[1].trim();
  return t;
}

/** Убирает точку (и ; : ,) в конце, но сохраняет точку сокращения («2023–2025 гг.»). */
export function stripTrailingPunct(s: string): string {
  let t = s.replace(/\s+$/, '');
  while (t.length > 0 && '.;:,'.includes(t[t.length - 1])) {
    if (t.endsWith('.') && !t.endsWith('..') && ABBREV_END.test(t)) break;
    t = t.slice(0, -1).replace(/\s+$/, '');
  }
  return t;
}

/** Учебный год по дате: с августа — текущий/следующий. */
export function academicYear(d: Date = new Date()): string {
  const start = d.getMonth() + 1 >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${start + 1}`;
}
