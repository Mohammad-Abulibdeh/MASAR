package com.masar.app;

import android.service.notification.NotificationListenerService;

/**
 * Android only lets an app see which music is playing (Spotify, Anghami, YouTube Music...) when the
 * person allows "notification access" for it. MASAR reads no notifications: this empty service only
 * unlocks MediaSessionManager.getActiveSessions() for the music bar on the driving screen.
 */
public class MediaListener extends NotificationListenerService {
}
