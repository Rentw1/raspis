#!/usr/bin/env python3
"""Генерирует src/export/metrics-data.ts: ширины знаков Liberation Serif (метрики Times New Roman).

Запуск: python3 scripts/font-metrics.py
"""
from fontTools.ttLib import TTFont

RANGES = [
    (0x20, 0x7E), (0xA0, 0x17F), (0x370, 0x3FF), (0x400, 0x52F), (0x2000, 0x206F),
    (0x20A0, 0x20CF), (0x2100, 0x214F), (0x2190, 0x21FF), (0x2200, 0x22FF), (0x25A0, 0x25FF),
]


def encode(path):
    f = TTFont(path)
    upm = f['head'].unitsPerEm
    cmap = f.getBestCmap()
    hmtx = f['hmtx']
    runs = []
    for a, b in RANGES:
        cur = None
        for cp in range(a, b + 1):
            g = cmap.get(cp)
            if g is None:
                cur = None
                continue
            w = hmtx[g][0]
            if cur is None:
                cur = [cp, []]
                runs.append(cur)
            cur[1].append(w)
    parts = [f"{s:x}:{','.join(str(w) for w in ws)}" for s, ws in runs]
    hhea = f['hhea']
    return upm, hhea.ascent, -hhea.descent, hhea.lineGap, ';'.join(parts)


def main():
    out = ['// Сгенерировано scripts/font-metrics.py — не править вручную.',
           '// Ширины знаков Liberation Serif (SIL OFL) = метрики Times New Roman: переносы строк и число',
           '// страниц совпадают с Word. Формат: «начальный код в hex:ширина,ширина,…» для подряд идущих знаков.', '']
    for name, path in (('REGULAR', 'public/fonts/LiberationSerif-Regular.ttf'), ('BOLD', 'public/fonts/LiberationSerif-Bold.ttf')):
        upm, asc, desc, gap, data = encode(path)
        out.append(f'export const {name}_METRICS = {{ upm: {upm}, ascent: {asc}, descent: {desc}, lineGap: {gap}, data: {data!r} }};')
        out.append('')
    with open('src/export/metrics-data.ts', 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(out).replace("data: '", 'data:\n    \'') )


if __name__ == '__main__':
    main()
