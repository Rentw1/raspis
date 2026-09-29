/**
 * Простая разметка разделов: абзацы через пустую строку, перечисления «– », таблицы
 * «Таблица N — Название» + строки «| … |». Очистка ответа ИИ, ссылки на источники, нумерация таблиц.
 */
import { stripTrailingPunct } from '../core/regulation';
import { capitalize, collapseSpaces, NBSP, stripThinking, typography } from '../core/text';

export interface ParaBlock {
  kind: 'para';
  text: string;
}

export interface ListItemBlock {
  kind: 'list';
  text: string;
  /** «–» или «1)». */
  marker: string;
}

export interface TableBlock {
  kind: 'table';
  title: string;
  /** Номер из подписи в тексте («Таблица 3 — …»), если был. */
  number?: string;
  rows: string[][];
  headerRows: number;
}

/** Строка-примечание под таблицей («Источник: …», «Данные условные»). */
export interface NoteBlock {
  kind: 'note';
  text: string;
}

export type DocBlock = ParaBlock | ListItemBlock | TableBlock | NoteBlock;

export const tableColumns = (t: TableBlock) => t.rows.reduce((m, r) => Math.max(m, r.length), 0);

export const TABLE_CAPTION = /^\s*(?:\*\*)?Таблица\s+([0-9]+(?:\.[0-9]+)?|[А-ЯA-Z]\.[0-9]+|N)?\s*[—–\-:.]\s*(.+?)(?:\*\*)?\s*$/i;
const PIPE_LINE = /^\s*\|.*\|\s*$/;
const SEP_LINE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const LIST_LINE = /^\s*(?:([–—\-•*·▪])|(\d{1,2})[.)])\s+(.+)$/;
const NOTE_LINE = /^\s*(Источник|Примечание|Составлено|Рассчитано|Данные условные)(?=[\s:.,]|$)/i;

/** Подпись таблицы без точки на конце и без кавычек-ёлочек по краям. */
export function cleanCaption(s: string): string {
  let t = stripTrailingPunct(collapseSpaces(s.replace(/\*\*/g, '')));
  const q = /^«([^«»]*)»$/.exec(t);
  if (q) t = q[1];
  return capitalize(t);
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]/g, '');

/** Фразы «как языковая модель…» и т. п. */
export function removePhrases(t: string): string {
  return t
    .replace(/[^.!?\n]*(как (языковая модель|ИИ|искусственный интеллект)|I am an AI|as an AI)[^.!?\n]*[.!?]\s*/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** [3,с.45] / [3; с. 45] / [3, стр. 45] / [3 с. 45] → [3, с. 45]; [3,5] → [3; 5]. */
export function normalizeCitations(t: string): string {
  let r = t.replace(
    /\[\s*(\d{1,3})\s*[,;]?\s*(?:с|c|стр|p|pp)\.?\s*(\d+(?:\s*[–—-]\s*\d+)?)\s*\]/gi,
    (_m, n: string, p: string) => `[${n}, с.${NBSP}${p.replace(/\s*[–—-]\s*/g, '–')}]`,
  );
  r = r.replace(/\[\s*(\d{1,3}(?:\s*[,;]\s*\d{1,3})+)\s*\]/g, (_m, nums: string) =>
    `[${nums
      .split(/[,;]/)
      .map((e) => e.trim())
      .filter(Boolean)
      .join('; ')}]`,
  );
  r = r.replace(/\[\s*(?:источник|source)\s*(\d{1,3})\s*\]/gi, '[$1]');
  return r;
}

/** Приводит ответ ИИ к «чистой» разметке: без Markdown, заголовков, служебных фраз; с русской типографикой. */
export function cleanAiText(raw: string, dropHeadings: string[] = []): string {
  let t = stripThinking(raw).replace(/\r/g, '');
  t = t.replace(/```[a-zA-Z]*\n?/g, '');
  const lines = t.split('\n');
  const out: string[] = [];
  const drop = new Set(dropHeadings.map(norm).filter(Boolean));
  for (let l of lines) {
    l = l.replace(/\s+$/, '');
    const plain = l.replace(/[#*_]/g, '').trim();
    if (/^\s*#{1,6}\s/.test(l)) continue;
    if (
      (/^(глава|раздел|параграф)\s+\d+/i.test(plain) && plain.length < 160 && !plain.includes('. ')) ||
      /^(введение|заключение|выводы по главе|список литературы)\s*:?$/i.test(plain)
    ) {
      continue;
    }
    if (drop.has(norm(plain))) continue;
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(l)) continue;
    if (
      /^(конечно|вот|ниже приведен|ниже представлен|надеюсь|если нужно|примечание автора)(?=[\s,:!.]|$)/i.test(plain) &&
      plain.length < 140 &&
      out.every((e) => !e.trim())
    ) {
      continue;
    }
    if (!PIPE_LINE.test(l)) {
      l = l.replace(/\*\*(.+?)\*\*/g, '$1');
      l = l.replace(/(^|[^\w*])\*(?!\s)([^*\n]+?)\*(?![\w*])/g, '$1$2');
      l = l.replace(/__(.+?)__/g, '$1');
      l = l.replace(/^\s*>\s?/, '');
      l = l.replace(/^\s*[*•·▪]\s+/, '– ');
      l = l.replace(/^\s*-\s+/, '– ');
    }
    out.push(l);
  }
  t = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  t = normalizeCitations(t);
  t = t
    .split('\n')
    .map((l) => (PIPE_LINE.test(l) ? l : typography(l)))
    .join('\n');
  return removePhrases(t);
}

function cells(line: string): string[] {
  let l = line.trim();
  if (l.startsWith('|')) l = l.slice(1);
  if (l.endsWith('|')) l = l.slice(0, -1);
  return l.split('|').map((c) => collapseSpaces(c.replace(/\*\*/g, '')));
}

function nextIsTable(lines: string[], from: number): boolean {
  for (let k = from; k < lines.length && k < from + 3; k++) {
    if (!lines[k].trim()) continue;
    return PIPE_LINE.test(lines[k]);
  }
  return false;
}

/** Разбор разметки раздела в блоки. */
export function parseMarkup(raw: string): DocBlock[] {
  const lines = raw.replace(/\r/g, '').split('\n');
  const blocks: DocBlock[] = [];
  const para: string[] = [];
  let pendingCaption: string | undefined;
  let pendingNumber: string | undefined;

  const flushPara = () => {
    if (!para.length) return;
    const text = collapseSpaces(para.join(' '));
    if (text) blocks.push({ kind: 'para', text });
    para.length = 0;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      flushPara();
      i++;
      continue;
    }
    const cap = TABLE_CAPTION.exec(trimmed);
    if (cap && nextIsTable(lines, i + 1)) {
      flushPara();
      pendingCaption = cleanCaption(cap[2]);
      pendingNumber = cap[1];
      i++;
      continue;
    }
    if (PIPE_LINE.test(line)) {
      flushPara();
      const rows: string[][] = [];
      let headerRows = 0;
      let sawSep = false;
      while (i < lines.length && (PIPE_LINE.test(lines[i]) || (SEP_LINE.test(lines[i]) && lines[i].includes('|')))) {
        if (SEP_LINE.test(lines[i])) {
          if (!sawSep) headerRows = rows.length;
          sawSep = true;
        } else {
          rows.push(cells(lines[i]));
        }
        i++;
      }
      if (rows.length) {
        const cols = rows.reduce((m, r) => Math.max(m, r.length), 0);
        for (const r of rows) {
          while (r.length < cols) r.push('–');
          for (let k = 0; k < r.length; k++) if (!r[k]) r[k] = '–';
        }
        blocks.push({
          kind: 'table',
          title: pendingCaption ?? '',
          number: pendingNumber,
          rows,
          headerRows: sawSep ? (headerRows === 0 ? 1 : headerRows) : 1,
        });
      }
      pendingCaption = undefined;
      pendingNumber = undefined;
      continue;
    }
    const li = LIST_LINE.exec(line);
    if (li) {
      flushPara();
      const marker = li[2] !== undefined ? `${li[2]})` : '–';
      let text = collapseSpaces(li[3]);
      // продолжение пункта на следующих строках (с отступом, без маркера)
      while (
        i + 1 < lines.length &&
        lines[i + 1].trim() &&
        !LIST_LINE.test(lines[i + 1]) &&
        !PIPE_LINE.test(lines[i + 1]) &&
        /^\s{2,}/.test(lines[i + 1])
      ) {
        i++;
        text = `${text} ${collapseSpaces(lines[i])}`;
      }
      blocks.push({ kind: 'list', text, marker });
      i++;
      continue;
    }
    if (NOTE_LINE.test(trimmed) && blocks.length && blocks[blocks.length - 1].kind === 'table' && !para.length) {
      blocks.push({ kind: 'note', text: collapseSpaces(trimmed) });
      i++;
      continue;
    }
    para.push(trimmed);
    i++;
  }
  flushPara();
  return blocks;
}

// ---------------- Ссылки на источники ----------------

export const CITATION_RE = /\[(\d{1,3}(?:\s*;\s*\d{1,3})*)(?:,\s*с\.[\s ]*[\d–-]+)?\]/g;

/** Номера источников, на которые есть ссылки в тексте. */
export function citedNumbers(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(CITATION_RE)) {
    for (const n of m[1].split(';')) {
      const v = Number(n.trim());
      if (Number.isInteger(v)) out.push(v);
    }
  }
  return out;
}

/** Перенумерация ссылок: map старый номер → новый (отсутствующие в map удаляются). */
export function renumberCitations(text: string, map: Map<number, number>): string {
  return text
    .replace(CITATION_RE, (whole: string, nums: string) => {
      const mapped = nums
        .split(';')
        .map((e) => Number(e.trim()))
        .filter((n) => Number.isInteger(n))
        .map((n) => map.get(n))
        .filter((n): n is number => n !== undefined);
      if (!mapped.length) return '';
      const pagePart = whole.includes('с.') ? whole.slice(whole.indexOf(',')).replace(']', '') : '';
      return `[${mapped.join('; ')}${pagePart}]`;
    })
    .replace(/ +([.,;:])/g, '$1');
}

/** Удаляет ссылки на номера вне диапазона 1..max. */
export function dropInvalidCitations(text: string, max: number): string {
  const map = new Map<number, number>();
  for (let i = 1; i <= max; i++) map.set(i, i);
  return renumberCitations(text, map);
}

// ---------------- Таблицы ----------------

/**
 * Сквозная нумерация таблиц: подписи и ссылки «таблице N» в тексте.
 * start — номер первой таблицы раздела. Возвращает новый текст и следующий номер.
 */
export function renumberTables(text: string, start: number): [string, number] {
  const lines = text.split('\n');
  let n = start;
  const map = new Map<string, number>();
  for (let i = 0; i < lines.length; i++) {
    const m = TABLE_CAPTION.exec(lines[i].trim());
    if (m && nextIsTable(lines, i + 1)) {
      const old = m[1];
      if (old && old !== 'N') map.set(old, n);
      lines[i] = `Таблица ${n} — ${cleanCaption(m[2])}`;
      n++;
    }
  }
  let out = lines.join('\n');
  if (map.size) {
    out = out.replace(/(таблиц[аеуыи]|табл\.)(\s+)(\d+(?:\.\d+)?)/gi, (whole: string, w: string, sp: string, num: string) => {
      const nn = map.get(num);
      return nn === undefined ? whole : `${w}${sp}${nn}`;
    });
  }
  return [out, n];
}

export const splitParagraphs = (text: string) => text.split(/\n\s*\n/);
