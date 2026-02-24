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

        // Build conditional progress subtitle. Support both distance and time
        // aggregated goals so the notification can show combined progress like
        // "Progress: 0 / 5.00km | 0 / 30m" when both are active.
        val hasDistance = try { MMKVStore.getGoalDistanceValue() > 0.0 } catch (e: Exception) { false }
        val hasTime = try { MMKVStore.getGoalTimeValue() > 0.0 } catch (e: Exception) { false }

        // Heading: "{N} application(s) blocked" or special-case when there are
        // no active blocks *and* no goals for today.
        val title = if (blockedCount == 0 && !hasDistance && !hasTime) {
            "No active blocks for today"
        } else if (blockedCount == 1) {
            "1 application blocked"
        } else {
            "${blockedCount} applications blocked"
        }

        val body = if (!hasDistance && !hasTime) {
            // No active goals — if there are no blocked apps, show a brief
            // friendly title and keep the body empty. If there are blocked
            // apps but no goals, show the simple status line below.
            if (blockedCount == 0) {
                ""
            } else {
                when (state.mode) {
                    TrackingMode.IDLE -> "Watching for movement…"
                    TrackingMode.PAUSED_VEHICLE -> "Paused (in vehicle)"
                    TrackingMode.TRACKING_AUTO,
                    TrackingMode.TRACKING_MANUAL -> "Tracking…"
                }
            }
        } else {
            val parts = mutableListOf<String>()
            if (hasDistance) {
                val totalDist = try { MMKVStore.getGoalDistanceValue() } catch (e: Exception) { 0.0 }
                val unit = try { MMKVStore.getGoalDistanceUnit() } catch (e: Exception) { "m" }
                val current = state.distanceMeters
                parts.add("Progress: ${formatDistance(current)} / ${formatDistanceFromUnit(totalDist, unit)}")
            }
            if (hasTime) {
                val totalTime = try { MMKVStore.getGoalTimeValue() } catch (e: Exception) { 0.0 }
                val unit = try { MMKVStore.getGoalTimeUnit() } catch (e: Exception) { "s" }
                val current = state.elapsedSeconds
                parts.add("Progress: ${formatTime(current)} / ${formatTimeSeconds(totalTime.toLong())}")
            }

            parts.joinToString(" | ")
        }

        return NotificationCompat.Builder(context, TrackingConstants.NOTIFICATION_CHANNEL)
            .setContentTitle(title)
            .setContentText(body)
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

    private fun formatDistance(meters: Double): String {
        return if (meters >= 1000.0) {
            "%.2fkm".format(meters / 1000.0)
        } else {
            "%.0fm".format(meters)
        }
    }

    private fun formatDistanceFromUnit(value: Double, unit: String): String {
        // JS writes distances in meters with unit 'm'
        return if (unit == "m") formatDistance(value) else "%.2f %s".format(value, unit)
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
