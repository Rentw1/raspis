/** Ширины текста по метрикам Liberation Serif (= Times New Roman). */
import { BOLD_METRICS, REGULAR_METRICS } from './metrics-data';

const TABLE_SIZE = 0x2600;

export class FontMetrics {
  readonly upm: number;
  readonly ascent: number;
  readonly descent: number;
  private readonly widths = new Float32Array(TABLE_SIZE).fill(-1);
  private readonly fallback: number;

  constructor(m: { upm: number; ascent: number; descent: number; data: string }) {
    this.upm = m.upm;
    this.ascent = m.ascent / m.upm;
    this.descent = m.descent / m.upm;
    for (const run of m.data.split(';')) {
      const [start, list] = run.split(':');
      let cp = parseInt(start, 16);
      for (const w of list.split(',')) {
        if (cp < TABLE_SIZE) this.widths[cp] = Number(w) / m.upm;
        cp++;
      }
    }
    this.fallback = this.widths[0x43e] > 0 ? this.widths[0x43e] : 0.5; // «о»
  }

  /** Есть ли знак в шрифте. */
  has(cp: number): boolean {
    return cp < TABLE_SIZE && this.widths[cp] >= 0;
  }

  /** Ширина знака в долях кегля. */
  charWidth(cp: number): number {
    if (cp < TABLE_SIZE) {
      const w = this.widths[cp];
      if (w >= 0) return w;
    }
    return this.fallback;
  }

  /** Ширина строки в пунктах. */
  width(text: string, size: number): number {
    let w = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
        w += this.fallback;
        i++;
        continue;
      }
      w += this.charWidth(c);
    }
    return w * size;
  }
}

export const REGULAR = new FontMetrics(REGULAR_METRICS);
export const BOLD = new FontMetrics(BOLD_METRICS);

export const fontOf = (bold: boolean) => (bold ? BOLD : REGULAR);

export function textWidth(text: string, size: number, bold = false): number {
  return fontOf(bold).width(text, size);
}

/** Знаки вне шрифта заменяются (эмодзи убираются), чтобы PDF и вёрстка не ломались. */
export function safeText(s: string): string {
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0) as number;
    if (cp === 32 || REGULAR.has(cp)) out += ch;
    else if (cp === 9 || cp === 10 || cp === 13) out += ' ';
    else if (cp === 0x2212) out += '-';
    else if (cp >= 0x1f000 || (cp >= 0x2600 && cp <= 0x27bf) || cp === 0xfe0f || cp === 0x200d) continue;
    else out += '?';
  }
  return out;
}
