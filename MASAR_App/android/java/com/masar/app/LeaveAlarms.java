package com.masar.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.HashSet;
import java.util.Set;

/**
 * "Leave now" reminders. The page hands over the plans (leave minute of the day, week days, notification text);
 * the alarms live here, so they fire even when MASAR is closed, and come back after the phone restarts.
 */
public class LeaveAlarms extends BroadcastReceiver {
    private static final String PREFS = "masar_leave";
    private static final String ACTION_FIRE = "com.masar.app.LEAVE";
    private static final String CHANNEL = "leave";
    static final String EXTRA_PLAN = "masar_leave";

    /** Keeps the plans and (re)schedules every alarm. */
    static void save(Context ctx, String json) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        cancelAll(ctx, p.getString("plans", "[]"));
        p.edit().putString("plans", json).apply();
        scheduleAll(ctx);
    }

    static void scheduleAll(Context ctx) {
        JSONArray plans = plans(ctx);
        for (int i = 0; i < plans.length(); i++) {
            JSONObject plan = plans.optJSONObject(i);
            if (plan != null) schedule(ctx, plan);
        }
    }

    private static JSONArray plans(Context ctx) {
        try {
            return new JSONArray(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("plans", "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static PendingIntent alarmIntent(Context ctx, String id) {
        Intent i = new Intent(ctx, LeaveAlarms.class).setAction(ACTION_FIRE).putExtra(EXTRA_PLAN, id);
        return PendingIntent.getBroadcast(ctx, id.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void cancelAll(Context ctx, String json) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        try {
            JSONArray old = new JSONArray(json);
            for (int i = 0; i < old.length(); i++) {
                JSONObject plan = old.optJSONObject(i);
                if (plan != null) am.cancel(alarmIntent(ctx, plan.optString("id")));
            }
        } catch (JSONException e) {
            /* nothing scheduled */
        }
    }

    /** The next time this plan's minute falls on one of its days, at least a minute from now. */
    private static long nextTime(JSONObject plan) {
        JSONArray days = plan.optJSONArray("days");
        if (days == null || days.length() == 0) return -1;
        Set<Integer> on = new HashSet<>();
        for (int i = 0; i < days.length(); i++) on.add(days.optInt(i));
        int minute = plan.optInt("minute");
        long now = System.currentTimeMillis();
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, minute / 60);
        c.set(Calendar.MINUTE, minute % 60);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        for (int k = 0; k < 8; k++) {
            if (on.contains(c.get(Calendar.DAY_OF_WEEK) - 1) && c.getTimeInMillis() > now + 30_000) return c.getTimeInMillis();
            c.add(Calendar.DAY_OF_MONTH, 1);
        }
        return -1;
    }

    private static void schedule(Context ctx, JSONObject plan) {
        long at = nextTime(plan);
        if (at < 0) return;
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = alarmIntent(ctx, plan.optString("id"));
        boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String action = intent.getAction();
        if (ACTION_FIRE.equals(action)) {
            String id = intent.getStringExtra(EXTRA_PLAN);
            JSONArray plans = plans(ctx);
            for (int i = 0; i < plans.length(); i++) {
                JSONObject plan = plans.optJSONObject(i);
                if (plan == null || !plan.optString("id").equals(id)) continue;
                notify(ctx, plan);
                schedule(ctx, plan); // the same time on the next chosen day
            }
            return;
        }
        /* The phone restarted, the clock changed or MASAR was updated: alarms are gone, so set them again. */
        scheduleAll(ctx);
    }

    private static void notify(Context ctx, JSONObject plan) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        String id = plan.optString("id");
        Intent open = new Intent(ctx, MainActivity.class).putExtra(EXTRA_PLAN, id)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(ctx, id.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, ctx.getString(R.string.leave_channel), NotificationManager.IMPORTANCE_HIGH);
            ch.enableVibration(true);
            nm.createNotificationChannel(ch);
            b = new Notification.Builder(ctx, CHANNEL);
        } else {
            b = new Notification.Builder(ctx).setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        }
        b.setSmallIcon(R.drawable.ic_stat_nav)
                .setContentTitle(plan.optString("title"))
                .setContentText(plan.optString("text"))
                .setStyle(new Notification.BigTextStyle().bigText(plan.optString("text")))
                .setContentIntent(tap)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_REMINDER);
        b.addAction(new Notification.Action.Builder((android.graphics.drawable.Icon) null, plan.optString("go", "Go"), tap).build());
        try {
            nm.notify(id.hashCode(), b.build());
        } catch (SecurityException e) {
            /* notifications not allowed: the page shows a hint on the reminders page */
        }
    }
}
