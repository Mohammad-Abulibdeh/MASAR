package com.masar.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Looper;

/**
 * Keeps GPS fixes coming while navigating, also with the phone locked or showing another app,
 * which is how a phone is used with Android Auto. Runs only between "start" and "stop" of a trip.
 */
public class NavService extends Service implements LocationListener {
    private static final String CHANNEL = "navigation";
    private static final int NOTIFICATION_ID = 1;
    private LocationManager locations;

    @Override
    public void onCreate() {
        super.onCreate();
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        locations = (LocationManager) getSystemService(LOCATION_SERVICE);
        try {
            /* GPS alone can take minutes to find the first fix, and none indoors or in a parking garage:
               the fused provider (GPS + Wi-Fi + cell) answers at once and keeps going where GPS cannot. */
            String quick = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                    && locations.hasProvider(LocationManager.FUSED_PROVIDER)
                    ? LocationManager.FUSED_PROVIDER : LocationManager.NETWORK_PROVIDER;
            for (String provider : new String[]{quick, LocationManager.GPS_PROVIDER}) {
                Location last = locations.getLastKnownLocation(provider);
                if (last != null && System.currentTimeMillis() - last.getTime() < 30000) NavState.fix(last);
                if (locations.getAllProviders().contains(provider)) {
                    locations.requestLocationUpdates(provider, 1000, 0, this, Looper.getMainLooper());
                }
            }
        } catch (SecurityException | IllegalArgumentException e) {
            stopSelf();
        }
    }

    private Notification buildNotification() {
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, getString(R.string.nav_channel),
                    NotificationManager.IMPORTANCE_LOW));
            b = new Notification.Builder(this, CHANNEL);
        } else {
            b = new Notification.Builder(this);
        }
        return b.setSmallIcon(R.drawable.ic_stat_nav)
                .setContentTitle(getString(R.string.app_name))
                .setContentText(getString(R.string.nav_running))
                .setContentIntent(open)
                .setOngoing(true)
                .build();
    }

    @Override
    public void onLocationChanged(Location location) { NavState.fix(location); }

    /* Older Android versions call these and have no default for them. */
    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {}

    @Override
    public void onProviderEnabled(String provider) {}

    @Override
    public void onProviderDisabled(String provider) {}

    @Override
    public void onDestroy() {
        if (locations != null) locations.removeUpdates(this);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
