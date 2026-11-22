package com.masar.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.provider.Settings;
import android.util.Base64;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.List;

/** Reads and controls whatever music app is playing, for the music bar on the driving screen. */
final class Music {
    private final Context context;
    private String artKey;
    private String artData;

    Music(Context context) { this.context = context; }

    boolean allowed() {
        String list = Settings.Secure.getString(context.getContentResolver(), "enabled_notification_listeners");
        return list != null && list.contains(context.getPackageName());
    }

    /** The session that is playing, else the most recent one. */
    private MediaController current() {
        if (!allowed()) return null;
        MediaSessionManager msm = (MediaSessionManager) context.getSystemService(Context.MEDIA_SESSION_SERVICE);
        try {
            List<MediaController> list = msm.getActiveSessions(new ComponentName(context, MediaListener.class));
            for (MediaController c : list) {
                PlaybackState s = c.getPlaybackState();
                if (s != null && s.getState() == PlaybackState.STATE_PLAYING) return c;
            }
            return list.isEmpty() ? null : list.get(0);
        } catch (SecurityException e) {
            return null;
        }
    }

    String state() {
        JSONObject o = new JSONObject();
        try {
            o.put("allowed", allowed());
            MediaController c = current();
            if (c == null) return o.toString();
            MediaMetadata m = c.getMetadata();
            PlaybackState s = c.getPlaybackState();
            o.put("has", true);
            o.put("playing", s != null && s.getState() == PlaybackState.STATE_PLAYING);
            o.put("app", appName(c.getPackageName()));
            if (m != null) {
                String title = m.getString(MediaMetadata.METADATA_KEY_TITLE);
                o.put("title", title == null ? "" : title);
                String artist = m.getString(MediaMetadata.METADATA_KEY_ARTIST);
                o.put("artist", artist == null ? "" : artist);
                o.put("art", art(c.getPackageName() + "|" + title, m));
            }
        } catch (Exception e) {
            // A music app with odd metadata never breaks the driving screen.
        }
        return o.toString();
    }

    void action(String what) {
        MediaController c = current();
        if (c == null) return;
        MediaController.TransportControls t = c.getTransportControls();
        PlaybackState s = c.getPlaybackState();
        switch (what) {
            case "toggle":
                if (s != null && s.getState() == PlaybackState.STATE_PLAYING) t.pause(); else t.play();
                break;
            case "next": t.skipToNext(); break;
            case "prev": t.skipToPrevious(); break;
            default: break;
        }
    }

    private String appName(String pkg) {
        try {
            PackageManager pm = context.getPackageManager();
            return pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString();
        } catch (Exception e) {
            return "";
        }
    }

    /** A small cover image as a data URL, made once per song. */
    private String art(String key, MediaMetadata m) {
        if (key.equals(artKey)) return artData;
        artKey = key;
        artData = "";
        Bitmap b = m.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART);
        if (b == null) b = m.getBitmap(MediaMetadata.METADATA_KEY_ART);
        if (b == null) b = m.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON);
        if (b != null) {
            Bitmap small = Bitmap.createScaledBitmap(b, 96, 96, true);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            small.compress(Bitmap.CompressFormat.JPEG, 80, out);
            artData = "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
        }
        return artData;
    }
}
