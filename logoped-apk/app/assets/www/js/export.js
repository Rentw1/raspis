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

  /** Паспорт занятия (шапка техкарты): [[заголовок, текст или абзацы]] */
  function passport(L, plan, S, tasks) {
    var o = plan.obj, ex = plan.ex;
    var num = function (arr) { return arr.map(function (x, i) { return (i + 1) + '. ' + x; }); };
    var rows = [
      ['Педагог', U.cap(S.position || 'учитель-логопед') + (S.teacher ? ' ' + S.teacher : '')],
      ['Образовательная область', 'Речевое развитие (в интеграции: ' + ex.integration.filter(function (x) { return x[0] !== 'Речевое развитие'; }).map(function (x) { return x[0].toLowerCase(); }).join(', ') + ')'],
      ['Лексическая тема', '«' + L.theme.title + '»'],
      ['Возрастная группа', plan.age.name + ', группа компенсирующей направленности для детей с ТНР' + (S.group ? ' «' + S.group.replace(/[«»"]/g, '') + '»' : '')],
      ['Речевое заключение', L.conclusion || 'ОНР III уровня'],
      ['Форма, тип, длительность', plan.form.name + ' занятие; ' + (L.kind === 'new' ? 'изучение нового материала' : 'закрепление пройденного материала') + '; ' + U.min(plan.total) + ' (СанПиН 1.2.3685-21)'],
      ['Направление работы', dirName(L.direction)]
    ];
    if (L.sound) rows.push(['Звук', L.sound2 ? 'Дифференциация ' + sn(L.sound) + ' – ' + sn(L.sound2) : sn(L.sound) + ' — автоматизация']);
    rows.push(['Цель', plan.goal]);
    rows.push(['Задачи', [[['Коррекционно-образовательные:', { b: true }]]].concat(num(o.edu)).concat([[['Коррекционно-развивающие:', { b: true }]]]).concat(num(o.dev)).concat([[['Коррекционно-воспитательные:', { b: true }]]]).concat(num(o.vos))]);
    rows.push(['Планируемые результаты', ex.results]);
    rows.push(['Словарная работа', [
      'Предметный словарь: ' + L.words.map(function (e) { return e.w; }).join(', ') + '.',
      L.theme.lex && L.theme.lex.v ? 'Глагольный словарь: ' + L.theme.lex.v.join(', ') + '.' : '',
      L.theme.lex && L.theme.lex.a ? 'Словарь признаков: ' + L.theme.lex.a.join(', ') + '.' : ''
    ].filter(Boolean)]);
    rows.push(['Оборудование и материалы', ex.equipment]);
    rows.push(['Предварительная работа', ex.prelim]);
    rows.push(['Методы и приёмы', ex.methods.map(function (m) { return U.cap(m) + '.'; })]);
    rows.push(['Педагогические технологии', U.cap(ex.technologies.join('; ')) + '.']);
    rows.push(['Виды детской деятельности', U.cap(ex.activities.join(', ')) + '.']);
    return rows;
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
      d.p(on('conspect') ? 'КОНСПЕКТ' : (on('techcard') ? 'ТЕХНОЛОГИЧЕСКАЯ КАРТА' : 'МАТЕРИАЛЫ'), { align: 'center', indent: 0, b: true, size: 36, before: 2600, after: 120 });
      titleLines(L, plan, S).forEach(function (t, i) { d.p(t, { align: 'center', indent: 0, b: i === 1, line: 300 }); });
      d.p('Форма проведения: ' + plan.form.name.toLowerCase() + '; тип: ' + (L.kind === 'new' ? 'изучение нового материала' : 'закрепление пройденного материала') + '; продолжительность: ' + U.min(plan.total) + '.',
        { align: 'center', indent: 0, i: true, size: 24, before: 200, line: 276 });
      d.p([['Составитель: ', {}], [S.position || 'учитель-логопед', {}]], { align: 'right', indent: 0, before: 2600, line: 276 });
      d.p(S.teacher || '________________________', { align: 'right', indent: 0, line: 276 });
      if (S.group) d.p('Группа: ' + S.group, { align: 'right', indent: 0, line: 276 });
      d.p(U.dateLong(new Date(L.date || Date.now())), { align: 'right', indent: 0, line: 276 });
      d.p((S.city || '') + (S.city ? ', ' : '') + year, { align: 'center', indent: 0, before: 2400 });
    }

    var secN = 0;
    var H = function (text, o) { d.h((++secN) + '. ' + text, o); };
    var portraitHas = on('title');

    /* ---- Информационная карта (отдельно, если нужна) ---- */
    if (on('info')) {
      if (on('title')) d.pageBreak();
      H('Информационная карта занятия');
      d.table(passport(L, plan, S, tasks).map(function (r) { return [{ text: r[0], b: true }, { text: r[1] }]; }), { widths: [4.6, 11.9], size: 24, header: 0 });
      portraitHas = true;
    }

    /* ---- Технологическая карта (альбомная): паспорт + ход занятия по частям ---- */
    if (on('techcard')) {
      if (portraitHas) d.endSection({ titlePg: on('title') });
      H('Технологическая карта логопедического занятия');
      if (!on('info')) {
        d.table(passport(L, plan, S, tasks).map(function (r) { return [{ text: r[0], b: true }, { text: r[1] }]; }), { widths: [5.6, 20.1], size: 22, header: 0 });
      }
      d.h('Ход занятия (' + U.min(plan.total) + ')', { level: 2 });
      var head = ['Этап, время', 'Задачи этапа', 'Деятельность учителя-логопеда', 'Деятельность детей', 'Методы и приёмы', 'Планируемый результат'];
      var tr = [head];
      var paras = function (list) { return list.map(function (x) { return [[x.t, { b: !!x.b, i: !!x.i }]]; }); };
      LESSON.card(plan).forEach(function (ph) {
        tr.push([{ text: [[[ph.n + '. ' + ph.name + ' — ' + U.min(ph.min), { b: true }]]], span: 6, shade: 'EDEDED', align: 'center', keepNext: true }]);
        ph.stages.forEach(function (st) {
          tr.push([
            { text: [[[st.n + '. ' + st.name, { b: true }]], [[U.min(st.min), { i: true }]]] },
            st.aim, { text: paras(st.teacher) }, { text: paras(st.children) }, st.methods, st.result
          ]);
        });
      });
      d.table(tr, { widths: [3.8, 3.3, 7.6, 4.5, 3.1, 3.4], size: 20, header: 1, headShade: 'D9D9D9' });
      d.endSection({ landscape: true, margins: [2, 2, 2, 2], titlePg: !portraitHas && on('title') });
      portraitHas = false;
    } else if (portraitHas) {
      d.endSection({ titlePg: on('title') });
    }

    /* ---- Ход занятия ---- */
    if (on('conspect')) {
      H('Ход занятия (конспект)', { pageBreak: false });
      plan.stages.forEach(function (s) {
        d.h(s.n + '. ' + s.name + ' (' + U.min(s.min) + ')', { level: 2 });
        d.p([['Задача этапа: ', { i: true, b: true }], [s.aim, { i: true }]], { size: sz });
        speechParas(d, s, sz);
      });
    }

    /* ---- Домашнее задание ---- */
    if (on('home')) {
      H('Задание для закрепления дома (для родителей)');
      plan.ex.home.forEach(function (h, i) { d.p((i + 1) + '. ' + h, { size: sz }); });
    }

    /* ---- Дополнительный речевой материал (подготовлен с помощью ИИ) ---- */
    var X = L.extra;
    if (X && on('extra')) {
      H('Дополнительный речевой материал');
      d.p([['Подготовлено с помощью ИИ (' + (X.by || 'ИИ') + '), проверено педагогом.', { i: true }]], { size: 22 });
      var sub = function (t) { d.h(t, { level: 2 }); };
      if ((X.chist || []).length) { sub('Чистоговорки' + (L.sound ? ' на звук ' + sn(L.sound) : '')); X.chist.forEach(function (c) { d.p('– ' + c, { size: sz, indent: 0, left: 709 }); }); }
      if ((X.skor || []).length) { sub('Скороговорки'); X.skor.forEach(function (c) { d.p('– ' + c, { size: sz, indent: 0, left: 709 }); }); }
      if ((X.riddles || []).length) { sub('Загадки'); X.riddles.forEach(function (r) { d.p([['«' + r[1] + '» ', {}], ['(' + r[0] + ')', { i: true }]], { size: sz }); }); }
      if (X.poem) { sub('Стихотворение «' + X.poem.name + '»'); X.poem.lines.forEach(function (l) { d.p([[l, { i: true }]], { size: sz, indent: 0, left: 1134, line: 276 }); }); }
      if (X.retell) {
        sub('Рассказ для пересказа «' + X.retell.title + '»');
        d.p(X.retell.text, { size: sz });
        (X.questions || []).forEach(function (q, i) { d.p((i + 1) + '. ' + q, { size: sz, indent: 0, left: 709 }); });
      }
    }

    /* ---- Ключи ---- */
    if (on('keys') && tasks.length) {
      H('Ключи к заданиям рабочего листа (для педагога)');
      tasks.forEach(function (t, i) { d.p([['Задание ' + (i + 1) + ' «' + t.title + '». ', { b: true }], [t.note, {}]], { size: sz }); });
    }

    /* ---- Источники ---- */
    if (on('sources')) {
      H('Нормативно-правовая база');
      METHODS.NPA.forEach(function (x, i) { d.p((i + 1) + '. ' + x, { size: sz }); });
      H('Список литературы');
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
    var css = '@page{size:A4;margin:15mm 15mm 15mm 20mm}@page land{size:A4 landscape;margin:12mm}.land{page:land;break-before:page;break-after:page}body{font-family:"Times New Roman",serif;font-size:13pt;line-height:1.4;color:#000}' +
      'h1{font-size:15pt;text-align:center;text-transform:uppercase;margin:14pt 0 8pt}h2{font-size:13pt;margin:10pt 0 4pt}' +
      'table{border-collapse:collapse;width:100%;font-size:11pt}td,th{border:1px solid #000;padding:3pt 5pt;vertical-align:top}th{background:#e6e6e6}' +
      '.task{border:1.5px solid #b9bdd6;border-radius:10px;padding:8pt 10pt;margin:0 0 10pt;page-break-inside:avoid}' +
      '.task h3{margin:0 0 4pt;color:#1f2a6b;font-size:14pt}.task p{margin:0 0 6pt;font-size:12pt}.task img{width:100%;display:block}' +
      '.sheet-title{text-align:center;color:#1f2a6b;font-size:18pt;font-weight:bold;margin:0}.sub{text-align:center;color:#4338ca}' +
      '.pb{page-break-before:always}.sp{margin:2pt 0}.poem{font-style:italic;margin:0 0 0 30pt}.muted{color:#555;font-size:10pt}' +
      '.pass th{width:28%;text-align:left;background:#f2f2f2}.tc{font-size:9.5pt}.tc thead{display:table-header-group}.tc td.ph{background:#ededed;font-weight:bold;text-align:center}.cp{margin:0 0 2pt}';
    var h = ['<!doctype html><html><head><meta charset="utf-8"><title>' + e(L.theme.title) + '</title><style>' + css + '</style></head><body>'];
    if (part !== 'sheet') {
      h.push('<p style="text-align:center">' + e(S.orgFull || '') + '</p>');
      h.push('<h1>Конспект</h1><p style="text-align:center">' + titleLines(L, plan, S).map(e).join('<br>') + '</p>');
      h.push('<p style="text-align:right">Составитель: ' + e(S.position || 'учитель-логопед') + ' ' + e(S.teacher || '') + '</p>');
      h.push('<div class="land"><h1>Технологическая карта логопедического занятия</h1><table class="pass">' +
        passport(L, plan, S, tasks).map(function (r) {
          var v = Array.isArray(r[1]) ? r[1].map(function (x) { return typeof x === 'string' ? e(x) : '<b>' + e(x[0][0]) + '</b>'; }).join('<br>') : e(r[1]);
          return '<tr><th>' + e(r[0]) + '</th><td>' + v + '</td></tr>';
        }).join('') + '</table>');
      var para = function (list) { return list.map(function (x) { var t = e(x.t); return '<p class="cp">' + (x.b ? '<b>' + t + '</b>' : x.i ? '<i>' + t + '</i>' : t) + '</p>'; }).join(''); };
      h.push('<h2>Ход занятия (' + U.min(plan.total) + ')</h2><table class="tc"><thead><tr><th>Этап, время</th><th>Задачи этапа</th><th>Деятельность учителя-логопеда</th><th>Деятельность детей</th><th>Методы и приёмы</th><th>Планируемый результат</th></tr></thead><tbody>' +
        LESSON.card(plan).map(function (ph) {
          return '<tr><td colspan="6" class="ph">' + ph.n + '. ' + e(ph.name) + ' — ' + U.min(ph.min) + '</td></tr>' + ph.stages.map(function (st) {
            return '<tr><td><b>' + st.n + '. ' + e(st.name) + '</b><br><i>' + U.min(st.min) + '</i></td><td>' + e(st.aim) + '</td><td>' + para(st.teacher) + '</td><td>' + para(st.children) + '</td><td>' + e(st.methods) + '</td><td>' + e(st.result) + '</td></tr>';
          }).join('');
        }).join('') + '</tbody></table></div>');
      h.push('<h1>Ход занятия</h1>');
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
      var X = L.extra;
      if (X) {
        h.push('<h1>Дополнительный речевой материал</h1><p class="muted">Подготовлено с помощью ИИ (' + e(X.by || 'ИИ') + '), проверено педагогом.</p>');
        if ((X.chist || []).length) h.push('<h2>Чистоговорки</h2>' + X.chist.map(function (c) { return '<p class="sp">– ' + e(c) + '</p>'; }).join(''));
        if ((X.skor || []).length) h.push('<h2>Скороговорки</h2>' + X.skor.map(function (c) { return '<p class="sp">– ' + e(c) + '</p>'; }).join(''));
        if ((X.riddles || []).length) h.push('<h2>Загадки</h2>' + X.riddles.map(function (r) { return '<p class="sp">«' + e(r[1]) + '» <i>(' + e(r[0]) + ')</i></p>'; }).join(''));
        if (X.poem) h.push('<h2>Стихотворение «' + e(X.poem.name) + '»</h2>' + X.poem.lines.map(function (l) { return '<p class="poem">' + e(l) + '</p>'; }).join(''));
        if (X.retell) h.push('<h2>Рассказ для пересказа «' + e(X.retell.title) + '»</h2><p>' + e(X.retell.text) + '</p>' + ((X.questions || []).length ? '<ol>' + X.questions.map(function (q) { return '<li>' + e(q) + '</li>'; }).join('') + '</ol>' : ''));
      }
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

  return { docx: docx, html: html, fileName: fileName, titleLines: titleLines, passport: passport };
})();
