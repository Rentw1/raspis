import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../ai/ai_client.dart';
import '../ai/providers.dart';
import '../core/regulation.dart';
import '../models/settings.dart';
import '../search/source_finder.dart';
import '../state/app_state.dart';
import 'widgets.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key, this.initialTab = 0});
  final int initialTab;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      initialIndex: widget.initialTab,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Настройки'),
          bottom: const TabBar(tabs: [Tab(text: 'Нейросеть'), Tab(text: 'Интернет'), Tab(text: 'Учреждение')]),
        ),
        body: const TabBarView(children: [_AiTab(), _InternetTab(), _InstitutionTab()]),
      ),
    );
  }
}

// ======================= Нейросеть =======================

class _AiTab extends StatefulWidget {
  const _AiTab();

  @override
  State<_AiTab> createState() => _AiTabState();
}

class _AiTabState extends State<_AiTab> {
  String _key = '';
  bool _loaded = false;
  bool _hasCert = false;
  String _loadedFor = '';

  Future<void> _loadKey(AppState s) async {
    final id = s.settings.ai.provider;
    if (_loadedFor == id && _loaded) return;
    _loadedFor = id;
    final k = id.isEmpty ? '' : await s.readAiKey(id);
    final cert = await s.storage.readSecret(AiClient.gigachatCertName);
    if (!mounted) return;
    setState(() {
      _key = k;
      _hasCert = cert.isNotEmpty;
      _loaded = true;
    });
  }

  Future<void> _pickCert(AppState s) async {
    try {
      final f = await FilePicker.pickFile(dialogTitle: 'Сертификат Russian Trusted Root CA (.cer, .crt, .pem)');
      if (f == null) return;
      final bytes = await f.xFile.readAsBytes();
      String pem;
      final asText = utf8.decode(bytes, allowMalformed: true);
      if (asText.contains('-----BEGIN CERTIFICATE-----')) {
        pem = asText;
      } else {
        final b64 = base64.encode(bytes);
        final lines = <String>[];
        for (var i = 0; i < b64.length; i += 64) {
          lines.add(b64.substring(i, i + 64 > b64.length ? b64.length : i + 64));
        }
        pem = '-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----\n';
      }
      final old = await s.storage.readSecret(AiClient.gigachatCertName);
      final merged = old.contains(pem.trim()) ? old : '$old\n$pem'.trim();
      await s.storage.writeSecret(AiClient.gigachatCertName, merged);
      s.ai.resetSession();
      if (!mounted) return;
      setState(() => _hasCert = true);
      snack(context, 'Сертификат добавлен (${f.name}).');
    } catch (e) {
      if (mounted) snack(context, 'Не удалось прочитать сертификат: $e');
    }
  }

  Future<void> _pickModel(AppState s, AiProvider p) async {
    List<String> ids;
    try {
      snack(context, 'Загружаю список моделей…', duration: const Duration(seconds: 2));
      ids = await s.ai.listModels(p.id, refresh: true);
    } on AiException catch (e) {
      if (mounted) snack(context, e.message, duration: const Duration(seconds: 6));
      return;
    }
    if (!mounted) return;
    if (ids.isEmpty) {
      snack(context, 'Сервис не вернул список моделей. Укажите модель вручную.');
      return;
    }
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (c) => _ModelPicker(ids: ids, title: 'Модели ${p.name}${p.freeSuffix != null ? ' (бесплатные)' : ''}'),
    );
    if (picked == null) return;
    s.settings.ai.models[p.id] = picked;
    s.ai.resetSession();
    await s.saveSettings();
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final ai = s.settings.ai;
    final p = providerById(ai.provider);
    if (!_loaded || _loadedFor != ai.provider) _loadKey(s);
    final cs = Theme.of(context).colorScheme;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        const InfoBanner(
          'Текст курсовой пишет бесплатная нейросеть. Выберите сервис, получите бесплатный ключ, вставьте его и нажмите «Проверить подключение». '
          'Ключ хранится только на этом телефоне (в защищённом хранилище) и отправляется только выбранному сервису.',
        ),
        const Gap(8),
        DropdownButtonFormField<String>(
          initialValue: p?.id,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Сервис ИИ (все с бесплатным доступом)', border: OutlineInputBorder()),
          items: [
            for (final x in aiProviders)
              DropdownMenuItem(
                value: x.id,
                child: Text('${x.name}${x.russia == RussiaAccess.works ? '  · РФ без VPN' : ''}', overflow: TextOverflow.ellipsis),
              ),
          ],
          onChanged: (v) async {
            if (v == null) return;
            ai.provider = v;
            s.ai.resetSession();
            s.aiState = ConnState.unknown;
            s.aiMessage = '';
            _loaded = false;
            await s.saveSettings();
            await s.refreshAiReady();
          },
        ),
        if (p != null) ...[
          const Gap(10),
          Card(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(p.about),
                  if (p.russia.label.isNotEmpty) ...[
                    const Gap(6),
                    Row(children: [
                      Icon(p.russia == RussiaAccess.works ? Icons.check_circle : Icons.vpn_lock, size: 18, color: p.russia == RussiaAccess.works ? const Color(0xFF2E7D32) : cs.tertiary),
                      const SizedBox(width: 6),
                      Expanded(child: Text(p.russia.label, style: Theme.of(context).textTheme.bodySmall)),
                    ]),
                  ],
                  if (p.steps.isNotEmpty) ...[
                    const Gap(10),
                    Text('Как получить ключ:', style: Theme.of(context).textTheme.labelLarge),
                    const Gap(4),
                    for (var i = 0; i < p.steps.length; i++)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 2),
                        child: Text('${i + 1}. ${p.steps[i]}', style: Theme.of(context).textTheme.bodySmall),
                      ),
                  ],
                  if (p.keyUrl.isNotEmpty) ...[
                    const Gap(10),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.tonalIcon(
                        icon: const Icon(Icons.vpn_key_outlined),
                        label: Text('Получить бесплатный ключ: ${Uri.parse(p.keyUrl).host}'),
                        onPressed: () => openLink(context, p.keyUrl),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const Gap(12),
          if (p.id == 'custom') ...[
            ModelTextField(
              label: 'Адрес OpenAI-совместимого API',
              hint: 'https://адрес-сервера/v1',
              value: ai.customBase,
              keyboardType: TextInputType.url,
              onChanged: (v) {
                ai.customBase = v.trim();
                s.ai.resetSession();
                s.saveSettings();
                s.refreshAiReady();
              },
            ),
            const Gap(12),
          ],
          SecretField(
            key: ValueKey('key_${p.id}_$_loaded'),
            label: p.auth == AuthScheme.gigachat ? 'Ключ авторизации GigaChat' : 'Ключ API ${p.name}',
            hint: p.keyHint,
            initial: _key,
            onChanged: (v) {
              _key = v;
              s.writeAiKey(p.id, v);
            },
          ),
          if (p.auth == AuthScheme.gigachat) ...[
            const Gap(10),
            InfoBanner(
              _hasCert
                  ? 'Сертификат НУЦ Минцифры загружен — защищённое соединение с GigaChat будет проверяться по нему.'
                  : 'Для GigaChat нужен сертификат «Russian Trusted Root CA». Скачайте его на gosuslugi.ru/crt и выберите файл кнопкой ниже.',
              kind: _hasCert ? BannerKind.success : BannerKind.warning,
            ),
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(icon: const Icon(Icons.download), label: const Text('gosuslugi.ru/crt'), onPressed: () => openLink(context, 'https://www.gosuslugi.ru/crt')),
              ),
              const SizedBox(width: 8),
              Expanded(child: FilledButton.tonalIcon(icon: const Icon(Icons.file_open), label: const Text('Выбрать файл'), onPressed: () => _pickCert(s))),
            ]),
            const Gap(10),
            DropdownButtonFormField<String>(
              initialValue: ai.gigachatScope,
              decoration: const InputDecoration(labelText: 'Тип доступа GigaChat', border: OutlineInputBorder()),
              items: const [
                DropdownMenuItem(value: 'GIGACHAT_API_PERS', child: Text('Физическое лицо (PERS)')),
                DropdownMenuItem(value: 'GIGACHAT_API_B2B', child: Text('ИП / юрлицо, предоплата (B2B)')),
                DropdownMenuItem(value: 'GIGACHAT_API_CORP', child: Text('ИП / юрлицо, постоплата (CORP)')),
              ],
              onChanged: (v) {
                ai.gigachatScope = v ?? 'GIGACHAT_API_PERS';
                s.ai.resetSession();
                s.saveSettings();
              },
            ),
          ],
          const Gap(12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: ModelTextField(
                  key: ValueKey('model_${p.id}_${ai.models[p.id]}'),
                  label: 'Модель (можно не указывать)',
                  hint: p.defaultModel.isNotEmpty ? p.defaultModel : 'подберётся автоматически',
                  value: ai.models[p.id] ?? '',
                  onChanged: (v) {
                    ai.models[p.id] = v.trim();
                    s.ai.resetSession();
                    s.saveSettings();
                  },
                ),
              ),
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: FilledButton.tonal(onPressed: () => _pickModel(s, p), child: const Text('Список')),
              ),
            ],
          ),
          const Gap(16),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: FilledButton.icon(
              icon: s.aiState == ConnState.checking
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                  : const Icon(Icons.wifi_tethering),
              label: const Text('Проверить подключение'),
              onPressed: s.aiState == ConnState.checking ? null : () => s.pingAi(),
            ),
          ),
          const Gap(10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(padding: const EdgeInsets.only(top: 3), child: StatusDot(s.aiState, size: 16)),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  switch (s.aiState) {
                    ConnState.unknown => s.aiReady ? 'Ключ сохранён. Нажмите «Проверить подключение».' : 'Не подключено.',
                    _ => s.aiMessage,
                  },
                  style: TextStyle(
                    color: s.aiState == ConnState.error ? cs.error : (s.aiState == ConnState.ok ? const Color(0xFF2E7D32) : null),
                    fontWeight: s.aiState == ConnState.ok || s.aiState == ConnState.error ? FontWeight.w600 : null,
                  ),
                ),
              ),
            ],
          ),
          const SectionTitle('Надёжность'),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Менять модель при лимите или ошибке'),
            subtitle: const Text('Если бесплатная модель перегружена (429/5xx), взять другую бесплатную модель того же сервиса'),
            value: ai.autoSwitchModel,
            onChanged: (v) {
              ai.autoSwitchModel = v;
              s.saveSettings();
            },
          ),
          DropdownButtonFormField<String>(
            initialValue: ai.fallbackProvider.isEmpty ? '' : ai.fallbackProvider,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Запасной сервис (если основной отказал)', border: OutlineInputBorder()),
            items: [
              const DropdownMenuItem(value: '', child: Text('Нет')),
              for (final x in aiProviders.where((x) => x.id != p.id)) DropdownMenuItem(value: x.id, child: Text(x.name)),
            ],
            onChanged: (v) {
              ai.fallbackProvider = v ?? '';
              s.saveSettings();
            },
          ),
          const Gap(4),
          Text('Для запасного сервиса ключ вводится так же: выберите его выше, вставьте ключ, затем верните основной.',
              style: Theme.of(context).textTheme.bodySmall),
          if (p.id == 'gemini')
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Поиск Google через Gemini'),
              subtitle: const Text('Для практической главы: свежая статистика и факты из интернета со ссылками на сайты'),
              value: ai.useGeminiSearch,
              onChanged: (v) {
                ai.useGeminiSearch = v;
                s.saveSettings();
              },
            ),
        ],
      ],
    );
  }
}

class _ModelPicker extends StatefulWidget {
  const _ModelPicker({required this.ids, required this.title});
  final List<String> ids;
  final String title;

  @override
  State<_ModelPicker> createState() => _ModelPickerState();
}

class _ModelPickerState extends State<_ModelPicker> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final list = widget.ids.where((e) => e.toLowerCase().contains(_q.toLowerCase())).toList();
    return SizedBox(
      height: MediaQuery.of(context).size.height * 0.75,
      child: Column(
        children: [
          Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Text(widget.title, style: Theme.of(context).textTheme.titleMedium)),
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Поиск модели', border: OutlineInputBorder()),
              onChanged: (v) => setState(() => _q = v),
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: list.length,
              itemBuilder: (c, i) => ListTile(
                leading: i == 0 && _q.isEmpty ? const Icon(Icons.star, color: Colors.amber) : const Icon(Icons.memory),
                title: Text(list[i]),
                subtitle: i == 0 && _q.isEmpty ? const Text('рекомендуется') : null,
                onTap: () => Navigator.pop(context, list[i]),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ======================= Интернет =======================

class _InternetTab extends StatefulWidget {
  const _InternetTab();

  @override
  State<_InternetTab> createState() => _InternetTabState();
}

class _InternetTabState extends State<_InternetTab> {
  bool _testing = false;
  List<SourceTestResult> _results = const [];

  Future<void> _test(AppState s) async {
    setState(() {
      _testing = true;
      _results = const [];
    });
    final r = await s.finder(CancelToken()).testAll();
    if (!mounted) return;
    setState(() {
      _testing = false;
      _results = r;
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final se = s.settings.search;
    Widget sw(String title, String sub, bool v, ValueChanged<bool> on) => SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(title),
          subtitle: Text(sub),
          value: v,
          onChanged: (x) {
            on(x);
            s.saveSettings();
          },
        );
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        const InfoBanner(
          'Приложение берёт материал из интернета: реальные научные статьи и книги для списка литературы (с выходными данными по ГОСТ), '
          'статистику и факты для практической главы, реквизиты нормативных актов. Ключи для баз литературы не нужны.',
        ),
        const SectionTitle('Литература', subtitle: 'Только профильные книги и научные статьи (без учебников, энциклопедий и газет)'),
        sw('КиберЛенинка', 'Научные статьи на русском языке (cyberleninka.ru)', se.cyberLeninka, (v) => se.cyberLeninka = v),
        sw('OpenAlex', 'Мировая база научных публикаций с аннотациями', se.openAlex, (v) => se.openAlex = v),
        sw('Google Книги', 'Монографии и профильные книги: издательство, год, число страниц', se.googleBooks, (v) => se.googleBooks = v),
        sw('Crossref', 'Статьи журналов с DOI, номерами и страницами', se.crossref, (v) => se.crossref = v),
        sw('Только на русском языке', 'Отбрасывать иностранные публикации', se.onlyRussian, (v) => se.onlyRussian = v),
        const SectionTitle('Факты и статистика'),
        sw('Википедия (справочно)', 'Помогает ИИ точнее писать теорию; в список литературы не попадает', se.wikipedia, (v) => se.wikipedia = v),
        DropdownButtonFormField<WebEngine>(
          initialValue: se.engine,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Веб-поиск', border: OutlineInputBorder()),
          items: [for (final e in WebEngine.values) DropdownMenuItem(value: e, child: Text(e.label, overflow: TextOverflow.ellipsis))],
          onChanged: (v) async {
            if (v == null) return;
            await s.setWebEngine(v);
            if (mounted) setState(() {});
          },
        ),
        if (se.engine.needsKey) ...[
          const Gap(10),
          FutureBuilder<String>(
            future: s.storage.readSecret(AppState.webKeyName(se.engine)),
            builder: (c, snap) => SecretField(
              key: ValueKey('web_${se.engine.name}_${snap.connectionState}'),
              label: 'Ключ ${se.engine == WebEngine.tavily ? 'Tavily' : 'Brave Search'}',
              initial: snap.data ?? '',
              onChanged: (v) => s.writeWebKey(se.engine, v),
            ),
          ),
          const Gap(6),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              icon: const Icon(Icons.vpn_key_outlined),
              label: Text('Получить бесплатный ключ: ${Uri.parse(se.engine.keyUrl).host}'),
              onPressed: () => openLink(context, se.engine.keyUrl),
            ),
          ),
        ],
        if (se.engine == WebEngine.searxng) ...[
          const Gap(10),
          ModelTextField(
            label: 'Адрес SearXNG',
            hint: 'https://searx.example.org',
            value: se.searxngBase,
            keyboardType: TextInputType.url,
            onChanged: (v) {
              se.searxngBase = v.trim();
              s.saveSettings();
            },
          ),
        ],
        sw('Читать найденные страницы', 'Извлекать текст сайтов (статистика, документы) для фактов', se.readPages, (v) => se.readPages = v),
        const Gap(8),
        ModelTextField(
          label: 'E-mail для OpenAlex и Crossref (необязательно)',
          helper: 'Эти базы быстрее отвечают «вежливым» запросам с адресом почты. Адрес отправляется только им.',
          value: se.contactEmail,
          keyboardType: TextInputType.emailAddress,
          onChanged: (v) {
            se.contactEmail = v.trim();
            s.saveSettings();
          },
        ),
        const Gap(16),
        SizedBox(
          width: double.infinity,
          height: 50,
          child: FilledButton.icon(
            icon: _testing ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white)) : const Icon(Icons.travel_explore),
            label: const Text('Проверить источники'),
            onPressed: _testing ? null : () => _test(s),
          ),
        ),
        const Gap(8),
        for (final r in _results)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: StatusDot(r.ok ? ConnState.ok : ConnState.error),
            title: Text(r.name),
            subtitle: Text(r.message),
          ),
      ],
    );
  }
}

// ======================= Учреждение =======================

class _InstitutionTab extends StatelessWidget {
  const _InstitutionTab();

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final inst = s.settings.institution;
    void save() => s.saveSettings();
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        const InfoBanner('Реквизиты для титульного листа (ПРИЛОЖЕНИЕ 4) и верхнего колонтитула. Менять нужно, только если изменилось название.'),
        const Gap(8),
        ModelTextField(label: 'Министерство', value: inst.ministry, maxLines: 2, onChanged: (v) {
          inst.ministry = v;
          save();
        }),
        const Gap(12),
        ModelTextField(label: 'Учреждение, строка 1', value: inst.orgLine1, maxLines: 2, onChanged: (v) {
          inst.orgLine1 = v;
          save();
        }),
        const Gap(12),
        ModelTextField(label: 'Учреждение, строка 2', value: inst.orgLine2, onChanged: (v) {
          inst.orgLine2 = v;
          save();
        }),
        const Gap(12),
        ModelTextField(
          label: 'Верхний колонтитул (со 2-й страницы, заглавными буквами)',
          value: inst.headerText,
          onChanged: (v) {
            inst.headerText = v;
            save();
          },
        ),
        const Gap(8),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            icon: const Icon(Icons.restore),
            label: const Text('Вернуть значения регламента'),
            onPressed: () {
              s.settings.institution = InstitutionSettings();
              save();
            },
          ),
        ),
        const SectionTitle('Оформление по регламенту'),
        const _RegRow('Лист', 'А4, односторонняя печать'),
        const _RegRow('Объём', '15–30 страниц без приложений'),
        _RegRow('Поля', 'левое ${Reg.marginLeftMm.round()} мм, правое ${Reg.marginRightMm.round()} мм, верхнее ${Reg.marginTopMm.round()} мм, нижнее ${Reg.marginBottomMm.round()} мм'),
        const _RegRow('Шрифт', 'Times New Roman 14, выравнивание по ширине, абзацный отступ 1,25 см'),
        const _RegRow('Интервал', '1,5 в тексте; 1,0 в таблицах (кегль 12)'),
        const _RegRow('Заголовки', 'по центру, без точки, без подчёркивания и переносов; 2 интервала до текста; каждая часть с новой страницы'),
        const _RegRow('Колонтитулы', 'вверху — название техникума заглавными (со 2-й страницы); внизу по центру — номер страницы без точки; на титульном номер не ставится'),
        const _RegRow('Таблицы', '«Таблица N — Название» слева над таблицей; при переносе — «Продолжение таблицы N»'),
        const _RegRow('Приложения', 'каждое с новой страницы, «Приложение N» в правом верхнем углу, ниже — заголовок'),
        const _RegRow('Литература', 'по алфавиту, ГОСТ 7.1-2003; без учебников, энциклопедий и газет'),
      ],
    );
  }
}

class _RegRow extends StatelessWidget {
  const _RegRow(this.k, this.v);
  final String k;
  final String v;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 110, child: Text(k, style: const TextStyle(fontWeight: FontWeight.w600))),
          Expanded(child: Text(v)),
        ]),
      );
}
