package com.touchgrass

import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.*
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import androidx.core.content.ContextCompat
import com.touchgrass.tracking.TrackingConstants
import com.touchgrass.tracking.TrackingPermissionGate
import com.touchgrass.tracking.TrackingService

class AppBlockerService : Service() {

    companion object {
        const val PREFS_NAME = "touchgrass_blocker_prefs"
        const val PREF_BLOCKED_PACKAGES = "blocked_packages"
        const val PREF_GOALS_REACHED = "goals_reached"
        const val PREF_HAS_PERMANENT = "has_permanent"
        const val PREF_CURRENTLY_BLOCKED = "currently_blocked"
        const val PREF_CONFIG_UPDATED_AT_MS = "config_updated_at_ms"
        const val PREF_CONFIG_DAY = "config_day"
        private const val POLL_INTERVAL_IDLE = 1000L
        private const val POLL_INTERVAL_BLOCKING = 500L
        private const val GESTURE_BLOCKER_HEIGHT_DP = 80
        private const val BLOCKED_ATTEMPT_DEDUPE_MS = 1500L
    }

    private val handler = Handler(Looper.getMainLooper())
    private var polling = false
    private var currentPollInterval = POLL_INTERVAL_IDLE

    private var windowManager: WindowManager? = null
    private var gestureBlockerView: View? = null
    private val lastBlockedAttemptByPackage = LinkedHashMap<String, Long>()

    private val pollRunnable = object : Runnable {
        override fun run() {
            if (!polling) return
            checkForegroundApp()
            handler.postDelayed(this, currentPollInterval)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        polling = true
        handler.post(pollRunnable)
        // Tell TrackingService the blocker is active so it can update the shared notification.
        notifyTrackingService(TrackingConstants.ACTION_BLOCKER_STARTED)
        return START_STICKY
    }

    private fun checkForegroundApp() {
        val foreground = getForegroundPackage()

        if (foreground == null || foreground == packageName) {
            return
        }

        val decision = BlockPolicyEvaluator.evaluatePackage(this, foreground)
        if (decision.shouldBlock) {
            launchBlockingScreen(foreground)
        } else {
            // User navigated to an unblocked app or home — clear the blocked state
            clearBlockedApp()
        }
    }

    private fun getForegroundPackage(): String? {
        val usm = getSystemService(USAGE_STATS_SERVICE) as UsageStatsManager
        val now = System.currentTimeMillis()
        val events = usm.queryEvents(now - 5000, now)
        var lastPackage: String? = null
        val event = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            if (event.eventType == UsageEvents.Event.ACTIVITY_RESUMED) {
                lastPackage = event.packageName
            }
        }
        return lastPackage
    }

    private fun launchBlockingScreen(blockedPackage: String) {
        recordBlockedAttempt(blockedPackage)

        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
            .putString(PREF_CURRENTLY_BLOCKED, blockedPackage)
            .apply()

        showGestureBlocker()
        setPollInterval(POLL_INTERVAL_BLOCKING)

        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
            )
            putExtra("SHOW_BLOCKER", true)
            putExtra("BLOCKED_PACKAGE", blockedPackage)
        }
        startActivity(intent)
    }

    private fun recordBlockedAttempt(blockedPackage: String) {
        val now = System.currentTimeMillis()
        val previous = lastBlockedAttemptByPackage[blockedPackage]
        if (previous != null && now - previous < BLOCKED_ATTEMPT_DEDUPE_MS) {
            return
        }

        lastBlockedAttemptByPackage[blockedPackage] = now
        if (lastBlockedAttemptByPackage.size > 200) {
            val iterator = lastBlockedAttemptByPackage.entries.iterator()
            repeat(100) {
                if (iterator.hasNext()) {
                    iterator.next()
                    iterator.remove()
                }
            }
        }

        try {
            MMKVStore.incrementTodayBlockedAttemptsForApp(blockedPackage)
            MMKVMetricsStore.incrementBlockedAttempt(blockedPackage)
        } catch (_: Exception) {
            // best-effort
        }
    }

    private fun clearBlockedApp() {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
            .remove(PREF_CURRENTLY_BLOCKED)
            .apply()
        hideGestureBlocker()
        setPollInterval(POLL_INTERVAL_IDLE)
    }

    private fun setPollInterval(interval: Long) {
        if (currentPollInterval != interval) {
            currentPollInterval = interval
        }
    }

    // --- Gesture-blocking overlay ---

    private fun showGestureBlocker() {
        if (gestureBlockerView != null) return
        if (!Settings.canDrawOverlays(this)) return

        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        gestureBlockerView = View(this)

        val heightPx = (GESTURE_BLOCKER_HEIGHT_DP * resources.displayMetrics.density).toInt()

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            heightPx,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM
        }

        try {
            windowManager?.addView(gestureBlockerView, params)
        } catch (_: Exception) {
            gestureBlockerView = null
        }
    }

    private fun hideGestureBlocker() {
        gestureBlockerView?.let {
            try {
                windowManager?.removeView(it)
            } catch (_: Exception) {}
            gestureBlockerView = null
        }
    }

    override fun onDestroy() {
        polling = false
        handler.removeCallbacks(pollRunnable)
        hideGestureBlocker()
        clearBlockedApp()
        notifyTrackingService(TrackingConstants.ACTION_BLOCKER_STOPPED)
        super.onDestroy()
    }

    private fun notifyTrackingService(action: String) {
        try {
            if (!canStartTrackingForeground()) {
                return
            }
            val intent = Intent(this, TrackingService::class.java).apply { this.action = action }
            ContextCompat.startForegroundService(this, intent)
        } catch (_: Exception) {
            // TrackingService may not be running — safe to ignore
        }
    }

    private fun canStartTrackingForeground(): Boolean {
        return TrackingPermissionGate.canStartForegroundTracking(this)
    }
}
