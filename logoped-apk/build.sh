#!/usr/bin/env bash
# Сборка APK без Gradle: aapt2 -> javac -> d8 -> zipalign -> apksigner.
# Инструменты: пакеты Ubuntu/Debian `aapt apksigner zipalign android-sdk-platform-23`
# (или Android SDK: ANDROID_HOME) + R8 (скачивается автоматически).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/app"
OUT="$ROOT/build"
TOOLS="$ROOT/.tools"
VERSION_CODE="${VERSION_CODE:-$(cat "$ROOT/VERSION_CODE")}"
VERSION_NAME="${VERSION_NAME:-$(cat "$ROOT/VERSION_NAME")}"
APK_NAME="${APK_NAME:-Konstruktor-Zanyatiy-v${VERSION_NAME}.apk}"
R8_VERSION="${R8_VERSION:-8.5.35}"
KS="${KEYSTORE:-$ROOT/keystore/logoped.jks}"
KS_PASS="${KEYSTORE_PASS:-logoped2026}"
KS_ALIAS="${KEYSTORE_ALIAS:-logoped}"

find_tool() { # $1 name
  local t
  if [ -n "${ANDROID_HOME:-}" ] && [ -d "$ANDROID_HOME/build-tools" ]; then
    t="$(ls -d "$ANDROID_HOME"/build-tools/*/ 2>/dev/null | sort -V | tail -1)$1"
    [ -x "$t" ] && { echo "$t"; return; }
  fi
  command -v "$1" || { echo "Не найден инструмент: $1" >&2; exit 1; }
}

AAPT2="${AAPT2:-$(find_tool aapt2)}"
ZIPALIGN="${ZIPALIGN:-$(find_tool zipalign)}"
APKSIGNER="${APKSIGNER:-$(find_tool apksigner)}"

if [ -z "${ANDROID_JAR:-}" ]; then
  for c in /usr/lib/android-sdk/platforms/android-23/android.jar \
           "${ANDROID_HOME:-/nonexistent}"/platforms/android-*/android.jar; do
    [ -f "$c" ] && { ANDROID_JAR="$c"; break; }
  done
fi
[ -f "${ANDROID_JAR:-}" ] || { echo "Не найден android.jar (apt install android-sdk-platform-23)" >&2; exit 1; }

mkdir -p "$TOOLS"
R8_JAR="${R8_JAR:-$TOOLS/r8-$R8_VERSION.jar}"
if [ ! -f "$R8_JAR" ]; then
  echo "» Скачиваю R8 $R8_VERSION"
  curl -fsSL -o "$R8_JAR.tmp" "https://storage.googleapis.com/r8-releases/raw/$R8_VERSION/r8lib.jar"
  mv "$R8_JAR.tmp" "$R8_JAR"
fi

echo "» aapt2: $AAPT2"
echo "» android.jar: $ANDROID_JAR"
rm -rf "$OUT"
mkdir -p "$OUT/flat" "$OUT/gen" "$OUT/classes" "$OUT/dex"

echo "» Ресурсы"
"$AAPT2" compile --dir "$APP/res" -o "$OUT/flat/res.zip"
"$AAPT2" link -o "$OUT/base.apk" \
  -I "$ANDROID_JAR" \
  --manifest "$APP/AndroidManifest.xml" \
  -A "$APP/assets" \
  --java "$OUT/gen" \
  --min-sdk-version 23 --target-sdk-version 34 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  --no-compress-regex '\.(png|jpg|webp)$' \
  "$OUT/flat/res.zip"

echo "» Java"
find "$APP/java" "$OUT/gen" -name '*.java' > "$OUT/sources.txt"
javac -nowarn -encoding UTF-8 -source 8 -target 8 -Xlint:-options \
  -bootclasspath "$ANDROID_JAR" -classpath "$ANDROID_JAR" \
  -d "$OUT/classes" @"$OUT/sources.txt"

echo "» DEX"
find "$OUT/classes" -name '*.class' > "$OUT/classes.txt"
java -cp "$R8_JAR" com.android.tools.r8.D8 --release --min-api 23 \
  --lib "$ANDROID_JAR" --output "$OUT/dex" @"$OUT/classes.txt"

echo "» Упаковка"
cp "$OUT/base.apk" "$OUT/unsigned.apk"
(cd "$OUT/dex" && zip -q -X "$OUT/unsigned.apk" classes.dex)
"$ZIPALIGN" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

echo "» Подпись"
"$APKSIGNER" sign --ks "$KS" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --ks-key-alias "$KS_ALIAS" --out "$OUT/$APK_NAME" "$OUT/aligned.apk"
"$APKSIGNER" verify "$OUT/$APK_NAME"

mkdir -p "$ROOT/dist"
cp "$OUT/$APK_NAME" "$ROOT/dist/$APK_NAME"
echo "✔ Готово: dist/$APK_NAME ($(du -h "$ROOT/dist/$APK_NAME" | cut -f1))"
