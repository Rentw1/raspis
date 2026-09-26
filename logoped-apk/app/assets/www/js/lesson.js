'use strict';
/*
 * Сборка занятия: цель и задачи, этапы с хронометражем (СанПиН 1.2.3685-21, ФАОП ДО),
 * речь логопеда и ответы детей — на материале той же темы и тех же слов, что в рабочем листе.
 */
var LESSON = (function () {
  function cap(s) { return U.cap(s); }
  function sn(id) { return id && PH.BY_ID[id] ? PH.BY_ID[id].name : ''; }
  function has(tasks, id) { return tasks.some(function (t) { return t.id === id; }); }
  function task(tasks, id) { return tasks.filter(function (t) { return t.id === id; })[0]; }

  /** Слова темы со звуком (без спорных случаев) */
  function soundWords(L, id) {
    var pool = L.words.concat(TASKS.withPic(L.theme.extra || []));
    var seen = {};
    return pool.filter(function (e) { if (seen[e.w]) return false; seen[e.w] = 1; return PH.has(e.w, id); });
  }
  function soundSents(L, id) {
    return (L.theme.sents || []).filter(function (s) {
      return s.split(/[\s,.!?«»—-]+/).some(function (w) { return w && PH.has(w, id); });
    });
  }

  /** Подстановка в шаблон игры: {w} — слово, {W} — с заглавной, {pl}/{PL} — мн. число, {a}/{A} — ответ */
  function fill(tpl, w, a) {
    var e = DB.word(w) || {};
    var pl = e.pl || w;
    return String(tpl).replace(/\{W\}/g, cap(w)).replace(/\{w\}/g, w).replace(/\{PL\}/g, cap(pl)).replace(/\{pl\}/g, pl)
      .replace(/\{A\}/g, cap(a || '')).replace(/\{a\}/g, a || '');
  }

  function age(L) { return METHODS.AGES.filter(function (a) { return a.id === L.age; })[0] || METHODS.AGES[1]; }
  function form(L) { return METHODS.FORMS.filter(function (f) { return f.id === L.form; })[0] || METHODS.FORMS[0]; }

  function duration(L) {
    if (L.duration) return L.duration;
    var a = age(L);
    return L.form === 'ind' ? a.ind : (L.form === 'sub' ? a.sub : a.front);
  }

  /* ---------- цель и задачи ---------- */
  function goal(L) {
    var t = '«' + L.theme.title + '»', s1 = sn(L.sound), s2 = sn(L.sound2);
    switch (L.direction) {
      case 'lex': return 'Формирование лексико-грамматических средств языка по лексической теме ' + t + '.';
      case 'sound':
        if (L.sound && L.sound2) return 'Дифференциация звуков ' + s1 + ' – ' + s2 + ' в словах и предложениях на материале лексической темы ' + t + '.';
        if (L.sound) return 'Автоматизация звука ' + s1 + ' в словах, словосочетаниях и предложениях на материале лексической темы ' + t + '.';
        return 'Совершенствование произносительной стороны речи на материале лексической темы ' + t + '.';
      case 'coherent': return 'Развитие связной речи: обучение составлению описательного рассказа с опорой на мнемотаблицу по лексической теме ' + t + '.';
      case 'literacy': return 'Совершенствование навыков звукового и слогового анализа слов на материале лексической темы ' + t + '.';
      default:
        return 'Уточнение и активизация словаря, совершенствование грамматического строя речи' +
          (L.sound ? (L.sound2 ? ' и дифференциация звуков ' + s1 + ' – ' + s2 : ' и автоматизация звука ' + s1) : '') +
          ' на материале лексической темы ' + t + '.';
    }
  }

  function objectives(L) {
    var T = L.tasks, th = L.theme;
    var nouns = L.words.slice(0, 10).map(function (e) { return e.w; });
    var edu = [];
    edu.push('Уточнять, расширять и активизировать словарь по теме: предметный (' + nouns.join(', ') + ')' +
      (th.lex && th.lex.v ? ', глагольный (' + th.lex.v.slice(0, 6).join(', ') + ')' : '') +
      (th.lex && th.lex.a ? ', словарь признаков (' + th.lex.a.slice(0, 6).join(', ') + ')' : '') + '.');
    edu.push('Закреплять обобщающее понятие «' + th.cat[1] + '».');
    var map = {
      many: 'Упражнять в образовании существительных множественного числа в именительном и родительном падежах.',
      count: 'Упражнять в согласовании числительных с существительными.',
      find: 'Упражнять в согласовании числительных с существительными.',
      dim: 'Упражнять в образовании существительных с уменьшительно-ласкательными суффиксами.',
      baby: 'Закреплять умение образовывать названия детёнышей.',
      poss: 'Упражнять в образовании притяжательных прилагательных.',
      forms: 'Упражнять в образовании относительных прилагательных.',
      prep: 'Учить понимать и употреблять простые предлоги (в, на, под, за, около).',
      food: 'Учить составлять простые распространённые предложения по картинкам.',
      home: 'Учить составлять простые распространённые предложения по картинкам.',
      tool: 'Учить составлять простые распространённые предложения по картинкам.',
      odd: 'Учить классифицировать предметы и объяснять свой выбор полным предложением.',
      groups: 'Учить классифицировать предметы по существенному признаку.',
      mnemo: 'Учить составлять описательный рассказ из 5–7 предложений с опорой на мнемотаблицу.',
      sinkvein: 'Учить составлять синквейн по лексической теме.',
      riddle: 'Учить отгадывать загадки и доказывать отгадку.',
      syll: 'Упражнять в делении слов на слоги.',
      first: 'Учить выделять первый звук в слове и давать ему характеристику.'
    };
    if (has(T, 'odd') && has(T, 'groups')) map.odd = map.groups = 'Учить классифицировать предметы по существенному признаку и объяснять свой выбор полным предложением.';
    var seen = {};
    T.forEach(function (t) { var m = map[t.id]; if (m && !seen[m]) { seen[m] = 1; edu.push(m); } });
    if (L.sound) {
      if (L.sound2) edu.push('Учить различать звуки ' + sn(L.sound) + ' – ' + sn(L.sound2) + ' на слух и в произношении.');
      else edu.push('Автоматизировать правильное произношение звука ' + sn(L.sound) + ' в слогах, словах и предложениях по теме.');
    }
    var dev = [];
    if (L.sound || has(T, 'hear') || has(T, 'sound')) dev.push('Развивать фонематический слух и восприятие (выделение звука, определение его места в слове).');
    if (L.tech.artic) dev.push('Развивать артикуляционную моторику' + (L.tech.breath ? ' и речевое дыхание' : '') + '.');
    else if (L.tech.breath) dev.push('Развивать речевое дыхание: плавный длительный выдох.');
    if (L.tech.finger || L.tech.sujok || has(T, 'trace') || has(T, 'color') || has(T, 'maze')) dev.push('Развивать мелкую моторику и зрительно-моторную координацию.');
    if (L.tech.move) dev.push('Развивать общую моторику, координацию речи с движением.');
    if (has(T, 'odd') || has(T, 'groups') || has(T, 'shadow') || has(T, 'overlap') || has(T, 'find')) dev.push('Развивать зрительное внимание, память, логическое мышление.');
    else dev.push('Развивать внимание, память, мышление.');
    if (L.tech.kinesio) dev.push('Развивать межполушарное взаимодействие, произвольность и самоконтроль.');
    var vos = [
      'Воспитывать ' + th.value + '.',
      'Формировать навыки сотрудничества, доброжелательность, умение слушать логопеда и сверстников.',
      'Воспитывать самоконтроль за собственной речью.'
    ];
    return { edu: edu, dev: dev, vos: vos };
  }

  /* ---------- этапы ---------- */
  function stages(L) {
    var T = L.tasks, th = L.theme, total = duration(L), ind = L.form === 'ind';
    var kids = ind ? 'Ребёнок' : 'Дети';
    var S = [];
    var nm = sn(L.sound);

    // 1. Организационный момент
    S.push({
      key: 'org', w: 1.4, name: 'Организационный момент. Психологический настрой',
      aim: 'Создать положительный эмоциональный настрой, настроить на совместную деятельность.',
      speech: ind ? [
        ['Логопед', 'Здравствуй! Я очень рада тебя видеть. Улыбнись мне! Сядь удобно, спинку держи ровно.'],
        ['Логопед', 'Сегодня у нас тема «' + th.title + '». Назови слова по этой теме, которые ты знаешь.'],
        [kids, cap(L.words.slice(0, 3).map(function (e) { return e.w; }).join(', ')) + '…']
      ] : [
        ['Логопед', 'Здравствуйте, ребята! Встаньте в круг, возьмитесь за руки: «Собрались все дети в круг: я — твой друг, и ты — мой друг. Крепко за руки возьмёмся и друг другу улыбнёмся!»'],
        ['Логопед', 'Сядет тот, кто назовёт ' + (th.cat[3] || th.cat[0]) + '.'],
        [kids, L.words.slice(0, 4).map(function (e) { return cap(e.w); }).join('! ') + '!']
      ],
      teacher: 'Приветствует детей, проводит психологический настрой, предлагает назвать слова по теме.',
      children: 'Приветствуют, выполняют движения, называют слова по теме.',
      methods: 'Игровой приём, словесный метод (беседа)',
      result: 'Дети настроены на занятие, активизирован словарь по теме.'
    });

    // 2. Мотивация и сообщение темы
    var rid = (th.riddles || []).slice(0, ind ? 1 : 2);
    var motSpeech = [['Логопед', th.guest + ' Сегодня мы отправимся ' + th.place + '.']];
    rid.forEach(function (r) { motSpeech.push(['Логопед', 'Отгадайте загадку: «' + r[1] + '»']); motSpeech.push([kids, cap(r[0]) + '!']); });
    motSpeech.push(['Логопед', (L.kind === 'new' ? 'Сегодня мы узнаем много нового' : 'Сегодня мы вспомним всё, что знаем') + ' по теме «' + th.title + '».' +
      (L.sound ? (L.sound2 ? ' А ещё будем учиться различать звуки ' + nm + ' и ' + sn(L.sound2) + '.' : ' А ещё будем учиться правильно произносить звук ' + nm + '.') : '')]);
    S.push({
      key: 'mot', w: 1.6, name: 'Мотивация. Сообщение темы',
      aim: 'Вызвать интерес к занятию, сообщить тему' + (L.sound ? ' и звук' : '') + '.',
      speech: motSpeech,
      teacher: 'Создаёт игровую ситуацию (сюрпризный момент), загадывает загадки, сообщает тему.',
      children: 'Слушают, отгадывают загадки, называют тему занятия.',
      methods: 'Сюрпризный момент, загадки, наглядность (картинки-отгадки)',
      result: 'У детей возник интерес к занятию; дети знают тему' + (L.sound ? ' и звук' : '') + '.'
    });

    // 3. Артикуляционная гимнастика
    if (L.tech.artic) {
      var group = L.sound ? PH.BY_ID[L.sound].group : 'none';
      var ex = METHODS.articulation(group, L.age);
      S.push({
        key: 'artic', w: 2.4, name: 'Артикуляционная гимнастика',
        aim: 'Развивать подвижность органов артикуляции' + (L.sound ? ', подготовить артикуляционный аппарат к произнесению ' + (PH.GROUP_NAMES[group] || 'звука') : '') + '.',
        speech: [['Логопед', 'Чтобы язычок хорошо работал, сделаем зарядку. Возьмите зеркала. Наш Весёлый Язычок тоже отправляется ' + th.place + '!']]
          .concat(ex.map(function (x) { return ['Упражнение', x.name + ' — ' + x.text]; })),
        teacher: 'Показывает упражнения (' + ex.map(function (x) { return x.name; }).join(', ') + '), контролирует качество выполнения.',
        children: 'Выполняют упражнения перед зеркалами под счёт.',
        methods: 'Показ, образец, контроль у зеркала, игровая мотивация',
        result: 'Артикуляционный аппарат подготовлен к работе.'
      });
    }

    // 4. Дыхательная гимнастика
    if (L.tech.breath && th.breath) {
      S.push({
        key: 'breath', w: 1, name: 'Дыхательная гимнастика «' + th.breath.name + '»',
        aim: 'Формировать правильный речевой выдох: плавный, длительный, направленный.',
        speech: [['Логопед', th.breath.text]],
        teacher: 'Объясняет и показывает упражнение, следит за правильностью вдоха и выдоха.',
        children: 'Выполняют дыхательное упражнение.',
        methods: 'Показ, словесная инструкция, игровой приём',
        result: 'Сформирован плавный длительный выдох.'
      });
    }

    // 5. Кинезиология
    if (L.tech.kinesio) {
      var kin = METHODS.KINESIO.slice(0, 2);
      S.push({
        key: 'kinesio', w: 1, name: 'Кинезиологические упражнения',
        aim: 'Активизировать межполушарное взаимодействие, внимание и самоконтроль.',
        speech: kin.map(function (k) { return ['Упражнение', k.name + ' — ' + k.text]; }),
        teacher: 'Показывает упражнения, задаёт темп.',
        children: 'Выполняют упражнения вслед за логопедом.',
        methods: 'Показ, образец, повторение',
        result: 'Дети сосредоточены, повышена работоспособность.'
      });
    }

    // 6. Основной этап: новое / закрепление
    var demoWords = L.words.filter(function (e) { return !e.of; }).slice(0, ind ? 3 : 5);
    if (L.kind === 'new') {
      var dSpeech = [['Логопед', 'Посмотрите на картинки. Я расскажу вам про ' + th.catAccPl + '.']];
      demoWords.forEach(function (e) {
        var parts = [cap(e.w) + (e.adj && e.adj.length ? ' — ' + e.adj.slice(0, 2).join(', ') : '') + '.'];
        if (e.v && e.v.length) parts.push(cap(e.v.slice(0, 2).join(', ')) + '.');
        dSpeech.push(['Логопед', parts.join(' ')]);
      });
      dSpeech.push(['Логопед', 'Повторите названия за мной. Как назвать их одним словом?']);
      dSpeech.push([kids, cap(demoWords.map(function (e) { return e.w; }).join(', ')) + '. Это ' + th.cat[1] + '.']);
      if (L.sound) {
        dSpeech.push(['Логопед', 'Послушайте звук ' + nm + '. Характеристика звука: ' + (PH.CHAR[L.sound] || '') + '.']);
        dSpeech.push(['Логопед', 'Произнесите звук ' + nm + ' вместе со мной. Посмотрите в зеркало: как работают губы и язычок?']);
      }
      S.push({
        key: 'demo', w: 3.2, name: 'Изучение нового: демонстрация и наглядный показ',
        aim: 'Познакомить с новыми словами по теме, их признаками' + (L.sound ? '; уточнить артикуляцию звука ' + nm : '') + '.',
        speech: dSpeech,
        teacher: 'Демонстрирует предметные картинки (' + demoWords.map(function (e) { return e.w; }).join(', ') + '), даёт образец речи, объясняет' + (L.sound ? ', показывает артикуляцию звука ' + nm : '') + '.',
        children: 'Рассматривают картинки, повторяют слова, отвечают на вопросы' + (L.sound ? ', произносят звук ' + nm : '') + '.',
        methods: 'Наглядный показ, образец речи логопеда, объяснение, беседа',
        result: 'Дети знают и называют новые слова по теме, понимают их значение.'
      });
    } else {
      var practice = T.filter(function (t) { return ['name', 'odd', 'many', 'count', 'dim', 'baby', 'food', 'home', 'tool', 'forms', 'poss', 'groups', 'find'].indexOf(t.id) >= 0; }).slice(0, 2);
      var pSpeech = [['Логопед', 'Сегодня вы будете выполнять задания самостоятельно. Возьмите рабочие листы. Внимательно слушайте задание.']];
      practice.forEach(function (t) { pSpeech.push(['Логопед', 'Задание «' + t.title + '». ' + t.instr]); pSpeech.push([kids, 'Выполняют задание и объясняют: ' + U.lower(t.note)]); });
      S.push({
        key: 'practice', w: 3.2, name: 'Закрепление: самостоятельная практическая деятельность', used: practice.map(function (t) { return t.id; }),
        aim: 'Закрепить знания по теме в самостоятельной практической деятельности.',
        speech: pSpeech,
        teacher: 'Даёт инструкции, организует самостоятельную работу детей с рабочим листом, оказывает индивидуальную помощь, проверяет.',
        children: 'Самостоятельно выполняют задания (' + practice.map(function (t) { return '«' + t.title + '»'; }).join(', ') + '), объясняют свои действия.',
        methods: 'Практический метод, самостоятельная работа, самопроверка, взаимопроверка',
        result: 'Дети самостоятельно применяют знания по теме, объясняют свой выбор.'
      });
    }

    // 7. Работа над звуком
    if (L.sound) {
      var sw = soundWords(L, L.sound).map(function (e) { return e.w; });
      var ss = soundSents(L, L.sound).slice(0, 3);
      var sSpeech = [['Логопед', 'Повторите за мной слоги: ' + PH.syllablePaths(L.sound).join('; ') + '.']];
      var hearT = task(T, 'sound') || task(T, 'hear');
      if (hearT && hearT.play) sSpeech = sSpeech.concat(hearT.play.lines);
      if (sw.length) sSpeech.push(['Логопед', 'Повторите слова со звуком ' + nm + ': ' + sw.slice(0, 8).join(', ') + '.']);
      if (ss.length) sSpeech.push(['Логопед', 'Повторите предложения: ' + ss.map(function (x) { return '«' + x + '»'; }).join(' ')]);
      if (L.sound2) {
        var sw2 = soundWords(L, L.sound2).map(function (e) { return e.w; });
        sSpeech.push(['Логопед', 'Слушайте внимательно: со звуком ' + nm + ' — ' + (sw.slice(0, 4).join(', ') || '—') + '; со звуком ' + sn(L.sound2) + ' — ' + (sw2.slice(0, 4).join(', ') || '—') + '. Разложите картинки на две группы.']);
      }
      S.push({
        key: 'sound', w: 3, name: L.sound2 ? 'Дифференциация звуков ' + nm + ' – ' + sn(L.sound2) : 'Автоматизация звука ' + nm + ' на материале темы',
        aim: L.sound2 ? 'Учить различать звуки на слух и в произношении.' : 'Закреплять правильное произношение звука ' + nm + ' в слогах, словах и предложениях по теме; развивать фонематический слух.',
        speech: sSpeech,
        teacher: 'Даёт речевой образец, организует игры на фонематический слух' + (hearT ? ' («' + hearT.title + '»)' : '') + ', контролирует произношение.',
        children: 'Повторяют слоги, слова и предложения со звуком ' + nm + ', определяют наличие и место звука.',
        methods: 'Образец речи, отражённое и самостоятельное проговаривание, игровые упражнения, звуковые схемы',
        result: 'Дети правильно произносят звук ' + nm + ' в словах и фразах по теме' + (hearT ? ', определяют место звука в слове' : '') + '.'
      });
    }

    // 8. Лексико-грамматические игры
    var lexIds = ['many', 'count', 'find', 'dim', 'baby', 'food', 'home', 'tool', 'forms', 'poss', 'odd', 'groups', 'prep'];
    var usedInPractice = S.filter(function (s) { return s.key === 'practice'; }).map(function (s) { return s.used || []; })[0] || [];
    var lexTasks = T.filter(function (t) { return lexIds.indexOf(t.id) >= 0 && t.play && usedInPractice.indexOf(t.id) < 0; });
    var maxGames = L.form === 'ind' ? 2 : (total >= 25 ? 4 : 3);
    var games = lexTasks.slice(0, maxGames);
    var talk = (th.talk || []).filter(function (tk) { return !/цвет/i.test(tk.name) || L.age === '4'; }).slice(0, games.length < 2 ? 2 : 1);
    if (games.length || talk.length) {
      var gSpeech = [];
      games.forEach(function (t) {
        gSpeech.push(['Игра', '«' + t.play.name + '»']);
        gSpeech = gSpeech.concat(t.play.lines);
      });
      talk.forEach(function (tk) {
        gSpeech.push(['Игра', '«' + tk.name + '»']);
        tk.items.slice(0, 4).forEach(function (it) {
          var e = DB.word(it[0]);
          gSpeech.push(['Логопед', fill(tk.qt, it[0], it[1])]);
          gSpeech.push([kids, fill(tk.tpl, it[0], it[1])]);
        });
      });
      S.push({
        key: 'lex', w: 4.2, name: 'Лексико-грамматические игры',
        aim: 'Совершенствовать грамматический строй речи, активизировать словарь по теме.',
        speech: gSpeech,
        teacher: 'Проводит игры: ' + games.map(function (t) { return '«' + t.play.name + '»'; }).concat(talk.map(function (tk) { return '«' + tk.name + '»'; })).join(', ') + '; даёт образец, исправляет ошибки.',
        children: 'Отвечают полными ответами, согласуют слова в роде, числе и падеже.',
        methods: 'Дидактические игры, образец ответа, вопросы, наглядность (предметные картинки)',
        result: 'Дети правильно употребляют грамматические формы слов по теме.'
      });
    }

    // 9. Динамическая пауза
    if (L.tech.move && th.move) {
      S.push({
        key: 'move', w: 1.6, name: 'Динамическая пауза (логоритмика) «' + th.move.name + '»',
        aim: 'Снять мышечное напряжение, развивать координацию речи с движением.',
        speech: [['Логопед', 'Встаньте, пожалуйста. Повторяйте за мной слова и движения:']].concat(th.move.lines.map(function (l) { return ['Текст', l]; })),
        teacher: 'Проговаривает текст, показывает движения.',
        children: 'Выполняют движения в соответствии с текстом, проговаривают слова.',
        methods: 'Показ, образец, повторение, двигательная активность',
        result: 'Снято напряжение, дети согласуют речь с движением.'
      });
    }

    // 10. Пальчиковая гимнастика / су-джок
    if ((L.tech.finger || L.tech.sujok) && th.finger) {
      var sj = L.tech.sujok;
      S.push({
        key: 'finger', w: 1.3, name: (sj ? 'Су-джок терапия. ' : '') + 'Пальчиковая гимнастика «' + th.finger.name + '»',
        aim: 'Развивать мелкую моторику, координацию движений пальцев рук' + (sj ? ', стимулировать нервные окончания ладоней (су-джок)' : '') + '.',
        speech: [['Логопед', sj ? 'Возьмите мячики су-джок. Катайте мячик между ладонями на каждую строчку, а на счёт надевайте колечко на пальчик.' : 'Приготовим наши пальчики:']].concat(th.finger.lines.map(function (l) { return ['Текст', l]; })),
        teacher: 'Проговаривает текст, показывает движения' + (sj ? ' с мячиком и колечком су-джок' : '') + '.',
        children: 'Выполняют движения пальцами, проговаривают текст.',
        methods: 'Показ, образец, повторение' + (sj ? ', су-джок массаж' : ''),
        result: 'Развита мелкая моторика, дети проговаривают текст с движениями.'
      });
    }

    // 11. Связная речь
    var coh = task(T, 'mnemo') || task(T, 'sinkvein') || task(T, 'riddle');
    if (coh || L.direction === 'coherent') {
      var cSpeech = [];
      if (task(T, 'mnemo') && th.story) {
        cSpeech.push(['Логопед', 'Давайте составим рассказ по схеме (мнемотаблице). Каждая клеточка — это вопрос: ' + th.story.plan.map(function (p) { return p[1]; }).join(' ')]);
        cSpeech.push([ind ? 'Ребёнок' : 'Ребёнок (образец)', th.story.text]);
      }
      if (task(T, 'sinkvein')) cSpeech = cSpeech.concat(task(T, 'sinkvein').play.lines);
      if (!cSpeech.length && task(T, 'riddle')) {
        cSpeech.push(['Логопед', 'Отгадайте загадку и объясните, как вы догадались.']);
        (task(T, 'riddle').riddles || []).forEach(function (r) { cSpeech.push(['Логопед', '«' + r + '»']); });
      }
      if (!cSpeech.length && th.story) {
        cSpeech.push(['Логопед', 'Расскажите про ' + (th.story.about || DB.acc(th.story.word)) + ' по плану: ' + th.story.plan.map(function (p) { return p[1]; }).join(' ')]);
        cSpeech.push(['Ребёнок (образец)', th.story.text]);
      }
      S.push({
        key: 'coh', w: 3, name: 'Развитие связной речи' + (task(T, 'mnemo') ? ': рассказ по мнемотаблице' : ''),
        aim: 'Учить составлять связный описательный рассказ по плану (схеме).',
        speech: cSpeech,
        teacher: 'Объясняет план рассказа по схеме, даёт образец, помогает наводящими вопросами.',
        children: 'Составляют рассказ-описание по схеме, дополняют ответы друг друга.',
        methods: 'Мнемотехника, образец рассказа, наводящие вопросы',
        result: 'Дети составляют описательный рассказ из 5–7 предложений с опорой на схему.'
      });
    }

    // 12. Работа в рабочем листе (графомоторика)
    var motor = T.filter(function (t) { return ['maze', 'trace', 'color', 'shadow', 'overlap', 'puzzle'].indexOf(t.id) >= 0; });
    if (motor.length) {
      var mSpeech = [['Логопед', 'Возьмите карандаши. Выполним задания в рабочем листе.']];
      motor.slice(0, 2).forEach(function (t) { mSpeech.push(['Логопед', '«' + t.title + '». ' + t.instr]); });
      mSpeech.push([kids, 'Выполняют задания, называют, что получилось.']);
      S.push({
        key: 'sheet', w: 2.2, name: 'Работа в рабочем листе',
        aim: 'Развивать мелкую моторику, зрительно-моторную координацию, зрительное внимание.',
        speech: mSpeech,
        teacher: 'Объясняет задания (' + motor.map(function (t) { return '«' + t.title + '»'; }).join(', ') + '), следит за посадкой и правильным захватом карандаша.',
        children: 'Выполняют графические задания, комментируют свои действия.',
        methods: 'Практический метод, инструкция, индивидуальная помощь',
        result: 'Дети выполняют графические задания аккуратно и последовательно.'
      });
    }

    // 13. Итог. Рефлексия
    var refl = METHODS.REFLECTION[U.hash(L.seed) % METHODS.REFLECTION.length];
    S.push({
      key: 'end', w: 1.4, name: 'Итог занятия. Рефлексия',
      aim: 'Подвести итог, оценить деятельность детей, развивать самооценку.',
      speech: [
        ['Логопед', 'О чём мы сегодня говорили? Какие слова по теме вы запомнили?' + (L.sound ? ' Какой звук учились правильно произносить?' : '')],
        [kids, 'Мы говорили про ' + th.catAccPl + ': ' + L.words.slice(0, 4).map(function (e) { return e.w; }).join(', ') + '.' + (L.sound ? ' Учились правильно произносить звук ' + nm + '.' : '')],
        ['Логопед', 'Какое задание было самым интересным? А что было трудным?'],
        ['Логопед', refl],
        ['Логопед', 'Вы сегодня очень старались, молодцы! ' + (th.guest.indexOf('К нам') === 0 ? 'Наш гость благодарит вас за помощь.' : '')]
      ],
      teacher: 'Задаёт итоговые вопросы, организует рефлексию, оценивает работу детей.',
      children: 'Отвечают на вопросы, оценивают свою работу.',
      methods: 'Беседа, рефлексия, поощрение',
      result: 'Дети называют тему, оценивают свою деятельность.'
    });

    // короткое занятие: объединяем родственные этапы, чтобы каждому досталась хотя бы минута
    function uniqJoin(a, b, sep) {
      var out = [];
      (a + sep + b).split(sep).forEach(function (x) { x = x.trim(); if (x && out.indexOf(x) < 0) out.push(x); });
      return out.join(sep);
    }
    function merge(a, b) {
      if (!a || !b || a === b) return false;
      a.name = a.name + '. ' + b.name;
      a.aim = a.aim + ' ' + b.aim;
      a.speech = a.speech.concat(b.speech);
      a.teacher = a.teacher + ' ' + b.teacher;
      a.children = a.children + ' ' + b.children;
      a.methods = uniqJoin(a.methods, b.methods, ', ');
      a.result = a.result + ' ' + b.result;
      a.w += b.w;
      if (b.used) a.used = (a.used || []).concat(b.used);
      S.splice(S.indexOf(b), 1);
      return true;
    }
    function byKey(k) { return S.filter(function (s) { return s.key === k; })[0]; }
    var limit = Math.max(5, Math.floor(total * 0.8));
    [['artic', 'breath'], ['move', 'finger'], ['move', 'kinesio'], ['finger', 'kinesio'], ['artic', 'kinesio'],
      ['practice', 'sheet'], ['lex', 'sheet'], ['demo', 'practice'], ['sound', 'sheet']].forEach(function (m) {
      if (S.length > limit) merge(byKey(m[0]), byKey(m[1]));
    });
    while (S.length > total && S.length > 3) {
      var best = 1;
      for (var k = 2; k < S.length - 2; k++) if (S[k].w + S[k + 1].w < S[best].w + S[best + 1].w) best = k;
      merge(S[best], S[best + 1]);
    }

    // хронометраж
    var sumW = S.reduce(function (a, s) { return a + s.w; }, 0);
    S.forEach(function (s) { s.min = Math.max(1, Math.round(total * s.w / sumW)); });
    var diff = total - S.reduce(function (a, s) { return a + s.min; }, 0);
    var order = S.slice().sort(function (a, b) { return b.w - a.w; });
    var i = 0;
    while (diff !== 0 && i < 100) {
      var st = order[i % order.length];
      if (diff > 0) { st.min++; diff--; } else if (st.min > 1) { st.min--; diff++; }
      i++;
    }
    S.forEach(function (s, k) { s.n = k + 1; });
    return S;
  }

  /* ---------- сопроводительные разделы ---------- */
  function extras(L) {
    var th = L.theme, T = L.tasks;
    var eq = ['Предметные картинки по теме: ' + L.words.map(function (e) { return e.w; }).join(', ') + '.'];
    if (L.tech.artic) eq.push('Индивидуальные зеркала.');
    if (L.tech.breath && th.breath && th.breath.item) eq.push('Для дыхательной гимнастики: ' + th.breath.item + '.');
    if (L.tech.sujok) eq.push('Мячики су-джок с кольцами.');
    if (L.sound) eq.push('Символ звука ' + sn(L.sound) + ', звуковые схемы (полоски из трёх клеток), фишки.');
    if (has(T, 'count') || has(T, 'find')) eq.push('Карточки с цифрами от 1 до 5.');
    if (has(T, 'mnemo')) eq.push('Мнемотаблица для составления рассказа.');
    if (has(T, 'prep')) eq.push('Коробка и игрушка для игры с предлогами.');
    eq.push('Рабочие листы, простые и цветные карандаши.');
    eq.push('Сюрпризный персонаж (игрушка или картинка).');
    if (L.tech.ict) eq.push('Ноутбук (интерактивная доска), мультимедийная презентация.');
    if (L.tech.move) eq.push('Музыкальное сопровождение для динамической паузы.');

    var prelim = [
      'Рассматривание иллюстраций и предметных картинок по теме «' + th.title + '».',
      th.lit && th.lit.length ? 'Чтение художественной литературы: ' + th.lit.join('; ') + '.' : 'Чтение художественной литературы по теме.',
      'Отгадывание загадок, разучивание пальчиковой гимнастики' + (th.finger ? ' «' + th.finger.name + '»' : '') + '.',
      'Дидактические игры по лексической теме.'
    ];
    if (L.sound) prelim.push('Индивидуальная работа по постановке и автоматизации звука ' + sn(L.sound) + '.');

    var integ = [
      ['Речевое развитие', 'обогащение словаря, грамматический строй речи' + (L.sound ? ', звуковая культура речи' : '') + ', связная речь'],
      ['Познавательное развитие', 'представления о предметах и явлениях по теме «' + th.title + '»' + (has(T, 'count') || has(T, 'find') ? ', счёт в пределах 5' : '') + (has(T, 'odd') || has(T, 'groups') ? ', классификация' : '')],
      ['Социально-коммуникативное развитие', 'взаимодействие со взрослым и сверстниками, ' + th.value],
      ['Художественно-эстетическое развитие', 'восприятие фольклора (загадки, потешки)' + (has(T, 'color') ? ', раскрашивание' : '') + (L.tech.move ? ', музыкально-ритмические движения' : '')],
      ['Физическое развитие', [L.tech.move ? 'динамическая пауза' : '', L.tech.finger || L.tech.sujok ? 'пальчиковая гимнастика' : '', L.tech.breath ? 'дыхательная гимнастика' : '', L.tech.artic ? 'артикуляционная гимнастика' : ''].filter(Boolean).join(', ') || 'двигательная активность']
    ];

    var acts = ['игровая', 'коммуникативная', 'познавательно-исследовательская'];
    if (L.tech.move || L.tech.finger) acts.push('двигательная');
    if ((th.riddles || []).length) acts.push('восприятие художественной литературы и фольклора');
    if (has(T, 'color') || has(T, 'trace') || has(T, 'maze')) acts.push('изобразительная');
    if (has(T, 'puzzle')) acts.push('конструирование');

    var methods = [
      'наглядные: показ предметных картинок, образец выполнения' + (has(T, 'mnemo') ? ', мнемотаблица' : ''),
      'словесные: беседа, вопросы, загадки, объяснение, образец речи логопеда, художественное слово',
      'практические: дидактические игры и упражнения, работа в рабочем листе',
      'игровые: сюрпризный момент, игровая мотивация'
    ];
    var tech = ['игровые', 'здоровьесберегающие (' + [L.tech.artic ? 'артикуляционная' : '', L.tech.breath ? 'дыхательная' : '', L.tech.finger ? 'пальчиковая гимнастика' : '', L.tech.move ? 'динамическая пауза' : '', L.tech.sujok ? 'су-джок' : ''].filter(Boolean).join(', ') + ')', 'личностно ориентированные'];
    if (has(T, 'mnemo')) tech.push('мнемотехника');
    if (L.tech.kinesio) tech.push('кинезиология');
    if (has(T, 'sinkvein')) tech.push('синквейн');
    if (L.tech.ict) tech.push('ИКТ');

    var sw = L.sound ? soundWords(L, L.sound).map(function (e) { return e.w; }) : [];
    var home = [
      'Рассмотрите с ребёнком картинки по теме «' + th.title + '»: ' + L.words.slice(0, 8).map(function (e) { return e.w; }).join(', ') + '. Попросите ребёнка назвать их одним словом (' + th.cat[1] + ').'
    ];
    var gameNames = T.filter(function (t) { return t.play && ['many', 'count', 'dim', 'baby', 'food', 'forms', 'poss', 'prep'].indexOf(t.id) >= 0; }).map(function (t) { return '«' + t.play.name + '»'; });
    if (gameNames.length) home.push('Поиграйте в игры ' + gameNames.join(', ') + ' со словами темы. Следите, чтобы ребёнок отвечал полным ответом.');
    if ((th.riddles || []).length) home.push('Выучите загадку: «' + th.riddles[0][1] + '» (отгадка — ' + th.riddles[0][0] + ').');
    if (sw.length) home.push('Ежедневно повторяйте слова со звуком ' + sn(L.sound) + ': ' + sw.slice(0, 8).join(', ') + '. Следите за правильным произношением звука.');
    if (th.story) home.push('Составьте вместе рассказ про ' + (th.story.about || DB.acc(th.story.word)) + ' по схеме из рабочего листа.');
    if (th.finger) home.push('Повторите пальчиковую гимнастику «' + th.finger.name + '».');
    if (th.lit && th.lit.length) home.push('Прочитайте ребёнку: ' + th.lit[0] + '. Обсудите прочитанное.');
    home.push('Выполните с ребёнком задания рабочего листа.');

    var results = [
      'Ребёнок называет предметы (объекты) по теме «' + th.title + '», их признаки и действия; употребляет обобщающее слово «' + th.cat[1] + '».'
    ];
    if (has(T, 'many') || has(T, 'count') || has(T, 'dim') || has(T, 'baby') || has(T, 'poss') || has(T, 'forms')) results.push('Правильно образует и употребляет грамматические формы слов по теме.');
    if (L.sound) results.push('Правильно произносит звук ' + sn(L.sound) + ' в словах и фразах по теме; определяет место звука в слове.');
    if (has(T, 'mnemo')) results.push('Составляет описательный рассказ с опорой на схему.');
    results.push('Проявляет интерес к занятию, взаимодействует со сверстниками и взрослым, оценивает свою работу.');

    return { equipment: eq, prelim: prelim, integration: integ, activities: acts, methods: methods, technologies: tech, home: home, results: results, soundWords: sw };
  }

  function build(L) {
    L.tasks = L.tasks || [];
    var st = stages(L);
    return {
      goal: goal(L), obj: objectives(L), stages: st, ex: extras(L),
      total: st.reduce(function (a, s) { return a + s.min; }, 0), age: age(L), form: form(L)
    };
  }

  return { build: build, duration: duration, soundWords: soundWords, goal: goal };
})();
