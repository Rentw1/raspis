import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:kursovaya/ai/ai_client.dart';
import 'package:kursovaya/ai/providers.dart';
import 'package:kursovaya/core/json_utils.dart';
import 'package:kursovaya/core/net.dart';
import 'package:kursovaya/core/regulation.dart';
import 'package:kursovaya/core/text_utils.dart';
import 'package:kursovaya/export/gost.dart';
import 'package:kursovaya/gen/budget.dart';
import 'package:kursovaya/gen/generator.dart';
import 'package:kursovaya/gen/markup.dart';
import 'package:kursovaya/models/coursework.dart';
import 'package:kursovaya/models/settings.dart';
import 'package:kursovaya/models/source.dart';
import 'package:kursovaya/qa/checker.dart';
import 'package:kursovaya/search/literature_apis.dart';
import 'package:kursovaya/search/source_finder.dart';
import 'package:kursovaya/search/web_search.dart';

import 'fixtures/sample.dart';

void main() {
  group('Разметка ответа ИИ', () {
    test('очистка Markdown, заголовков и кавычек', () {
      const raw = '<think>план ответа</think>## Глава 1. Теория\n\n**Оборотные активы** — это "ресурсы" организации [3,с.45]. Второе предложение - важное.\n\n* первый пункт\n* второй пункт\n\nКак языковая модель, я не могу гарантировать точность.';
      final t = Markup.cleanAiText(raw);
      expect(t, isNot(contains('**')));
      expect(t, isNot(contains('##')));
      expect(t, isNot(contains('think')));
      expect(t, contains('«ресурсы»'));
      expect(t, contains('[3, с. 45]'));
      expect(t, contains('– первый пункт'));
      expect(t, contains('предложение – важное'));
      expect(t, isNot(contains('языковая модель')));
    });

    test('разбор абзацев, списков и таблиц', () {
      const raw = 'Первый абзац текста.\nпродолжение абзаца.\n\nСписок:\n– один;\n– два.\n\nТаблица 2 — Динамика выручки.\n| Показатель | 2024 | 2025 |\n|---|---|---|\n| Выручка | 10,5 | |\n\nИсточник: данные организации';
      final b = Markup.parse(raw);
      expect(b.whereType<ParaBlock>().first.text, 'Первый абзац текста. продолжение абзаца.');
      expect(b.whereType<ListItemBlock>().length, 2);
      final table = b.whereType<TableBlock>().single;
      expect(table.title, 'Динамика выручки');
      expect(table.number, '2');
      expect(table.rows.length, 2);
      expect(table.rows[1][2], '–', reason: 'пустая ячейка → прочерк');
      expect(b.last, isA<NoteBlock>());
    });

    test('перенумерация таблиц и ссылок', () {
      const raw = 'Как видно из таблицы 5, рост.\n\nТаблица 5 — Итоги\n| А | Б |\n| 1 | 2 |';
      final (out, next) = Markup.renumberTables(raw, 3);
      expect(out, contains('Таблица 3 — Итоги'));
      expect(out, contains('таблицы 3'));
      expect(next, 4);
    });

    test('ссылки на источники: нормализация, перенумерация, удаление неверных', () {
      expect(Markup.citedNumbers('текст [2, с. 15] и [3; 4]'), [2, 3, 4]);
      expect(Markup.renumberCitations('а [1, с. 5] б [2].', {1: 2, 2: 1}), 'а [2, с. 5] б [1].');
      expect(Markup.dropInvalidCitations('факт [7].', 5), 'факт.');
    });
  });

  group('JSON от моделей', () {
    test('ограждения, хвостовые запятые, переводы строк в строках', () {
      final j = parseJsonLoose('Вот план:\n```json\n{"a": [1,2,], "b": "строка\nперенос",}\n```');
      expect(j['a'], [1, 2]);
      expect(j['b'], 'строка\nперенос');
    });
  });

  group('ГОСТ 7.1-2003', () {
    test('книга, статья, электронный ресурс, нормативный акт', () {
      final book = Source(id: 'b', type: SourceType.book, title: 'Финансовый анализ', authors: ['Иванов И. И.', 'Петров П. П.'], publisher: 'Юрайт', year: 2023, pageCount: 256);
      expect(Gost.format(book), 'Иванов, И. И. Финансовый анализ / И. И. Иванов, П. П. Петров. – Москва : Юрайт, 2023. – 256 с.');
      final art = Source(id: 'a', type: SourceType.article, title: 'Оборотный капитал', authors: ['Смирнов А. В.'], container: 'Вестник экономики', year: 2024, issue: '3', pages: '10-20');
      expect(Gost.format(art), 'Смирнов, А. В. Оборотный капитал / А. В. Смирнов // Вестник экономики. – 2024. – № 3. – С. 10–20.');
      final cl = Source(id: 'c', type: SourceType.article, title: 'Статья', authors: ['Кузнецова Е. П.'], container: 'Журнал', year: 2022, url: 'https://cyberleninka.ru/article/n/x', origin: SourceOrigin.cyberLeninka, accessed: DateTime(2026, 9, 27));
      expect(Gost.format(cl), contains('[Электронный ресурс]'));
      expect(Gost.format(cl), contains('Режим доступа: https://cyberleninka.ru/article/n/x (дата обращения: 27.09.2026)'));
      final law = Source(id: 'n', type: SourceType.normative, title: 'О бухгалтерском учете', docKind: 'Федеральный закон', docDate: '06.12.2011', docNumber: '402-ФЗ');
      expect(Gost.format(law), 'О бухгалтерском учете : федер. закон от 06.12.2011 № 402-ФЗ.');
      final many = Source(id: 'm', type: SourceType.book, title: 'Менеджмент', authors: ['Андреев А. А.', 'Борисов Б. Б.', 'Власов В. В.', 'Григорьев Г. Г.'], publisher: 'Питер', year: 2021);
      expect(Gost.format(many), startsWith('Менеджмент / '));
      expect(Gost.format(many), contains('[и др.]'));
      expect(Gost.format(many), contains('Санкт-Петербург : Питер'));
    });

    test('алфавитный порядок: сначала кириллица', () {
      final list = [
        Source(id: '1', type: SourceType.book, title: 'Zeta', authors: ['Smith J.']),
        Source(id: '2', type: SourceType.book, title: 'Бета', authors: ['Яковлев Я. Я.']),
        Source(id: '3', type: SourceType.book, title: 'Альфа', authors: ['Андреев А. А.']),
      ];
      expect(Gost.ordered(list).map((e) => e.id).toList(), ['3', '2', '1']);
    });
  });

  group('ФИО', () {
    test('разные записи', () {
      expect(parsePersonName('Иванов Иван Иванович').surnameInitials, 'Иванов И. И.');
      expect(parsePersonName('Иван Иванович Иванов').surnameInitials, 'Иванов И. И.');
      expect(parsePersonName('И.И. Иванов').surnameInitials, 'Иванов И. И.');
      expect(parsePersonName('Smith, John').surnameInitials, 'Smith J.');
      expect(isFemaleName('Иванова Анна Сергеевна'), isTrue);
      expect(isFemaleName('Петров Пётр Петрович'), isFalse);
    });
  });

  group('Регламент', () {
    test('заголовки без точки, но с сокращениями', () {
      expect(Reg.cleanHeading('Глава 1. Теоретические основы.'), 'Теоретические основы');
      expect(Reg.cleanHeading('Анализ за 2023–2025 гг.'), 'Анализ за 2023–2025 гг.');
      expect(Reg.chapterHeading(2, 'анализ показателей.'), 'ГЛАВА 2. АНАЛИЗ ПОКАЗАТЕЛЕЙ');
      expect(Reg.marginLeftTw, 1701);
      expect(Reg.marginRightTw, 567);
      expect(Reg.marginTopTw, 1134);
      expect(Reg.contentWidthTw, 9638);
      expect(Reg.academicYear(DateTime(2026, 9, 27)), '2026-2027');
      expect(Reg.academicYear(DateTime(2027, 3, 1)), '2026-2027');
    });

    test('объём под 15–30 страниц', () {
      final o = GenOptions(targetPages: 25);
      final b = Budget.compute(o);
      expect(b.chapterWords.length, 2);
      expect(b.introWords, inInclusiveRange(500, 650));
      expect(b.chapterWords.reduce((a, c) => a + c), greaterThan(2500));
      expect(Budget.compute(GenOptions(chapters: 3)).chapterWords.length, 3);
    });
  });

  group('Кодировки страниц', () {
    test('windows-1251 и koi8-r', () {
      expect(Net.decodeCp1251(latin1.encode('Ïðèâåò')), 'Привет');
      expect(Net.decodeKoi8r([0xF0, 0xD2, 0xC9, 0xD7, 0xC5, 0xD4]), 'Привет');
    });
  });

  group('Парсеры баз литературы', () {
    test('OpenAlex', () {
      final j = {
        'results': [
          {
            'display_name': 'Управление оборотным капиталом предприятия',
            'publication_year': 2023,
            'type': 'article',
            'doi': 'https://doi.org/10.1/abc',
            'authorships': [
              {'author': {'display_name': 'Иван Иванович Иванов'}}
            ],
            'primary_location': {'source': {'display_name': 'Вестник экономики', 'host_organization_name': 'Издательство'}},
            'biblio': {'volume': '5', 'issue': '2', 'first_page': '10', 'last_page': '18'},
            'abstract_inverted_index': {'Статья': [0], 'посвящена': [1], 'капиталу': [2]},
          }
        ]
      };
      final s = OpenAlexApi.parse(j).single;
      expect(s.authors.single, 'Иванов И. И.');
      expect(s.pages, '10–18');
      expect(s.doi, '10.1/abc');
      expect(s.annotation, 'Статья посвящена капиталу');
    });

    test('Crossref, КиберЛенинка, Google Книги', () {
      final cr = CrossrefApi.parse({
        'message': {
          'items': [
            {
              'title': ['Анализ ликвидности'],
              'author': [
                {'family': 'Петров', 'given': 'Пётр Петрович'}
              ],
              'issued': {
                'date-parts': [
                  [2022, 5]
                ]
              },
              'container-title': ['Экономика и управление'],
              'page': '45-52',
              'DOI': '10.2/x',
            }
          ]
        }
      }).single;
      expect(cr.year, 2022);
      expect(cr.authors.single, 'Петров П. П.');
      final cl = CyberLeninkaApi.parse({
        'articles': [
          {'name': 'Оборотные <b>активы</b> организации', 'authors': ['Смирнова Анна Викторовна'], 'year': 2021, 'journal': 'Молодой учёный', 'link': '/article/n/oborotnye'}
        ]
      }).single;
      expect(cl.title, 'Оборотные активы организации');
      expect(cl.url, 'https://cyberleninka.ru/article/n/oborotnye');
      final gb = GoogleBooksApi.parse({
        'items': [
          {
            'volumeInfo': {'title': 'Финансовый менеджмент', 'authors': ['Ковалёв В. В.'], 'publisher': 'Проспект', 'publishedDate': '2020-03-01', 'pageCount': 1104}
          }
        ]
      }).single;
      expect(gb.year, 2020);
      expect(Gost.format(gb), contains('Москва : Проспект, 2020. – 1104 с.'));
    });

    test('фильтр учебников и энциклопедий', () {
      expect(isForbiddenSource(Source(id: 'x', type: SourceType.book, title: 'Экономика организации : учебник для СПО')), isTrue);
      expect(isForbiddenSource(Source(id: 'y', type: SourceType.book, title: 'Большая экономическая энциклопедия')), isTrue);
      expect(isForbiddenSource(Source(id: 'z', type: SourceType.article, title: 'Оценка эффективности управления запасами')), isFalse);
    });

    test('DuckDuckGo HTML', () {
      const html = '<div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Frosstat.gov.ru%2Ffolder%2F1&rut=x">Росстат</a>'
          '<a class="result__snippet">Статистика 2025</a></div><div class="result result--ad"><a class="result__a" href="https://ads">Реклама</a></div>';
      final r = WebSearch.parseDuckDuckGo(html);
      expect(r.single.url, 'https://rosstat.gov.ru/folder/1');
      expect(r.single.snippet, 'Статистика 2025');
      expect(isReputableHost(r.single.host), isTrue);
    });

    test('ядро темы и запросы', () {
      expect(SourceFinder.topicCore('Анализ эффективности использования оборотных активов на примере ООО «Ромашка»'), 'эффективности использования оборотных активов');
      final cw = sampleCoursework();
      final q = SourceFinder.buildQueries(cw);
      expect(q, isNotEmpty);
      expect(q.first, isNot(contains('Ромашка')));
    });
  });

  group('План от ИИ', () {
    test('исправление ролей глав, таблиц и приложений', () {
      final o = GenOptions(chapters: 2, appendixCount: 2, maxTables: 2);
      final p = Generator.parsePlan({
        'object': 'оборотные активы',
        'chapters': [
          {'title': 'Глава 1. Теоретические основы.', 'role': 'practice', 'points': ['a', 'b', 'c'], 'tables': ['Т1', 'Т2']},
          {'title': 'Анализ показателей', 'role': 'theory', 'points': ['a', 'b', 'c'], 'tables': ['Т3', 'Т4']},
          {'title': 'Лишняя глава', 'role': 'practice'},
        ],
        'appendices': [
          {'title': 'Баланс.', 'content': 'таблица', 'chapter': 5}
        ],
      }, o);
      expect(p.chapters.length, 2);
      expect(p.chapters[0].title, 'Теоретические основы');
      expect(p.chapters[0].role, 'theory');
      expect(p.chapters[1].role, 'practice');
      expect(p.chapters.fold<int>(0, (a, c) => a + c.tables.length), 2);
      expect(p.chapters[1].tables.length, 2, reason: 'таблицы — в первую очередь в практической главе');
      expect(p.appendices.length, 2);
      expect(p.appendices.first.chapter, 2);
    });
  });

  group('Клиент ИИ', () {
    AiClient client(http.Client Function() mock, {String provider = 'openrouter', String model = ''}) {
      final s = AiSettings(provider: provider, models: {if (model.isNotEmpty) provider: model});
      return AiClient(settings: s, readSecret: (n) async => n.startsWith('ai_key_') ? 'test-key' : '', clientFactory: (_) => mock());
    }

    test('автоподбор бесплатной модели и проверка подключения', () async {
      final mock = MockClient((req) async {
        if (req.url.path.endsWith('/models')) {
          expect(req.headers['Authorization'], 'Bearer test-key');
          return http.Response(jsonEncode({'data': [{'id': 'meta-llama/llama-3.3-70b-instruct:free'}, {'id': 'deepseek/deepseek-chat-v3-0324:free'}, {'id': 'openai/gpt-4o'}, {'id': 'x/embed-large:free'}]}), 200);
        }
        final body = jsonDecode(req.body) as Map;
        expect(body['model'], 'deepseek/deepseek-chat-v3-0324:free');
        return http.Response(jsonEncode({'choices': [{'message': {'content': 'Москва'}, 'finish_reason': 'stop'}]}), 200, headers: {'content-type': 'application/json; charset=utf-8'});
      });
      final ai = client(() => mock);
      final r = await ai.ping('openrouter');
      expect(r.ok, isTrue, reason: r.message);
      expect(r.message, contains('Подключено успешно'));
      expect(ai.settings.models['openrouter'], 'deepseek/deepseek-chat-v3-0324:free');
    });

    test('ошибка авторизации', () async {
      final mock = MockClient((req) async => http.Response(jsonEncode({'error': {'message': 'Invalid API key'}}), 401));
      final r = await client(() => mock, model: 'm').ping('openrouter');
      expect(r.ok, isFalse);
      expect(r.message, contains('Ошибка авторизации'));
    });

    test('потоковый ответ (SSE)', () async {
      final mock = MockClient.streaming((req, body) async {
        final chunks = [
          'data: {"choices":[{"delta":{"content":"Прив"}}]}\n\n',
          ': keep-alive\n\n',
          'data: {"choices":[{"delta":{"content":"ет, мир"},"finish_reason":"stop"}]}\n\n',
          'data: [DONE]\n\n',
        ];
        return http.StreamedResponse(Stream.fromIterable(chunks.map(utf8.encode)), 200, headers: {'content-type': 'text/event-stream'});
      });
      final ai = client(() => mock, model: 'm');
      final deltas = <String>[];
      final r = await ai.chatFull([const ChatMessage.user('hi')], onDelta: deltas.add);
      expect(r.text, 'Привет, мир');
      expect(deltas.join(), 'Привет, мир');
    });

    test('повтор при 429 и смена модели', () async {
      var calls = 0;
      final mock = MockClient((req) async {
        if (req.url.path.endsWith('/models')) {
          return http.Response(jsonEncode({'data': [{'id': 'a:free'}, {'id': 'b:free'}]}), 200);
        }
        calls++;
        final model = (jsonDecode(req.body) as Map)['model'];
        if (model == 'a:free') return http.Response('{"error":{"message":"rate limited"}}', 429, headers: {'retry-after': '1'});
        return http.Response(jsonEncode({'choices': [{'message': {'content': 'ok от $model'}}]}), 200, headers: {'content-type': 'application/json; charset=utf-8'});
      });
      final ai = client(() => mock, model: 'a:free');
      final statuses = <String>[];
      final t = await ai.chat([const ChatMessage.user('x')], onStatus: statuses.add);
      expect(t, 'ok от b:free');
      expect(calls, greaterThanOrEqualTo(2));
      expect(statuses.any((s) => s.contains('Переключаюсь')), isTrue);
    }, timeout: const Timeout(Duration(minutes: 2)));

    test('ранжирование моделей Gemini', () {
      final p = providerById('gemini')!;
      final r = AiClient.rankModels(p, ['gemini-2.0-flash', 'gemini-2.5-flash-image', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-flash']);
      expect(r.first, 'gemini-3-flash');
    });
  });

  group('Проверка по регламенту', () {
    test('полная работа без критичных нарушений; пустая — с нарушениями', () {
      final cw = sampleCoursework();
      final r = QaChecker.check(cw);
      final fails = r.items.where((i) => i.level == CheckLevel.fail).map((i) => i.id).toList();
      expect(fails, isEmpty, reason: fails.join(', '));
      final empty = Coursework(id: 'e');
      final r2 = QaChecker.check(empty);
      expect(r2.fails, greaterThan(3));
      expect(r2.grade, 'неудовлетворительно');
    });

    test('автоисправления: точки в заголовках, ссылки на таблицы и приложения', () {
      final cw = sampleCoursework();
      cw.chapters.first.title = 'Теоретические основы.';
      cw.chapters.last.text = cw.chapters.last.text.replaceAll('Динамика показателей представлена в таблице 1.', 'Показатели ниже.');
      for (final c in cw.chapters) {
        c.text = c.text.replaceAll(RegExp(r'приложени[еияю]\s+\d'), '');
      }
      var r = QaChecker.check(cw);
      expect(r.items.firstWhere((i) => i.id == 'headings').level, CheckLevel.warn);
      expect(r.items.firstWhere((i) => i.id == 'tables_refs').level, CheckLevel.warn);
      QaChecker.applyFix('headings', cw);
      QaChecker.applyFix('table_refs', cw);
      QaChecker.applyFix('appendix_refs', cw);
      r = QaChecker.check(cw);
      expect(r.items.firstWhere((i) => i.id == 'headings').level, CheckLevel.ok);
      expect(r.items.firstWhere((i) => i.id == 'tables_refs').level, CheckLevel.ok);
      expect(r.items.firstWhere((i) => i.id == 'appendix_refs').level, CheckLevel.ok);
    });

    test('перенумерация ссылок после изменения списка литературы', () {
      final cw = sampleCoursework();
      final before = Gost.ordered(cw.sources);
      final first = before.first;
      cw.chapters.first.text = 'Факт [1]. Другой факт [2, с. 5].';
      first.selected = false;
      QaChecker.renumberAfterSourceChange(cw, before);
      expect(cw.chapters.first.text, 'Факт. Другой факт [1, с. 5].');
    });
  });

  group('Типографика', () {
    test('кавычки, тире, неразрывные пробелы', () {
      expect(typography('Он сказал "да" - и ушёл... См. с. 45 и № 3'), 'Он сказал «да» – и ушёл… См. с. 45 и № 3');
    });
  });
}
