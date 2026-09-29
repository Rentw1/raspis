/**
 * Ширины столбцов таблицы (одинаково для вёрстки и Word): каждый столбец не уже самого длинного
 * слова, остаток ширины делится пропорционально объёму текста.
 */
export function columnWidths(rows: string[][], cols: number, width: number, textWidth: (s: string) => number, padX = 5.4): number[] {
  if (cols <= 0) return [];
  const minW = new Array<number>(cols).fill(0);
  const want = new Array<number>(cols).fill(0);
  for (const r of rows) {
    for (let i = 0; i < cols; i++) {
      const text = i < r.length ? r[i] : '';
      for (const w of text.split(/[ \t\r\n]+/)) {
        if (!w) continue;
        minW[i] = Math.max(minW[i], textWidth(w) + 2 * padX + 1);
      }
      want[i] = Math.max(want[i], Math.min(textWidth(text) + 2 * padX + 1, width));
    }
  }
  for (let i = 0; i < cols; i++) minW[i] = Math.max(minW[i], 2 * padX + 12);
  const sumMin = minW.reduce((a, b) => a + b, 0);
  const widths = [...minW];
  if (sumMin >= width) return minW.map((w) => (width * w) / sumMin);
  const extra = width - sumMin;
  const growth = want.map((w, i) => Math.max(0, w - minW[i]));
  const g = growth.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cols; i++) widths[i] += g > 0 ? (extra * growth[i]) / g : extra / cols;
  return widths;
}

const NUM = /^[\s+\-–−]?[\d\s .,]+%?$/;

export function isNumericCell(s: string): boolean {
  const t = s.trim();
  return t !== '' && NUM.test(t) && /\d/.test(t);
}

/** Столбцы, где все значения — числа (выравниваются по правому краю, разряды друг под другом). */
export function numericColumns(rows: string[][], cols: number, headerRows: number): boolean[] {
  return Array.from({ length: cols }, (_, i) => {
    const body = rows
      .slice(headerRows)
      .map((r) => (i < r.length ? r[i] : ''))
      .filter((s) => s.trim() !== '' && s.trim() !== '–');
    return body.length > 0 && body.every(isNumericCell);
  });
}
