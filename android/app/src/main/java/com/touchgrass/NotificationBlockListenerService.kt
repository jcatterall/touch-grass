package com.touchgrass

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import org.json.JSONArray

class NotificationBlockListenerService : NotificationListenerService() {

    companion object {
        private const val TAG = "NotifBlockListener"
        private const val CONFIG_STALE_AFTER_MS = 24L * 60L * 60L * 1000L
        private const val DEDUPE_WINDOW_MS = 1500L
    }

    private data class BlockDecision(
        val shouldBlock: Boolean,
        val reason: String,
    )

    private val lastCancelledByKey = LinkedHashMap<String, Long>()

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        val posted = sbn ?: return
        val pkg = posted.packageName ?: return
        if (pkg.isBlank() || pkg == packageName) return

        val notification = posted.notification ?: return
        if ((notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0) {
            return
        }

        val decision = evaluateBlockDecision(pkg)
        if (!decision.shouldBlock) {
            if (decision.reason != "not_target_package") {
                Log.d(TAG, "allow pkg=$pkg reason=${decision.reason}")
            }
            return
        }
        if (isDuplicate(posted)) return

        try {
            cancelNotification(posted.key)
            MMKVStore.incrementTodayNotificationsBlockedForApp(pkg)
            MMKVMetricsStore.incrementNotificationBlocked(pkg)
            Log.d(TAG, "blocked pkg=$pkg reason=${decision.reason}")
        } catch (_: Exception) {
            // best-effort; fail-open
        }
    }

    private fun evaluateBlockDecision(packageName: String): BlockDecision {
        val prefs = getSharedPreferences(AppBlockerService.PREFS_NAME, MODE_PRIVATE)
        val blockedJson = prefs.getString(AppBlockerService.PREF_BLOCKED_PACKAGES, "[]") ?: "[]"
        val blockedPackages = mutableSetOf<String>()

        try {
            val arr = JSONArray(blockedJson)
            for (i in 0 until arr.length()) {
                blockedPackages.add(arr.optString(i))
            }
        } catch (_: Exception) {
            return BlockDecision(false, "invalid_blocked_config")
        }

        if (packageName !in blockedPackages) return BlockDecision(false, "not_target_package")

        val configUpdatedAt = prefs.getLong(AppBlockerService.PREF_CONFIG_UPDATED_AT_MS, 0L)
        if (configUpdatedAt <= 0L || System.currentTimeMillis() - configUpdatedAt > CONFIG_STALE_AFTER_MS) {
            return BlockDecision(false, "stale_config")
        }

        val configDay = prefs.getString(AppBlockerService.PREF_CONFIG_DAY, "") ?: ""
        val today = MMKVStore.todayKey()
        if (configDay != today) {
            return BlockDecision(false, "config_day_mismatch")
        }

        if (!isPlanActiveNow(today)) return BlockDecision(false, "plan_inactive")

        val hasPermanent = prefs.getBoolean(AppBlockerService.PREF_HAS_PERMANENT, false)
        val goalsReached = MMKVStore.getGoalsReachedSafe()

        if (hasPermanent) return BlockDecision(true, "permanent_plan")
        if (goalsReached) return BlockDecision(false, "goals_reached")

        return BlockDecision(true, "active_day_unmet_goals")
    }

    private fun isPlanActiveNow(today: String): Boolean {
        val planDay = MMKVStore.getPlanDay()
        if (planDay != today) return false
        if (!MMKVStore.isPlanActiveToday()) return false
        val untilMs = MMKVStore.getPlanActiveUntilMs()
        if (untilMs <= 0L) return false
        return System.currentTimeMillis() <= untilMs
    }

    private fun isDuplicate(sbn: StatusBarNotification): Boolean {
        val now = System.currentTimeMillis()
        val key = sbn.key ?: return false

        val previous = lastCancelledByKey[key]
        if (previous != null && now - previous < DEDUPE_WINDOW_MS) {
            return true
        }

        lastCancelledByKey[key] = now
        if (lastCancelledByKey.size > 200) {
            val iterator = lastCancelledByKey.entries.iterator()
            repeat(100) {
                if (iterator.hasNext()) {
                    iterator.next()
                    iterator.remove()
                }
            }
        }

        return false
    }
}
