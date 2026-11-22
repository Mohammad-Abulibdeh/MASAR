package com.masar.app;

import android.content.Intent;
import android.net.Uri;

import org.json.JSONObject;

import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLDecoder;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Turns a location another app sent (geo: link, Google Maps link, shared text) into
 * {"lat":..,"lng":..,"label":..} or {"query":..} for the page. Short links (maps.app.goo.gl)
 * are opened once to read where they point.
 */
final class SharedPlace {
    private static final Pattern PAIR = Pattern.compile("(-?\\d{1,2}\\.\\d{3,})\\s*,\\s*(-?\\d{1,3}\\.\\d{3,})");
    private static final Pattern AT = Pattern.compile("@(-?\\d{1,2}\\.\\d+),(-?\\d{1,3}\\.\\d+)");
    private static final Pattern DATA = Pattern.compile("!3d(-?\\d{1,2}\\.\\d+)!4d(-?\\d{1,3}\\.\\d+)");
    private static final Pattern LINK = Pattern.compile("https?://\\S+");

    private SharedPlace() {}

    /** The link or text in an intent, or null when it carries no place. */
    static String raw(Intent intent) {
        if (intent == null) return null;
        if (Intent.ACTION_VIEW.equals(intent.getAction()) && intent.getData() != null) return intent.getData().toString();
        if (Intent.ACTION_SEND.equals(intent.getAction())) return intent.getStringExtra(Intent.EXTRA_TEXT);
        return null;
    }

    /** Must run off the main thread: a short link needs the network. */
    static String resolve(String raw) {
        if (raw == null) return null;
        try {
            String text = raw.trim(), link = null, label = null;
            Matcher lm = LINK.matcher(text);
            if (text.startsWith("geo:")) link = text;
            else if (lm.find()) {
                link = lm.group();
                String before = text.substring(0, lm.start()).replaceAll("[:\\-–\\s]+$", "").trim();
                if (!before.isEmpty() && before.length() <= 60) label = before;
            }
            if (link != null && isShort(link)) link = follow(link);
            JSONObject o = link != null ? fromLink(link) : null;
            if (o == null) o = pair(text);
            if (o == null) return null;
            if (label != null && !o.has("label") && o.has("lat")) o.put("label", label);
            return o.toString();
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean isShort(String link) {
        String host = Uri.parse(link).getHost();
        return host != null && (host.equals("maps.app.goo.gl") || host.equals("goo.gl"));
    }

    /** Reads the redirects of a short link without loading the page. */
    private static String follow(String link) throws Exception {
        String at = link;
        for (int hop = 0; hop < 5; hop++) {
            HttpURLConnection c = (HttpURLConnection) new URL(at).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(6000);
            c.setReadTimeout(6000);
            c.setRequestMethod("GET");
            int code = c.getResponseCode();
            String next = c.getHeaderField("Location");
            c.disconnect();
            if (code < 300 || code >= 400 || next == null) return at;
            at = new URL(new URL(at), next).toString();
            if (!isShort(at)) return at;
        }
        return at;
    }

    private static JSONObject fromLink(String link) throws Exception {
        String s = URLDecoder.decode(link, "UTF-8");
        if (s.startsWith("geo:")) {
            // geo:lat,lng  or  geo:0,0?q=lat,lng(Label)  or  geo:0,0?q=Some place
            String q = s.contains("?q=") ? s.substring(s.indexOf("?q=") + 3) : null;
            JSONObject o = q != null ? pair(q) : null;
            if (o == null) {
                o = pair(s);
                if (o != null && o.getDouble("lat") == 0 && o.getDouble("lng") == 0) o = null;
            }
            if (o == null && q != null && !q.trim().isEmpty()) return new JSONObject().put("query", q.replaceAll("\\+", " ").trim());
            if (o != null && q != null) {
                Matcher name = Pattern.compile("\\(([^)]+)\\)").matcher(q);
                if (name.find()) o.put("label", name.group(1).replace('+', ' '));
            }
            return o;
        }
        Matcher m = DATA.matcher(s);
        if (m.find()) return place(m.group(1), m.group(2));
        Uri u = Uri.parse(link);
        for (String key : new String[]{"q", "query", "ll", "daddr", "destination", "center"}) {
            String v = u.getQueryParameter(key);
            if (v == null) continue;
            JSONObject o = pair(v);
            if (o != null) return o;
        }
        m = AT.matcher(s);
        if (m.find()) return place(m.group(1), m.group(2));
        for (String key : new String[]{"q", "query", "daddr", "destination"}) {
            String v = u.getQueryParameter(key);
            if (v != null && !v.trim().isEmpty()) return new JSONObject().put("query", v.trim());
        }
        // maps/place/Some+Name/...
        Matcher p = Pattern.compile("/place/([^/@]+)").matcher(s);
        if (p.find()) return new JSONObject().put("query", p.group(1).replace('+', ' ').trim());
        return null;
    }

    private static JSONObject pair(String s) throws Exception {
        Matcher m = PAIR.matcher(s);
        return m.find() ? place(m.group(1), m.group(2)) : null;
    }

    private static JSONObject place(String lat, String lng) throws Exception {
        return new JSONObject().put("lat", Double.parseDouble(lat)).put("lng", Double.parseDouble(lng));
    }
}
