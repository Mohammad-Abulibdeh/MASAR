package com.masar.app.car;

import android.graphics.Canvas;
import android.graphics.Rect;
import android.util.Log;
import android.view.Surface;

import androidx.annotation.NonNull;
import androidx.car.app.AppManager;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.SurfaceCallback;
import androidx.car.app.SurfaceContainer;
import androidx.car.app.model.Action;
import androidx.car.app.model.ActionStrip;
import androidx.car.app.model.CarIcon;
import androidx.car.app.model.DateTimeWithZone;
import androidx.car.app.model.Distance;
import androidx.car.app.model.Template;
import androidx.car.app.navigation.NavigationManager;
import androidx.car.app.navigation.NavigationManagerCallback;
import androidx.car.app.navigation.model.Maneuver;
import androidx.car.app.navigation.model.MessageInfo;
import androidx.car.app.navigation.model.NavigationTemplate;
import androidx.car.app.navigation.model.RoutingInfo;
import androidx.car.app.navigation.model.Step;
import androidx.car.app.navigation.model.TravelEstimate;
import androidx.core.graphics.drawable.IconCompat;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.Lifecycle;
import androidx.lifecycle.LifecycleOwner;

import com.masar.app.NavState;
import com.masar.app.R;

import java.util.TimeZone;

/**
 * The car screen: MASAR's map drawn on the car display, with Android Auto's own panel for the next
 * turn and the arrival time. The trip itself is started and run on the phone.
 */
public class NavScreen extends Screen implements NavState.Listener, SurfaceCallback {
    private final CarMap map;
    private final NavigationManager navigation;
    private boolean announcedNavigation;
    private Surface surface;
    private int width, height, dpi;
    private Rect visible;

    NavScreen(@NonNull CarContext context) {
        super(context);
        map = CarMap.get(context);
        navigation = context.getCarService(NavigationManager.class);
        navigation.setNavigationManagerCallback(new NavigationManagerCallback() {
            @Override
            public void onStopNavigation() {
                NavState.Controller c = NavState.controller;
                if (c != null) c.stopNavigation();
            }
        });
        context.getCarService(AppManager.class).setSurfaceCallback(this);
        getLifecycle().addObserver(new DefaultLifecycleObserver() {
            @Override
            public void onCreate(@NonNull LifecycleOwner owner) {
                NavState.addListener(NavScreen.this);
                map.setOnLoaded(NavScreen.this::draw);
            }

            @Override
            public void onDestroy(@NonNull LifecycleOwner owner) {
                NavState.removeListener(NavScreen.this);
                if (announcedNavigation) tellHost(false);
            }
        });
    }

    @Override
    public void onNavChanged() {
        if (!getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.CREATED)) return;
        boolean on = NavState.now().navigating;
        if (on != announcedNavigation) {
            announcedNavigation = on;
            tellHost(on);
        }
        invalidate();
        draw();
    }

    /*
     * Lets Android Auto know a trip is running (for the car's own displays and to pause other maps).
     * A host can refuse: a hand-installed app is not always treated as a navigation app, and the car
     * may disconnect at any moment. The map and directions on the car screen work without it.
     */
    private void tellHost(boolean on) {
        try {
            if (on) navigation.navigationStarted();
            else navigation.navigationEnded();
        } catch (RuntimeException e) {
            Log.w("MasarCar", "Android Auto refused navigation " + (on ? "start" : "end"), e);
        }
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        NavState.Snapshot s = NavState.now();
        NavigationTemplate.Builder t = new NavigationTemplate.Builder();
        ActionStrip.Builder actions = new ActionStrip.Builder();
        if (!s.navigating) {
            t.setNavigationInfo(new MessageInfo.Builder(getCarContext().getString(R.string.car_idle_title))
                    .setText(getCarContext().getString(R.string.car_idle_text)).build());
            actions.addAction(new Action.Builder().setTitle(getCarContext().getString(R.string.app_name))
                    .setOnClickListener(this::invalidate).build());
            return t.setActionStrip(actions.build()).build();
        }

        if (s.loading && !s.msg.isEmpty()) {
            MessageInfo.Builder m = new MessageInfo.Builder(s.msg);
            if (!s.msgText.isEmpty()) m.setText(s.msgText);
            t.setNavigationInfo(m.build());
        } else if (s.loading) {
            t.setNavigationInfo(new RoutingInfo.Builder().setLoading(true).build());
        } else {
            Maneuver maneuver = new Maneuver.Builder(maneuverType(s.turn)).setIcon(icon(maneuverIcon(s.turn))).build();
            Step.Builder step = new Step.Builder(s.cue).setManeuver(maneuver);
            if (!s.street.isEmpty()) step.setRoad(s.street);
            t.setNavigationInfo(new RoutingInfo.Builder().setCurrentStep(step.build(), distance(s.dist)).build());
            t.setDestinationTravelEstimate(new TravelEstimate.Builder(distance(s.leftM),
                    DateTimeWithZone.create(s.eta, TimeZone.getDefault()))
                    .setRemainingTimeSeconds(Math.max(0, Math.round(s.leftS))).build());
        }
        boolean muted = NavState.muted();
        actions.addAction(new Action.Builder()
                .setIcon(icon(muted ? R.drawable.ic_car_muted : R.drawable.ic_car_sound))
                .setOnClickListener(() -> {
                    NavState.Controller c = NavState.controller;
                    if (c != null) c.setMuted(!muted);
                }).build());
        actions.addAction(new Action.Builder().setTitle(getCarContext().getString(R.string.car_stop))
                .setOnClickListener(() -> {
                    NavState.Controller c = NavState.controller;
                    if (c != null) c.stopNavigation();
                }).build());
        return t.setActionStrip(actions.build()).build();
    }

    private CarIcon icon(int res) {
        return new CarIcon.Builder(IconCompat.createWithResource(getCarContext(), res)).build();
    }

    private static Distance distance(double meters) {
        if (meters >= 1000) return Distance.create(Math.round(meters / 100) / 10.0, Distance.UNIT_KILOMETERS);
        return Distance.create(Math.max(0, Math.round(meters / 10) * 10), Distance.UNIT_METERS);
    }

    private static int maneuverType(String turn) {
        switch (turn) {
            case "right": return Maneuver.TYPE_TURN_NORMAL_RIGHT;
            case "left": return Maneuver.TYPE_TURN_NORMAL_LEFT;
            case "slight_right": return Maneuver.TYPE_TURN_SLIGHT_RIGHT;
            case "slight_left": return Maneuver.TYPE_TURN_SLIGHT_LEFT;
            case "uturn": return Maneuver.TYPE_U_TURN_LEFT;
            case "arrive": return Maneuver.TYPE_DESTINATION;
            default: return Maneuver.TYPE_STRAIGHT;
        }
    }

    private static int maneuverIcon(String turn) {
        switch (turn) {
            case "right": return R.drawable.ic_turn_right;
            case "left": return R.drawable.ic_turn_left;
            case "slight_right": return R.drawable.ic_turn_slight_right;
            case "slight_left": return R.drawable.ic_turn_slight_left;
            case "uturn": return R.drawable.ic_turn_uturn;
            case "arrive": return R.drawable.ic_turn_arrive;
            default: return R.drawable.ic_turn_straight;
        }
    }

    // ---------------------------------------------------------------- map surface
    @Override
    public void onSurfaceAvailable(@NonNull SurfaceContainer container) {
        surface = container.getSurface();
        width = container.getWidth();
        height = container.getHeight();
        dpi = container.getDpi();
        draw();
    }

    @Override
    public void onVisibleAreaChanged(@NonNull Rect area) {
        visible = area;
        draw();
    }

    @Override
    public void onStableAreaChanged(@NonNull Rect area) {
        if (visible == null) visible = area;
        draw();
    }

    @Override
    public void onSurfaceDestroyed(@NonNull SurfaceContainer container) {
        surface = null;
    }

    private void draw() {
        Surface s = surface;
        if (s == null || !s.isValid()) return;
        Canvas canvas;
        try {
            canvas = s.lockCanvas(null);
        } catch (IllegalArgumentException | Surface.OutOfResourcesException e) {
            return;
        }
        try {
            Rect area = visible != null ? visible : new Rect(0, 0, width, height);
            map.draw(canvas, area, dpi, getCarContext().isDarkMode(), NavState.now(), NavState.route());
        } finally {
            s.unlockCanvasAndPost(canvas);
        }
    }
}
