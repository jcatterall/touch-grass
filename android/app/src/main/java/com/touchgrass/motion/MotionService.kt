package com.touchgrass.motion

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import com.touchgrass.tracking.TrackingConstants
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.touchgrass.tracking.NotificationHelper
import com.touchgrass.tracking.TrackingState

/**
 * Foreground service that keeps the motion tracking engine alive when the
 * app is backgrounded or the system is under memory pressure.
 *
 * Android 14+ (API 34) requirements:
 *   - foregroundServiceType="health" in manifest
 *   - FOREGROUND_SERVICE_HEALTH permission
 *   - POST_NOTIFICATIONS permission for the persistent notification
 *
 * Uses START_STICKY to survive system-initiated restarts.
 *
 * Integrates with TrackingService's notification so that when both are running
 * the motion state is visible to the user.
 */
class MotionService : Service() {

    companion object {
        private const val TAG = "MotionService"

        // Reuse the canonical TrackingService notification ID so MotionService and
        // TrackingService don't create two persistent notifications when both run.
        private val NOTIFICATION_ID = TrackingConstants.NOTIFICATION_ID

        @Volatile
        private var isRunning = false

        fun isServiceRunning(): Boolean = isRunning

        fun start(context: Context) {
            val intent = Intent(context, MotionService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, MotionService::class.java))
        }
    }

    private var config: MotionConfig = MotionConfig()

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "MotionService created")
        config = MotionSessionController.config
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.i(TAG, "MotionService onStartCommand")

        val notification = buildNotification()

        // Android 14+ requires foreground service type at runtime
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH
            )
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        // Initialise the bridge so MotionSessionController can signal TrackingService
        MotionTrackingBridge.init(applicationContext)

        // Start the engine if not already running
        if (!MotionEngine.isRunning()) {
            MotionEngine.start(applicationContext, config)
        }

        isRunning = true

        // Survive system kills — system will restart the service
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.i(TAG, "MotionService destroyed")
        MotionEngine.stop()
        MotionSessionController.reset()
        isRunning = false
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ── Notification ────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                config.notificationChannelId,
                config.notificationChannelName,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Persistent notification for motion tracking"
                setShowBadge(false)
            }

            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        // Reuse NotificationHelper so MotionService and TrackingService show consistent content
        val helper = NotificationHelper(this)
        return helper.build(TrackingState())
    }
}
