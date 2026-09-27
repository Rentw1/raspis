import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../state/app_state.dart';

/// Индикатор состояния: серый — не проверено, жёлтый — проверка, зелёный — ОК, красный — ошибка.
class StatusDot extends StatelessWidget {
  const StatusDot(this.state, {super.key, this.size = 14});
  final ConnState state;
  final double size;

  static Color colorOf(ConnState s, ColorScheme cs) => switch (s) {
        ConnState.ok => const Color(0xFF2E7D32),
        ConnState.error => const Color(0xFFC62828),
        ConnState.checking => const Color(0xFFF9A825),
        ConnState.unknown => cs.outline,
      };

  @override
  Widget build(BuildContext context) {
    final c = colorOf(state, Theme.of(context).colorScheme);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: c, shape: BoxShape.circle, boxShadow: [BoxShadow(color: c.withValues(alpha: 0.35), blurRadius: 6)]),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.subtitle});
  final String text;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 18, 4, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(text, style: t.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          if (subtitle != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(subtitle!, style: t.bodySmall)),
        ],
      ),
    );
  }
}

enum BannerKind { info, success, warning, error }

class InfoBanner extends StatelessWidget {
  const InfoBanner(this.text, {super.key, this.kind = BannerKind.info, this.action, this.icon});
  final String text;
  final BannerKind kind;
  final Widget? action;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final (bg, fg, ic) = switch (kind) {
      BannerKind.info => (cs.secondaryContainer, cs.onSecondaryContainer, Icons.info_outline),
      BannerKind.success => (const Color(0xFFE3F4E5), const Color(0xFF1B5E20), Icons.check_circle_outline),
      BannerKind.warning => (const Color(0xFFFFF4D6), const Color(0xFF6D4C00), Icons.warning_amber_rounded),
      BannerKind.error => (cs.errorContainer, cs.onErrorContainer, Icons.error_outline),
    };
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon ?? ic, color: fg, size: 20),
          const SizedBox(width: 10),
          Expanded(child: SelectableText(text, style: TextStyle(color: fg, height: 1.3))),
          if (action != null) ...[const SizedBox(width: 8), action!],
        ],
      ),
    );
  }
}

Future<bool> confirm(BuildContext context, String title, String text, {String ok = 'Да', bool danger = false}) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text(title),
      content: Text(text),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Отмена')),
        FilledButton(
          style: danger ? FilledButton.styleFrom(backgroundColor: Theme.of(c).colorScheme.error) : null,
          onPressed: () => Navigator.pop(c, true),
          child: Text(ok),
        ),
      ],
    ),
  );
  return r ?? false;
}

void snack(BuildContext context, String text, {SnackBarAction? action, Duration duration = const Duration(seconds: 4)}) {
  final m = ScaffoldMessenger.maybeOf(context);
  if (m == null) return;
  m.hideCurrentSnackBar();
  m.showSnackBar(SnackBar(content: Text(text), action: action, duration: duration, behavior: SnackBarBehavior.floating));
}

Future<void> openLink(BuildContext context, String url) async {
  final uri = Uri.tryParse(url);
  if (uri == null) return;
  final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) snack(context, 'Не удалось открыть ссылку: $url');
}

/// Поле ввода секрета (ключа) с кнопками «показать» и «вставить».
class SecretField extends StatefulWidget {
  const SecretField({super.key, required this.label, required this.initial, required this.onChanged, this.hint});
  final String label;
  final String initial;
  final String? hint;
  final ValueChanged<String> onChanged;

  @override
  State<SecretField> createState() => _SecretFieldState();
}

class _SecretFieldState extends State<SecretField> {
  late final TextEditingController _c = TextEditingController(text: widget.initial);
  bool _show = false;

  @override
  void didUpdateWidget(covariant SecretField old) {
    super.didUpdateWidget(old);
    if (old.initial != widget.initial && _c.text != widget.initial) _c.text = widget.initial;
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _c,
      obscureText: !_show,
      autocorrect: false,
      enableSuggestions: false,
      keyboardType: TextInputType.visiblePassword,
      decoration: InputDecoration(
        labelText: widget.label,
        hintText: widget.hint,
        border: const OutlineInputBorder(),
        suffixIcon: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              tooltip: 'Вставить из буфера',
              icon: const Icon(Icons.content_paste),
              onPressed: () async {
                final d = await Clipboard.getData(Clipboard.kTextPlain);
                final t = (d?.text ?? '').trim();
                if (t.isEmpty) return;
                _c.text = t;
                widget.onChanged(t);
              },
            ),
            IconButton(
              tooltip: _show ? 'Скрыть' : 'Показать',
              icon: Icon(_show ? Icons.visibility_off : Icons.visibility),
              onPressed: () => setState(() => _show = !_show),
            ),
          ],
        ),
      ),
      onChanged: (v) => widget.onChanged(v.trim()),
    );
  }
}

/// Текстовое поле, синхронизированное со значением модели.
class ModelTextField extends StatefulWidget {
  const ModelTextField({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    this.hint,
    this.maxLines = 1,
    this.minLines,
    this.keyboardType,
    this.helper,
    this.required = false,
  });

  final String label;
  final String value;
  final ValueChanged<String> onChanged;
  final String? hint;
  final String? helper;
  final int? maxLines;
  final int? minLines;
  final TextInputType? keyboardType;
  final bool required;

  @override
  State<ModelTextField> createState() => _ModelTextFieldState();
}

class _ModelTextFieldState extends State<ModelTextField> {
  late final TextEditingController _c = TextEditingController(text: widget.value);

  @override
  void didUpdateWidget(covariant ModelTextField old) {
    super.didUpdateWidget(old);
    if (widget.value != _c.text && widget.value != old.value) _c.text = widget.value;
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final empty = widget.required && _c.text.trim().isEmpty;
    return TextField(
      controller: _c,
      maxLines: widget.maxLines,
      minLines: widget.minLines,
      keyboardType: widget.keyboardType ?? (widget.maxLines == 1 ? TextInputType.text : TextInputType.multiline),
      textCapitalization: TextCapitalization.sentences,
      decoration: InputDecoration(
        labelText: widget.label + (widget.required ? ' *' : ''),
        hintText: widget.hint,
        helperText: widget.helper,
        helperMaxLines: 4,
        errorText: empty ? 'Обязательное поле' : null,
        border: const OutlineInputBorder(),
        alignLabelWithHint: widget.maxLines != 1,
      ),
      onChanged: (v) {
        widget.onChanged(v);
        if (widget.required) setState(() {});
      },
    );
  }
}

/// Поле с подсказками из списка и свободным вводом.
class SuggestField extends StatelessWidget {
  const SuggestField({super.key, required this.label, required this.value, required this.options, required this.onChanged, this.hint, this.required = false});

  final String label;
  final String value;
  final List<String> options;
  final ValueChanged<String> onChanged;
  final String? hint;
  final bool required;

  @override
  Widget build(BuildContext context) {
    return Autocomplete<String>(
      initialValue: TextEditingValue(text: value),
      optionsBuilder: (v) {
        final q = v.text.toLowerCase().trim();
        if (q.isEmpty) return options;
        return options.where((o) => o.toLowerCase().contains(q));
      },
      onSelected: onChanged,
      fieldViewBuilder: (context, controller, focus, onSubmit) => TextField(
        controller: controller,
        focusNode: focus,
        maxLines: null,
        textCapitalization: TextCapitalization.sentences,
        decoration: InputDecoration(
          labelText: label + (required ? ' *' : ''),
          hintText: hint,
          border: const OutlineInputBorder(),
          suffixIcon: const Icon(Icons.arrow_drop_down),
        ),
        onChanged: onChanged,
      ),
    );
  }
}

class Gap extends StatelessWidget {
  const Gap([this.size = 12, Key? key]) : super(key: key);
  final double size;
  @override
  Widget build(BuildContext context) => SizedBox(height: size, width: size);
}
