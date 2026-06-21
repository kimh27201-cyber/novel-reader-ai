package com.novelreader.v1;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import android.view.ViewGroup;
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

import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final String TAG = "NovelReaderWebView";
    private static final int CAMERA_PERMISSION_REQUEST = 1001;
    private static final int FILE_CHOOSER_REQUEST = 1002;
    private static final int SCAN_QR_REQUEST = 1003;
    private WebView webView;
    private PermissionRequest pendingPermissionRequest;
    private ValueCallback<Uri[]> filePathCallback;
    private String scanCallbackName;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(
            webView,
            new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );
        configureWebView(webView);
        webView.loadUrl("file:///android_asset/www/index.html");
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
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        view.clearCache(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            settings.setAllowFileAccessFromFileURLs(true);
            settings.setAllowUniversalAccessFromFileURLs(true);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
        view.addJavascriptInterface(new LocalChapterBridge(), "NovelReaderLocalStorage");
        view.addJavascriptInterface(new ScanBridge(), "NovelReaderScan");
        view.addJavascriptInterface(new RenderedHtmlBridge(), "NovelReaderWebViewParser");
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
                response = interceptExternalRequest(request);
                return response != null ? response : super.shouldInterceptRequest(view, request);
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

    public class RenderedHtmlBridge {
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
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
