package com.masar.app.car;

import android.content.Intent;

import androidx.annotation.NonNull;
import androidx.car.app.CarAppService;
import androidx.car.app.Screen;
import androidx.car.app.Session;
import androidx.car.app.validation.HostValidator;

/** Entry point Android Auto binds to when the car screen opens MASAR. */
public class MasarCarService extends CarAppService {
    @NonNull
    @Override
    public HostValidator createHostValidator() {
        /* The app is installed by hand, not from Google Play, so any Android Auto host is accepted. */
        return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR;
    }

    @NonNull
    @Override
    public Session onCreateSession() {
        return new Session() {
            @NonNull
            @Override
            public Screen onCreateScreen(@NonNull Intent intent) {
                return new NavScreen(getCarContext());
            }
        };
    }
}
