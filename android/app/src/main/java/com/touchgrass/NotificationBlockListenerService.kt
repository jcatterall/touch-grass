package com.touchgrass

import android.content.ComponentName
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

class NotificationBlockListenerService : NotificationListenerService() {

    companion object {
        private const val TAG = "NotifBlockListener"
        private const val DEDUPE_WINDOW_MS = 1500L
    }

    private val lastCancelledByKey = LinkedHashMap<String, Long>()

    override fun onListenerConnected() {
        super.onListenerConnected()
        MMKVStore.setNotificationListenerConnectedAtMs(System.currentTimeMillis())
        Log.i(TAG, "listener_connected")
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        MMKVStore.setNotificationListenerDisconnectedAtMs(System.currentTimeMillis())
        Log.w(TAG, "listener_disconnected")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                requestRebind(ComponentName(this, NotificationBlockListenerService::class.java))
                Log.i(TAG, "listener_rebind_requested")
            } catch (e: Exception) {
                Log.w(TAG, "listener_rebind_failed", e)
            }
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        MMKVStore.setNotificationListenerLastEventAtMs(System.currentTimeMillis())
        val posted = sbn ?: return
        val pkg = posted.packageName ?: return
        if (pkg.isBlank() || pkg == packageName) return

        val notification = posted.notification ?: return

        val decision = BlockPolicyEvaluator.evaluatePackage(this, pkg)
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
