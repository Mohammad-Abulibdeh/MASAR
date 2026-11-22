package com.masar.app.car;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.util.JsonReader;

import com.masar.app.NavState;

import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Draws the road network in MASAR's colours on the car display, centred on the car.
 * The roads are read once from the same data file the phone uses (www/data/network.js).
 */
final class CarMap {
    private static final double CELL_DEG = 0.01;
    private static final float METERS_PER_DP = 1.7f;
    private static final double MANARA_LAT = 31.904947, MANARA_LNG = 35.20443;
    private static CarMap instance;

    private final Handler main = new Handler(Looper.getMainLooper());
    private volatile boolean loaded;
    private Runnable onLoaded;
    private float[][] roads;          // lat, lng, lat, lng, ... per road segment
    private byte[] ranks;             // 0 side road ... 3 main road
    private final Map<Long, int[]> cells = new HashMap<>();
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path = new Path();

    static synchronized CarMap get(Context context) {
        if (instance == null) {
            instance = new CarMap();
            Context app = context.getApplicationContext();
            new Thread(() -> instance.load(app)).start();
        }
        return instance;
    }

    void setOnLoaded(Runnable r) {
        onLoaded = r;
        if (loaded) main.post(r);
    }

    // ---------------------------------------------------------------- loading
    private void load(Context context) {
        try (Reader in = new InputStreamReader(context.getAssets().open("www/data/network.js"), StandardCharsets.UTF_8)) {
            int c;
            while ((c = in.read()) != -1 && c != '=') { /* skip "window.MASAR_NET" */ }
            JsonReader json = new JsonReader(in);
            json.setLenient(true);
            double[] lat = null, lng = null;
            List<double[]> edgeList = new ArrayList<>();
            List<int[]> ends = new ArrayList<>();
            List<Integer> rankList = new ArrayList<>();
            json.beginObject();
            while (json.hasNext()) {
                String name = json.nextName();
                if ("lat".equals(name)) lat = readDoubles(json);
                else if ("lng".equals(name)) lng = readDoubles(json);
                else if ("edges".equals(name)) readEdges(json, edgeList, ends, rankList);
                else json.skipValue();
            }
            build(lat, lng, edgeList, ends, rankList);
        } catch (IOException | RuntimeException e) {
            return;  // no map: the car screen still shows directions
        }
        loaded = true;
        Runnable r = onLoaded;
        if (r != null) main.post(r);
    }

    private static double[] readDoubles(JsonReader json) throws IOException {
        List<Double> list = new ArrayList<>();
        json.beginArray();
        while (json.hasNext()) list.add(json.nextDouble());
        json.endArray();
        double[] out = new double[list.size()];
        for (int i = 0; i < out.length; i++) out[i] = list.get(i);
        return out;
    }

    /* Each edge is [from, to, length, speed, name, rank, [[lat, lng], ...]]. */
    private static void readEdges(JsonReader json, List<double[]> coords, List<int[]> ends, List<Integer> ranks)
            throws IOException {
        json.beginArray();
        while (json.hasNext()) {
            json.beginArray();
            int u = json.nextInt(), v = json.nextInt();
            json.skipValue();
            json.skipValue();
            json.skipValue();
            int rank = json.nextInt();
            List<Double> pts = new ArrayList<>();
            json.beginArray();
            while (json.hasNext()) {
                json.beginArray();
                pts.add(json.nextDouble());
                pts.add(json.nextDouble());
                json.endArray();
            }
            json.endArray();
            json.endArray();
            double[] inner = new double[pts.size()];
            for (int i = 0; i < inner.length; i++) inner[i] = pts.get(i);
            coords.add(inner);
            ends.add(new int[]{u, v});
            ranks.add(rank);
        }
        json.endArray();
    }

    private void build(double[] lat, double[] lng, List<double[]> coords, List<int[]> ends, List<Integer> rankList) {
        Set<Long> seen = new HashSet<>();
        List<float[]> keep = new ArrayList<>();
        List<Byte> keepRank = new ArrayList<>();
        Map<Long, List<Integer>> grid = new HashMap<>();
        for (int i = 0; i < ends.size(); i++) {
            int u = ends.get(i)[0], v = ends.get(i)[1];
            if (seen.contains(((long) v << 32) | u)) continue;  // two-way road: draw it once
            seen.add(((long) u << 32) | v);
            double[] inner = coords.get(i);
            float[] line = new float[inner.length + 4];
            line[0] = (float) lat[u];
            line[1] = (float) lng[u];
            for (int j = 0; j < inner.length; j++) line[j + 2] = (float) inner[j];
            line[line.length - 2] = (float) lat[v];
            line[line.length - 1] = (float) lng[v];
            int id = keep.size();
            keep.add(line);
            keepRank.add((byte) (int) rankList.get(i));
            grid.computeIfAbsent(cell(lat[u], lng[u]), k -> new ArrayList<>()).add(id);
        }
        roads = keep.toArray(new float[0][]);
        ranks = new byte[keepRank.size()];
        for (int i = 0; i < ranks.length; i++) ranks[i] = keepRank.get(i);
        for (Map.Entry<Long, List<Integer>> e : grid.entrySet()) {
            int[] ids = new int[e.getValue().size()];
            for (int i = 0; i < ids.length; i++) ids[i] = e.getValue().get(i);
            cells.put(e.getKey(), ids);
        }
    }

    private static long cell(double lat, double lng) {
        return ((long) Math.floor(lat / CELL_DEG) << 32) ^ ((long) Math.floor(lng / CELL_DEG) & 0xffffffffL);
    }

    // ---------------------------------------------------------------- drawing
    /** Colours: background, side road casing, side road, main road casing, main road. */
    private static final int[] LIGHT = {0xFFFFF4D9, 0xFFD8CBB0, 0xFFFFFFFF, 0xFF1D0F3A, 0xFFFFD21F};
    private static final int[] DARK = {0xFF1D0F3A, 0xFF2A1B52, 0xFF4A3A7A, 0xFF120828, 0xFFFFD21F};
    private static final Map<String, Integer> BANDS = new HashMap<>();
    static {
        BANDS.put("low", 0xFF19E68C);
        BANDS.put("moderate", 0xFFFFE11A);
        BANDS.put("heavy", 0xFFFF8A1F);
        BANDS.put("very_heavy", 0xFFFF2D55);
    }

    void draw(Canvas canvas, Rect area, int dpi, boolean dark, NavState.Snapshot s, NavState.Route route) {
        int[] colors = dark ? DARK : LIGHT;
        canvas.drawColor(colors[0]);
        float density = Math.max(dpi, 120) / 160f;
        double mpp = METERS_PER_DP / density;
        double clat = s.navigating ? s.lat : MANARA_LAT, clng = s.navigating ? s.lng : MANARA_LNG;
        if (clat == 0 && clng == 0) { clat = MANARA_LAT; clng = MANARA_LNG; }
        float cx = area.exactCenterX(), cy = area.top + area.height() * (s.navigating ? 0.68f : 0.5f);
        Projection p = new Projection(clat, clng, mpp, cx, cy);

        if (loaded) drawRoads(canvas, p, canvas.getWidth(), canvas.getHeight(), colors, density);
        if (s.navigating && route != null) drawRoute(canvas, p, route, density);
        if (s.navigating) drawCar(canvas, cx, cy, (float) s.bearing, density);
    }

    private void drawRoads(Canvas canvas, Projection p, int w, int h, int[] colors, float density) {
        double padLat = h * p.mpp / 110540.0, padLng = w * p.mpp / (111320.0 * p.cos);
        double south = p.lat - padLat, north = p.lat + padLat, west = p.lng - padLng, east = p.lng + padLng;
        List<Integer> visible = new ArrayList<>();
        for (double la = Math.floor(south / CELL_DEG) * CELL_DEG; la <= north; la += CELL_DEG) {
            for (double lo = Math.floor(west / CELL_DEG) * CELL_DEG; lo <= east; lo += CELL_DEG) {
                int[] ids = cells.get(cell(la + CELL_DEG / 2, lo + CELL_DEG / 2));
                if (ids != null) for (int id : ids) visible.add(id);
            }
        }
        float[] casing = {5f, 6f, 8f, 9.5f}, fill = {3f, 4f, 5.5f, 7f};
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setStrokeJoin(Paint.Join.ROUND);
        for (int pass = 0; pass < 2; pass++) {
            for (int rank = 0; rank < 4; rank++) {
                path.reset();
                for (int id : visible) if (ranks[id] == rank) addLine(path, p, roads[id]);
                boolean main = rank >= 2;
                paint.setColor(pass == 0 ? (main ? colors[3] : colors[1]) : (main ? colors[4] : colors[2]));
                paint.setStrokeWidth((pass == 0 ? casing[rank] : fill[rank]) * density);
                canvas.drawPath(path, paint);
            }
        }
    }

    private void drawRoute(Canvas canvas, Projection p, NavState.Route route, float density) {
        path.reset();
        for (double[] line : route.lines) addLine(path, p, line);
        paint.setColor(0xFF1D0F3A);
        paint.setStrokeWidth(11 * density);
        canvas.drawPath(path, paint);
        paint.setStrokeWidth(7 * density);
        for (int i = 0; i < route.lines.length; i++) {
            path.reset();
            addLine(path, p, route.lines[i]);
            Integer c = BANDS.get(route.bands[i]);
            paint.setColor(c != null ? c : 0xFF27D7FF);
            canvas.drawPath(path, paint);
        }
        paint.setStyle(Paint.Style.FILL);
        float dx = p.x(route.destLng), dy = p.y(route.destLat);
        paint.setColor(0xFF1D0F3A);
        canvas.drawCircle(dx, dy, 11 * density, paint);
        paint.setColor(0xFFFF3D8B);
        canvas.drawCircle(dx, dy, 8 * density, paint);
        paint.setColor(Color.WHITE);
        canvas.drawCircle(dx, dy, 3 * density, paint);
        paint.setStyle(Paint.Style.STROKE);
    }

    private void drawCar(Canvas canvas, float x, float y, float bearing, float density) {
        canvas.save();
        canvas.rotate(bearing, x, y);
        Path car = new Path();
        float s = 13 * density;
        car.moveTo(x, y - s);
        car.lineTo(x + s * 0.75f, y + s * 0.8f);
        car.lineTo(x, y + s * 0.4f);
        car.lineTo(x - s * 0.75f, y + s * 0.8f);
        car.close();
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(0xFFFFD21F);
        canvas.drawPath(car, paint);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(3 * density);
        paint.setColor(0xFF1D0F3A);
        canvas.drawPath(car, paint);
        canvas.restore();
    }

    private static void addLine(Path path, Projection p, float[] line) {
        path.moveTo(p.x(line[1]), p.y(line[0]));
        for (int i = 2; i + 1 < line.length; i += 2) path.lineTo(p.x(line[i + 1]), p.y(line[i]));
    }

    private static void addLine(Path path, Projection p, double[] line) {
        path.moveTo(p.x(line[1]), p.y(line[0]));
        for (int i = 2; i + 1 < line.length; i += 2) path.lineTo(p.x(line[i + 1]), p.y(line[i]));
    }

    /** Flat projection around the car: fine for the few kilometres a car screen shows. */
    private static final class Projection {
        final double lat, lng, mpp, cos;
        final float cx, cy;

        Projection(double lat, double lng, double mpp, float cx, float cy) {
            this.lat = lat;
            this.lng = lng;
            this.mpp = mpp;
            this.cos = Math.cos(Math.toRadians(lat));
            this.cx = cx;
            this.cy = cy;
        }

        float x(double lngValue) { return (float) (cx + (lngValue - lng) * 111320.0 * cos / mpp); }
        float y(double latValue) { return (float) (cy - (latValue - lat) * 110540.0 / mpp); }
    }
}
