package com.novelreader.v1;

import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.nio.charset.Charset;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class SourceHttpBridge {
    private static final int DEFAULT_TIMEOUT_MS = 12000;
    private static final int MAX_TIMEOUT_MS = 60000;
    private static final int DEFAULT_MAX_BYTES = 4 * 1024 * 1024;
    private static final int ABSOLUTE_MAX_BYTES = 8 * 1024 * 1024;
    private static final int MAX_REDIRECTS = 5;
    private static final Pattern CALLBACK_PATTERN = Pattern.compile("^[A-Za-z_$][A-Za-z0-9_$]{0,127}$");
    private static final Pattern CHARSET_PATTERN = Pattern.compile("charset\\s*=\\s*[\\\"']?([^;\\s\\\"']+)", Pattern.CASE_INSENSITIVE);

    private final WebView webView;
    private final ExecutorService executor = Executors.newFixedThreadPool(4);
    private final ConcurrentHashMap<String, String> cookieJar = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> lastRequestAt = new ConcurrentHashMap<>();

    public SourceHttpBridge(WebView webView) {
        this.webView = webView;
    }

    @JavascriptInterface
    public String capabilities() {
        JSONObject result = new JSONObject();
        try {
            result.put("native", true);
            result.put("version", 1);
            result.put("methods", new JSONArray().put("GET").put("POST"));
            result.put("charsets", new JSONArray().put("utf-8").put("gbk").put("gb2312").put("gb18030"));
            result.put("cookies", true);
            result.put("maxResponseBytes", ABSOLUTE_MAX_BYTES);
            result.put("maxRedirects", MAX_REDIRECTS);
            result.put("maxConcurrency", 4);
        } catch (Exception ignored) {
            // JSONObject operations above cannot fail with these values.
        }
        return result.toString();
    }

    @JavascriptInterface
    public boolean request(final String requestJson, final String callbackName) {
        if (callbackName == null || !CALLBACK_PATTERN.matcher(callbackName).matches()) return false;
        executor.execute(new Runnable() {
            @Override public void run() {
                executeRequest(requestJson, callbackName);
            }
        });
        return true;
    }

    public void shutdown() {
        executor.shutdownNow();
        cookieJar.clear();
        lastRequestAt.clear();
    }

    private void executeRequest(String requestJson, String callbackName) {
        long startedAt = System.currentTimeMillis();
        JSONObject result;
        try {
            JSONObject request = new JSONObject(requestJson == null ? "{}" : requestJson);
            result = perform(request, startedAt);
        } catch (SecurityException error) {
            result = failure("TARGET_BLOCKED", safeMessage(error, "目标地址已被安全策略阻止"), 0, startedAt);
        } catch (SocketTimeoutException error) {
            result = failure("TIMEOUT", "书源请求超时", 0, startedAt);
        } catch (Exception error) {
            result = failure("NETWORK_ERROR", safeMessage(error, "书源网络请求失败"), 0, startedAt);
        }
        dispatch(callbackName, result);
    }

    private JSONObject perform(JSONObject request, long startedAt) throws Exception {
        String method = request.optString("method", "GET").toUpperCase(Locale.US);
        if (!"GET".equals(method) && !"POST".equals(method)) {
            return failure("METHOD_NOT_ALLOWED", "仅支持 GET/POST 请求", 0, startedAt);
        }
        int timeoutMs = clamp(request.optInt("timeoutMs", DEFAULT_TIMEOUT_MS), 1000, MAX_TIMEOUT_MS);
        int maxBytes = clamp(request.optInt("maxBytes", DEFAULT_MAX_BYTES), 1024, ABSOLUTE_MAX_BYTES);
        String sourceKey = request.optString("sourceKey", "anonymous");
        String body = request.optString("body", "");
        JSONObject requestedHeaders = request.optJSONObject("headers");
        URL currentUrl = validateUrl(encodeLegacyUrl(request.optString("url", ""), request.optString("charset", "")));
        URL previousUrl = null;
        Map<String, String> headers = jsonHeaders(requestedHeaders);

        String explicitUserAgent = request.optString("userAgent", "");
        if (!explicitUserAgent.isEmpty()) headers.put("User-Agent", explicitUserAgent);
        String explicitReferer = request.optString("referer", "");
        if (!explicitReferer.isEmpty()) headers.put("Referer", explicitReferer);

        for (int redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
            validateUrl(currentUrl.toString());
            if (previousUrl != null && !sameOrigin(previousUrl, currentUrl)) {
                removeHeaderIgnoreCase(headers, "Authorization");
                removeHeaderIgnoreCase(headers, "Proxy-Authorization");
                removeHeaderIgnoreCase(headers, "Cookie");
            }
            applyRateLimit(sourceKey, currentUrl, request.optInt("requestIntervalMs", 0));

            HttpURLConnection connection = (HttpURLConnection) currentUrl.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(timeoutMs);
            connection.setReadTimeout(timeoutMs);
            connection.setRequestMethod(method);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept-Encoding", "identity");
            for (Map.Entry<String, String> header : headers.entrySet()) {
                connection.setRequestProperty(header.getKey(), header.getValue());
            }
            String cookie = request.optString("cookie", "");
            if (cookie.isEmpty()) cookie = cookieJar.get(cookieKey(sourceKey, currentUrl));
            if (cookie != null && !cookie.isEmpty()) connection.setRequestProperty("Cookie", cookie);

            if ("POST".equals(method)) {
                connection.setDoOutput(true);
                String requestCharset = resolveRequestCharset(request.optString("charset", ""));
                String contentType = connection.getRequestProperty("Content-Type");
                if (contentType != null && contentType.toLowerCase(Locale.US).contains("application/x-www-form-urlencoded")
                    && !contentType.toLowerCase(Locale.US).contains("charset=")) {
                    connection.setRequestProperty("Content-Type", contentType + "; charset=" + requestCharset);
                }
                byte[] bytes = body.getBytes(Charset.forName(requestCharset));
                connection.setFixedLengthStreamingMode(bytes.length);
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(bytes);
                }
            }

            int status = connection.getResponseCode();
            storeCookies(sourceKey, currentUrl, connection.getHeaderFields());
            if (status >= 300 && status < 400) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                if (location == null || location.trim().isEmpty()) {
                    return failure("REDIRECT_INVALID", "站点返回了无目标的重定向", status, startedAt);
                }
                if (redirects == MAX_REDIRECTS) {
                    return failure("TOO_MANY_REDIRECTS", "书源重定向次数过多", status, startedAt);
                }
                previousUrl = currentUrl;
                currentUrl = validateUrl(new URL(currentUrl, location).toString());
                if (status == 303 || ((status == 301 || status == 302) && "POST".equals(method))) {
                    method = "GET";
                    body = "";
                }
                continue;
            }

            InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            byte[] bytes = readLimited(stream, maxBytes);
            String charsetName = resolveCharset(request.optString("charset", ""), connection.getContentType());
            String text = new String(bytes, Charset.forName(charsetName));
            JSONObject responseHeaders = responseHeaders(connection.getHeaderFields());
            connection.disconnect();

            JSONObject response = new JSONObject();
            response.put("ok", status >= 200 && status < 400);
            response.put("status", status);
            response.put("finalUrl", currentUrl.toString());
            response.put("headers", responseHeaders);
            response.put("text", text);
            response.put("charset", charsetName.toLowerCase(Locale.US));
            response.put("elapsedMs", System.currentTimeMillis() - startedAt);
            response.put("errorCode", status >= 400 ? "HTTP_ERROR" : "");
            response.put("message", status >= 400 ? "HTTP " + status : "");
            return response;
        }
        return failure("TOO_MANY_REDIRECTS", "书源重定向次数过多", 0, startedAt);
    }

    private URL validateUrl(String value) throws Exception {
        URL url = new URL(value);
        String protocol = url.getProtocol().toLowerCase(Locale.US);
        if (!"http".equals(protocol) && !"https".equals(protocol)) throw new SecurityException("仅允许 HTTP/HTTPS 地址");
        if (url.getUserInfo() != null) throw new SecurityException("目标地址不能包含用户凭据");
        String host = url.getHost();
        if (host == null || host.trim().isEmpty()) throw new SecurityException("目标地址缺少主机名");
        InetAddress[] addresses = InetAddress.getAllByName(host);
        if (addresses.length == 0) throw new SecurityException("目标域名无法解析");
        for (InetAddress address : addresses) {
            if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                || address.isSiteLocalAddress() || address.isMulticastAddress()) {
                throw new SecurityException("禁止访问私网、回环或链路本地地址");
            }
        }
        return url;
    }

    private byte[] readLimited(InputStream stream, int maxBytes) throws Exception {
        if (stream == null) return new byte[0];
        try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int total = 0;
            int count;
            while ((count = input.read(buffer)) != -1) {
                total += count;
                if (total > maxBytes) throw new SecurityException("响应内容超过大小限制");
                output.write(buffer, 0, count);
            }
            return output.toByteArray();
        }
    }

    private void storeCookies(String sourceKey, URL url, Map<String, List<String>> fields) {
        if (fields == null) return;
        for (Map.Entry<String, List<String>> entry : fields.entrySet()) {
            if (entry.getKey() == null || !"set-cookie".equalsIgnoreCase(entry.getKey())) continue;
            StringBuilder cookies = new StringBuilder();
            for (String rawCookie : entry.getValue()) {
                if (rawCookie == null || rawCookie.isEmpty()) continue;
                String pair = rawCookie.split(";", 2)[0].trim();
                if (pair.isEmpty()) continue;
                if (cookies.length() > 0) cookies.append("; ");
                cookies.append(pair);
            }
            if (cookies.length() > 0) cookieJar.put(cookieKey(sourceKey, url), cookies.toString());
        }
    }

    private String cookieKey(String sourceKey, URL url) {
        return sourceKey + "|" + url.getHost().toLowerCase(Locale.US);
    }

    private void applyRateLimit(String sourceKey, URL url, int requestedIntervalMs) throws InterruptedException {
        int interval = clamp(requestedIntervalMs, 0, 10000);
        if (interval == 0) return;
        String key = cookieKey(sourceKey, url);
        long now = System.currentTimeMillis();
        Long previous = lastRequestAt.put(key, now);
        if (previous != null) {
            long waitMs = interval - (now - previous);
            if (waitMs > 0) Thread.sleep(waitMs);
        }
        lastRequestAt.put(key, System.currentTimeMillis());
    }

    private Map<String, String> jsonHeaders(JSONObject object) {
        Map<String, String> headers = new HashMap<>();
        if (object == null) return headers;
        java.util.Iterator<String> keys = object.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            String value = object.optString(key, "");
            if (!key.trim().isEmpty() && !value.isEmpty()) headers.put(key, value);
        }
        return headers;
    }

    private JSONObject responseHeaders(Map<String, List<String>> fields) throws Exception {
        JSONObject result = new JSONObject();
        if (fields == null) return result;
        for (Map.Entry<String, List<String>> entry : fields.entrySet()) {
            if (entry.getKey() == null || entry.getValue() == null) continue;
            if ("set-cookie".equalsIgnoreCase(entry.getKey())) continue;
            result.put(entry.getKey(), join(entry.getValue()));
        }
        return result;
    }

    private String resolveCharset(String requested, String contentType) {
        String candidate = requested == null ? "" : requested.trim();
        if (candidate.isEmpty() && contentType != null) {
            Matcher matcher = CHARSET_PATTERN.matcher(contentType);
            if (matcher.find()) candidate = matcher.group(1);
        }
        if (candidate.isEmpty()) return "UTF-8";
        if ("gb2312".equalsIgnoreCase(candidate)) candidate = "GBK";
        try {
            Charset.forName(candidate);
            return candidate;
        } catch (Exception ignored) {
            return "UTF-8";
        }
    }

    private String resolveRequestCharset(String requested) {
        String candidate = requested == null ? "" : requested.trim().toLowerCase(Locale.US);
        if ("gb18030".equals(candidate)) return "GB18030";
        if ("gbk".equals(candidate) || "gb2312".equals(candidate)) return "GBK";
        return "UTF-8";
    }

    private String encodeLegacyUrl(String value, String requestedCharset) throws Exception {
        String charset = resolveRequestCharset(requestedCharset);
        if ("UTF-8".equals(charset)) return value;
        StringBuilder output = new StringBuilder();
        for (int index = 0; index < value.length();) {
            int codePoint = value.codePointAt(index);
            String character = new String(Character.toChars(codePoint));
            index += Character.charCount(codePoint);
            if (codePoint <= 0x7f) {
                output.append(character);
                continue;
            }
            byte[] bytes = character.getBytes(Charset.forName(charset));
            for (byte item : bytes) {
                output.append('%');
                String hex = Integer.toHexString(item & 0xff).toUpperCase(Locale.US);
                if (hex.length() < 2) output.append('0');
                output.append(hex);
            }
        }
        return output.toString();
    }

    private boolean sameOrigin(URL left, URL right) {
        return left.getProtocol().equalsIgnoreCase(right.getProtocol())
            && left.getHost().equalsIgnoreCase(right.getHost())
            && effectivePort(left) == effectivePort(right);
    }

    private int effectivePort(URL url) {
        if (url.getPort() >= 0) return url.getPort();
        return "https".equalsIgnoreCase(url.getProtocol()) ? 443 : 80;
    }

    private void removeHeaderIgnoreCase(Map<String, String> headers, String target) {
        String matched = null;
        for (String key : headers.keySet()) {
            if (target.equalsIgnoreCase(key)) {
                matched = key;
                break;
            }
        }
        if (matched != null) headers.remove(matched);
    }

    private JSONObject failure(String code, String message, int status, long startedAt) {
        JSONObject result = new JSONObject();
        try {
            result.put("ok", false);
            result.put("status", status);
            result.put("finalUrl", "");
            result.put("headers", new JSONObject());
            result.put("text", "");
            result.put("charset", "");
            result.put("elapsedMs", System.currentTimeMillis() - startedAt);
            result.put("errorCode", code);
            result.put("message", message);
        } catch (Exception ignored) {
            // JSONObject operations above cannot fail with these values.
        }
        return result;
    }

    private void dispatch(String callbackName, JSONObject result) {
        final String script = "if(window[" + JSONObject.quote(callbackName) + "])window["
            + JSONObject.quote(callbackName) + "](" + result.toString() + ");";
        webView.post(new Runnable() {
            @Override public void run() {
                webView.evaluateJavascript(script, null);
            }
        });
    }

    private String safeMessage(Exception error, String fallback) {
        String message = error.getMessage();
        return message == null || message.trim().isEmpty() ? fallback : message;
    }

    private String join(List<String> values) {
        StringBuilder result = new StringBuilder();
        for (String value : values) {
            if (result.length() > 0) result.append(", ");
            result.append(value);
        }
        return result.toString();
    }

    private int clamp(int value, int minimum, int maximum) {
        return Math.max(minimum, Math.min(maximum, value));
    }
}
