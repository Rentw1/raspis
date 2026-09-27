'use strict';
/*
 * Бесплатный ИИ-помощник. Подключение к OpenAI-совместимым сервисам с бесплатным доступом:
 * Pollinations (бесплатные кредиты, умеет рисовать), OpenRouter (модели «free»), Hugging Face,
 * Groq, Google Gemini — или к своему серверу. Ключ хранится только на телефоне.
 * ИИ — только помощник: всё, что он присылает, проверяется по словарю темы и фонетике;
 * в задания попадают лишь слова темы с картинками, а материалы педагог просматривает перед добавлением.
 */
var AI = (function () {
  var PROVIDERS = [
    { id: 'pollinations', name: 'Pollinations', base: 'https://gen.pollinations.ai/v1', model: 'openai/gpt-5.4-nano', images: true,
      keyUrl: 'https://enter.pollinations.ai', keyHint: 'sk_…',
      about: 'Текст и картинки. Вход через GitHub или Google, бесплатные кредиты (Quest Pollen) пополняются.' },
    { id: 'openrouter', name: 'OpenRouter', base: 'https://openrouter.ai/api/v1', model: '', free: ':free',
      keyUrl: 'https://openrouter.ai/keys', keyHint: 'sk-or-…',
      about: 'Десятки бесплатных моделей (с пометкой «free»): DeepSeek, Qwen, Llama, Gemma. Ограничение — около 50 запросов в день.' },
    { id: 'hf', name: 'Hugging Face', base: 'https://router.huggingface.co/v1', model: '',
      keyUrl: 'https://huggingface.co/settings/tokens', keyHint: 'hf_…',
      about: 'Бесплатный токен с ежемесячным лимитом, открытые модели Qwen, DeepSeek, Llama.' },
    { id: 'groq', name: 'Groq', base: 'https://api.groq.com/openai/v1', model: '',
      keyUrl: 'https://console.groq.com/keys', keyHint: 'gsk_…',
      about: 'Бесплатный ключ, очень быстрые открытые модели (Llama, Qwen, GPT-OSS).' },
    { id: 'gemini', name: 'Google Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: '',
      keyUrl: 'https://aistudio.google.com/apikey', keyHint: 'AIza…',
      about: 'Бесплатный ключ Google AI Studio. В некоторых странах сервис недоступен.' },
    { id: 'custom', name: 'Свой сервер', base: '', model: '', keyUrl: '', keyHint: 'ключ (если нужен)',
      about: 'Любой OpenAI-совместимый адрес https://…/v1 (DeepSeek, Mistral, LM Studio через туннель и т. п.).' }
  ];
  var PREFER = {
    openrouter: [/deepseek.*(v3|v4|chat)/i, /qwen3?.*(235|72|80|32|max|plus)/i, /llama-3\.3-70b|llama-4/i, /gemma-(3|4)/i, /mistral/i, /glm/i, /./],
    hf: [/deepseek-ai\/deepseek-v3/i, /qwen\/qwen3/i, /qwen\/qwen2\.5-72b/i, /llama-3\.3-70b/i, /gemma/i, /./],
    groq: [/llama-3\.3-70b/i, /gpt-oss-120b/i, /qwen/i, /llama/i, /./],
    gemini: [/gemini-[0-9.]+-flash$/i, /gemini-[0-9.]+-flash(?!.*(image|tts|live|audio|thinking|exp))/i, /gemini.*flash/i, /gemini/i],
    pollinations: [/gpt-5\.4-nano/i, /gpt-5-nano/i, /mistral-small/i, /./],
    custom: [/./]
  };
  var EXCLUDE = /whisper|tts|audio|image|embed|guard|moderation|rerank|transcri|speech|dall|flux|sdxl|video|vision-only|ocr/i;

  var cfg = { provider: '', keys: {}, models: {}, base: '', imageModel: '', customImages: false };
  var onChange = null;

  function configure(c, cb) {
    cfg = Object.assign({ provider: '', keys: {}, models: {}, base: '', imageModel: '', customImages: false }, c || {});
    cfg.keys = Object.assign({}, cfg.keys); cfg.models = Object.assign({}, cfg.models);
    if (cb) onChange = cb;
  }
  function settings() { return cfg; }
  function saveCfg() { if (onChange) onChange(cfg); }
  function provider(id) { var pid = id || cfg.provider; return PROVIDERS.filter(function (p) { return p.id === pid; })[0] || null; }
  function base(p) { return String(p.id === 'custom' ? cfg.base || '' : p.base || '').trim().replace(/\/+$/, ''); }
  function key(p) { return String((cfg.keys || {})[p.id] || '').trim(); }
  function model(p) { return String((cfg.models || {})[p.id] || p.model || '').trim(); }
  function ready() {
    var p = provider();
    return !!(p && /^https:\/\//.test(base(p)) && (key(p) || p.id === 'custom'));
  }
  function canImage() {
    var p = provider();
    return !!(ready() && (p.images || (p.id === 'custom' && cfg.customImages)));
  }
  function label() {
    var p = provider();
    if (!p) return 'не подключён';
    if (!ready()) return p.name + ' — нужен ключ';
    return p.name + (model(p) ? ' · ' + model(p) : '');
  }

  function headers(p) {
    var h = { 'Content-Type': 'application/json' };
    var k = key(p);
    if (k) h.Authorization = 'Bearer ' + k;
    if (p.id === 'openrouter') { h['HTTP-Referer'] = 'https://github.com/Rentw1/raspis'; h['X-Title'] = 'Konstruktor Zanyatiy'; }
    return h;
  }

  function errText(r) {
    if (!r) return 'Нет ответа от сервиса.';
    if (r.error) return 'Нет связи с сервисом: ' + r.error;
    var msg = '';
    try {
      var j = JSON.parse(r.data);
      msg = (j.error && (j.error.message || j.error)) || j.message || j.detail || '';
      if (typeof msg !== 'string') msg = JSON.stringify(msg);
    } catch (e) { msg = String(r.data || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 160); }
    msg = msg ? ' ' + String(msg).slice(0, 240) : '';
    switch (r.status) {
      case 400: return 'Сервис отклонил запрос (400).' + msg;
      case 401: case 403: return 'Ключ не принят (' + r.status + '). Проверьте ключ в настройках ИИ.' + msg;
      case 402: return 'Закончились бесплатные кредиты (402). Пополните их на сайте сервиса или выберите другой сервис.' + msg;
      case 404: return 'Модель или адрес не найдены (404). Выберите другую модель в настройках ИИ.' + msg;
      case 429: return 'Превышен лимит бесплатных запросов (429). Подождите немного и повторите.' + msg;
      default: return 'Ошибка сервиса ИИ ' + (r.status || '') + '.' + msg;
    }
  }

  /* ---------- модели ---------- */
  function listModels(pid) {
    var p = provider(pid);
    if (!p) return Promise.reject(new Error('Выберите сервис ИИ'));
    return NET.request(base(p) + '/models', { headers: headers(p), timeout: 30000 }).then(function (r) {
      if (!r.ok) throw new Error(errText(r));
      var j = JSON.parse(r.data);
      var list = (j.data || j.models || []).map(function (m) { return typeof m === 'string' ? m : (m.id || m.name || ''); })
        .map(function (id) { return String(id).replace(/^models\//, ''); })
        .filter(function (id) { return id && !EXCLUDE.test(id); });
      if (p.free) list = list.filter(function (id) { return id.slice(-p.free.length) === p.free; });
      return U.uniq(list);
    });
  }
  function pickModel(p, ids) {
    var prefs = PREFER[p.id] || [/./];
    for (var i = 0; i < prefs.length; i++) {
      var hit = ids.filter(function (id) { return prefs[i].test(id); })[0];
      if (hit) return hit;
    }
    return ids[0] || '';
  }
  function ensureModel(p) {
    var m = model(p);
    if (m) return Promise.resolve(m);
    return listModels(p.id).then(function (ids) {
      var pick = pickModel(p, ids);
      if (!pick) throw new Error('У сервиса ' + p.name + ' не нашлось подходящей бесплатной модели. Укажите модель вручную в настройках ИИ.');
      cfg.models[p.id] = pick; saveCfg();
      return pick;
    });
  }

  /* ---------- текст ---------- */
  function chat(messages, o) {
    o = o || {};
    var p = provider();
    if (!p) return Promise.reject(new Error('ИИ не подключён. Откройте Настройки → Бесплатный ИИ.'));
    if (!ready()) return Promise.reject(new Error('Для сервиса ' + p.name + ' нужен ключ. Получите бесплатный ключ и вставьте его в настройках ИИ.'));
    if (!NET.online()) return Promise.reject(new Error('Нет интернета.'));
    return ensureModel(p).then(function (m) {
      var body = { model: m, messages: messages, temperature: o.temperature == null ? 0.4 : o.temperature };
      if (o.maxTokens) body.max_tokens = o.maxTokens;
      if (o.json) body.response_format = { type: 'json_object' };
      function send() {
        return NET.request(base(p) + '/chat/completions', { method: 'POST', headers: headers(p), body: JSON.stringify(body), timeout: o.timeout || 150000 });
      }
      return send().then(function (r) {
        if (!r.ok && body.response_format && (r.status === 400 || r.status === 422)) { delete body.response_format; return send(); }
        return r;
      }).then(function (r) {
        if (!r.ok) throw new Error(errText(r));
        var j;
        try { j = JSON.parse(r.data); } catch (e) { throw new Error('Сервис ИИ прислал непонятный ответ.'); }
        if (j.error) throw new Error(errText({ status: 400, data: r.data }));
        var ch = j.choices && j.choices[0];
        var content = ch && ch.message ? ch.message.content : (ch && ch.text) || '';
        if (Array.isArray(content)) content = content.map(function (x) { return typeof x === 'string' ? x : (x && x.text) || ''; }).join('');
        content = String(content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        if (!content) throw new Error('ИИ вернул пустой ответ' + (ch && ch.finish_reason === 'length' ? ': ответ не поместился, выберите другую модель.' : '.'));
        return content;
      });
    });
  }

  /** Достаёт JSON-объект из ответа модели (с «ограждениями» ```, пояснениями, хвостовыми запятыми) */
  function parseJson(text) {
    var t = String(text || '').replace(/^﻿/, '').trim();
    var fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('ИИ ответил не в том формате. Повторите попытку.');
    t = t.slice(a, b + 1);
    var noComma = t.replace(/,\s*([}\]])/g, '$1');
    var tries = [t, noComma, noComma.replace(/[“”„]/g, '"').replace(/ /g, ' ')];
    for (var i = 0; i < tries.length; i++) {
      try { return JSON.parse(tries[i]); } catch (e) { /* следующая попытка */ }
    }
    throw new Error('ИИ прислал повреждённые данные. Повторите попытку или выберите другую модель.');
  }

  function chatJson(system, user, o) {
    var msgs = [{ role: 'system', content: system }, { role: 'user', content: user }];
    return chat(msgs, Object.assign({ json: true }, o)).then(parseJson).catch(function (err) {
      if (!/формат|повреждённые/.test(err.message)) throw err;
      msgs.push({ role: 'user', content: 'Ответь ещё раз: только один JSON-объект по заданной схеме, без пояснений и без Markdown.' });
      return chat(msgs, Object.assign({ json: true, temperature: 0.2 }, o)).then(parseJson);
    });
  }

  /* ---------- картинки ---------- */
  function imagePrompt(what, style) {
    return style === 'bw'
      ? 'Simple black and white coloring page for preschool children: ' + what + '. Thick clean black outlines, pure white background, no shading, no gray, no text, one object, centered, full object visible.'
      : 'Simple flat cartoon illustration for preschool children: ' + what + '. Bright friendly colors, thick dark outlines, pure white background, no text, one object, centered, full object visible.';
  }
  function image(prompt) {
    var p = provider();
    if (!canImage()) return Promise.reject(new Error('Рисовать умеет Pollinations (или свой сервер с поддержкой картинок). Подключите его в настройках ИИ.'));
    if (!NET.online()) return Promise.reject(new Error('Нет интернета.'));
    var seed = Math.floor(Math.random() * 2147483000);
    if (p.id === 'pollinations') {
      var url = 'https://gen.pollinations.ai/image/' + encodeURIComponent(prompt) + '?width=512&height=512&seed=' + seed +
        (cfg.imageModel ? '&model=' + encodeURIComponent(cfg.imageModel) : '');
      return NET.request(url, { headers: { Authorization: 'Bearer ' + key(p) }, binary: true, timeout: 180000 }).then(function (r) {
        if (!r.ok || !r.binary) throw new Error(errText(r));
        var type = String(r.type || 'image/jpeg').split(';')[0];
        return 'data:' + (type.indexOf('image/') === 0 ? type : 'image/jpeg') + ';base64,' + r.data;
      });
    }
    var body = { prompt: prompt, n: 1, size: '512x512', response_format: 'b64_json' };
    if (cfg.imageModel) body.model = cfg.imageModel;
    return NET.request(base(p) + '/images/generations', { method: 'POST', headers: headers(p), body: JSON.stringify(body), timeout: 180000 }).then(function (r) {
      if (!r.ok) throw new Error(errText(r));
      var j = JSON.parse(r.data), d = j.data && j.data[0];
      if (d && d.b64_json) return 'data:image/png;base64,' + d.b64_json;
      if (d && d.url) return NET.getDataUrl(d.url);
      throw new Error('Сервис не прислал картинку.');
    });
  }
  /** Английское название для поиска картинок (если ИИ подключён) */
  function translate(ru) {
    return chat([{ role: 'system', content: 'You translate Russian nouns to English for picture search. Answer with 1-3 English words only, lowercase, no punctuation.' },
      { role: 'user', content: ru }], { temperature: 0, timeout: 60000 }).then(function (t) {
      return String(t).split('\n')[0].toLowerCase().replace(/[^a-z \-]/g, '').trim().split(' ').slice(0, 3).join(' ');
    });
  }

  /* ---------- проверка и нормализация данных от ИИ ---------- */
  function str(v, max) { v = v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); return max ? v.slice(0, max) : v; }
  function arr(v) { return Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]); }
  function strs(v, n, max, keepDup) {
    var l = arr(v).map(function (x) { return str(x, max || 400); }).filter(Boolean);
    return (keepDup ? l : U.uniq(l)).slice(0, n || 20);
  }
  function norm(s) { return str(s).toLowerCase().replace(/ё/g, 'е'); }
  function isRu(s) { return /^[А-Яа-яЁё][А-Яа-яЁё\- ]{0,40}$/.test(s) && !/[a-z]/i.test(s); }
  function prefixOk(a, b) {
    a = norm(a); b = norm(b);
    var n = 0;
    while (n < a.length && n < b.length && a[n] === b[n]) n++;
    return n >= (a.length >= 4 ? 2 : 1);
  }
  function form(v, w) {
    v = str(v, 60);
    if (!v || v === '-' || v === '—' || !isRu(v) || !prefixOk(w, v)) return null;
    return w.charAt(0) === w.charAt(0).toLowerCase() ? v.toLowerCase() : v;
  }
  var GENDER = { 'м': 'м', 'муж': 'м', 'm': 'м', 'ж': 'ж', 'жен': 'ж', 'f': 'ж', 'ср': 'ср', 'сред': 'ср', 'n': 'ср', 'мн': 'мн', 'pl': 'мн' };

  /** Слово от ИИ → запись словаря (или null) */
  function wordEntry(x) {
    if (!x || typeof x !== 'object') return null;
    var w = str(x.w || x.word, 40);
    if (!isRu(w)) return null;
    var g = GENDER[norm(x.g || x.gender).replace(/\./g, '')] || 'м';
    var e = {
      w: w, gs: form(x.gs, w), pl: g === 'мн' ? w : form(x.pl, w), gp: form(x.gp, w), g: g,
      dim: (function () { var d = form(x.dim, w); return d && norm(d) !== norm(w) ? d : null; })(),
      img: null, en: str(x.en, 40).toLowerCase().replace(/[^a-z \-]/g, '').trim() || null,
      adj: strs(x.adj, 4, 30).filter(isRu), v: strs(x.v, 4, 40).filter(function (s) { return /^[А-Яа-яЁё\- ,]+$/.test(s); }),
      ai: true
    };
    if (x.anim === true || str(x.anim) === 'true') e.anim = true;
    var poss = str(x.poss, 30);
    if (poss && isRu(poss) && /(ий|ый|ой|ин|ын|ов|ев)$/.test(poss)) e.poss = poss.toLowerCase();
    if (e.g === 'мн' || x.mass === true) e.noCount = true;
    return e;
  }

  var PLANS = {
    animal: 'ANIMAL_PLAN', bird: 'BIRD_PLAN', plant: 'PLANT_PLAN', vegetable: 'PLANT_PLAN', fruit: 'PLANT_PLAN', toy: 'TOY_PLAN', tree: 'TREE_PLAN',
    mushroom: 'MUSH_PLAN', clothes: 'CLOTH_PLAN', shoes: 'CLOTH_PLAN', dish: 'DISH_PLAN', food: 'PRODUCT_PLAN', product: 'PRODUCT_PLAN',
    furniture: 'FURN_PLAN', transport: 'TRANS_PLAN', profession: 'PROF_PLAN', tool: 'TOOL_PLAN', appliance: 'APPL_PLAN',
    flower: 'FLOWER_PLAN', fish: 'FISH_PLAN', insect: 'INSECT_PLAN', instrument: 'INSTR_PLAN'
  };
  var GENERIC_PLAN = [['@', 'Что это?'], ['1F3A8', 'Какого цвета?'], ['1F9F1', 'Из чего сделан?'], ['1F50E', 'Какие части есть?'], ['2753', 'Для чего нужен?'], ['2764', 'Как беречь?']];
  function planFor(kind, anim) {
    var name = PLANS[norm(kind)];
    var p = name && window[name];
    if (p) return p;
    return anim && window.ANIMAL_PLAN ? window.ANIMAL_PLAN : GENERIC_PLAN;
  }
  function lines(v, min, max) {
    var l = strs(v, max || 12, 160, true);
    return l.length >= (min || 1) ? l : null;
  }
  function slug(t) {
    var map = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
    return String(t).toLowerCase().split('').map(function (c) { return map[c] != null ? map[c] : (/[a-z0-9]/.test(c) ? c : '_'); }).join('').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'tema';
  }

  /** Встроенные темы, далёкие по смыслу (для «Четвёртого лишнего») */
  function fallbackContrast(words) {
    var set = {};
    words.forEach(function (w) { set[norm(w)] = 1; });
    var order = ['posuda', 'transport', 'odezhda', 'frukty', 'mebel', 'igrushki', 'dom_zhiv', 'ovoshchi', 'instrumenty'];
    return order.filter(function (id) {
      var t = DB.byId[id];
      return t && !t.words.some(function (w) { return set[norm(w)]; });
    }).slice(0, 2);
  }

  /**
   * Тема от ИИ → {theme, newWords, notes}. Все ссылки (загадки, маршруты, рассказ, игры)
   * проверяются: они должны указывать на слова самой темы.
   */
  function normalizeTheme(j, title, id) {
    if (!j || typeof j !== 'object') throw new Error('ИИ не прислал данные темы.');
    var notes = [];
    var entries = [], seen = {};
    arr(j.words).forEach(function (x) {
      var e = wordEntry(x);
      if (!e) { notes.push('Пропущено слово: ' + str(x && (x.w || x.word) || x, 40)); return; }
      if (seen[norm(e.w)]) return;
      seen[norm(e.w)] = 1;
      e.baby = null;
      entries.push({ e: e, raw: x });
    });
    if (entries.length < 5) throw new Error('ИИ предложил слишком мало слов по теме (' + entries.length + '). Попробуйте ещё раз или уточните название темы.');
    entries = entries.slice(0, 14);

    // уже известные слова берём из встроенного словаря (там проверенные формы и картинки)
    var words = [], newWords = [];
    entries.forEach(function (it) {
      var known = DB.word(it.e.w);
      if (known) { words.push(known.w); return; }
      words.push(it.e.w);
      newWords.push(it.e);
    });
    var inTheme = {};
    words.forEach(function (w) { inTheme[norm(w)] = w; });
    function ref(w) { return inTheme[norm(w)] || null; }

    // детёныши животных
    var babyPairs = [];
    arr(j.babies).forEach(function (b) {
      var parent = ref(b && b.parent);
      var be = wordEntry(b);
      if (!parent || !be) return;
      var known = DB.word(be.w);
      if (!known) {
        be.img = 'of:' + parent; be.of = parent; be.small = true; be.anim = true;
        if (!newWords.some(function (x) { return x.w === be.w; })) newWords.push(be);
      }
      babyPairs.push([parent, (known || be).w]);
      var pe = DB.word(parent) || newWords.filter(function (x) { return x.w === parent; })[0];
      if (pe && !pe.baby) pe.baby = (known || be).w;
    });

    var cat = strs(j.cat, 5, 60, true);
    if (cat.length < 3) throw new Error('ИИ не указал обобщающее слово темы. Повторите попытку.');
    var firstAnim = newWords.concat(words.map(DB.word).filter(Boolean)).some(function (e) { return e.anim; });
    if (!cat[3]) cat[3] = cat[0];
    if (!cat[4]) cat[4] = firstAnim ? cat[2] : cat[1];

    var riddles = arr(j.riddles).map(function (r) {
      var ans = ref(Array.isArray(r) ? r[0] : r && (r.answer || r.a));
      var text = str(Array.isArray(r) ? r[1] : r && (r.text || r.q), 300);
      return ans && text.length > 10 ? [ans, text.replace(/^«|»$/g, '')] : null;
    }).filter(Boolean).slice(0, 6);

    var routes = arr(j.routes).map(function (r) {
      var a = ref(Array.isArray(r) ? r[0] : r && r.from), b = ref(Array.isArray(r) ? r[1] : r && r.to);
      var s = str(Array.isArray(r) ? r[2] : r && r.text, 160);
      return a && b && a !== b && s ? [a, b, s] : null;
    }).filter(Boolean).slice(0, 3);

    var talk = arr(j.talk).map(function (g) {
      if (!g || typeof g !== 'object') return null;
      var qt = str(g.qt, 120), tpl = str(g.tpl, 160);
      if (qt.indexOf('{w}') < 0 || tpl.indexOf('{a}') < 0 || !/\{W\}|\{w\}/.test(tpl)) return null;
      var items = arr(g.items).map(function (it) {
        var w = ref(Array.isArray(it) ? it[0] : it && it.w), a = str(Array.isArray(it) ? it[1] : it && it.a, 120);
        return w && a ? [w, a] : null;
      }).filter(Boolean).slice(0, 8);
      return items.length >= 3 ? { name: str(g.name, 60) || 'Ответь полным ответом', qt: qt, tpl: tpl, items: items } : null;
    }).filter(Boolean).slice(0, 2);

    var storyWord = ref(j.story && j.story.word) || words[0];
    var storyText = str(j.story && j.story.text, 1200);
    var storyEntry = DB.word(storyWord) || newWords.filter(function (x) { return x.w === storyWord; })[0] || {};
    var fg = j.finger && lines(j.finger.lines, 4, 12), mv = j.move && lines(j.move.lines, 4, 12);
    var contrast = strs(j.contrast, 3, 30).filter(function (c) { return DB.byId[c] && !DB.byId[c].ai; });
    if (!contrast.length) contrast = fallbackContrast(words);
    var kind = norm(j.kind);

    var t = {
      id: id || ('ai_' + slug(title) + '_' + Date.now().toString(36)), ai: true,
      title: str(j.title, 80) || title, month: Math.max(0, Math.min(12, parseInt(j.month, 10) || 0)),
      icon: null, keys: [], cat: cat, contrast: contrast,
      place: str(j.place, 60) || 'в путешествие', where: str(j.where, 60) || '',
      guest: str(j.guest, 300) || 'К нам в гости пришёл Незнайка. Он хочет узнать, что вы знаете по теме «' + title + '».',
      value: str(j.value, 160) || 'интерес и бережное отношение к окружающему миру',
      words: words, extra: [], pairs: {},
      talk: talk, sents: strs(j.sents, 12, 160), riddles: riddles, routes: routes, lit: strs(j.lit, 4, 160),
      story: storyText.length > 60 ? { word: storyWord, plan: planFor(kind, storyEntry.anim), text: storyText } : null,
      finger: fg ? { name: str(j.finger.name, 60) || 'Пальчиковая гимнастика', lines: fg } : null,
      move: mv ? { name: str(j.move.name, 60) || 'Физминутка', lines: mv } : null,
      breath: j.breath && str(j.breath.text, 400).length > 20 ? { name: str(j.breath.name, 60) || 'Подуй', text: str(j.breath.text, 400), item: str(j.breath.item, 60) } : null,
      lex: { v: strs(j.lex && j.lex.v, 10, 30), a: strs(j.lex && j.lex.a, 10, 30) }
    };
    if (babyPairs.length >= 2) t.pairs.baby = { name: 'У кого кто?', q: 'Соедини линией маму и её детёныша.', items: babyPairs.slice(0, 6) };
    var possWords = words.map(function (w) { return DB.word(w) || newWords.filter(function (x) { return x.w === w; })[0]; }).filter(function (e) { return e && e.poss && e.anim; });
    if (possWords.length >= 2) t.possParts = kind === 'bird' && window.BIRD_PARTS ? window.BIRD_PARTS : window.ANIMAL_PARTS;
    if (!t.story) delete t.story;
    ['finger', 'move', 'breath'].forEach(function (k) { if (!t[k]) delete t[k]; });
    return { theme: t, newWords: newWords, notes: notes };
  }

  /* ---------- запросы к ИИ ---------- */
  var SYS = 'Ты — опытный учитель-логопед детского сада (группа компенсирующей направленности для детей с тяжёлыми нарушениями речи) ' +
    'и знаток русской грамматики. Пишешь грамотно, просто и по-детски понятно, строго по заданной теме, без повторов. ' +
    'Отвечаешь только одним JSON-объектом без пояснений.';

  function themeRequest(title, age) {
    var builtins = DB.themes.filter(function (t) { return !t.ai; }).map(function (t) { return t.id + ' — ' + t.title; }).join('; ');
    var years = age === '4' ? '4–5' : (age === '6' ? '6–7' : '5–6');
    return 'Составь материал для логопедических занятий по лексической теме «' + title + '» для детей ' + years + ' лет.\n' +
      'Требования:\n' +
      '1. "words": 10–12 конкретных существительных СТРОГО по теме — предметы или живые существа, которые легко нарисовать одной картинкой (без абстрактных понятий, без повторов). ' +
      'Для каждого слова: w — именительный падеж ед. ч. строчными буквами; gs — родительный падеж ед. ч.; pl — именительный мн. ч.; gp — родительный мн. ч. (после слова «много»); ' +
      'g — род: "м", "ж", "ср" или "мн" (если слово употребляется только во мн. ч.); dim — уменьшительно-ласкательная форма (или ""); en — английское название 1–2 словами, как подпись к эмодзи; ' +
      'anim — true для живых существ; adj — 3 прилагательных, согласованных с этим словом; v — 3 глагола в 3-м лице ед. ч. (что делает); poss — притяжательное прилагательное м. р. для животных (лисий, волчий) или "".\n' +
      '2. "babies": для животных — детёныши [{"w","gs","pl","gp","g","parent"}], где parent — слово из words; если тема не про животных — [].\n' +
      '3. "cat": обобщающее понятие в 5 формах [им. ед., им. мн., род. мн., вин. ед., вин. мн.], например ["дикое животное","дикие животные","диких животных","дикое животное","диких животных"].\n' +
      '4. "riddles": 4 детские загадки [[отгадка, текст]], отгадка — слово из words.\n' +
      '5. "sents": 8 простых предложений со словами темы.\n' +
      '6. "talk": 1–2 речевые игры {"name","qt","tpl","items"}: qt — вопрос с {w} (слово), tpl — образец ответа с {W} (слово с заглавной) и {a} (ответ), items — [[слово из words, ответ]] 4–6 шт. ' +
      'Пример: {"name":"Кто где живёт?","qt":"Где живёт {w}?","tpl":"{W} живёт {a}.","items":[["белка","в дупле"]]}.\n' +
      '7. "routes": 2 маршрута для лабиринта [[слово из words, другое слово из words, "Помоги … (предложение)"]].\n' +
      '8. "story": {"word": слово из words, "text": описательный рассказ-образец из 6–8 предложений}.\n' +
      '9. "finger": пальчиковая гимнастика {"name","lines"} 6–8 строк, в конце строки в скобках движение; "move": физминутка {"name","lines"} 6–8 строк с движениями в скобках; "breath": дыхательное упражнение {"name","text","item"}.\n' +
      '10. "lex": {"v": 8 глаголов по теме в инфинитиве, "a": 8 прилагательных по теме}.\n' +
      '11. "lit": 2–3 произведения детской литературы по теме в виде «Автор «Название»».\n' +
      '12. "guest": сюрпризный момент (1–2 предложения, кто пришёл в гости и о чём просит); "place": куда отправимся (с предлогом, вин. п.); "where": где (с предлогом, предл. п.); ' +
      '"value": что воспитываем (начиная с существительного: «бережное отношение к …»); "month": номер месяца учебного года, когда обычно изучают тему (1–12) или 0; ' +
      '"kind": один из animal, bird, fish, insect, plant, vegetable, fruit, tree, flower, mushroom, toy, clothes, shoes, dish, food, furniture, transport, profession, tool, appliance, instrument, other.\n' +
      '13. "contrast": 2 id встроенных тем, максимально далёких по смыслу от этой темы (для игры «Четвёртый лишний»), из списка: ' + builtins + '.\n' +
      'Верни JSON: {"title","cat","words","babies","riddles","sents","talk","routes","story","finger","move","breath","lex","lit","guest","place","where","value","month","kind","contrast"}.';
  }

  function makeTheme(title, age) {
    title = str(title, 80);
    if (title.length < 3) return Promise.reject(new Error('Введите название темы.'));
    return chatJson(SYS, themeRequest(title, age), { temperature: 0.35, maxTokens: 6000 }).then(function (j) { return normalizeTheme(j, U.cap(title)); });
  }

  function wordRequest(w) {
    return 'Дай грамматические формы и сведения для слова «' + w + '» (для логопедических игр с детьми). ' +
      'Верни JSON: {"w": слово в им. п. ед. ч., "gs": род. п. ед. ч., "pl": им. п. мн. ч., "gp": род. п. мн. ч., "g": "м"|"ж"|"ср"|"мн", "dim": уменьшительно-ласкательная форма или "", ' +
      '"en": английское название 1–2 словами, "anim": true|false, "adj": 3 прилагательных, "v": 3 глагола в 3-м лице ед. ч., "poss": притяжательное прилагательное м. р. для животных или ""}.';
  }
  function fillWord(w) {
    return chatJson(SYS, wordRequest(w), { temperature: 0.1, maxTokens: 800, timeout: 90000 }).then(function (j) {
      var e = wordEntry(Object.assign({}, j, { w: w }));
      if (!e) throw new Error('ИИ не смог разобрать слово «' + w + '».');
      return e;
    });
  }

  function extrasRequest(L) {
    var sn = L.sound && PH.BY_ID[L.sound] ? PH.BY_ID[L.sound].name : '';
    var years = L.age === '4' ? '4–5' : (L.age === '6' ? '6–7' : '5–6');
    var ws = L.words.map(function (e) { return e.w; }).join(', ');
    return 'Лексическая тема «' + L.theme.title + '», дети ' + years + ' лет с ТНР. Слова темы: ' + ws + '.\n' +
      (sn ? 'Звук для автоматизации: ' + sn + '.\n' : 'Звук не выбран.\n') +
      'Составь дополнительный речевой материал к занятию:\n' +
      '"chist": ' + (sn ? '6 чистоговорок на звук ' + sn + ' (слоговая дорожка + фраза со словом темы, например «Ра-ра-ра — вот и…»); в каждой должен быть звук ' + sn : 'пустой массив []') + ';\n' +
      '"skor": 2 короткие скороговорки по теме' + (sn ? ' со звуком ' + sn : '') + ';\n' +
      '"riddles": 3 новые загадки [[отгадка, текст]], отгадка — строго одно из слов темы;\n' +
      '"poem": короткое стихотворение по теме для заучивания {"name","lines"} (4–8 строк);\n' +
      '"retell": рассказ для пересказа {"title","text"} из 5–7 простых предложений со словами темы;\n' +
      '"questions": 4–5 вопросов по рассказу.\n' +
      'Верни JSON: {"chist","skor","riddles","poem","retell","questions"}.';
  }
  function normalizeExtras(j, L) {
    if (!j || typeof j !== 'object') throw new Error('ИИ не прислал материал.');
    var wordsN = {};
    L.words.forEach(function (e) { wordsN[norm(e.w)] = e.w; });
    function hasSound(line) {
      if (!L.sound) return true;
      return String(line).replace(/\([^)]*\)/g, ' ').split(/[\s,.!?«»"“”—–:;-]+/).some(function (w) { return w.length > 1 && PH.has(w.toLowerCase(), L.sound); });
    }
    var out = {
      chist: L.sound ? strs(j.chist, 8, 200).filter(hasSound).slice(0, 6) : [],
      skor: strs(j.skor, 3, 240).filter(hasSound).slice(0, 2),
      riddles: arr(j.riddles).map(function (r) {
        var ans = wordsN[norm(Array.isArray(r) ? r[0] : r && (r.answer || r.a))];
        var text = str(Array.isArray(r) ? r[1] : r && (r.text || r.q), 300).replace(/^«|»$/g, '');
        return ans && text.length > 10 ? [ans, text] : null;
      }).filter(Boolean).slice(0, 3),
      poem: j.poem && lines(j.poem.lines, 4, 12) ? { name: str(j.poem.name, 80) || 'Стихотворение', lines: lines(j.poem.lines, 4, 12) } : null,
      retell: j.retell && str(j.retell.text, 1500).length > 80 ? { title: str(j.retell.title, 80) || 'Рассказ', text: str(j.retell.text, 1500) } : null,
      questions: strs(j.questions, 6, 200)
    };
    if (!out.retell) out.questions = [];
    var p = provider();
    out.by = p ? p.name + (model(p) ? ', модель ' + model(p) : '') : 'ИИ';
    out.date = Date.now();
    if (!out.chist.length && !out.skor.length && !out.riddles.length && !out.poem && !out.retell) throw new Error('ИИ не смог составить материал по теме. Повторите попытку.');
    return out;
  }
  function makeExtras(L) {
    return chatJson(SYS, extrasRequest(L), { temperature: 0.6, maxTokens: 3000 }).then(function (j) { return normalizeExtras(j, L); });
  }

  return {
    PROVIDERS: PROVIDERS, configure: configure, settings: settings, provider: provider, model: model, ready: ready, canImage: canImage, label: label,
    listModels: listModels, chat: chat, chatJson: chatJson, parseJson: parseJson, image: image, imagePrompt: imagePrompt, translate: translate,
    makeTheme: makeTheme, normalizeTheme: normalizeTheme, fillWord: fillWord, wordEntry: wordEntry, makeExtras: makeExtras, normalizeExtras: normalizeExtras,
    save: saveCfg
  };
})();
