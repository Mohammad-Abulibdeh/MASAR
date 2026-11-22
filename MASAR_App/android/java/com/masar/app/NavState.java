package com.masar.app;

import android.location.Location;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.concurrent.CopyOnWriteArrayList;

/**
 * What the phone is doing right now, shared by the phone screen, the GPS service and the car screen.
 * The page (WebView) does the routing; this class only carries its results and the GPS fixes around.
 */
public final class NavState {
    private NavState() {}

    /** One update from the page. Immutable, so the car screen can read it from any thread. */
    public static final class Snapshot {
        public final boolean navigating, loading;
        public final String turn, street, cue, dest, msg, msgText;
        public final double dist, leftM, leftS, lat, lng, bearing;
        public final long eta;

        Snapshot(JSONObject o) {
            navigating = o.optBoolean("nav");
            loading = o.optBoolean("loading");
            turn = o.optString("turn", "straight");
            street = o.optString("street", "");
            cue = o.optString("cue", "");
            dest = o.optString("dest", "");
            msg = o.optString("msg", "");
            msgText = o.optString("msgText", "");
            dist = o.optDouble("dist", 0);
            leftM = o.optDouble("leftM", 0);
            leftS = o.optDouble("leftS", 0);
            lat = o.optDouble("lat", 0);
            lng = o.optDouble("lng", 0);
            bearing = o.optDouble("bearing", 0);
            eta = o.optLong("eta", 0);
        }
    }

    /** The route on the map: one polyline per road segment, coloured by its traffic band. */
    public static final class Route {
        public final double[][] lines;
        public final String[] bands;
        public final double destLat, destLng;

        Route(JSONObject o) throws JSONException {
            JSONArray edges = o.getJSONArray("edges");
            lines = new double[edges.length()][];
            bands = new String[edges.length()];
            for (int i = 0; i < edges.length(); i++) {
                JSONArray e = edges.getJSONArray(i);
                bands[i] = e.getString(0);
                lines[i] = new double[e.length() - 1];
                for (int j = 1; j < e.length(); j++) lines[i][j - 1] = e.getDouble(j);
            }
            JSONArray d = o.getJSONArray("dest");
            destLat = d.getDouble(0);
            destLng = d.getDouble(1);
        }
    }

    /** What the car screen can ask the phone to do. Set by MainActivity while it is alive. */
    public interface Controller {
        void stopNavigation();
        void setMuted(boolean muted);
    }

    public interface Listener { void onNavChanged(); }
    public interface FixListener { void onFix(Location location); }

    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static final CopyOnWriteArrayList<Listener> LISTENERS = new CopyOnWriteArrayList<>();
    private static volatile Snapshot snapshot = new Snapshot(new JSONObject());
    private static volatile Route route;
    private static volatile boolean muted;
    public static volatile Controller controller;
    public static volatile FixListener fixListener;

    public static Snapshot now() { return snapshot; }
    public static Route route() { return route; }
    public static boolean muted() { return muted; }

    public static void update(String json) {
        try {
            snapshot = new Snapshot(new JSONObject(json));
        } catch (JSONException e) {
            return;
        }
        notifyListeners();
    }

    public static void setRoute(String json) {
        try {
            route = new Route(new JSONObject(json));
        } catch (JSONException e) {
            return;
        }
        notifyListeners();
    }

    public static void setMuted(boolean value) {
        muted = value;
        notifyListeners();
    }

    public static void fix(Location location) {
        FixListener l = fixListener;
        if (l != null) l.onFix(location);
    }

    public static void addListener(Listener l) { LISTENERS.add(l); }
    public static void removeListener(Listener l) { LISTENERS.remove(l); }

    /* A failure on the car side (the car disconnecting, say) must never stop navigation on the phone. */
    private static void notifyListeners() {
        MAIN.post(() -> {
            for (Listener l : LISTENERS) {
                try {
                    l.onNavChanged();
                } catch (RuntimeException e) {
                    Log.w("MasarCar", "car screen update failed", e);
                }
            }
        });
    }
}
