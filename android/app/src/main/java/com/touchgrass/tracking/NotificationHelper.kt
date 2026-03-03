package com.touchgrass.tracking

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import com.touchgrass.MMKVStore
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

    internal data class NotificationText(
        val title: String,
        val body: String
    )

    companion object {
        internal fun computeText(
            blockedCount: Int,
            emergencyBypassActive: Boolean,
            todayKey: String,
            planDay: String,
            planActiveFlag: Boolean,
            planActiveUntilMs: Long,
            goalDistanceValue: Double,
            goalDistanceUnit: String,
            goalTimeValue: Double,
            goalTimeUnit: String,
            nowMs: Long,
            state: TrackingState
        ): NotificationText {
            val notExpired = planActiveUntilMs <= 0L || nowMs <= planActiveUntilMs
            val planActiveToday = planDay == todayKey && planActiveFlag && notExpired
            val dayIsToday = try {
                MMKVStore.isCurrentDayToday()
            } catch (_: Exception) {
                true
            }
            val progressDistance = if (dayIsToday) state.distanceMeters else 0.0
            val progressElapsed = if (dayIsToday) state.elapsedSeconds else 0L

            val hasDistance = planActiveToday && goalDistanceUnit == "m" && goalDistanceValue > 0.0
            val hasTime = planActiveToday && goalTimeUnit == "s" && goalTimeValue > 0.0

            val normalTitle = if (!planActiveToday) {
                "No active plans for today"
            } else if (blockedCount == 1) {
                "1 application blocked"
            } else {
                "${blockedCount} applications blocked"
            }

            val title = if (emergencyBypassActive) {
                "Emergency unblocking enabled"
            } else {
                normalTitle
            }

            val body = if (!planActiveToday) {
                ""
            } else {
                val parts = mutableListOf<String>()
                if (hasDistance) {
                    parts.add("Progress: ${formatDistance(progressDistance)} / ${formatDistance(goalDistanceValue)}")
                }
                if (hasTime) {
                    parts.add("Progress: ${formatTime(progressElapsed)} / ${formatTimeSeconds(goalTimeValue.toLong())}")
                }
                parts.joinToString(" | ")
            }

            return NotificationText(title = title, body = body)
        }

        private fun formatDistance(meters: Double): String {
            return if (meters >= 1000.0) {
                "%.2fkm".format(meters / 1000.0)
            } else {
                "%.0fm".format(meters)
            }
        }

        private fun formatTime(seconds: Long): String {
            return if (seconds < 60) {
                "${seconds}s"
            } else {
                "${seconds / 60}m"
            }
        }

        private fun formatTimeSeconds(sec: Long): String = formatTime(sec)
    }

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
        // Number of distinct blocked apps (fast-path via MMKV)
        val blockedCount = try { MMKVStore.getBlockedCount() } catch (e: Exception) { 0 }

        val nowMs = System.currentTimeMillis()
        val emergencyBypassActive = try { MMKVStore.getEmergencyUnblockStatus(nowMs).active } catch (e: Exception) { false }
        val today = try { MMKVStore.todayKey() } catch (e: Exception) { "" }
        val planDay = try { MMKVStore.getPlanDay() } catch (e: Exception) { "" }
        val planActiveFlag = try { MMKVStore.isPlanActiveToday() } catch (e: Exception) { false }
        val planActiveUntilMs = try { MMKVStore.getPlanActiveUntilMs() } catch (e: Exception) { 0L }
        val goalDistanceUnit = try { MMKVStore.getGoalDistanceUnit() } catch (e: Exception) { "m" }
        val goalTimeUnit = try { MMKVStore.getGoalTimeUnit() } catch (e: Exception) { "s" }
        val goalDistanceValue = try { MMKVStore.getGoalDistanceValue() } catch (e: Exception) { 0.0 }
        val goalTimeValue = try { MMKVStore.getGoalTimeValue() } catch (e: Exception) { 0.0 }

        val text = computeText(
            blockedCount = blockedCount,
            emergencyBypassActive = emergencyBypassActive,
            todayKey = today,
            planDay = planDay,
            planActiveFlag = planActiveFlag,
            planActiveUntilMs = planActiveUntilMs,
            goalDistanceValue = goalDistanceValue,
            goalDistanceUnit = goalDistanceUnit,
            goalTimeValue = goalTimeValue,
            goalTimeUnit = goalTimeUnit,
            nowMs = nowMs,
            state = state
        )

        return NotificationCompat.Builder(context, TrackingConstants.NOTIFICATION_CHANNEL)
            .setContentTitle(text.title)
            .setContentText(text.body)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
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
