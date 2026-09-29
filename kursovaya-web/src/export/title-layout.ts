/**
 * Титульный лист по ПРИЛОЖЕНИЮ 4 регламента: высоты всех строк известны заранее,
 * гибкие отступы подбираются так, чтобы лист гарантированно помещался на одну страницу.
 */
import { Reg } from '../core/regulation';
import { yearLine, type TitlePageData } from './doc-model';
import { lineCount, type TextRun } from './text-layout';

export type TitleAlign = 'left' | 'center' | 'right';

export interface TitleLine {
  spacer: boolean;
  runs: TextRun[];
  size: number;
  spacing: number;
  align: TitleAlign;
  rightIndent: number;
  /** Высота строки (для отступа — задана, для текста вычисляется). */
  height: number;
  lines: number;
}

/** Правый отступ стиля «toc 1» из образца (909 twips). */
export const TOC_RIGHT_INDENT = 909 / 20;

const txt = (runs: TextRun[], size: number, spacing: number, align: TitleAlign = 'left', rightIndent = 0): TitleLine => ({
  spacer: false,
  runs,
  size,
  spacing,
  align,
  rightIndent,
  height: 0,
  lines: 1,
});

const gap = (height: number): TitleLine => ({ spacer: true, runs: [], size: 12, spacing: 1, align: 'left', rightIndent: 0, height, lines: 0 });

export function computeTitleLayout(t: TitlePageData): TitleLine[] {
  const width = Reg.contentWidthPt;
  const p14 = Reg.linePitch(14, 1.0);
  const p14h = Reg.linePitch(14, 1.5);
  const spacerA = gap(0);
  const spacerB = gap(0);
  const spacerC = gap(0);
  const blankTopic = gap(p14h);
  const blankAfterTopic = gap(p14 * 2);
  const lines: TitleLine[] = [
    txt([{ text: t.ministry, bold: true }], 12, 1.0, 'center'),
    txt([{ text: t.org1, bold: true }], 12, 1.0, 'center'),
    txt([{ text: t.org2, bold: true }], 12, 1.0, 'center'),
    spacerA,
    txt([{ text: 'КУРСОВАЯ РАБОТА', bold: true }], 14, 1.5, 'center', TOC_RIGHT_INDENT),
    txt([{ text: 'по дисциплине (междисциплинарному курсу)', bold: true }], 14, 1.5, 'center', TOC_RIGHT_INDENT),
    txt([{ text: t.discipline || '____________________________________________', bold: true }], 14, 1.5, 'center', TOC_RIGHT_INDENT),
    blankTopic,
    txt([{ text: 'Тема: ', bold: true }, { text: `«${t.topic}»`, bold: true }], 14, 1.5),
    blankAfterTopic,
    txt([{ text: t.female ? 'выполнила:' : 'выполнил:', bold: true }, { text: ` ${t.student}` }], 14, 1.0),
    gap(Reg.linePitch(10, 1.0)),
    txt([{ text: 'группа', bold: true }, { text: ` ${t.group}    ${t.course} ` }, { text: 'курса,', bold: true }], 14, 1.5),
    txt([{ text: 'специальность:', bold: true }, { text: ` ${t.specialty}` }], 14, 1.5),
    txt([{ text: `руководитель: ${t.supervisor}`, bold: true }], 14, 1.0),
    gap(p14),
    spacerB,
    txt([{ text: ' Дата проверки:', bold: true }], 14, 1.5),
    txt([{ text: ' Оценка с учётом защиты:', bold: true }], 14, 1.5),
    txt([{ text: ' Члены комиссии:', bold: true }], 14, 1.5),
    spacerC,
    txt([{ text: yearLine(t), bold: true }], 14, 1.5, 'center', TOC_RIGHT_INDENT),
  ];
  let fixed = 0;
  for (const l of lines) {
    if (l.spacer) {
      fixed += l.height;
      continue;
    }
    l.lines = lineCount(l.runs, l.size, width - l.rightIndent);
    l.height = l.lines * Reg.linePitch(l.size, l.spacing);
    fixed += l.height;
  }
  // Запас на расхождения вёрстки Word — 1,5 строки.
  let free = Reg.contentHeightPt - fixed - 1.5 * p14h;
  if (free < 40) {
    // очень длинная тема: убираем пустые строки
    free += blankTopic.height + blankAfterTopic.height;
    blankTopic.height = 0;
    blankAfterTopic.height = 0;
  }
  free = Math.max(0, free);
  spacerA.height = free * 0.32;
  spacerB.height = free * 0.52;
  spacerC.height = free * 0.16;
  return lines;
}
