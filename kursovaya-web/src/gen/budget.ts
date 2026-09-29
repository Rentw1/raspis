/**
 * Расчёт объёма разделов (в словах) под желаемое число страниц.
 *
 * Страница основного текста (Times New Roman 14, интервал 1,5, поля 30/10/20/20 мм)
 * вмещает около 30 строк по ~75 знаков — примерно 270 слов с учётом абзацных отступов.
 */
import type { GenOptions } from '../models/coursework';

export const WORDS_PER_PAGE = 270;

/** Введение: 2–2,5 страницы. */
export const INTRO_PAGES = 2.2;

export interface Budget {
  introWords: number;
  conclusionWords: number;
  chapterWords: number[];
}

export function computeBudget(o: GenOptions, sources = 20): Budget {
  const n = Math.min(3, Math.max(2, o.chapters));
  // Титульный лист + содержание + введение (3 листа с учётом начала с новой страницы)
  // + заключение (3 листа) + список литературы.
  const bibPages = Math.max(1, Math.ceil((sources * 2.6) / 29 + 0.3));
  const fixed = 1 + 1 + 3 + 3 + bibPages;
  const chapterPages = Math.max(n * 3, o.targetPages - fixed - 0.5 * n);
  const chapterTotal = Math.round(chapterPages * WORDS_PER_PAGE);
  const theory = Math.round((chapterTotal * o.theoryPercent) / 100);
  const practice = chapterTotal - theory;
  let ch: number[];
  if (n === 2) {
    ch = [theory, practice];
  } else {
    const p2 = Math.round(practice * 0.55);
    ch = [theory, p2, practice - p2];
  }
  const intro = Math.round(INTRO_PAGES * WORDS_PER_PAGE) - 20;
  return { introWords: intro, conclusionWords: intro - 20, chapterWords: ch };
}

/** На сколько частей делить главу (часть ≈ 700–900 слов — надёжно для бесплатных моделей). */
export function partsFor(words: number): number {
  return Math.max(2, Math.ceil(words / 850));
}
