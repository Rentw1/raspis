package ru.shatlyk.logoped;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.media.MediaScannerConnection;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Base64;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Оболочка приложения: WebView с локальными ресурсами (assets/www) и мостом к Android
 * для сохранения документов, отправки, печати и загрузки картинок из интернета.
 */
public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String START_URL = "https://" + HOST + "/index.html";
    static final String AUTHORITY = "ru.shatlyk.logoped.docs";
    /** Папка в «Загрузках» для готовых документов — по названию приложения */
    static final String FOLDER = "Конструктор занятий";
    private static final String TAG = "Logoped";
    private static final int REQ_FILE = 1001;
    private static final int REQ_PERM = 1002;
    private static final int MAX_DOWNLOAD = 12 * 1024 * 1024;

    private WebView web;
    private WebView printView;
    private ValueCallback<Uri[]> fileCallback;
    private final ExecutorService pool = Executors.newFixedThreadPool(4);
    private final Handler ui = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setTextZoom(100);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setMediaPlaybackRequiresUserGesture(true);
        web.setWebViewClient(new AssetClient());
        web.setWebChromeClient(new Chrome());
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.loadUrl(START_URL);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        pool.shutdownNow();
        if (web != null) {
            web.removeJavascriptInterface("AndroidBridge");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (web == null) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript("(window.__onBack && window.__onBack()) ? '1' : '0'", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String v) {
                if (!"\"1\"".equals(v)) finish();
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null) {
                ClipData clip = data.getClipData();
                if (clip != null && clip.getItemCount() > 0) {
                    result = new Uri[clip.getItemCount()];
                    for (int i = 0; i < clip.getItemCount(); i++) result[i] = clip.getItemAt(i).getUri();
                } else if (data.getData() != null) {
                    result = new Uri[]{data.getData()};
                }
            }
            if (fileCallback != null) fileCallback.onReceiveValue(result);
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    // ---------- локальные ресурсы ----------

    static String mimeOf(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        if (p.endsWith(".html") || p.endsWith(".htm")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".ttf")) return "font/ttf";
        if (p.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (p.endsWith(".pdf")) return "application/pdf";
        return "application/octet-stream";
    }

    WebResourceResponse serveAsset(String path) {
        if (path == null || path.length() == 0 || "/".equals(path)) path = "/index.html";
        Map<String, String> headers = new HashMap<String, String>();
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Cache-Control", "no-cache");
        if (path.contains("..")) {
            return new WebResourceResponse("text/plain", "utf-8", 403, "Forbidden", headers, new ByteArrayInputStream(new byte[0]));
        }
        try {
            InputStream in = getAssets().open("www" + path);
            String mime = mimeOf(path);
            boolean text = mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") || mime.contains("svg");
            return new WebResourceResponse(mime, text ? "utf-8" : null, 200, "OK", headers, in);
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", headers, new ByteArrayInputStream(new byte[0]));
        }
    }

    class AssetClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (HOST.equals(u.getHost())) return serveAsset(u.getPath());
            return null;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            Uri u = Uri.parse(url);
            if (HOST.equals(u.getHost())) return false;
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, u));
            } catch (ActivityNotFoundException e) {
                toastNow("Не найдено приложение для открытия ссылки");
            }
            return true;
        }
    }

    class Chrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = cb;
            Intent i = new Intent(Intent.ACTION_GET_CONTENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("image/*");
            try {
                startActivityForResult(Intent.createChooser(i, "Выберите картинку"), REQ_FILE);
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                cb.onReceiveValue(null);
                return false;
            }
            return true;
        }

        @Override
        public boolean onConsoleMessage(ConsoleMessage m) {
            Log.d(TAG, m.message() + " @" + m.sourceId() + ":" + m.lineNumber());
            return true;
        }
    }

    // ---------- вспомогательное ----------

    void toastNow(final String msg) {
        ui.post(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show();
            }
        });
    }

    void callJs(final String cb, final JSONObject result) {
        ui.post(new Runnable() {
            @Override
            public void run() {
                if (web == null) return;
                web.evaluateJavascript("window.__bridgeCb && window.__bridgeCb(" + JSONObject.quote(cb) + "," + result.toString() + ")", null);
            }
        });
    }

    static JSONObject err(String message) {
        JSONObject o = new JSONObject();
        try {
            o.put("ok", false);
            o.put("error", message == null ? "Ошибка" : message);
        } catch (Exception ignored) {
        }
        return o;
    }

    static String safeName(String name) {
        String n = name == null ? "" : name.replaceAll("[\\\\/:*?\"<>|\\n\\r\\t]", "_").trim();
        if (n.startsWith(".")) n = "_" + n;
        if (n.length() == 0) n = "document";
        if (n.length() > 120) {
            int dot = n.lastIndexOf('.');
            String ext = dot > 0 ? n.substring(dot) : "";
            n = n.substring(0, 120 - ext.length()) + ext;
        }
        return n;
    }

    static void writeFile(File f, byte[] data) throws IOException {
        FileOutputStream os = new FileOutputStream(f);
        try {
            os.write(data);
            os.getFD().sync();
        } finally {
            os.close();
        }
    }

    File shareDir() {
        File dir = new File(getCacheDir(), "share");
        if (!dir.exists() && !dir.mkdirs()) Log.w(TAG, "cannot create share dir");
        return dir;
    }

    Uri shareUri(String name) {
        return Uri.parse("content://" + AUTHORITY + "/" + Uri.encode(name));
    }

    static File uniqueFile(File dir, String name) {
        File f = new File(dir, name);
        if (!f.exists()) return f;
        int dot = name.lastIndexOf('.');
        String base = dot > 0 ? name.substring(0, dot) : name;
        String ext = dot > 0 ? name.substring(dot) : "";
        for (int i = 2; i < 1000; i++) {
            f = new File(dir, base + " (" + i + ")" + ext);
            if (!f.exists()) return f;
        }
        return new File(dir, base + " " + System.currentTimeMillis() + ext);
    }

    JSONObject saveBytes(String rawName, byte[] data, String mime) throws Exception {
        String name = safeName(rawName);
        writeFile(new File(shareDir(), name), data);
        String where;
        if (Build.VERSION.SDK_INT >= 29) {
            ContentResolver cr = getContentResolver();
            ContentValues cv = new ContentValues();
            cv.put("_display_name", name);
            cv.put("mime_type", mime);
            cv.put("relative_path", Environment.DIRECTORY_DOWNLOADS + "/" + FOLDER);
            cv.put("is_pending", 1);
            Uri item = cr.insert(Uri.parse("content://media/external/downloads"), cv);
            if (item == null) throw new IOException("Не удалось создать файл в «Загрузках»");
            OutputStream os = cr.openOutputStream(item);
            if (os == null) throw new IOException("Нет доступа к «Загрузкам»");
            try {
                os.write(data);
            } finally {
                os.close();
            }
            ContentValues done = new ContentValues();
            done.put("is_pending", 0);
            cr.update(item, done, null, null);
            String realName = name;
            Cursor c = cr.query(item, new String[]{"_display_name"}, null, null, null);
            if (c != null) {
                try {
                    if (c.moveToFirst() && c.getString(0) != null) realName = c.getString(0);
                } finally {
                    c.close();
                }
            }
            where = "Загрузки › " + FOLDER + " › " + realName;
        } else {
            File dir = null;
            if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED) {
                dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), FOLDER);
                if (!dir.exists() && !dir.mkdirs()) dir = null;
            } else {
                ui.post(new Runnable() {
                    @Override
                    public void run() {
                        requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_PERM);
                    }
                });
            }
            if (dir == null) {
                dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (dir == null) dir = new File(getFilesDir(), "Download");
                if (!dir.exists() && !dir.mkdirs()) throw new IOException("Не удалось создать папку");
            }
            File f = uniqueFile(dir, name);
            writeFile(f, data);
            MediaScannerConnection.scanFile(this, new String[]{f.getAbsolutePath()}, new String[]{mime}, null);
            where = f.getAbsolutePath();
        }
        JSONObject r = new JSONObject();
        r.put("ok", true);
        r.put("name", name);
        r.put("path", where);
        return r;
    }

    // ---------- мост для JavaScript ----------

    class Bridge {
        @JavascriptInterface
        public String version() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public boolean isOnline() {
            try {
                ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
                NetworkInfo ni = cm == null ? null : cm.getActiveNetworkInfo();
                return ni != null && ni.isConnected();
            } catch (Exception e) {
                return true;
            }
        }

        @JavascriptInterface
        public void toast(String msg) {
            toastNow(msg);
        }

        @JavascriptInterface
        public void saveFile(final String name, final String base64, final String mime, final String cb) {
            pool.execute(new Runnable() {
                @Override
                public void run() {
                    try {
                        byte[] data = Base64.decode(base64, Base64.DEFAULT);
                        callJs(cb, saveBytes(name, data, mime));
                    } catch (Throwable t) {
                        Log.e(TAG, "saveFile", t);
                        callJs(cb, err(t.getMessage()));
                    }
                }
            });
        }

        @JavascriptInterface
        public void shareFile(final String name, final String mime) {
            ui.post(new Runnable() {
                @Override
                public void run() {
                    String n = safeName(name);
                    if (!new File(shareDir(), n).exists()) {
                        toastNow("Сначала сохраните файл");
                        return;
                    }
                    Uri uri = shareUri(n);
                    Intent i = new Intent(Intent.ACTION_SEND);
                    i.setType(mime);
                    i.putExtra(Intent.EXTRA_STREAM, uri);
                    i.putExtra(Intent.EXTRA_SUBJECT, n);
                    i.setClipData(ClipData.newRawUri(n, uri));
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    try {
                        startActivity(Intent.createChooser(i, "Отправить файл"));
                    } catch (ActivityNotFoundException e) {
                        toastNow("Нет приложений для отправки файла");
                    }
                }
            });
        }

        @JavascriptInterface
        public void openFile(final String name, final String mime) {
            ui.post(new Runnable() {
                @Override
                public void run() {
                    String n = safeName(name);
                    if (!new File(shareDir(), n).exists()) {
                        toastNow("Сначала сохраните файл");
                        return;
                    }
                    Uri uri = shareUri(n);
                    Intent i = new Intent(Intent.ACTION_VIEW);
                    i.setDataAndType(uri, mime);
                    i.setClipData(ClipData.newRawUri(n, uri));
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    try {
                        startActivity(i);
                    } catch (ActivityNotFoundException e) {
                        toastNow("Нет приложения для открытия. Установите Microsoft Word, WPS Office или Google Документы.");
                    }
                }
            });
        }

        @JavascriptInterface
        public void httpGet(final String url, final boolean binary, final String cb) {
            httpRequest("GET", url, null, null, binary, 25000, cb);
        }

        /**
         * HTTPS-запрос для интернет-картинок и бесплатных ИИ-сервисов.
         * headersJson — объект {"Имя": "значение"}; body — текст (JSON или form-urlencoded) либо null.
         * Ответ в JS: {ok, status, type, data} (data — текст или base64 при binary) или {ok:false, error}.
         */
        @JavascriptInterface
        public void httpRequest(final String method, final String url, final String headersJson, final String body,
                                final boolean binary, final int timeoutMs, final String cb) {
            pool.execute(new Runnable() {
                @Override
                public void run() {
                    HttpURLConnection c = null;
                    try {
                        if (url == null || !url.startsWith("https://")) throw new IOException("Разрешены только https-адреса");
                        String m = method == null ? "GET" : method.toUpperCase(Locale.ROOT);
                        if (!m.equals("GET") && !m.equals("POST")) throw new IOException("Метод не поддерживается: " + m);
                        c = (HttpURLConnection) new URL(url).openConnection();
                        c.setConnectTimeout(15000);
                        c.setReadTimeout(Math.max(10000, Math.min(timeoutMs <= 0 ? 25000 : timeoutMs, 300000)));
                        c.setInstanceFollowRedirects(true);
                        c.setRequestMethod(m);
                        c.setRequestProperty("User-Agent", "KonstruktorZanyatiy (Android; educational, non-commercial)");
                        c.setRequestProperty("Accept", binary ? "image/*,*/*;q=0.8" : "application/json,*/*;q=0.8");
                        if (headersJson != null && headersJson.length() > 0) {
                            JSONObject h = new JSONObject(headersJson);
                            java.util.Iterator<String> it = h.keys();
                            while (it.hasNext()) {
                                String k = it.next();
                                c.setRequestProperty(k, h.optString(k, ""));
                            }
                        }
                        if (m.equals("POST")) {
                            byte[] out = (body == null ? "" : body).getBytes("UTF-8");
                            c.setDoOutput(true);
                            c.setFixedLengthStreamingMode(out.length);
                            OutputStream os = c.getOutputStream();
                            try {
                                os.write(out);
                            } finally {
                                os.close();
                            }
                        }
                        int code = c.getResponseCode();
                        InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
                        ByteArrayOutputStream bos = new ByteArrayOutputStream();
                        if (in != null) {
                            try {
                                byte[] buf = new byte[16384];
                                int n;
                                while ((n = in.read(buf)) > 0) {
                                    bos.write(buf, 0, n);
                                    if (bos.size() > MAX_DOWNLOAD) throw new IOException("Ответ слишком большой");
                                }
                            } finally {
                                in.close();
                            }
                        }
                        byte[] data = bos.toByteArray();
                        String type = c.getContentType();
                        boolean ok = code >= 200 && code < 300;
                        JSONObject r = new JSONObject();
                        r.put("ok", ok);
                        r.put("status", code);
                        r.put("type", type == null ? "" : type);
                        boolean asBinary = binary && ok && (type == null || !type.startsWith("application/json"));
                        r.put("data", asBinary ? Base64.encodeToString(data, Base64.NO_WRAP) : new String(data, "UTF-8"));
                        r.put("binary", asBinary);
                        callJs(cb, r);
                    } catch (Throwable t) {
                        callJs(cb, err(t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage()));
                    } finally {
                        if (c != null) c.disconnect();
                    }
                }
            });
        }

        /** Открыть ссылку (страница получения ключа ИИ и т. п.) во внешнем браузере */
        @JavascriptInterface
        public void openUrl(final String url) {
            if (url == null || !url.startsWith("https://")) return;
            ui.post(new Runnable() {
                @Override
                public void run() {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    } catch (ActivityNotFoundException e) {
                        Toast.makeText(MainActivity.this, "Нет браузера для открытия ссылки", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public void printHtml(final String html, final String jobName) {
            ui.post(new Runnable() {
                @Override
                public void run() {
                    final String job = jobName == null || jobName.length() == 0 ? FOLDER : jobName;
                    final WebView pv = new WebView(MainActivity.this);
                    pv.getSettings().setJavaScriptEnabled(false);
                    pv.setWebViewClient(new WebViewClient() {
                        @Override
                        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                            Uri u = request.getUrl();
                            if (HOST.equals(u.getHost())) return serveAsset(u.getPath());
                            return null;
                        }

                        @Override
                        public void onPageFinished(WebView view, String url) {
                            try {
                                PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                                PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(job);
                                PrintAttributes attrs = new PrintAttributes.Builder()
                                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                                        .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                                        .build();
                                pm.print(job, adapter, attrs);
                            } catch (Throwable t) {
                                Log.e(TAG, "print", t);
                                toastNow("Печать недоступна на этом устройстве");
                            }
                        }
                    });
                    printView = pv;
                    pv.loadDataWithBaseURL("https://" + HOST + "/", html, "text/html", "utf-8", null);
                }
            });
        }
    }
}
