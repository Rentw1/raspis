import 'dart:math';

/// Неразрывный пробел.
const String nbsp = ' ';

final Random _rnd = Random.secure();

/// Короткий уникальный идентификатор.
String newId([String prefix = '']) {
  final t = DateTime.now().microsecondsSinceEpoch.toRadixString(36);
  final r = List.generate(6, (_) => _rnd.nextInt(36).toRadixString(36)).join();
  return '$prefix$t$r';
}

/// UUID v4 (нужен для заголовка RqUID у GigaChat).
String uuid4() {
  final b = List<int>.generate(16, (_) => _rnd.nextInt(256));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  final h = b.map((x) => x.toRadixString(16).padLeft(2, '0')).join();
  return '${h.substring(0, 8)}-${h.substring(8, 12)}-${h.substring(12, 16)}-${h.substring(16, 20)}-${h.substring(20)}';
}

final RegExp _wordRe = RegExp(r'[A-Za-zА-Яа-яЁё0-9]+(?:[-’][A-Za-zА-Яа-яЁё0-9]+)*');

int wordCount(String s) => _wordRe.allMatches(s).length;

List<String> words(String s) => _wordRe.allMatches(s).map((m) => m.group(0)!).toList();

/// Схлопывает пробелы и табуляции; неразрывные пробелы сохраняются (они важны для вёрстки).
String collapseSpaces(String s) => s.replaceAll(RegExp(r'[ \t]+'), ' ').trim();

bool hasCyrillic(String s) => RegExp(r'[А-Яа-яЁё]').hasMatch(s);

double cyrillicRatio(String s) {
  final letters = RegExp(r'[A-Za-zА-Яа-яЁё]').allMatches(s).length;
  if (letters == 0) return 0;
  return RegExp(r'[А-Яа-яЁё]').allMatches(s).length / letters;
}

String stripHtml(String s) {
  var t = s.replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), ' ');
  t = t.replaceAll(RegExp(r'<[^>]+>'), '');
  t = t
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll('&laquo;', '«')
      .replaceAll('&raquo;', '»')
      .replaceAll('&mdash;', '—')
      .replaceAll('&ndash;', '–');
  t = t.replaceAllMapped(RegExp(r'&#(\d+);'), (m) {
    final code = int.tryParse(m.group(1)!);
    return code == null ? '' : String.fromCharCode(code);
  });
  return collapseSpaces(t);
}

String truncate(String s, int max) {
  if (s.length <= max) return s;
  final cut = s.substring(0, max);
  final sp = cut.lastIndexOf(' ');
  return '${(sp > max * 0.6 ? cut.substring(0, sp) : cut).trimRight()}…';
}

String capitalize(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

/// Удаляет управляющие символы, недопустимые в XML 1.0.
String xmlSafe(String s) => s.replaceAll(RegExp(r'[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]'), '');

/// Русская типографика для текста от ИИ: «ёлочки», тире, неразрывные пробелы в ссылках.
String typography(String s) {
  var t = s.replaceAll('\r', '');
  t = t.replaceAll(RegExp(r'[“”„‟]'), '"');
  // Кавычки: открывающая после начала строки/пробела/скобки, остальные — закрывающие.
  final sb = StringBuffer();
  for (var i = 0; i < t.length; i++) {
    final ch = t[i];
    if (ch == '"') {
      final prev = i == 0 ? ' ' : t[i - 1];
      final opening = RegExp(r'[\s(\[«—–-]').hasMatch(prev) || i == 0;
      sb.write(opening ? '«' : '»');
    } else {
      sb.write(ch);
    }
  }
  t = sb.toString();
  t = t.replaceAll(RegExp(r'(?<=\S) +-{1,2} +(?=\S)'), ' – ');
  t = t.replaceAll(RegExp(r'(?<=\s)—(?=\s)'), '–');
  t = t.replaceAll(RegExp(r'\.{3}'), '…');
  // "с. 45", "т. е." — неразрывный пробел, чтобы номер страницы не отрывался.
  t = t.replaceAllMapped(RegExp(r'(?<![А-Яа-яЁёA-Za-z])([сС]\.) ?(\d)'), (m) => '${m[1]}$nbsp${m[2]}');
  t = t.replaceAllMapped(RegExp(r'(№) ?(\d)'), (m) => '${m[1]}$nbsp${m[2]}');
  t = t.replaceAll(RegExp(r' {2,}'), ' ');
  return t;
}

// ---------------- ФИО ----------------

class PersonName {
  PersonName(this.surname, this.first, this.patronymic);
  final String surname;
  final String first;
  final String patronymic;

  String get initials {
    final parts = <String>[];
    if (first.isNotEmpty) parts.add('${first[0].toUpperCase()}.');
    if (patronymic.isNotEmpty) parts.add('${patronymic[0].toUpperCase()}.');
    return parts.join(nbsp);
  }

  /// «Иванов И. И.»
  String get surnameInitials => initials.isEmpty ? surname : '$surname$nbsp$initials';

  /// «И. И. Иванов»
  String get initialsSurname => initials.isEmpty ? surname : '$initials$nbsp$surname';

  /// «Иванов, И. И.» — заголовок библиографической записи.
  String get heading => initials.isEmpty ? surname : '$surname,$nbsp$initials';
}

const _femaleSuffixes = ['вна', 'чна', 'кызы', 'гызы', 'шна'];
const _maleSuffixes = ['вич', 'ич', 'оглы', 'улы', 'ьич'];

bool _isPatronymic(String w) {
  final l = w.toLowerCase();
  return _femaleSuffixes.any(l.endsWith) || _maleSuffixes.any(l.endsWith);
}

/// Женский род по отчеству (для «выполнил / выполнила» на титульном листе).
bool isFemaleName(String fio) {
  final parts = fio.trim().split(RegExp(r'\s+'));
  for (final p in parts.reversed) {
    final l = p.toLowerCase().replaceAll('.', '');
    if (_femaleSuffixes.any(l.endsWith)) return true;
    if (_maleSuffixes.any(l.endsWith)) return false;
  }
  if (parts.isNotEmpty) {
    final s = parts.first.toLowerCase();
    if (RegExp(r'(ова|ева|ёва|ина|ына|ская|цкая|ая)$').hasMatch(s)) return true;
  }
  return false;
}

const _commonFirstNames = {
  'александр', 'алексей', 'анатолий', 'андрей', 'антон', 'артем', 'артём', 'борис', 'вадим', 'валентин',
  'валерий', 'василий', 'виктор', 'виталий', 'владимир', 'владислав', 'вячеслав', 'геннадий', 'георгий',
  'григорий', 'даниил', 'денис', 'дмитрий', 'евгений', 'егор', 'иван', 'игорь', 'илья', 'кирилл', 'константин',
  'леонид', 'максим', 'марат', 'михаил', 'никита', 'николай', 'олег', 'павел', 'петр', 'пётр', 'роман', 'руслан',
  'сергей', 'станислав', 'степан', 'тимур', 'федор', 'фёдор', 'юрий', 'ярослав', 'айдар', 'рустем', 'рустам',
  'ильдар', 'ринат', 'ренат', 'рамиль', 'алина', 'алла', 'анастасия', 'анна', 'валентина', 'валерия', 'вера',
  'виктория', 'галина', 'дарья', 'диана', 'екатерина', 'елена', 'елизавета', 'жанна', 'зарина', 'ирина', 'карина',
  'кристина', 'ксения', 'лариса', 'лилия', 'любовь', 'людмила', 'маргарита', 'марина', 'мария', 'надежда',
  'наталья', 'наталия', 'нина', 'ольга', 'полина', 'светлана', 'софия', 'софья', 'татьяна', 'юлия', 'яна',
  'гульнара', 'эльвира', 'альбина', 'айгуль', 'лейсан', 'резеда', 'гузель', 'регина', 'алсу', 'динара',
  'john', 'james', 'robert', 'michael', 'david', 'maria', 'anna', 'peter', 'paul', 'thomas',
};

bool _looksLikeInitial(String w) => RegExp(r'^[A-ZА-ЯЁ]\.?$').hasMatch(w.replaceAll(nbsp, ''));

/// Разбирает ФИО в разных записях: «Иванов Иван Иванович», «Иван Иванович Иванов»,
/// «Иванов И. И.», «И. И. Иванов», «Иванов, И. И.», «Smith, John», «John Smith».
PersonName parsePersonName(String raw) {
  var s = raw.replaceAll(nbsp, ' ').replaceAll(RegExp(r'\s+'), ' ').trim();
  if (s.isEmpty) return PersonName('', '', '');
  // «Фамилия, Имя Отчество» или «Фамилия, И. О.»
  if (s.contains(',')) {
    final i = s.indexOf(',');
    final sur = s.substring(0, i).trim();
    final rest = s.substring(i + 1).trim().replaceAll('.', '. ').replaceAll(RegExp(r'\s+'), ' ').trim();
    final r = rest.split(' ').where((x) => x.isNotEmpty).toList();
    return PersonName(_cap(sur), r.isNotEmpty ? r[0] : '', r.length > 1 ? r[1] : '');
  }
  // Инициалы слитно: «И.И.Иванов» / «Иванов И.И.»
  s = s.replaceAllMapped(RegExp(r'([A-ZА-ЯЁ])\.(?=[A-ZА-ЯЁ])'), (m) => '${m[1]}. ');
  final p = s.split(' ').where((x) => x.isNotEmpty).toList();
  if (p.length == 1) return PersonName(_cap(p[0]), '', '');
  // Инициалы впереди: «И. И. Иванов»
  if (_looksLikeInitial(p[0])) {
    final initials = p.takeWhile(_looksLikeInitial).toList();
    final sur = p.skip(initials.length).join(' ');
    return PersonName(_cap(sur), initials.isNotEmpty ? initials[0] : '', initials.length > 1 ? initials[1] : '');
  }
  // Инициалы сзади: «Иванов И. И.»
  if (p.length >= 2 && _looksLikeInitial(p[1])) {
    return PersonName(_cap(p[0]), p[1], p.length > 2 && _looksLikeInitial(p[2]) ? p[2] : '');
  }
  if (p.length >= 3) {
    if (_isPatronymic(p[2])) return PersonName(_cap(p[0]), p[1], p[2]); // Фамилия Имя Отчество
    if (_isPatronymic(p[1])) return PersonName(_cap(p[2]), p[0], p[1]); // Имя Отчество Фамилия
    // Латиница: «John Ronald Smith» → фамилия последняя
    if (!hasCyrillic(s)) return PersonName(_cap(p.last), p[0], p[1]);
    return PersonName(_cap(p[0]), p[1], p[2]);
  }
  // Два слова
  final a = p[0].toLowerCase(), b = p[1].toLowerCase();
  if (_commonFirstNames.contains(a) && !_commonFirstNames.contains(b)) return PersonName(_cap(p[1]), p[0], '');
  if (_commonFirstNames.contains(b)) return PersonName(_cap(p[0]), p[1], '');
  if (!hasCyrillic(s)) return PersonName(_cap(p[1]), p[0], '');
  if (RegExp(r'(ов|ев|ёв|ин|ын|ский|цкий|ова|ева|ина|ская|цкая|ых|их|ко|юк|ук|ян|дзе|швили)$').hasMatch(a)) {
    return PersonName(_cap(p[0]), p[1], '');
  }
  return PersonName(_cap(p[1]), p[0], '');
}

String _cap(String s) {
  if (s.isEmpty) return s;
  if (s == s.toUpperCase() && s.length > 2) {
    return s.split('-').map((x) => x.isEmpty ? x : x[0] + x.substring(1).toLowerCase()).join('-');
  }
  return s[0].toUpperCase() + s.substring(1);
}

// ---------------- Похожесть текстов ----------------

String _normWord(String w) => w.toLowerCase().replaceAll('ё', 'е');

/// Простейший стеммер: отбрасывает типичные окончания (для сравнения ключевых слов).
String stemRu(String w) {
  var s = _normWord(w);
  if (s.length <= 4) return s;
  const ends = [
    'иями', 'ями', 'ами', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ых', 'их', 'ой', 'ей', 'ий', 'ый', 'ая',
    'яя', 'ое', 'ее', 'ую', 'юю', 'ия', 'ие', 'ии', 'ию', 'ью', 'ов', 'ев', 'ам', 'ям', 'ах', 'ях', 'ом', 'ем',
    'а', 'я', 'о', 'е', 'ы', 'и', 'у', 'ю', 'ь', 'й',
  ];
  for (final e in ends) {
    if (s.length - e.length >= 4 && s.endsWith(e)) return s.substring(0, s.length - e.length);
  }
  return s;
}

const _stop = {
  'и', 'в', 'во', 'на', 'с', 'со', 'по', 'к', 'ко', 'о', 'об', 'от', 'до', 'из', 'за', 'для', 'при', 'не', 'что',
  'как', 'это', 'а', 'но', 'или', 'у', 'же', 'ли', 'бы', 'его', 'ее', 'их', 'также', 'так', 'то', 'все', 'был',
  'была', 'были', 'быть', 'является', 'являются', 'который', 'которые', 'которая', 'которых', 'этом', 'этой',
};

Set<String> keywordStems(String s) =>
    words(s).map(_normWord).where((w) => w.length > 2 && !_stop.contains(w)).map(stemRu).toSet();

/// Шинглы из n слов для поиска дословных совпадений.
Set<String> shingles(String s, [int n = 5]) {
  final w = words(s).map(_normWord).where((x) => !_stop.contains(x)).toList();
  final out = <String>{};
  for (var i = 0; i + n <= w.length; i++) {
    out.add(w.sublist(i, i + n).join(' '));
  }
  return out;
}

double jaccard(Set<String> a, Set<String> b) {
  if (a.isEmpty || b.isEmpty) return 0;
  final inter = a.intersection(b).length;
  return inter / (a.length + b.length - inter);
}

/// Доля шинглов [a], встречающихся в [b].
double containment(Set<String> a, Set<String> b) {
  if (a.isEmpty || b.isEmpty) return 0;
  return a.intersection(b).length / a.length;
}

String two(int v) => v.toString().padLeft(2, '0');

String dateRu(DateTime d) => '${two(d.day)}.${two(d.month)}.${d.year}';

const _months = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября',
  'декабря',
];

String dateRuLong(DateTime d) => '${d.day} ${_months[d.month - 1]} ${d.year} г.';

/// Безопасное имя файла (кириллица сохраняется).
String safeFileName(String s, {int max = 80}) {
  var t = s.replaceAll(RegExp(r'[\\/:*?"<>|\u0000-\u001F«»]'), '').replaceAll(RegExp(r'\s+'), '_');
  t = t.replaceAll(RegExp(r'_+'), '_').replaceAll(RegExp(r'^[_.]+|[_.]+$'), '');
  if (t.length > max) t = t.substring(0, max);
  return t.isEmpty ? 'kursovaya' : t;
}

/// Число прописью не нужно; склонение слова «источник», «приложение» и т. п.
String plural(int n, String one, String few, String many) {
  final m10 = n % 10, m100 = n % 100;
  if (m10 == 1 && m100 != 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const _numWordsGen = {
  1: 'одной', 2: 'двух', 3: 'трех', 4: 'четырех', 5: 'пяти', 6: 'шести',
};

String chaptersGenitive(int n) => '${_numWordsGen[n] ?? n} ${plural(n, 'главы', 'глав', 'глав')}';
