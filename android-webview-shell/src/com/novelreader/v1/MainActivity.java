package com.novelreader.v1;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.util.Base64;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.webkit.ValueCallback;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final String TAG = "NovelReaderWebView";
    private static final String APP_URL = "file:///android_asset/www/index.html";
    private static final String LAUNCH_PREFS = "novel_reader_launch";
    private static final String LAUNCH_THEME_KEY = "app_theme";
    private static final String DEFAULT_LAUNCH_THEME = "xuanye";
    private static final long LAUNCH_REVEAL_TIMEOUT_MS = 5000L;
    private static final int CAMERA_PERMISSION_REQUEST = 1001;
    private static final int FILE_CHOOSER_REQUEST = 1002;
    private static final int SCAN_QR_REQUEST = 1003;
    private WebView webView;
    private SourceHttpBridge sourceHttpBridge;
    private FrameLayout launchRoot;
    private TextView launchLabel;
    private final Handler launchHandler = new Handler(Looper.getMainLooper());
    private long launchStartedAt;
    private boolean launchContentRevealed;
    private PermissionRequest pendingPermissionRequest;
    private ValueCallback<Uri[]> filePathCallback;
    private String scanCallbackName;
    private PendingDeepLinkStore pendingDeepLinkStore;
    private boolean pageLoaded;
    private final Object ttsLock = new Object();
    private final Map<String, String> ttsCallbacks = new HashMap<>();
    private TextToSpeech textToSpeech;
    private Voice defaultTtsVoice;
    private volatile boolean ttsReady;
    private volatile String ttsStatus = "initializing";
    private volatile String ttsMessage = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        launchStartedAt = System.currentTimeMillis();
        final String launchTheme = getSavedLaunchTheme();
        applySystemTheme(launchTheme);
        Log.i(TAG, "launch shell theme=" + launchTheme);

        launchRoot = new FrameLayout(this);
        webView = new WebView(this);
        webView.setAlpha(0f);
        launchRoot.addView(
            webView,
            new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );
        launchLabel = createLaunchLabel();
        FrameLayout.LayoutParams launchLabelParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            Gravity.CENTER
        );
        launchRoot.addView(launchLabel, launchLabelParams);
        applyLaunchTheme(launchTheme);
        setContentView(
            launchRoot,
            new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );
        pendingDeepLinkStore = new PendingDeepLinkStore();
        initializeTextToSpeech();
        configureWebView(webView);
        launchHandler.postDelayed(new Runnable() {
            @Override
            public void run() {
                revealLaunchContent("timeout");
            }
        }, LAUNCH_REVEAL_TIMEOUT_MS);
        String initialDeepLink = extractIncomingDeepLink(getIntent());
        if (initialDeepLink != null) {
            pendingDeepLinkStore.save(initialDeepLink, "onCreate");
            openImportScanPage();
        } else {
            webView.loadUrl(APP_URL);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingDeepLink(intent);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView(WebView view) {
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            settings.setAllowFileAccessFromFileURLs(true);
            settings.setAllowUniversalAccessFromFileURLs(true);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
        LocalChapterBridge localStorageBridge = new LocalChapterBridge();
        view.addJavascriptInterface(localStorageBridge, "NovelReaderLocalStorage");
        view.addJavascriptInterface(localStorageBridge, "NovelReaderSourceStorage");
        view.addJavascriptInterface(new ScanBridge(), "NovelReaderScan");
        view.addJavascriptInterface(new DeepLinkBridge(), "NovelReaderDeepLinkBridge");
        view.addJavascriptInterface(new RenderedHtmlBridge(), "NovelReaderWebViewParser");
        sourceHttpBridge = new SourceHttpBridge(view);
        view.addJavascriptInterface(sourceHttpBridge, "NovelReaderHttp");
        view.addJavascriptInterface(new TextToSpeechBridge(), "NovelReaderTts");
        view.addJavascriptInterface(new LaunchBridge(), "NovelReaderLaunch");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(false);
        }

        view.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d(
                    TAG,
                    consoleMessage.messageLevel() + " "
                        + consoleMessage.sourceId() + ":"
                        + consoleMessage.lineNumber() + " "
                        + consoleMessage.message()
                );
                return true;
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
                    return;
                }
                for (String resource : request.getResources()) {
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                        grantCameraPermission(request);
                        return;
                    }
                }
                request.deny();
            }

            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;

                Intent intent;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && fileChooserParams != null) {
                    intent = fileChooserParams.createIntent();
                } else {
                    intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                }

                if (intent.getAction() == null) {
                    intent.setAction(Intent.ACTION_OPEN_DOCUMENT);
                }
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (Exception error) {
                    Log.e(TAG, "file chooser failed: " + error.getMessage());
                    MainActivity.this.filePathCallback = null;
                    filePathCallback.onReceiveValue(null);
                    return true;
                }
            }
        });
        view.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                Log.d(TAG, "page finished: " + url);
                pageLoaded = true;
                launchHandler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        revealLaunchContent("page-finished-fallback");
                    }
                }, 300L);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    Log.e(TAG, "resource error: " + request.getUrl() + " " + error.getDescription());
                }
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse response = interceptAsset(request.getUrl());
                if (response != null) {
                    return response;
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return false;
            }
        });
    }

    private TextView createLaunchLabel() {
        TextView label = new TextView(this);
        label.setGravity(Gravity.CENTER);
        label.setText("解码阅读\nDECODING READER");
        label.setTextSize(22f);
        label.setLineSpacing(10f, 1f);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            label.setLetterSpacing(0.08f);
        }
        label.setContentDescription("解码阅读正在启动");
        return label;
    }

    private String normalizeLaunchTheme(String themeId) {
        if ("candy".equals(themeId) || "sakura".equals(themeId) || "cyber".equals(themeId)
                || "noirGold".equals(themeId) || "xuanye".equals(themeId)) {
            return themeId;
        }
        return DEFAULT_LAUNCH_THEME;
    }

    private String getSavedLaunchTheme() {
        SharedPreferences preferences = getSharedPreferences(LAUNCH_PREFS, MODE_PRIVATE);
        return normalizeLaunchTheme(preferences.getString(LAUNCH_THEME_KEY, DEFAULT_LAUNCH_THEME));
    }

    private int getLaunchBackgroundColor(String themeId) {
        switch (normalizeLaunchTheme(themeId)) {
            case "candy": return Color.rgb(255, 247, 214);
            case "sakura": return Color.rgb(248, 239, 246);
            case "cyber": return Color.rgb(3, 8, 23);
            case "noirGold": return Color.rgb(8, 7, 5);
            default: return Color.rgb(7, 10, 15);
        }
    }

    private int getLaunchTextColor(String themeId) {
        switch (normalizeLaunchTheme(themeId)) {
            case "candy": return Color.rgb(52, 42, 50);
            case "sakura": return Color.rgb(73, 56, 71);
            case "cyber": return Color.rgb(232, 247, 255);
            case "noirGold": return Color.rgb(244, 235, 216);
            default: return Color.rgb(244, 241, 232);
        }
    }

    private boolean isLightLaunchTheme(String themeId) {
        String normalized = normalizeLaunchTheme(themeId);
        return "candy".equals(normalized) || "sakura".equals(normalized);
    }

    private void applySystemTheme(String themeId) {
        int backgroundColor = getLaunchBackgroundColor(themeId);
        Window window = getWindow();
        window.setBackgroundDrawable(new ColorDrawable(backgroundColor));
        window.setStatusBarColor(backgroundColor);
        window.setNavigationBarColor(backgroundColor);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.setNavigationBarDividerColor(backgroundColor);
        }

        View decor = window.getDecorView();
        int flags = decor.getSystemUiVisibility();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags = isLightLaunchTheme(themeId)
                ? flags | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                : flags & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            flags = isLightLaunchTheme(themeId)
                ? flags | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
                : flags & ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        decor.setSystemUiVisibility(flags);
    }

    private void applyLaunchTheme(String themeId) {
        final int backgroundColor = getLaunchBackgroundColor(themeId);
        applySystemTheme(themeId);
        if (launchRoot != null) launchRoot.setBackgroundColor(backgroundColor);
        if (webView != null) webView.setBackgroundColor(backgroundColor);
        if (launchLabel != null) launchLabel.setTextColor(getLaunchTextColor(themeId));
    }

    private void saveLaunchTheme(String themeId) {
        final String normalized = normalizeLaunchTheme(themeId);
        getSharedPreferences(LAUNCH_PREFS, MODE_PRIVATE)
            .edit()
            .putString(LAUNCH_THEME_KEY, normalized)
            .apply();
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                applyLaunchTheme(normalized);
            }
        });
    }

    private void revealLaunchContent(String source) {
        if (launchContentRevealed || webView == null) return;
        launchContentRevealed = true;
        launchHandler.removeCallbacksAndMessages(null);
        webView.setAlpha(1f);
        if (launchLabel != null && launchRoot != null) {
            launchRoot.removeView(launchLabel);
            launchLabel = null;
        }
        Log.i(TAG, "first content visible source=" + source + " elapsedMs="
            + (System.currentTimeMillis() - launchStartedAt));
    }

    public class LaunchBridge {
        @JavascriptInterface
        public void saveTheme(String themeId) {
            saveLaunchTheme(themeId);
        }

        @JavascriptInterface
        public void ready(String themeId) {
            saveLaunchTheme(themeId);
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    revealLaunchContent("vue-ready");
                }
            });
        }
    }

    public class ScanBridge {
        @JavascriptInterface
        public boolean scanQr(String callbackName) {
            if (callbackName == null || callbackName.trim().isEmpty()) {
                return false;
            }

            scanCallbackName = callbackName.trim();
            Intent intent = new Intent("com.google.zxing.client.android.SCAN");
            intent.putExtra("SCAN_MODE", "QR_CODE_MODE");
            intent.putExtra("PROMPT", "请扫描书源二维码");

            try {
                startActivityForResult(intent, SCAN_QR_REQUEST);
                return true;
            } catch (ActivityNotFoundException error) {
                Log.e(TAG, "qr scanner not found: " + error.getMessage());
                scanCallbackName = null;
                return false;
            } catch (Exception error) {
                Log.e(TAG, "qr scanner failed: " + error.getMessage());
                String callback = scanCallbackName;
                scanCallbackName = null;
                dispatchScanResult(callback, false, "", "原生扫码启动失败");
                return true;
            }
        }
    }

    public class DeepLinkBridge {
        @JavascriptInterface
        public String peekDeepLink() {
            return pendingDeepLinkStore.peekDeepLink();
        }

        @JavascriptInterface
        public boolean ackDeepLink(String id) {
            return pendingDeepLinkStore.ackDeepLink(id);
        }

        @JavascriptInterface
        public String consumeDeepLink() {
            return pendingDeepLinkStore.consumeUri();
        }
    }

    private class PendingDeepLinkStore {
        private static final String PREFS = "novel_reader_pending_deep_link";
        private static final String KEY_ID = "id";
        private static final String KEY_URI = "uri";
        private static final String KEY_CREATED_AT = "createdAt";
        private static final String KEY_SOURCE = "source";
        private final SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);

        void save(String uri, String source) {
            if (uri == null || uri.trim().isEmpty()) {
                return;
            }
            String normalized = uri.trim();
            String id = System.currentTimeMillis() + "_" + Math.abs(normalized.hashCode());
            prefs.edit()
                .putString(KEY_ID, id)
                .putString(KEY_URI, normalized)
                .putLong(KEY_CREATED_AT, System.currentTimeMillis())
                .putString(KEY_SOURCE, source == null ? "" : source)
                .apply();
        }

        String peekDeepLink() {
            String uri = prefs.getString(KEY_URI, "");
            if (uri == null || uri.trim().isEmpty()) {
                return "{\"ok\":false,\"reason\":\"empty\"}";
            }
            try {
                JSONObject payload = new JSONObject();
                payload.put("ok", true);
                payload.put("id", prefs.getString(KEY_ID, ""));
                payload.put("uri", uri);
                payload.put("createdAt", prefs.getLong(KEY_CREATED_AT, 0));
                payload.put("source", prefs.getString(KEY_SOURCE, ""));
                return payload.toString();
            } catch (Exception error) {
                Log.e(TAG, "deep link peek failed: " + error.getMessage());
                return "{\"ok\":false,\"reason\":\"peek-failed\"}";
            }
        }

        boolean ackDeepLink(String id) {
            String storedId = prefs.getString(KEY_ID, "");
            if (id == null || storedId == null || !storedId.equals(id)) {
                return false;
            }
            clear();
            return true;
        }

        void clear() {
            prefs.edit().clear().apply();
        }

        String consumeUri() {
            String uri = prefs.getString(KEY_URI, "");
            clear();
            return uri == null ? "" : uri;
        }
    }

    public class RenderedHtmlBridge {
        @JavascriptInterface
        public String getBridgeInfo() {
            try {
                JSONObject payload = new JSONObject();
                JSONObject features = new JSONObject();
                JSONArray methods = new JSONArray();
                methods.put("getBridgeInfo");
                methods.put("fetchRenderedHtml");
                methods.put("openLoginPage");
                methods.put("getCookie");
                features.put("renderedFetch", true);
                features.put("openLogin", true);
                features.put("readCookie", true);
                payload.put("contractVersion", 1);
                payload.put("runtime", "android-webview-shell");
                payload.put("platform", "android");
                payload.put("features", features);
                payload.put("methods", methods);
                return payload.toString();
            } catch (Exception error) {
                return "{\"error\":\"bridge info failed\"}";
            }
        }

        @JavascriptInterface
        public boolean openLoginPage(String url) {
            if (url == null || !url.matches("^https?://.+")) return false;
            final String loginUrl = url;
            webView.post(new Runnable() {
                @Override public void run() { webView.loadUrl(loginUrl); }
            });
            return true;
        }

        @JavascriptInterface
        public String getCookie(String url) {
            if (url == null || !url.matches("^https?://.+")) return "";
            String cookie = CookieManager.getInstance().getCookie(url);
            return cookie == null ? "" : cookie;
        }

        @JavascriptInterface
        public boolean fetchRenderedHtml(String url, String optionsJson, String callbackName) {
            if (url == null || !url.matches("^https?://.+") || callbackName == null || callbackName.trim().isEmpty()) {
                return false;
            }
            final String targetUrl = url;
            final String callback = callbackName.trim();
            runOnUiThread(new Runnable() {
                @Override
                @SuppressLint("SetJavaScriptEnabled")
                public void run() {
                    final WebView parser = new WebView(MainActivity.this);
                    final Handler handler = new Handler(Looper.getMainLooper());
                    try {
                        JSONObject options = new JSONObject(optionsJson == null ? "{}" : optionsJson);
                        int timeoutMs = Math.max(500, Math.min(30000, options.optInt("timeoutMs", 10000)));
                        int waitMs = Math.max(0, Math.min(10000, options.optInt("waitMs", 500)));
                        WebSettings settings = parser.getSettings();
                        settings.setJavaScriptEnabled(true);
                        settings.setDomStorageEnabled(true);
                        if (!options.optString("userAgent").isEmpty()) settings.setUserAgentString(options.optString("userAgent"));
                        if (!options.optString("cookie").isEmpty()) {
                            CookieManager.getInstance().setCookie(targetUrl, options.optString("cookie"));
                        }
                        final boolean[] completed = { false };
                        Runnable timeout = new Runnable() {
                            @Override public void run() {
                                if (completed[0]) return;
                                completed[0] = true;
                                dispatchRenderedResult(callback, "", targetUrl, "", "", 0, "WebView 渲染超时");
                                parser.destroy();
                            }
                        };
                        handler.postDelayed(timeout, timeoutMs);
                        parser.setWebViewClient(new WebViewClient() {
                            @Override public void onPageFinished(WebView view, String finalUrl) {
                                handler.postDelayed(new Runnable() {
                                    @Override public void run() {
                                        if (completed[0]) return;
                                        view.evaluateJavascript("document.documentElement.outerHTML", new ValueCallback<String>() {
                                            @Override public void onReceiveValue(String value) {
                                                if (completed[0]) return;
                                                completed[0] = true;
                                                handler.removeCallbacks(timeout);
                                                String html = decodeJavascriptString(value);
                                                String cookie = CookieManager.getInstance().getCookie(finalUrl);
                                                dispatchRenderedResult(callback, html, finalUrl, view.getTitle(), cookie, 200, "");
                                                parser.destroy();
                                            }
                                        });
                                    }
                                }, waitMs);
                            }
                        });
                        Map<String, String> headers = new HashMap<>();
                        JSONObject rawHeaders = options.optJSONObject("headers");
                        if (rawHeaders != null) {
                            JSONArray names = rawHeaders.names();
                            if (names != null) for (int i = 0; i < names.length(); i++) {
                                String name = names.optString(i);
                                if (name.matches("^[!#$%&'*+.^_`|~0-9A-Za-z-]+$")) headers.put(name, rawHeaders.optString(name));
                            }
                        }
                        parser.loadUrl(targetUrl, headers);
                    } catch (Exception error) {
                        dispatchRenderedResult(callback, "", targetUrl, "", "", 0, error.getMessage());
                        parser.destroy();
                    }
                }
            });
            return true;
        }
    }

    private String decodeJavascriptString(String value) {
        try { return new JSONArray("[" + value + "]").getString(0); }
        catch (Exception error) { return value == null ? "" : value; }
    }

    private void dispatchRenderedResult(String callback, String html, String finalUrl, String title, String cookie, int status, String error) {
        try {
            JSONObject payload = new JSONObject();
            payload.put("html", html == null ? "" : html);
            payload.put("finalUrl", finalUrl == null ? "" : finalUrl);
            payload.put("title", title == null ? "" : title);
            payload.put("cookie", cookie == null ? "" : cookie);
            payload.put("status", status);
            payload.put("error", error == null ? "" : error);
            String script = "window['" + escapeJs(callback) + "'](" + payload.toString() + ")";
            webView.post(new Runnable() {
                @Override public void run() { webView.evaluateJavascript(script, null); }
            });
        } catch (Exception dispatchError) {
            Log.e(TAG, "rendered html callback failed: " + dispatchError.getMessage());
        }
    }

    public class LocalChapterBridge {
        private File chapterRoot() {
            File root = new File(getFilesDir(), "local_txt_chapters");
            if (!root.exists()) {
                root.mkdirs();
            }
            return root;
        }

        private File fileForKey(String key) {
            String name = Base64.encodeToString(
                String.valueOf(key).getBytes(),
                Base64.URL_SAFE | Base64.NO_WRAP
            );
            return new File(chapterRoot(), name + ".txt");
        }

        @JavascriptInterface
        public boolean writeChapter(String key, String content) {
            FileOutputStream output = null;
            try {
                File file = fileForKey(key);
                output = new FileOutputStream(file, false);
                output.write(String.valueOf(content).getBytes("UTF-8"));
                output.flush();
                return true;
            } catch (Exception error) {
                Log.e(TAG, "local chapter write failed: " + error.getMessage());
                return false;
            } finally {
                if (output != null) {
                    try {
                        output.close();
                    } catch (IOException ignored) {
                    }
                }
            }
        }

        @JavascriptInterface
        public String readChapter(String key) {
            FileInputStream input = null;
            ByteArrayOutputStream output = null;
            try {
                File file = fileForKey(key);
                if (!file.exists()) {
                    return "";
                }
                input = new FileInputStream(file);
                output = new ByteArrayOutputStream();
                byte[] buffer = new byte[8192];
                while (true) {
                    int length = input.read(buffer);
                    if (length < 0) {
                        break;
                    }
                    output.write(buffer, 0, length);
                }
                return output.toString("UTF-8");
            } catch (Exception error) {
                Log.e(TAG, "local chapter read failed: " + error.getMessage());
                return "";
            } finally {
                if (input != null) {
                    try {
                        input.close();
                    } catch (IOException ignored) {
                    }
                }
                if (output != null) {
                    try {
                        output.close();
                    } catch (IOException ignored) {
                    }
                }
            }
        }

        @JavascriptInterface
        public boolean removeChapter(String key) {
            try {
                File file = fileForKey(key);
                return !file.exists() || file.delete();
            } catch (Exception error) {
                Log.e(TAG, "local chapter remove failed: " + error.getMessage());
                return false;
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == SCAN_QR_REQUEST) {
            String callback = scanCallbackName;
            scanCallbackName = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                String result = data.getStringExtra("SCAN_RESULT");
                if (result == null || result.trim().isEmpty()) {
                    dispatchScanResult(callback, false, "", "扫码结果为空");
                    return;
                }
                dispatchScanResult(callback, true, result, "");
                return;
            }
            dispatchScanResult(callback, false, "", "扫码已取消");
            return;
        }

        if (requestCode != FILE_CHOOSER_REQUEST || filePathCallback == null) {
            return;
        }

        Uri[] results = null;
        if (resultCode == Activity.RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                results = new Uri[count];
                for (int index = 0; index < count; index += 1) {
                    results[index] = data.getClipData().getItemAt(index).getUri();
                }
            } else if (data.getData() != null) {
                results = new Uri[]{data.getData()};
            }
        }

        filePathCallback.onReceiveValue(results);
        filePathCallback = null;
    }

    private void dispatchScanResult(String callbackName, boolean ok, String result, String error) {
        if (callbackName == null || callbackName.trim().isEmpty() || webView == null) {
            return;
        }
        String payload = "{\"ok\":" + (ok ? "true" : "false")
            + ",\"result\":\"" + escapeJson(result) + "\""
            + ",\"error\":\"" + escapeJson(error) + "\"}";
        String script = "window['" + escapeJs(callbackName) + "'](" + payload + ")";
        webView.post(new Runnable() {
            @Override
            public void run() {
                if (webView == null) {
                    return;
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    webView.evaluateJavascript(script, null);
                    return;
                }
                webView.loadUrl("javascript:" + script);
            }
        });
    }

    private void initializeTextToSpeech() {
        ttsStatus = "initializing";
        ttsMessage = "";
        textToSpeech = new TextToSpeech(getApplicationContext(), new TextToSpeech.OnInitListener() {
            @Override
            public void onInit(int status) {
                synchronized (ttsLock) {
                    if (textToSpeech == null) {
                        return;
                    }
                    if (status != TextToSpeech.SUCCESS) {
                        ttsReady = false;
                        ttsStatus = "unavailable";
                        ttsMessage = "系统语音服务初始化失败";
                        return;
                    }

                    int languageResult = textToSpeech.setLanguage(Locale.SIMPLIFIED_CHINESE);
                    if (languageResult == TextToSpeech.LANG_MISSING_DATA
                            || languageResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                        ttsReady = false;
                        ttsStatus = "unavailable";
                        ttsMessage = "系统语音服务不支持中文";
                        return;
                    }
                    defaultTtsVoice = textToSpeech.getVoice();

                    textToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                        @Override
                        public void onStart(String utteranceId) {
                            // The JavaScript controller already enters playing state
                            // when speak() accepts an utterance.
                        }

                        @Override
                        public void onDone(String utteranceId) {
                            dispatchTtsResult(utteranceId, "done", "");
                        }

                        @Override
                        public void onError(String utteranceId) {
                            dispatchTtsResult(utteranceId, "error", "系统语音服务朗读失败");
                        }

                        @Override
                        public void onError(String utteranceId, int errorCode) {
                            dispatchTtsResult(
                                utteranceId,
                                "error",
                                "系统语音服务朗读失败（错误码 " + errorCode + "）"
                            );
                        }
                    });
                    ttsReady = true;
                    ttsStatus = "ready";
                    ttsMessage = "";
                }
            }
        });
    }

    public class TextToSpeechBridge {
        @JavascriptInterface
        public String getState() {
            try {
                JSONObject payload = new JSONObject();
                payload.put("available", ttsReady);
                payload.put("ready", ttsReady);
                payload.put("status", ttsStatus);
                payload.put("language", "zh-CN");
                payload.put("message", ttsMessage);
                return payload.toString();
            } catch (Exception error) {
                return "{\"available\":false,\"ready\":false,\"status\":\"error\","
                    + "\"language\":\"zh-CN\",\"message\":\"无法读取系统语音服务状态\"}";
            }
        }

        @JavascriptInterface
        public String getVoices() {
            try {
                JSONObject payload = new JSONObject();
                JSONArray voicesJson = new JSONArray();
                synchronized (ttsLock) {
                    if (ttsReady && textToSpeech != null) {
                        Voice currentVoice = textToSpeech.getVoice();
                        Set<Voice> voices = textToSpeech.getVoices();
                        if (voices != null) {
                            for (Voice voice : voices) {
                                if (!isSelectableChineseVoice(voice)) {
                                    continue;
                                }
                                JSONObject item = new JSONObject();
                                item.put("id", voice.getName());
                                item.put("name", voice.getName());
                                item.put("lang", voice.getLocale().toLanguageTag());
                                item.put("provider", "system");
                                item.put("quality", voice.getQuality());
                                item.put("latency", voice.getLatency());
                                item.put("networkRequired", false);
                                item.put("isDefault", voice.equals(currentVoice));
                                voicesJson.put(item);
                            }
                        }
                    }
                }
                payload.put("voices", voicesJson);
                return payload.toString();
            } catch (Exception error) {
                Log.e(TAG, "tts voice enumeration failed: " + error.getMessage());
                return "{\"voices\":[]}";
            }
        }

        @JavascriptInterface
        public boolean setVoice(String voiceId) {
            String normalizedId = voiceId == null ? "" : voiceId.trim();
            synchronized (ttsLock) {
                if (!ttsReady || textToSpeech == null) {
                    return false;
                }
                if (normalizedId.isEmpty()) {
                    if (defaultTtsVoice != null) {
                        return textToSpeech.setVoice(defaultTtsVoice) == TextToSpeech.SUCCESS;
                    }
                    return textToSpeech.setLanguage(Locale.SIMPLIFIED_CHINESE) >= TextToSpeech.LANG_AVAILABLE;
                }

                Set<Voice> voices = textToSpeech.getVoices();
                if (voices != null) {
                    for (Voice voice : voices) {
                        if (isSelectableChineseVoice(voice) && normalizedId.equals(voice.getName())) {
                            return textToSpeech.setVoice(voice) == TextToSpeech.SUCCESS;
                        }
                    }
                }
                if (defaultTtsVoice != null) {
                    textToSpeech.setVoice(defaultTtsVoice);
                }
                return false;
            }
        }

        @JavascriptInterface
        public boolean setPitch(float pitch) {
            float safePitch = pitch;
            if (Float.isNaN(safePitch) || Float.isInfinite(safePitch)) {
                safePitch = 1.0f;
            }
            safePitch = Math.max(0.5f, Math.min(2.0f, safePitch));
            synchronized (ttsLock) {
                return ttsReady
                    && textToSpeech != null
                    && textToSpeech.setPitch(safePitch) == TextToSpeech.SUCCESS;
            }
        }

        @JavascriptInterface
        public boolean speak(
                String text,
                float rate,
                String utteranceId,
                String callbackName) {
            String normalizedText = text == null ? "" : text.trim();
            String normalizedId = utteranceId == null ? "" : utteranceId.trim();
            String normalizedCallback = callbackName == null ? "" : callbackName.trim();
            if (normalizedText.isEmpty() || normalizedId.isEmpty() || normalizedCallback.isEmpty()) {
                return false;
            }

            synchronized (ttsLock) {
                if (!ttsReady || textToSpeech == null) {
                    return false;
                }
                float safeRate = rate;
                if (Float.isNaN(safeRate) || Float.isInfinite(safeRate)) {
                    safeRate = 1.0f;
                }
                safeRate = Math.max(0.5f, Math.min(2.0f, safeRate));
                textToSpeech.stop();
                ttsCallbacks.clear();
                ttsCallbacks.put(normalizedId, normalizedCallback);
                if (textToSpeech.setSpeechRate(safeRate) != TextToSpeech.SUCCESS) {
                    ttsCallbacks.remove(normalizedId);
                    return false;
                }
                int result = textToSpeech.speak(
                    normalizedText,
                    TextToSpeech.QUEUE_FLUSH,
                    null,
                    normalizedId
                );
                if (result != TextToSpeech.SUCCESS) {
                    ttsCallbacks.remove(normalizedId);
                    return false;
                }
                return true;
            }
        }

        @JavascriptInterface
        public boolean stop() {
            synchronized (ttsLock) {
                ttsCallbacks.clear();
                return textToSpeech != null && textToSpeech.stop() == TextToSpeech.SUCCESS;
            }
        }
    }

    private boolean isSelectableChineseVoice(Voice voice) {
        if (voice == null || voice.getLocale() == null || voice.isNetworkConnectionRequired()) {
            return false;
        }
        String language = voice.getLocale().getLanguage();
        return "zh".equalsIgnoreCase(language)
            || "cmn".equalsIgnoreCase(language)
            || "yue".equalsIgnoreCase(language);
    }

    private void dispatchTtsResult(String utteranceId, String status, String message) {
        final String callbackName;
        synchronized (ttsLock) {
            callbackName = ttsCallbacks.remove(utteranceId);
        }
        if (callbackName == null || callbackName.trim().isEmpty() || webView == null) {
            return;
        }
        try {
            JSONObject payload = new JSONObject();
            payload.put("utteranceId", utteranceId == null ? "" : utteranceId);
            payload.put("status", status);
            payload.put("message", message == null ? "" : message);
            final String script =
                "window['" + escapeJs(callbackName) + "'](" + payload.toString() + ")";
            webView.post(new Runnable() {
                @Override
                public void run() {
                    if (webView == null) {
                        return;
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                        webView.evaluateJavascript(script, null);
                        return;
                    }
                    webView.loadUrl("javascript:" + script);
                }
            });
        } catch (Exception error) {
            Log.e(TAG, "tts callback failed: " + error.getMessage());
        }
    }

    private String extractIncomingDeepLink(Intent intent) {
        if (intent == null) {
            return null;
        }
        String uri = intent.getDataString();
        if (uri == null || uri.trim().isEmpty()) {
            return null;
        }
        return uri.trim();
    }

    private void handleIncomingDeepLink(Intent intent) {
        String uri = extractIncomingDeepLink(intent);
        if (uri == null) {
            return;
        }
        pendingDeepLinkStore.save(uri, "onNewIntent");
        openImportScanPage();
    }

    private void openImportScanPage() {
        if (webView == null) {
            return;
        }
        pageLoaded = false;
        webView.loadUrl(APP_URL + "#/pages/import/scan?fromDeepLink=1");
    }

    private String escapeJson(String value) {
        if (value == null) {
            return "";
        }
        return value
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r");
    }

    private String escapeJs(String value) {
        return escapeJson(value).replace("'", "\\'");
    }

    private void grantCameraPermission(PermissionRequest request) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            pendingPermissionRequest = request;
            requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST);
            return;
        }
        request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != CAMERA_PERMISSION_REQUEST || pendingPermissionRequest == null
                || Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
            return;
        }
        PermissionRequest request = pendingPermissionRequest;
        pendingPermissionRequest = null;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            return;
        }
        request.deny();
    }

    private WebResourceResponse interceptAsset(Uri uri) {
        if (uri == null || !"file".equals(uri.getScheme())) {
            return null;
        }
        String path = uri.getPath();
        if (path == null || !path.startsWith("/static/")) {
            return null;
        }
        String assetPath = "www" + path;
        try {
            InputStream stream = getAssets().open(assetPath);
            return new WebResourceResponse(mimeType(path), "UTF-8", stream);
        } catch (IOException error) {
            Log.e(TAG, "asset intercept failed: " + assetPath + " " + error.getMessage());
            return null;
        }
    }

    private WebResourceResponse interceptExternalRequest(WebResourceRequest request) {
        if (request == null || request.getUrl() == null) {
            return null;
        }
        Uri uri = request.getUrl();
        String scheme = uri.getScheme();
        if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
            return null;
        }
        if (!"GET".equalsIgnoreCase(request.getMethod())) {
            return null;
        }
        String host = uri.getHost();
        if (host == null || isLocalHost(host)) {
            return null;
        }

        try {
            HttpURLConnection connection = (HttpURLConnection) new URL(uri.toString()).openConnection();
            connection.setInstanceFollowRedirects(true);
            connection.setConnectTimeout(12000);
            connection.setReadTimeout(12000);
            connection.setRequestMethod("GET");
            connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty(
                "User-Agent",
                "Mozilla/5.0 (Linux; Android) AppleWebKit/537.36 NovelReader/1.0"
            );
            Map<String, String> headers = request.getRequestHeaders();
            if (headers != null) {
                for (Map.Entry<String, String> entry : headers.entrySet()) {
                    String key = entry.getKey();
                    if (key == null || entry.getValue() == null) {
                        continue;
                    }
                    String lower = key.toLowerCase(Locale.ROOT);
                    if ("host".equals(lower) || "accept-encoding".equals(lower)
                            || "origin".equals(lower) || "referer".equals(lower)) {
                        continue;
                    }
                    connection.setRequestProperty(key, entry.getValue());
                }
            }

            int statusCode = connection.getResponseCode();
            InputStream stream = statusCode >= 400 ? connection.getErrorStream() : connection.getInputStream();
            if (stream == null) {
                return null;
            }
            String contentType = connection.getContentType();
            String mime = parseMimeType(contentType);
            String charset = parseCharset(contentType);
            Map<String, String> responseHeaders = new HashMap<>();
            responseHeaders.put("Access-Control-Allow-Origin", "*");
            responseHeaders.put("Access-Control-Allow-Methods", "GET, OPTIONS");
            responseHeaders.put("Access-Control-Allow-Headers", "*");
            responseHeaders.put("Cache-Control", "no-cache");
            return new WebResourceResponse(
                mime,
                charset,
                statusCode,
                connection.getResponseMessage() != null ? connection.getResponseMessage() : "OK",
                responseHeaders,
                stream
            );
        } catch (Exception error) {
            Log.e(TAG, "external request failed: " + uri + " " + error.getMessage());
            return null;
        }
    }

    private boolean isLocalHost(String host) {
        String value = host.toLowerCase(Locale.ROOT);
        return "localhost".equals(value)
            || value.startsWith("127.")
            || value.startsWith("10.")
            || value.startsWith("192.168.")
            || value.startsWith("172.16.")
            || value.startsWith("172.17.")
            || value.startsWith("172.18.")
            || value.startsWith("172.19.")
            || value.startsWith("172.20.")
            || value.startsWith("172.21.")
            || value.startsWith("172.22.")
            || value.startsWith("172.23.")
            || value.startsWith("172.24.")
            || value.startsWith("172.25.")
            || value.startsWith("172.26.")
            || value.startsWith("172.27.")
            || value.startsWith("172.28.")
            || value.startsWith("172.29.")
            || value.startsWith("172.30.")
            || value.startsWith("172.31.");
    }

    private String parseMimeType(String contentType) {
        if (contentType == null || contentType.trim().isEmpty()) {
            return "text/plain";
        }
        return contentType.split(";", 2)[0].trim();
    }

    private String parseCharset(String contentType) {
        if (contentType == null) {
            return "UTF-8";
        }
        for (String part : contentType.split(";")) {
            String value = part.trim();
            if (value.toLowerCase(Locale.ROOT).startsWith("charset=")) {
                return value.substring("charset=".length()).trim();
            }
        }
        return "UTF-8";
    }

    private String mimeType(String path) {
        if (path.endsWith(".png")) {
            return "image/png";
        }
        if (path.endsWith(".svg")) {
            return "image/svg+xml";
        }
        if (path.endsWith(".css")) {
            return "text/css";
        }
        if (path.endsWith(".js")) {
            return "application/javascript";
        }
        if (path.endsWith(".txt")) {
            return "text/plain";
        }
        return "application/octet-stream";
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        launchHandler.removeCallbacksAndMessages(null);
        if (sourceHttpBridge != null) {
            sourceHttpBridge.shutdown();
            sourceHttpBridge = null;
        }
        launchLabel = null;
        launchRoot = null;
        synchronized (ttsLock) {
            ttsCallbacks.clear();
            if (textToSpeech != null) {
                textToSpeech.stop();
                textToSpeech.shutdown();
                textToSpeech = null;
            }
            defaultTtsVoice = null;
            ttsReady = false;
            ttsStatus = "destroyed";
        }
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
