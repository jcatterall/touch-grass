package com.touchgrass

import android.app.*
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.*
import androidx.core.app.NotificationCompat
import org.json.JSONArray

class AppBlockerService : Service() {

    companion object {
        const val CHANNEL_ID = "touchgrass_blocker"
        const val NOTIFICATION_ID = 1002
        const val PREFS_NAME = "touchgrass_blocker_prefs"
        const val PREF_BLOCKED_PACKAGES = "blocked_packages"
        const val PREF_GOALS_REACHED = "goals_reached"
        const val PREF_HAS_PERMANENT = "has_permanent"
        const val PREF_CURRENTLY_BLOCKED = "currently_blocked"
    }

    private val handler = Handler(Looper.getMainLooper())
    private var polling = false

    private val pollRunnable = object : Runnable {
        override fun run() {
            if (!polling) return
            checkForegroundApp()
            handler.postDelayed(this, 1000)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification())
        polling = true
        handler.post(pollRunnable)
        return START_STICKY
    }

    private fun checkForegroundApp() {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val goalsReached = prefs.getBoolean(PREF_GOALS_REACHED, false)
        val hasPermanent = prefs.getBoolean(PREF_HAS_PERMANENT, false)

        if (goalsReached && !hasPermanent) {
            clearBlockedApp()
            return
        }

        val blockedJson = prefs.getString(PREF_BLOCKED_PACKAGES, "[]") ?: "[]"
        val blockedSet = mutableSetOf<String>()
        try {
            val arr = JSONArray(blockedJson)
            for (i in 0 until arr.length()) {
                blockedSet.add(arr.getString(i))
            }
        } catch (_: Exception) {}

        if (blockedSet.isEmpty()) {
            clearBlockedApp()
            return
        }

        val foreground = getForegroundPackage()
        if (foreground != null && foreground != packageName && foreground in blockedSet) {
            launchBlockingScreen(foreground)
        } else {
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
        // Write which app is blocked so the RN side can read it
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
            .putString(PREF_CURRENTLY_BLOCKED, blockedPackage)
            .apply()

        // Launch TouchGrass to the foreground — singleTask mode means
        // this will bring the existing instance to front, not create a new one
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            putExtra("SHOW_BLOCKER", true)
            putExtra("BLOCKED_PACKAGE", blockedPackage)
        }
        startActivity(intent)
    }

    private fun clearBlockedApp() {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
            .remove(PREF_CURRENTLY_BLOCKED)
            .apply()
    }

    private fun buildNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("App Blocker Active")
            .setContentText("Blocked apps are restricted until you reach your goals")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "App Blocker",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Shown while app blocking is active"
            setShowBadge(false)
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    override fun onDestroy() {
        polling = false
        handler.removeCallbacks(pollRunnable)
        clearBlockedApp()
        super.onDestroy()
    }
}
