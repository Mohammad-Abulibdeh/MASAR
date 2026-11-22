package com.masar.app;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Insets;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.view.WindowManager;
import android.view.WindowInsets;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;

/** Hosts the MASAR interface (assets/www) in a full-screen WebView. */
public class MainActivity extends Activity {
    /* Android's reserved host for local content: a secure origin, so GPS and storage work. */
    private static final String HOST = "appassets.androidplatform.net";
    private static final int REQUEST_LOCATION = 7;
    private static final int REQUEST_NAV = 8;
    private boolean notificationsRequested;
    /* Navigation voice goes to the car speakers through Android Auto, and lowers the music meanwhile. */
    private static final AudioAttributes GUIDANCE = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
    private AudioFocusRequest focusRequest;

    private WebView web;
    private GeolocationPermissions.Callback pendingCallback;
    private String pendingOrigin;
    private static final String[] VOICE_EXTENSIONS = {".mp3", ".m4a", ".aac", ".ogg", ".opus", ".wav"};

    private TextToSpeech tts;
    private boolean ttsReady;
    private volatile File voiceDir;
    private MediaPlayer player;
    private AudioManager audio;
    private Music music;
    /* A place another app sent (JSON for the page), kept until the page takes it. */
    private volatile String pendingPlace;
    /* The "Leave now" reminder that was tapped (its id), kept until the page takes it. */
    private volatile String pendingLeave;
    private static final int REQUEST_SPEECH = 9;
    private static final int REQUEST_NOTIFY = 10;
    private static final int REQUEST_FILE = 11;
    private android.webkit.ValueCallback<Uri[]> fileCallback;
    private File cameraFile;

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        takeSharedPlace(intent);
        if (takeLeaveIntent(intent) && web != null) web.evaluateJavascript("window.masarLeave && masarLeave()", null);
    }

    private boolean takeLeaveIntent(Intent intent) {
        String id = intent == null ? null : intent.getStringExtra(LeaveAlarms.EXTRA_PLAN);
        if (id == null) return false;
        pendingLeave = id;
        intent.removeExtra(LeaveAlarms.EXTRA_PLAN);
        return true;
    }

    /** Reads the place in the background (short links need the network), then tells the page. */
    private void takeSharedPlace(Intent intent) {
        String raw = SharedPlace.raw(intent);
        if (raw == null) return;
        new Thread(() -> {
            String place = SharedPlace.resolve(raw);
            if (place == null) return;
            pendingPlace = place;
            runOnUiThread(() -> { if (web != null) web.evaluateJavascript("window.masarSharedPlace && masarSharedPlace()", null); });
        }).start();
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#5A2BE0"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setGeolocationEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setTextZoom(100);
        tts = new TextToSpeech(this, status -> ttsReady = status == TextToSpeech.SUCCESS);
        tts.setAudioAttributes(GUIDANCE);
        connectNavState();
        audio = (AudioManager) getSystemService(AUDIO_SERVICE);
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
        new Thread(this::copyVoiceClips).start();
        web.addJavascriptInterface(new NativeBridge(), "MasarNative");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return serveAsset(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !HOST.equals(request.getUrl().getHost());
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                Log.i("MasarWeb", m.messageLevel() + " " + m.sourceId() + ":" + m.lineNumber() + " " + m.message());
                return true;
            }

            /* The profile photo: the gallery, or a new picture from the camera. */
            @Override
            public boolean onShowFileChooser(WebView view, android.webkit.ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE);
                Intent chooser = Intent.createChooser(pick, null);
                try {
                    File dir = new File(getCacheDir(), "share");
                    dir.mkdirs();
                    cameraFile = new File(dir, "photo.jpg");
                    if (cameraFile.exists()) cameraFile.delete();
                    Uri out = androidx.core.content.FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".files", cameraFile);
                    Intent camera = new Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE).putExtra(android.provider.MediaStore.EXTRA_OUTPUT, out)
                            .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
                } catch (IllegalArgumentException e) {
                    cameraFile = null; // gallery only
                }
                try {
                    startActivityForResult(chooser, REQUEST_FILE);
                } catch (android.content.ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (hasLocationPermission()) {
                    callback.invoke(origin, true, false);
                    return;
                }
                pendingOrigin = origin;
                pendingCallback = callback;
                requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION}, REQUEST_LOCATION);
            }
        });

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#5A2BE0"));
        root.addView(web);
        setContentView(root);
        /* Android 15 draws apps under the system bars and the keyboard: keep the page clear of them. */
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsets.CONSUMED;
            });
        }
        if (state == null) web.loadUrl("https://" + HOST + "/index.html");
        else web.restoreState(state);
        music = new Music(this);
        if (state == null) takeSharedPlace(getIntent());
        takeLeaveIntent(getIntent());
    }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code == REQUEST_FILE) {
            Uri[] picked = null;
            if (result == RESULT_OK) {
                if (data != null && data.getData() != null) picked = new Uri[]{data.getData()};
                else if (cameraFile != null && cameraFile.length() > 0) {
                    picked = new Uri[]{androidx.core.content.FileProvider.getUriForFile(this, getPackageName() + ".files", cameraFile)};
                }
            }
            if (fileCallback != null) fileCallback.onReceiveValue(picked);
            fileCallback = null;
            return;
        }
        if (code != REQUEST_SPEECH) return;
        org.json.JSONArray heard = new org.json.JSONArray();
        if (result == RESULT_OK && data != null) {
            java.util.ArrayList<String> list = data.getStringArrayListExtra(android.speech.RecognizerIntent.EXTRA_RESULTS);
            if (list != null) for (String s : list) heard.put(s);
        }
        web.evaluateJavascript("window.masarHeard && masarHeard(" + heard + ")", null);
    }

    /** What the page needs from the phone while navigating. Only local pages are ever loaded. */
    private class NativeBridge {
        @JavascriptInterface
        public void setNavigating(boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        /** Plays recorded clips one after another. False when any clip is missing, so the page can fall back. */
        @JavascriptInterface
        public boolean playClips(String names) {
            File[] files = voiceFiles(names.split(","));
            if (files == null) return false;
            runOnUiThread(() -> playSequence(files, 0));
            return true;
        }

        /** Starts the GPS service for a trip, asking for permission first when needed. */
        @JavascriptInterface
        public void startLocation() {
            runOnUiThread(() -> {
                if (hasPreciseLocation() && notificationsAsked()) {
                    startNavService();
                    return;
                }
                java.util.List<String> ask = new java.util.ArrayList<>();
                if (!hasPreciseLocation()) {
                    ask.add(Manifest.permission.ACCESS_FINE_LOCATION);
                    ask.add(Manifest.permission.ACCESS_COARSE_LOCATION);
                }
                if (Build.VERSION.SDK_INT >= 33) ask.add(Manifest.permission.POST_NOTIFICATIONS);
                requestPermissions(ask.toArray(new String[0]), REQUEST_NAV);
            });
        }

        /* WebView always reports a light phone to the page, so the page asks here instead. */
        @JavascriptInterface
        public boolean isNightMode() {
            int mode = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
            return mode == Configuration.UI_MODE_NIGHT_YES;
        }

        @JavascriptInterface
        public void openAppSettings() {
            runOnUiThread(() -> startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.fromParts("package", getPackageName(), null))));
        }

        @JavascriptInterface
        public void stopLocation() {
            runOnUiThread(() -> stopService(new Intent(MainActivity.this, NavService.class)));
        }

        /** Opens the phone's share sheet (WhatsApp, SMS...) with a ready text, e.g. "I arrive at 17:40". */
        @JavascriptInterface
        public void share(String text) {
            runOnUiThread(() -> {
                Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
                startActivity(Intent.createChooser(send, null));
            });
        }

        /** A short buzz for road alerts, so the driver doesn't need to look at the screen. */
        @JavascriptInterface
        public void buzz(int ms) {
            android.os.Vibrator v = (android.os.Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (v == null || !v.hasVibrator()) return;
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(android.os.VibrationEffect.createOneShot(Math.min(ms, 600), android.os.VibrationEffect.DEFAULT_AMPLITUDE));
            else v.vibrate(Math.min(ms, 600));
        }

        /** The place another app sent, once (null when there is none). */
        @JavascriptInterface
        public String takePlace() {
            String p = pendingPlace;
            pendingPlace = null;
            return p;
        }

        /** What is playing in the music app: {"allowed","has","playing","title","artist","app","art"}. */
        @JavascriptInterface
        public String musicState() { return music == null ? "{}" : music.state(); }

        /** "toggle", "next" or "prev" on the music app that is playing. */
        @JavascriptInterface
        public void musicAction(String what) { if (music != null) music.action(what); }

        /** Opens the system screen where the person allows MASAR to see the music that is playing. */
        @JavascriptInterface
        public void openMusicAccess() {
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS"));
                } catch (Exception e) {
                    startActivity(new Intent(android.provider.Settings.ACTION_SETTINGS));
                }
            });
        }

        /* -------- "Leave now" reminders */
        @JavascriptInterface
        public void setLeaveAlarms(String json) { LeaveAlarms.save(MainActivity.this, json); }

        @JavascriptInterface
        public String takeLeave() {
            String id = pendingLeave;
            pendingLeave = null;
            return id;
        }

        @JavascriptInterface
        public boolean notificationsOn() {
            return ((android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE)).areNotificationsEnabled();
        }

        @JavascriptInterface
        public void askNotifications() {
            if (Build.VERSION.SDK_INT < 33 || notificationsAsked()) return;
            notificationsRequested = true;
            runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQUEST_NOTIFY));
        }

        /* -------- voice commands: the phone's speech service listens and sends back text (onActivityResult) */
        @JavascriptInterface
        public boolean listen(String lang, String prompt) {
            Intent i = new Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                    .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL, android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE, lang)
                    .putExtra(android.speech.RecognizerIntent.EXTRA_MAX_RESULTS, 5)
                    .putExtra(android.speech.RecognizerIntent.EXTRA_PROMPT, prompt);
            if (i.resolveActivity(getPackageManager()) == null) return false;
            runOnUiThread(() -> {
                try {
                    startActivityForResult(i, REQUEST_SPEECH);
                } catch (android.content.ActivityNotFoundException e) {
                    web.evaluateJavascript("window.masarHeard && masarHeard([])", null);
                }
            });
            return true;
        }

        /* -------- emergency: the dialer and the SMS app open ready; the person presses call or send */
        @JavascriptInterface
        public void dial(String number) {
            runOnUiThread(() -> startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(number)))));
        }

        @JavascriptInterface
        public void sms(String numbers, String text) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + numbers)).putExtra("sms_body", text);
                try {
                    startActivity(i);
                } catch (android.content.ActivityNotFoundException e) {
                    share(text);
                }
            });
        }

        /* -------- the monthly summary picture (PNG, base64) to WhatsApp, Instagram... */
        @JavascriptInterface
        public void shareImage(String base64, String text) {
            try {
                File dir = new File(getCacheDir(), "share");
                dir.mkdirs();
                File out = new File(dir, "masar-month.png");
                try (FileOutputStream os = new FileOutputStream(out)) {
                    os.write(android.util.Base64.decode(base64, android.util.Base64.DEFAULT));
                }
                Uri uri = androidx.core.content.FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".files", out);
                Intent send = new Intent(Intent.ACTION_SEND).setType("image/png")
                        .putExtra(Intent.EXTRA_STREAM, uri).putExtra(Intent.EXTRA_TEXT, text)
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                runOnUiThread(() -> startActivity(Intent.createChooser(send, null)));
            } catch (IOException | IllegalArgumentException e) {
                share(text);
            }
        }

        @JavascriptInterface
        public void carUpdate(String json) { NavState.update(json); }

        @JavascriptInterface
        public void carRoute(String json) { NavState.setRoute(json); }

        @JavascriptInterface
        public boolean speak(String text, String lang) {
            if (!ttsReady) return false;
            int available = tts.setLanguage(new Locale(lang));
            if (available < TextToSpeech.LANG_AVAILABLE) return false;
            return tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "masar") == TextToSpeech.SUCCESS;
        }
    }

    /* The clips are copied out of the APK once: MediaPlayer cannot open compressed assets. */
    private void copyVoiceClips() {
        File dir = new File(getCacheDir(), "voice");
        try {
            String[] names = getAssets().list("www/voice");
            if (names == null) return;
            dir.mkdirs();
            byte[] buf = new byte[16384];
            for (String name : names) {
                File out = new File(dir, name);
                try (InputStream in = getAssets().open("www/voice/" + name);
                     FileOutputStream os = new FileOutputStream(out)) {
                    int n;
                    while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
                }
            }
        } catch (IOException e) {
            /* No clips: the page falls back to text-to-speech. */
        }
        voiceDir = dir;
    }

    private File[] voiceFiles(String[] names) {
        File dir = voiceDir;
        if (dir == null) return null;
        File[] found = new File[names.length];
        for (int i = 0; i < names.length; i++) {
            for (String ext : VOICE_EXTENSIONS) {
                File f = new File(dir, names[i].trim() + ext);
                if (f.exists()) { found[i] = f; break; }
            }
            if (found[i] == null) return null;
        }
        return found;
    }

    private void playSequence(File[] files, int index) {
        if (index == 0) {
            if (tts != null) tts.stop();
            stopClip();
            requestFocus();
        }
        if (index >= files.length) {
            stopClip();
            abandonFocus();
            return;
        }
        MediaPlayer mp = new MediaPlayer();
        player = mp;
        try {
            mp.setAudioAttributes(GUIDANCE);
            mp.setDataSource(files[index].getAbsolutePath());
            mp.setOnCompletionListener(done -> { if (player == mp) playSequence(files, index + 1); });
            mp.setOnErrorListener((bad, what, extra) -> { if (player == mp) playSequence(files, index + 1); return true; });
            mp.prepare();
            mp.start();
        } catch (IOException | RuntimeException e) {
            playSequence(files, index + 1);
        }
    }

    private void requestFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(GUIDANCE).build();
            audio.requestAudioFocus(focusRequest);
        } else {
            audio.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
        }
    }

    private void abandonFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequest != null) audio.abandonAudioFocusRequest(focusRequest);
        else audio.abandonAudioFocus(null);
    }

    private void stopClip() {
        if (player == null) return;
        player.release();
        player = null;
    }

    @Override
    protected void onDestroy() {
        stopService(new Intent(this, NavService.class));
        NavState.update("{\"nav\":false}");
        NavState.fixListener = null;
        NavState.controller = null;
        stopClip();
        if (tts != null) tts.shutdown();
        web.destroy();
        super.onDestroy();
    }

    /* The only internet the app uses: Firebase sign-in and the user's own synced data. */
    private static final java.util.Set<String> ACCOUNT_HOSTS = new java.util.HashSet<>(java.util.Arrays.asList(
            "identitytoolkit.googleapis.com", "securetoken.googleapis.com", "firestore.googleapis.com"));

    private WebResourceResponse serveAsset(Uri url) {
        if (ACCOUNT_HOSTS.contains(url.getHost()) && "https".equals(url.getScheme())) return null;
        if (!HOST.equals(url.getHost())) return blocked();
        String path = url.getPath();
        if (path == null || path.contains("..")) return blocked();
        String ext = MimeTypeMap.getFileExtensionFromUrl(path);
        String mime = "js".equals(ext) ? "text/javascript"
                : "css".equals(ext) ? "text/css"
                : "svg".equals(ext) ? "image/svg+xml"
                : "woff2".equals(ext) ? "font/woff2"
                : "text/html";
        try {
            return new WebResourceResponse(mime, "UTF-8", getAssets().open("www" + path));
        } catch (IOException e) {
            Log.w("MasarWeb", "missing asset " + path);
            return blocked();
        }
    }

    private static WebResourceResponse blocked() {
        /* Apart from the account hosts above, nothing is ever fetched from the internet. */
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not found", null, null);
    }

    private boolean notificationsAsked() {
        return Build.VERSION.SDK_INT < 33 || notificationsRequested
                || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    private void startNavService() {
        Intent service = new Intent(this, NavService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(service);
        else startService(service);
    }

    /* Hands each GPS fix from the service to the page, and the car screen's buttons to the page. */
    private void connectNavState() {
        NavState.fixListener = loc -> runOnUiThread(() -> web.evaluateJavascript(String.format(Locale.ROOT,
                "window.masarFix && masarFix(%f,%f,%f,%s,%s)", loc.getLatitude(), loc.getLongitude(),
                loc.hasAccuracy() ? loc.getAccuracy() : 50f,
                loc.hasSpeed() ? String.valueOf(loc.getSpeed()) : "null",
                loc.hasBearing() ? String.valueOf(loc.getBearing()) : "null"), null));
        NavState.controller = new NavState.Controller() {
            @Override
            public void stopNavigation() {
                runOnUiThread(() -> web.evaluateJavascript("window.masarCarStop && masarCarStop()", null));
            }

            @Override
            public void setMuted(boolean muted) {
                NavState.setMuted(muted);
                runOnUiThread(() -> web.evaluateJavascript("window.masarCarMute && masarCarMute(" + muted + ")", null));
            }
        };
    }

    private boolean hasPreciseLocation() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasLocationPermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        if (code == REQUEST_NAV) {
            notificationsRequested = true;
            if (hasLocationPermission()) startNavService();
            else web.evaluateJavascript("window.masarFixError && masarFixError(1)", null);
            if (hasLocationPermission() && !hasPreciseLocation()) {
                web.evaluateJavascript("window.masarPreciseNeeded && masarPreciseNeeded()", null);
            }
            return;
        }
        if (code == REQUEST_LOCATION && pendingCallback != null) {
            pendingCallback.invoke(pendingOrigin, hasLocationPermission(), false);
            pendingCallback = null;
            pendingOrigin = null;
        }
    }

    /* The activity handles uiMode changes itself (see the manifest), so the page is told directly. */
    @Override
    public void onConfigurationChanged(Configuration config) {
        super.onConfigurationChanged(config);
        web.evaluateJavascript("window.masarSystemTheme && masarSystemTheme()", null);
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.masarBack ? window.masarBack() : false", handled -> {
            if (!"true".equals(handled)) finish();
        });
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }
}
