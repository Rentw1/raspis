'use strict';
/* Сборка документа Word и HTML для печати/PDF из плана занятия и заданий. */
var EXPORT = (function () {
  function sn(id) { return id && PH.BY_ID[id] ? PH.BY_ID[id].name : ''; }
  function dirName(id) { var d = METHODS.DIRECTIONS.filter(function (x) { return x.id === id; })[0]; return d ? d.name : ''; }

  function titleLines(L, plan, S) {
    var a = plan.age, f = plan.form;
    var lines = [
      f.gen + ' логопедического занятия',
      'по лексической теме «' + L.theme.title + '»' + (L.sound ? (L.sound2 ? ' (дифференциация звуков ' + sn(L.sound) + ' – ' + sn(L.sound2) + ')' : ' (автоматизация звука ' + sn(L.sound) + ')') : ''),
      'для детей ' + a.short + ' группы компенсирующей направленности',
      'для детей с тяжёлыми нарушениями речи (' + a.years + ' лет)'
    ];
    return lines;
  }

  function fileName(L, ext) {
    var name = 'Занятие ' + L.theme.title.replace(/[.,]/g, '') + (L.sound ? ' ' + L.sound : '') + ' ' + U.dateShort(new Date(L.date || Date.now()));
    return name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() + '.' + ext;
  }

  function speechParas(d, stage, size) {
    stage.speech.forEach(function (sp) {
      var who = sp[0], txt = sp[1];
      if (who === 'Упражнение') d.p([['– ', {}], [txt, {}]], { left: 709, hanging: 283, size: size });
      else if (who === 'Текст') d.p([[txt, { i: true }]], { left: 1134, indent: 0, size: size, line: 276 });
      else if (who === 'Игра') d.p([['Игра ' + txt, { b: true, i: true }]], { before: 80, keepNext: true, size: size });
      else d.p([[who + ': ', { b: true }], [txt, {}]], { size: size });
    });
  }

  /**
   * L — параметры занятия, plan — LESSON.build, tasks — задания, pngs — PNG-байты картинок заданий (по порядку),
   * S — настройки (организация, педагог, что включать).
   */
  function docx(L, plan, tasks, pngs, S) {
    var inc = S.include || {};
    var on = function (k) { return inc[k] !== false; };
    var d = new DOCX.Doc({ size: (S.fontSize || 14) * 2 });
    var sz = (S.fontSize || 14) * 2;
    var year = new Date(L.date || Date.now()).getFullYear();

    /* ---- Титульный лист ---- */
    if (on('title')) {
      d.p(S.orgFull || '', { align: 'center', indent: 0, line: 276 });
      d.p('', { indent: 0 });
      d.p('КОНСПЕКТ', { align: 'center', indent: 0, b: true, size: 36, before: 2600, after: 120 });
      titleLines(L, plan, S).forEach(function (t, i) { d.p(t, { align: 'center', indent: 0, b: i === 1, line: 300 }); });
      d.p('Форма проведения: ' + plan.form.name.toLowerCase() + '; тип: ' + (L.kind === 'new' ? 'изучение нового материала' : 'закрепление пройденного материала') + '; продолжительность: ' + U.min(plan.total) + '.',
        { align: 'center', indent: 0, i: true, size: 24, before: 200, line: 276 });
      d.p([['Составитель: ', {}], [S.position || 'учитель-логопед', {}]], { align: 'right', indent: 0, before: 2600, line: 276 });
      d.p(S.teacher || '________________________', { align: 'right', indent: 0, line: 276 });
      if (S.group) d.p('Группа: ' + S.group, { align: 'right', indent: 0, line: 276 });
      d.p(U.dateLong(new Date(L.date || Date.now())), { align: 'right', indent: 0, line: 276 });
      d.p((S.city || '') + (S.city ? ', ' : '') + year, { align: 'center', indent: 0, before: 2400 });
      d.pageBreak();
    }

    /* ---- Информационная карта ---- */
    if (on('info')) {
      d.h('1. Информационная карта занятия');
      var o = plan.obj, ex = plan.ex;
      var num = function (arr) { return arr.map(function (x, i) { return (i + 1) + '. ' + x; }); };
      var rows = [
        ['Лексическая тема', '«' + L.theme.title + '»'],
        ['Возрастная группа', plan.age.name + ', группа компенсирующей направленности для детей с ТНР' + (S.group ? ' «' + S.group.replace(/[«»"]/g, '') + '»' : '')],
        ['Речевое заключение', L.conclusion || 'ОНР III уровня'],
        ['Форма организации', plan.form.name + ' занятие'],
        ['Тип занятия', L.kind === 'new' ? 'Изучение нового материала' : 'Закрепление пройденного материала'],
        ['Направление работы', dirName(L.direction)],
        ['Продолжительность', U.min(plan.total) + ' (СанПиН 1.2.3685-21, табл. 6.6)'],
        ['Звук', L.sound ? (L.sound2 ? 'Дифференциация ' + sn(L.sound) + ' – ' + sn(L.sound2) : sn(L.sound) + ' — автоматизация') : '—'],
        ['Цель', plan.goal],
        ['Задачи', [[['Коррекционно-образовательные:', { b: true }]]].concat(num(o.edu)).concat([[['Коррекционно-развивающие:', { b: true }]]]).concat(num(o.dev)).concat([[['Коррекционно-воспитательные:', { b: true }]]]).concat(num(o.vos))],
        ['Интеграция образовательных областей (ФОП ДО)', ex.integration.map(function (x) { return x[0] + ': ' + x[1] + '.'; })],
        ['Виды детской деятельности', U.cap(ex.activities.join(', ')) + '.'],
        ['Методы и приёмы', ex.methods.map(function (m) { return U.cap(m) + '.'; })],
        ['Педагогические технологии', U.cap(ex.technologies.join('; ')) + '.'],
        ['Оборудование и материалы', ex.equipment],
        ['Предварительная работа', ex.prelim],
        ['Словарная работа', [
          'Предметный словарь: ' + L.words.map(function (e) { return e.w; }).join(', ') + '.',
          L.theme.lex && L.theme.lex.v ? 'Глагольный словарь: ' + L.theme.lex.v.join(', ') + '.' : '',
          L.theme.lex && L.theme.lex.a ? 'Словарь признаков: ' + L.theme.lex.a.join(', ') + '.' : ''
        ].filter(Boolean)],
        ['Планируемые результаты', ex.results]
      ];
      d.table(rows.map(function (r) { return [{ text: r[0], b: true }, { text: r[1] }]; }), { widths: [4.6, 11.9], size: 24, header: 0 });
    }

    /* ---- Технологическая карта (альбомная) ---- */
    if (on('techcard')) {
      d.endSection({ titlePg: on('title') });
      d.h('2. Технологическая карта занятия (' + U.min(plan.total) + ')');
      var head = ['№', 'Этап, время', 'Задачи этапа', 'Деятельность логопеда', 'Деятельность детей', 'Методы, приёмы, формы', 'Планируемый результат'];
      var tr = [head];
      plan.stages.forEach(function (s) {
        tr.push([
          { text: String(s.n), align: 'center' },
          { text: [[[s.name, { b: true }]], s.min + ' мин'] },
          s.aim, s.teacher, s.children, s.methods, s.result
        ]);
      });
      d.table(tr, { widths: [0.8, 3.6, 4.0, 5.5, 4.4, 3.7, 3.7], size: 22, header: 1, headShade: 'D9D9D9', cantSplit: true });
      d.endSection({ landscape: true, margins: [2, 2, 2, 2] });
    } else {
      d.endSection({ titlePg: on('title') });
    }

    /* ---- Ход занятия ---- */
    if (on('conspect')) {
      d.h('3. Ход занятия', { pageBreak: false });
      plan.stages.forEach(function (s) {
        d.h(s.n + '. ' + s.name + ' (' + U.min(s.min) + ')', { level: 2 });
        d.p([['Задача этапа: ', { i: true, b: true }], [s.aim, { i: true }]], { size: sz });
        speechParas(d, s, sz);
      });
    }

    /* ---- Домашнее задание ---- */
    if (on('home')) {
      d.h('4. Задание для закрепления дома (для родителей)');
      plan.ex.home.forEach(function (h, i) { d.p((i + 1) + '. ' + h, { size: sz }); });
    }

    /* ---- Ключи ---- */
    if (on('keys') && tasks.length) {
      d.h('5. Ключи к заданиям рабочего листа (для педагога)');
      tasks.forEach(function (t, i) { d.p([['Задание ' + (i + 1) + ' «' + t.title + '». ', { b: true }], [t.note, {}]], { size: sz }); });
    }

    /* ---- Источники ---- */
    if (on('sources')) {
      d.h('6. Нормативно-правовая база');
      METHODS.NPA.forEach(function (x, i) { d.p((i + 1) + '. ' + x, { size: sz }); });
      d.h('7. Список литературы');
      METHODS.LITERATURE.forEach(function (x, i) { d.p((i + 1) + '. ' + x, { size: sz }); });
      d.p('Иллюстрации: OpenMoji — открытый проект эмодзи (openmoji.org), лицензия CC BY-SA 4.0' +
        (Object.keys(IMG.overrides).some(function (k) { return IMG.overrides[k] && IMG.overrides[k].src === 'arasaac'; }) ? '; пиктограммы ARASAAC (arasaac.org), автор Sergio Palao, лицензия CC BY-NC-SA 4.0, собственность Правительства Арагона' : '') + '.',
      { size: 20, i: true, before: 200 });
    }

    /* ---- Рабочий лист ---- */
    var hasSheet = on('worksheet') && tasks.length;
    if (hasSheet) {
      d.endSection({});
      d.p('РАБОЧИЙ ЛИСТ', { align: 'center', indent: 0, b: true, size: 32, color: '1F2A6B', after: 40 });
      d.p('Лексическая тема «' + L.theme.title + '»' + (L.sound ? (L.sound2 ? ' · звуки ' + sn(L.sound) + ' – ' + sn(L.sound2) : ' · звук ' + sn(L.sound)) : ''),
        { align: 'center', indent: 0, size: 26, color: '4338CA', line: 276 });
      d.p('Имя ребёнка: ______________________________     Дата: ______________', { align: 'center', indent: 0, size: 24, before: 120, after: 120, line: 276 });
      var cellW = 17.6;
      tasks.forEach(function (t, i) {
        var png = pngs[i];
        var wCm = 16.8, hCm = wCm * t.h / TASKS.W;
        var maxH = 20.5;
        if (hCm > maxH) { wCm = wCm * maxH / hCm; hCm = maxH; }
        var xml = d.pXml([['Задание ' + (i + 1) + '. ', { b: true, color: '4338CA', size: 28 }], [t.title, { b: true, size: 28, color: '1F2A6B' }]], { indent: 0, line: 276, after: 40, keepNext: true }) +
          d.pXml([[t.instr, { size: 24 }]], { indent: 0, line: 264, after: 80, keepNext: true }) +
          (png ? d.pXml(d.imgRun(png, wCm, hCm), { raw: true, align: 'center', indent: 0, line: 240 }) : '') +
          (S.answersOnSheet ? d.pXml([['Для взрослого: ' + t.note, { i: true, size: 20, color: '6B6F8A' }]], { indent: 0, line: 240, before: 60 }) : '');
        d.table([[{ xml: xml }]], { widths: [cellW], borderColor: 'B9BDD6', borderSize: 8, cantSplit: true, padV: 120, padH: 160 });
      });
      d.p('Иллюстрации: OpenMoji (CC BY-SA 4.0)' + (Object.keys(IMG.overrides).some(function (k) { return IMG.overrides[k] && IMG.overrides[k].src === 'arasaac'; }) ? '; пиктограммы ARASAAC (CC BY-NC-SA 4.0)' : '') + '.',
        { size: 16, i: true, color: '8A8FB0', indent: 0, line: 240 });
    }

    return d.build({
      title: 'Конспект логопедического занятия «' + L.theme.title + '»',
      subject: 'Логопедическое занятие', author: S.teacher || '', keywords: 'логопед, ФОП ДО, ФАОП ДО, ' + L.theme.title
    }, hasSheet ? { margins: [1.5, 1.5, 1.5, 1.5] } : {});
  }

  /* ---------- HTML для печати (Android → Печать/PDF) ---------- */
  function html(L, plan, tasks, dataUrls, S, part) {
    var e = U.esc;
    var css = '@page{size:A4;margin:15mm 15mm 15mm 20mm}body{font-family:"Times New Roman",serif;font-size:13pt;line-height:1.4;color:#000}' +
      'h1{font-size:15pt;text-align:center;text-transform:uppercase;margin:14pt 0 8pt}h2{font-size:13pt;margin:10pt 0 4pt}' +
      'table{border-collapse:collapse;width:100%;font-size:11pt}td,th{border:1px solid #000;padding:3pt 5pt;vertical-align:top}th{background:#e6e6e6}' +
      '.task{border:1.5px solid #b9bdd6;border-radius:10px;padding:8pt 10pt;margin:0 0 10pt;page-break-inside:avoid}' +
      '.task h3{margin:0 0 4pt;color:#1f2a6b;font-size:14pt}.task p{margin:0 0 6pt;font-size:12pt}.task img{width:100%;display:block}' +
      '.sheet-title{text-align:center;color:#1f2a6b;font-size:18pt;font-weight:bold;margin:0}.sub{text-align:center;color:#4338ca}' +
      '.pb{page-break-before:always}.sp{margin:2pt 0}.poem{font-style:italic;margin:0 0 0 30pt}.muted{color:#555;font-size:10pt}';
    var h = ['<!doctype html><html><head><meta charset="utf-8"><title>' + e(L.theme.title) + '</title><style>' + css + '</style></head><body>'];
    if (part !== 'sheet') {
      h.push('<p style="text-align:center">' + e(S.orgFull || '') + '</p>');
      h.push('<h1>Конспект</h1><p style="text-align:center">' + titleLines(L, plan, S).map(e).join('<br>') + '</p>');
      h.push('<p style="text-align:right">Составитель: ' + e(S.position || 'учитель-логопед') + ' ' + e(S.teacher || '') + '</p>');
      h.push('<h2>Цель</h2><p>' + e(plan.goal) + '</p><h2>Задачи</h2>');
      [['Коррекционно-образовательные', plan.obj.edu], ['Коррекционно-развивающие', plan.obj.dev], ['Коррекционно-воспитательные', plan.obj.vos]].forEach(function (g) {
        h.push('<p><b>' + g[0] + ':</b></p><ol>' + g[1].map(function (x) { return '<li>' + e(x) + '</li>'; }).join('') + '</ol>');
      });
      h.push('<h2>Оборудование</h2><ul>' + plan.ex.equipment.map(function (x) { return '<li>' + e(x) + '</li>'; }).join('') + '</ul>');
      h.push('<h1 class="pb">Технологическая карта</h1><table><tr><th>Этап, время</th><th>Задачи</th><th>Деятельность логопеда</th><th>Деятельность детей</th><th>Результат</th></tr>' +
        plan.stages.map(function (s) { return '<tr><td><b>' + s.n + '. ' + e(s.name) + '</b><br>' + s.min + ' мин</td><td>' + e(s.aim) + '</td><td>' + e(s.teacher) + '</td><td>' + e(s.children) + '</td><td>' + e(s.result) + '</td></tr>'; }).join('') + '</table>');
      h.push('<h1 class="pb">Ход занятия</h1>');
      plan.stages.forEach(function (s) {
        h.push('<h2>' + s.n + '. ' + e(s.name) + ' (' + s.min + ' мин)</h2>');
        s.speech.forEach(function (sp) {
          if (sp[0] === 'Текст') h.push('<p class="poem">' + e(sp[1]) + '</p>');
          else if (sp[0] === 'Упражнение') h.push('<p class="sp">– ' + e(sp[1]) + '</p>');
          else if (sp[0] === 'Игра') h.push('<p class="sp"><b><i>Игра ' + e(sp[1]) + '</i></b></p>');
          else h.push('<p class="sp"><b>' + e(sp[0]) + ':</b> ' + e(sp[1]) + '</p>');
        });
      });
      h.push('<h1>Задание для закрепления дома</h1><ol>' + plan.ex.home.map(function (x) { return '<li>' + e(x) + '</li>'; }).join('') + '</ol>');
    }
    if (part !== 'plan' && tasks.length) {
      h.push('<div class="' + (part === 'sheet' ? '' : 'pb') + '"><p class="sheet-title">РАБОЧИЙ ЛИСТ</p><p class="sub">Лексическая тема «' + e(L.theme.title) + '»' + (L.sound ? ' · звук ' + e(sn(L.sound)) : '') + '</p>' +
        '<p style="text-align:center">Имя ребёнка: ____________________ Дата: __________</p></div>');
      tasks.forEach(function (t, i) {
        h.push('<div class="task"><h3>Задание ' + (i + 1) + '. ' + e(t.title) + '</h3><p>' + e(t.instr) + '</p>' + (dataUrls[i] ? '<img src="' + dataUrls[i] + '">' : '') +
          (S.answersOnSheet ? '<p class="muted">Для взрослого: ' + e(t.note) + '</p>' : '') + '</div>');
      });
      h.push('<p class="muted">Иллюстрации: OpenMoji (CC BY-SA 4.0).</p>');
    }
    h.push('</body></html>');
    return h.join('');
  }

  return { docx: docx, html: html, fileName: fileName, titleLines: titleLines };
})();
