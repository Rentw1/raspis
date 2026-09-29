/** Модель документа — общая для вёрстки, DOCX и PDF. */
import { Reg } from '../core/regulation';
import { isFemaleName, parsePersonName } from '../core/text';
import { chaptersOf, conclusionOf, introductionOf, sectionHeading, type Coursework } from '../models/coursework';
import type { InstitutionSettings } from '../models/settings';
import { parseMarkup, type TableBlock } from '../gen/markup';
import { formatSource, orderedSources } from './gost';

/** Таблица с присвоенным номером. */
export interface NumberedTable {
  /** «1» для основной части, «1.1» — для приложения 1. */
  label: string;
  table: TableBlock;
  /** Уникальный ключ таблицы (для «Продолжения таблицы» в DOCX). */
  key: string;
}

export type DocItem =
  | { kind: 'para'; text: string; indent: boolean }
  | { kind: 'list'; marker: string; text: string }
  | { kind: 'table'; table: NumberedTable }
  | { kind: 'note'; text: string }
  | { kind: 'bib'; number: number; text: string }
  | { kind: 'signature'; initialsName: string; year: number };

export type PartKind = 'introduction' | 'chapter' | 'conclusion' | 'bibliography' | 'appendix';

/** Структурная часть: начинается с новой страницы, имеет заголовок. */
export interface DocPart {
  id: string;
  kind: PartKind;
  /** Заголовок, как он печатается (для приложения — название под словом «Приложение N»). */
  heading: string;
  tocText: string;
  items: DocItem[];
  appendixNumber?: number;
}

export interface TitlePageData {
  ministry: string;
  org1: string;
  org2: string;
  discipline: string;
  topic: string;
  student: string;
  female: boolean;
  group: string;
  course: number;
  specialty: string;
  supervisor: string;
  academicYear: string;
}

export function yearLine(t: TitlePageData): string {
  const m = /(\d{4})\D+(\d{4})/.exec(t.academicYear);
  return m ? `${m[1]} - ${m[2]} уч. год.` : `${t.academicYear} уч. год.`;
}

export interface DocModel {
  title: TitlePageData;
  parts: DocPart[];
  headerText: string;
  docTitle: string;
  author: string;
}

export function buildDocModel(cw: Coursework, inst: InstitutionSettings): DocModel {
  const m = cw.meta;
  const title: TitlePageData = {
    ministry: inst.ministry,
    org1: inst.orgLine1,
    org2: inst.orgLine2,
    discipline: m.discipline.trim(),
    topic: m.topic.trim(),
    student: m.studentName.trim(),
    female: isFemaleName(m.studentName),
    group: m.group.trim(),
    course: m.course,
    specialty: m.specialty.trim(),
    supervisor: m.supervisor.trim(),
    academicYear: m.academicYear,
  };
  const parts: DocPart[] = [];
  let tableNo = 1;

  const items = (text: string, keyPrefix: string, tableLabel?: (k: number) => string): DocItem[] => {
    const out: DocItem[] = [];
    let k = 0;
    for (const b of parseMarkup(text)) {
      switch (b.kind) {
        case 'para':
          out.push({ kind: 'para', text: b.text, indent: true });
          break;
        case 'list':
          out.push({ kind: 'list', marker: b.marker, text: b.text });
          break;
        case 'table': {
          k++;
          const label = tableLabel ? tableLabel(k) : String(tableNo++);
          out.push({ kind: 'table', table: { label, table: b, key: `${keyPrefix}-t${k}` } });
          break;
        }
        case 'note':
          out.push({ kind: 'note', text: b.text });
          break;
      }
    }
    return out;
  };

  const intro = introductionOf(cw);
  if (intro) parts.push({ id: 'introduction', kind: 'introduction', heading: Reg.introTitle, tocText: Reg.introTitle, items: items(intro.text, 'intro') });
  for (const c of chaptersOf(cw)) {
    const h = sectionHeading(c);
    parts.push({ id: `chapter${c.number}`, kind: 'chapter', heading: h, tocText: h, items: items(c.text, `ch${c.number}`) });
  }
  const concl = conclusionOf(cw);
  if (concl) parts.push({ id: 'conclusion', kind: 'conclusion', heading: Reg.conclusionTitle, tocText: Reg.conclusionTitle, items: items(concl.text, 'concl') });
  const ordered = orderedSources(cw.sources);
  const bib: DocItem[] = ordered.map((s, i) => ({ kind: 'bib', number: i + 1, text: formatSource(s) }));
  const signature: DocItem = { kind: 'signature', initialsName: parsePersonName(m.studentName).initialsSurname, year: new Date().getFullYear() };
  if (cw.options.signature === 'afterBibliography' || cw.appendices.length === 0) bib.push(signature);
  parts.push({ id: 'bibliography', kind: 'bibliography', heading: Reg.bibliographyTitle, tocText: Reg.bibliographyTitle, items: bib });

  // Регламент: если приложение одно, оно не нумеруется.
  const single = cw.appendices.length === 1;
  cw.appendices.forEach((a, idx) => {
    const t = Reg.cleanHeading(a.title);
    const it = items(a.text, `app${a.number}`, (k) => (single ? `П.${k}` : `${a.number}.${k}`));
    if (idx === cw.appendices.length - 1 && cw.options.signature === 'endOfWork') it.push(signature);
    parts.push({
      id: `appendix${a.number}`,
      kind: 'appendix',
      heading: t,
      tocText: single ? `${Reg.appendixLabel}. ${t}` : `${Reg.appendixLabel} ${a.number}. ${t}`,
      items: it,
      appendixNumber: single ? undefined : a.number,
    });
  });
  if (single) {
    const re = /(приложени[еияю])[\s ]+1(?!\d)/gi;
    for (const p of parts) {
      if (p.kind === 'appendix' || p.kind === 'bibliography') continue;
      p.items = p.items.map((e) => (e.kind === 'para' || e.kind === 'list' ? { ...e, text: e.text.replace(re, '$1') } : e));
    }
  }
  return { title, parts, headerText: inst.headerText, docTitle: m.topic.trim(), author: m.studentName.trim() };
}
