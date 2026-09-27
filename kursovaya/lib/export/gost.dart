import '../core/text_utils.dart';
import '../models/source.dart';

/// Библиографическое описание по ГОСТ 7.1-2003 и сортировка списка литературы по алфавиту.
class Gost {
  Gost._();

  static const String sep = '. – ';

  /// Издательство → город (если база не указала место издания).
  static const Map<String, String> _publisherCity = {
    'юрайт': 'Москва',
    'инфра-м': 'Москва',
    'инфра м': 'Москва',
    'кнорус': 'Москва',
    'проспект': 'Москва',
    'дашков': 'Москва',
    'статут': 'Москва',
    'норма': 'Москва',
    'академия': 'Москва',
    'юнити': 'Москва',
    'юстиция': 'Москва',
    'магистр': 'Москва',
    'эксмо': 'Москва',
    'аст': 'Москва',
    'альпина': 'Москва',
    'дмк пресс': 'Москва',
    'вузовский учебник': 'Москва',
    'финансы и статистика': 'Москва',
    'экономика': 'Москва',
    'высшая школа': 'Москва',
    'наука': 'Москва',
    'высшей школы экономики': 'Москва',
    'вшэ': 'Москва',
    'издательство московского университета': 'Москва',
    'мгу': 'Москва',
    'русайнс': 'Москва',
    'лаборатория знаний': 'Москва',
    'солон': 'Москва',
    'форум': 'Москва',
    'омега-л': 'Москва',
    'альфа-м': 'Москва',
    'флинта': 'Москва',
    'перспектива': 'Москва',
    'логос': 'Москва',
    'велби': 'Москва',
    'питер': 'Санкт-Петербург',
    'лань': 'Санкт-Петербург',
    'бхв': 'Санкт-Петербург',
    'юридический центр': 'Санкт-Петербург',
    'спбгу': 'Санкт-Петербург',
    'санкт-петербургского': 'Санкт-Петербург',
    'феникс': 'Ростов-на-Дону',
    'ай пи ар медиа': 'Саратов',
    'ай пи эр медиа': 'Саратов',
    'инфра-инженерия': 'Вологда',
    'казанского': 'Казань',
    'казанский': 'Казань',
    'кфу': 'Казань',
    'татарское книжное': 'Казань',
    'уральского': 'Екатеринбург',
    'новосибирского': 'Новосибирск',
    'томского': 'Томск',
  };

  static String? cityForPublisher(String? publisher) {
    if (publisher == null) return null;
    final p = publisher.toLowerCase().replaceAll('ё', 'е');
    for (final e in _publisherCity.entries) {
      if (p.contains(e.key)) return e.value;
    }
    return null;
  }

  static String _clean(String? s) {
    var t = (s ?? '').replaceAll(RegExp(r'[ \t\r\n]+'), ' ').trim();
    while (t.isNotEmpty && '.,;:'.contains(t[t.length - 1])) {
      t = t.substring(0, t.length - 1).trimRight();
    }
    return t;
  }

  /// Заголовки в ВЕРХНЕМ РЕГИСТРЕ из баз → обычный регистр.
  static String cleanTitle(String s) {
    var t = _clean(stripHtml(s));
    final letters = t.replaceAll(RegExp(r'[^A-Za-zА-Яа-яЁё]'), '');
    if (letters.length > 8 && letters == letters.toUpperCase()) {
      t = t.toLowerCase();
    }
    return capitalize(t);
  }

  static List<PersonName> _names(Source s) => s.authors.map(parsePersonName).where((n) => n.surname.isNotEmpty).toList();

  static String _resp(List<PersonName> n, {bool etAl = false}) {
    final shown = etAl ? n.take(3).toList() : n;
    final r = shown.map((e) => e.initialsSurname).join(', ');
    return etAl && n.length > 3 ? '$r [и$nbspдр.]' : r;
  }

  static String _date(DateTime? d) => dateRu(d ?? DateTime.now());

  static String _electronic(Source s, DateTime? accessed) {
    final url = (s.url ?? '').trim();
    if (url.isEmpty) return '';
    return '$sepРежим доступа: $url (дата обращения: ${_date(s.accessed ?? accessed)})';
  }

  static String _volumeIssue(Source s) {
    final parts = <String>[];
    if ((s.volume ?? '').trim().isNotEmpty) parts.add('Т.$nbsp${_clean(s.volume)}');
    if ((s.issue ?? '').trim().isNotEmpty) parts.add('№$nbsp${_clean(s.issue).replaceFirst(RegExp(r'^№\s*'), '')}');
    return parts.join(', ');
  }

  static String _pagesRange(String p) => _clean(p).replaceAll(RegExp(r'\s*[-—−]\s*'), '–');

  /// Полное библиографическое описание.
  static String format(Source s, {DateTime? accessed}) {
    if ((s.manual ?? '').trim().isNotEmpty) return _finish(s.manual!.trim());
    switch (s.type) {
      case SourceType.normative:
        return _normative(s, accessed);
      case SourceType.web:
        return _web(s, accessed);
      case SourceType.article:
        return _article(s, accessed);
      case SourceType.book:
      case SourceType.other:
        return _book(s, accessed);
    }
  }

  static String _finish(String t) {
    var r = t.replaceAll(RegExp(r'[ \t\r\n]+'), ' ').replaceAll(' ,', ',').trim();
    r = r.replaceAll(RegExp(r'\.\.+$'), '.');
    if (!r.endsWith('.') && !r.endsWith(')')) r = '$r.';
    if (r.endsWith(')')) r = '$r.';
    return r;
  }

  static String _book(Source s, DateTime? accessed) {
    final names = _names(s);
    final title = cleanTitle(s.title);
    final sub = _clean(s.subtitle);
    final b = StringBuffer();
    final many = names.length > 3;
    if (names.isNotEmpty && !many) b.write('${names.first.heading} ');
    b.write(title);
    if (sub.isNotEmpty) b.write(' : $sub');
    if (s.isElectronic && s.type == SourceType.other) b.write(' [Электронный ресурс]');
    if (names.isNotEmpty) b.write(' / ${_resp(names, etAl: many)}');
    final city = _clean(s.city).isNotEmpty ? _clean(s.city) : (cityForPublisher(s.publisher) ?? '');
    final pub = _clean(s.publisher);
    final year = s.year?.toString() ?? '';
    String imprint;
    if (city.isEmpty && pub.isEmpty) {
      imprint = '[Б.$nbspм. : б.$nbspи.]';
    } else {
      imprint = '${city.isEmpty ? '[Б.$nbspм.]' : city} : ${pub.isEmpty ? '[б.$nbspи.]' : pub}';
    }
    b.write('$sep$imprint${year.isEmpty ? '' : ', $year'}');
    if (s.pageCount != null && s.pageCount! > 0) b.write('$sep${s.pageCount}$nbspс');
    if (s.type == SourceType.other && (s.url ?? '').isNotEmpty) b.write(_electronic(s, accessed));
    return _finish(b.toString());
  }

  static String _article(Source s, DateTime? accessed) {
    final names = _names(s);
    final title = cleanTitle(s.title);
    final many = names.length > 3;
    final electronic = s.url != null && s.url!.isNotEmpty && (s.origin == 'КиберЛенинка' || (s.pages ?? '').isEmpty);
    final b = StringBuffer();
    if (names.isNotEmpty && !many) b.write('${names.first.heading} ');
    b.write(title);
    if (electronic) b.write(' [Электронный ресурс]');
    if (names.isNotEmpty) b.write(' / ${_resp(names, etAl: many)}');
    final journal = _clean(s.container);
    if (journal.isNotEmpty) b.write(' // $journal');
    if (s.year != null) b.write('$sep${s.year}');
    final vi = _volumeIssue(s);
    if (vi.isNotEmpty) b.write('$sep$vi');
    if ((s.pages ?? '').trim().isNotEmpty) {
      final p = _pagesRange(s.pages!);
      b.write('$sepС.$nbsp$p');
    }
    if (electronic) b.write(_electronic(s, accessed));
    return _finish(b.toString());
  }

  static String _web(Source s, DateTime? accessed) {
    final title = cleanTitle(s.title);
    final site = _clean(s.siteName ?? s.container);
    final b = StringBuffer(title);
    b.write(' [Электронный ресурс]');
    if (site.isNotEmpty && site.toLowerCase() != title.toLowerCase()) b.write(' // $site');
    if (s.year != null) b.write('$sep${s.year}');
    b.write(_electronic(s, accessed));
    return _finish(b.toString());
  }

  static String normalizeKind(String? kind) {
    var k = _clean(kind).toLowerCase();
    if (k.isEmpty) return '';
    const map = {
      'федеральный закон': 'федер. закон',
      'фз': 'федер. закон',
      'федеральный конституционный закон': 'федер. конституц. закон',
      'закон рт': 'закон Респ. Татарстан',
      'закон республики татарстан': 'закон Респ. Татарстан',
      'указ президента рф': 'указ Президента Рос. Федерации',
      'указ президента российской федерации': 'указ Президента Рос. Федерации',
      'постановление правительства рф': 'постановление Правительства Рос. Федерации',
      'постановление правительства российской федерации': 'постановление Правительства Рос. Федерации',
      'приказ минфина россии': 'приказ М-ва финансов Рос. Федерации',
      'приказ министерства финансов российской федерации': 'приказ М-ва финансов Рос. Федерации',
    };
    return map[k] ?? k.replaceAll('рф', 'Рос. Федерации');
  }

  static String _normative(Source s, DateTime? accessed) {
    final title = cleanTitle(s.title);
    final kind = normalizeKind(s.docKind);
    final b = StringBuffer(title);
    final req = <String>[];
    if (kind.isNotEmpty) req.add(kind);
    if ((s.docDate ?? '').trim().isNotEmpty) req.add('от ${_clean(s.docDate)}');
    if ((s.docNumber ?? '').trim().isNotEmpty) req.add('№$nbsp${_clean(s.docNumber).replaceFirst(RegExp(r'^№\s*'), '')}');
    if (req.isNotEmpty) b.write(' : ${req.join(' ')}');
    if ((s.url ?? '').isNotEmpty) {
      b.write(' [Электронный ресурс]');
      b.write(_electronic(s, accessed));
    }
    return _finish(b.toString());
  }

  /// Краткая подпись для промптов и списков в интерфейсе.
  static String shortLabel(Source s) {
    final names = _names(s);
    final a = names.isEmpty ? '' : '${names.take(2).map((e) => e.surnameInitials).join(', ')}${names.length > 2 ? ' и др.' : ''} ';
    switch (s.type) {
      case SourceType.article:
        return '$a${cleanTitle(s.title)}${(s.container ?? '').isNotEmpty ? ' // ${_clean(s.container)}' : ''}${s.year != null ? ', ${s.year}' : ''}';
      case SourceType.normative:
        return '${cleanTitle(s.title)} (${[normalizeKind(s.docKind), if ((s.docDate ?? '').isNotEmpty) 'от ${s.docDate}', if ((s.docNumber ?? '').isNotEmpty) '№ ${s.docNumber}'].where((e) => e.isNotEmpty).join(' ')})';
      case SourceType.web:
        return '${cleanTitle(s.title)} (сайт${(s.siteName ?? '').isNotEmpty ? ' ${s.siteName}' : ''})';
      case SourceType.book:
      case SourceType.other:
        return '$a${cleanTitle(s.title)}${(s.subtitle ?? '').isNotEmpty ? ' : ${_clean(s.subtitle)}' : ''}${(s.publisher ?? '').isNotEmpty ? '. – ${_clean(s.publisher)}' : ''}${s.year != null ? ', ${s.year}' : ''}';
    }
  }

  static String sortKey(Source s) {
    final f = format(s).toLowerCase().replaceAll('ё', 'е').replaceAll(RegExp(r'^[^a-zа-я0-9]+'), '');
    final cyr = f.isNotEmpty && RegExp(r'[а-я]').hasMatch(f[0]);
    return '${cyr ? '0' : '1'}$f';
  }

  /// Список литературы: по алфавиту (сначала русские описания, затем на латинице).
  static List<Source> ordered(List<Source> sources) {
    final list = sources.where((s) => s.selected).toList();
    list.sort((a, b) => sortKey(a).compareTo(sortKey(b)));
    return list;
  }
}
