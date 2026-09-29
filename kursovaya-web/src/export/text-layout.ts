/** Разбиение текста на слова и перенос строк так же, как в Word (жадно, по пробелам и после дефисов). */
import { fontOf } from './metrics';

export interface TextRun {
  text: string;
  bold?: boolean;
}

/** Слово (или часть составного слова после дефиса/тире). */
export interface LayoutToken {
  text: string;
  bold: boolean;
  /** Сколько пробелов перед словом (растягиваются при выключке по ширине). */
  spaces: number;
  width: number;
}

const WORDISH = /[А-Яа-яЁёA-Za-z0-9]/;
const AFTER_DASH = /[А-Яа-яЁёA-Za-z0-9«(]/;
const DASHES = '-–—';

/** Места переноса внутри слова: после дефиса или тире между буквами/цифрами. */
function splitHyphens(w: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 1; i < w.length - 1; i++) {
    if (DASHES.includes(w[i]) && WORDISH.test(w[i - 1]) && AFTER_DASH.test(w[i + 1])) {
      out.push(w.slice(start, i + 1));
      start = i + 1;
    }
  }
  out.push(w.slice(start));
  return out;
}

/** Неразрывные пробелы (U+00A0) не разрывают слово. */
export function tokenize(runs: TextRun[]): LayoutToken[] {
  const out: LayoutToken[] = [];
  let pending = 0;
  for (const r of runs) {
    const parts = r.text.replace(/[\n\t]/g, ' ').split(' ');
    parts.forEach((w, i) => {
      if (i > 0) pending++;
      if (!w) return;
      const pieces = splitHyphens(w);
      pieces.forEach((p, k) => {
        out.push({ text: p, bold: !!r.bold, spaces: k === 0 && out.length > 0 ? pending : 0, width: 0 });
      });
      pending = 0;
    });
  }
  return out;
}

export type LineRange = [number, number];

/**
 * Жадный перенос строк. Возвращает диапазоны [start, end) токенов.
 * Слово шире строки разбивается по символам (длинные адреса сайтов).
 */
export function breakLines(toks: LayoutToken[], firstWidth: number, width: number, size: number): LineRange[] {
  const measure = (s: string, b: boolean) => fontOf(b).width(s, size);
  const space = (b: boolean) => fontOf(b).width(' ', size);
  for (const t of toks) t.width = measure(t.text, t.bold);
  const lines: LineRange[] = [];
  let start = 0;
  let x = 0;
  let avail = firstWidth;
  let k = 0;
  while (k < toks.length) {
    const t = toks[k];
    const sp = k > start ? t.spaces * space(t.bold) : 0;
    if (k > start && x + sp + t.width > avail + 0.01) {
      lines.push([start, k]);
      start = k;
      x = 0;
      avail = width;
      continue;
    }
    if (k === start && t.width > avail + 0.01 && t.text.length > 1) {
      let cut = 1;
      while (cut < t.text.length && measure(t.text.slice(0, cut + 1), t.bold) <= avail) cut++;
      const rest: LayoutToken = { text: t.text.slice(cut), bold: t.bold, spaces: 0, width: 0 };
      t.text = t.text.slice(0, cut);
      t.width = measure(t.text, t.bold);
      rest.width = measure(rest.text, rest.bold);
      toks.splice(k + 1, 0, rest);
    }
    x += sp + toks[k].width;
    k++;
  }
  if (start < toks.length || !lines.length) lines.push([start, toks.length]);
  return lines;
}

/** Число строк абзаца заданной ширины. */
export function lineCount(runs: TextRun[], size: number, firstWidth: number, width = firstWidth): number {
  const toks = tokenize(runs);
  if (!toks.length) return 1;
  return breakLines(toks, firstWidth, width, size).length;
}
