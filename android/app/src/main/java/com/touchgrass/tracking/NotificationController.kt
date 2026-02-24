package com.touchgrass.tracking

import android.app.Notification
import android.app.NotificationManager
import android.app.Service
import android.content.pm.ServiceInfo
import android.os.Build
import android.util.Log

/**
 * Single owner for the tracking foreground notification lifecycle.
 *
 * Stage 4 intent:
 * - TrackingService is the only component that should actively update the tracking notification.
 * - Other services must not reuse TrackingConstants.NOTIFICATION_ID.
 */
class NotificationController(
    private val service: Service,
    private val helper: NotificationHelper = NotificationHelper(service)
) {

    companion object {
        private const val TAG = "NotificationController"
    }

    private val nm: NotificationManager = service.getSystemService(NotificationManager::class.java)

    fun ensureChannel() {
        helper.ensureChannel()
    }

    fun build(state: TrackingState): Notification = helper.build(state)

    fun startForeground(state: TrackingState) {
        val notification = helper.build(state)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                service.startForeground(
                    TrackingConstants.NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
                )
            } else {
                service.startForeground(TrackingConstants.NOTIFICATION_ID, notification)
            }
        } catch (se: SecurityException) {
            Log.e(TAG, "Failed to start foreground notification", se)
            throw se
        }
    }

    fun update(state: TrackingState) {
        nm.notify(TrackingConstants.NOTIFICATION_ID, helper.build(state))
    }

    fun cancel() {
        nm.cancel(TrackingConstants.NOTIFICATION_ID)
    }
}
