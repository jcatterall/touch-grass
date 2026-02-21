package com.touchgrass.tracking

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat

/**
 * Builds and manages the persistent foreground-service notification.
 *
 * The notification channel is created once in [ensureChannel].
 * Call [build] whenever the [TrackingState] changes to get an updated [Notification].
 *
 * Notification throttling (15 s) is enforced by [TrackingController], not here,
 * so this class remains a pure builder with no internal state.
 */
class NotificationHelper(private val context: Context) {

    fun ensureChannel() {
        val manager = context.getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(TrackingConstants.NOTIFICATION_CHANNEL) != null) return

        val channel = NotificationChannel(
            TrackingConstants.NOTIFICATION_CHANNEL,
            TrackingConstants.NOTIFICATION_CHANNEL_NAME,
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Shows TouchGrass activity status and goal progress"
            setShowBadge(false)
        }
        manager.createNotificationChannel(channel)
    }

    fun build(state: TrackingState): Notification {
        val title = if (state.goalReached) "TouchGrass: Goal Reached!" else "TouchGrass is active"

        val body = when (state.mode) {
            TrackingMode.IDLE -> "Watching for movement…"
            TrackingMode.PAUSED_VEHICLE -> "Paused (in vehicle)"
            TrackingMode.TRACKING_AUTO,
            TrackingMode.TRACKING_MANUAL -> formatProgress(state)
        }

        return NotificationCompat.Builder(context, TrackingConstants.NOTIFICATION_CHANNEL)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(!state.goalReached)
            .setColor(0xFF4F7942.toInt())
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun formatProgress(state: TrackingState): String {
        val km = state.distanceMeters / 1000.0
        val elMin = state.elapsedSeconds / 60
        return if (km >= 1.0) {
            "%.2f km · %d min".format(km, elMin)
        } else {
            "%.0f m · %d min".format(state.distanceMeters, elMin)
        }
    }
}
