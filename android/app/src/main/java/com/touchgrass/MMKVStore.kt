package com.touchgrass

import android.content.Context
import com.tencent.mmkv.MMKV
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Singleton shared-memory store readable by both Kotlin services and JS (via react-native-mmkv).
 *
 * Uses MULTI_PROCESS_MODE so TrackingService, AppBlockerService, and the JS thread all access
 * the same underlying file without IPC overhead. Reads and writes are synchronous (C++ mmap),
 * making this the primary fast-path for "today's totals" that previously required an async
 * AsyncStorage round-trip on app open.
 *
 * Key contract: key names here must match those used in fastStorage in src/storage.ts.
 */
object MMKVStore {

    private lateinit var kv: MMKV

    fun init(context: Context) {
        MMKV.initialize(context)
        kv = MMKV.mmkvWithID("touchgrass_state", MMKV.MULTI_PROCESS_MODE)
        // Ensure numeric keys always have a typed value so decodeDouble/decodeLong
        // never hits an uninitialized buffer (which logs "reach end" errors).
        if (!kv.containsKey(KEY_TODAY_DISTANCE)) kv.encode(KEY_TODAY_DISTANCE, 0.0)
        if (!kv.containsKey(KEY_TODAY_ELAPSED))  kv.encode(KEY_TODAY_ELAPSED, 0L)
        if (!kv.containsKey(KEY_GOAL_VALUE))     kv.encode(KEY_GOAL_VALUE, 0.0)
        if (!kv.containsKey(KEY_TRACKING_MODE))  kv.encode(KEY_TRACKING_MODE, "idle")
        if (!kv.containsKey(KEY_TRACKING_REVISION)) kv.encode(KEY_TRACKING_REVISION, 0L)
        if (!kv.containsKey(KEY_GOAL_DISTANCE_VALUE)) kv.encode(KEY_GOAL_DISTANCE_VALUE, 0.0)
        if (!kv.containsKey(KEY_GOAL_DISTANCE_UNIT))  kv.encode(KEY_GOAL_DISTANCE_UNIT, "m")
        if (!kv.containsKey(KEY_GOAL_TIME_VALUE))     kv.encode(KEY_GOAL_TIME_VALUE, 0.0)
        if (!kv.containsKey(KEY_GOAL_TIME_UNIT))      kv.encode(KEY_GOAL_TIME_UNIT, "s")
        if (!kv.containsKey(KEY_BLOCKED_COUNT))  kv.encode(KEY_BLOCKED_COUNT, 0)
        if (!kv.containsKey(KEY_PLAN_DAY))       kv.encode(KEY_PLAN_DAY, "")
        if (!kv.containsKey(KEY_PLAN_ACTIVE_TODAY)) kv.encode(KEY_PLAN_ACTIVE_TODAY, false)
        if (!kv.containsKey(KEY_PLAN_ACTIVE_UNTIL_MS)) kv.encode(KEY_PLAN_ACTIVE_UNTIL_MS, 0L)
        if (!kv.containsKey(KEY_IDLE_MONITORING_ENABLED)) kv.encode(KEY_IDLE_MONITORING_ENABLED, false)
        if (!kv.containsKey(KEY_TODAY_LAST_UPDATE_MS)) kv.encode(KEY_TODAY_LAST_UPDATE_MS, 0L)
        if (!kv.containsKey(KEY_LAST_AR_REPLAY_EVENT_NANOS)) kv.encode(KEY_LAST_AR_REPLAY_EVENT_NANOS, 0L)
        if (!kv.containsKey(KEY_TODAY_NOTIFICATIONS_BLOCKED_TOTAL)) kv.encode(KEY_TODAY_NOTIFICATIONS_BLOCKED_TOTAL, 0)
        if (!kv.containsKey(KEY_TODAY_NOTIFICATIONS_BLOCKED_BY_APP_JSON)) kv.encode(KEY_TODAY_NOTIFICATIONS_BLOCKED_BY_APP_JSON, "{}")
        if (!kv.containsKey(KEY_TODAY_BLOCKED_ATTEMPTS_BY_APP_JSON)) kv.encode(KEY_TODAY_BLOCKED_ATTEMPTS_BY_APP_JSON, "{}")
        if (!kv.containsKey(KEY_NOTIF_LISTENER_CONNECTED_AT_MS)) kv.encode(KEY_NOTIF_LISTENER_CONNECTED_AT_MS, 0L)
        if (!kv.containsKey(KEY_NOTIF_LISTENER_DISCONNECTED_AT_MS)) kv.encode(KEY_NOTIF_LISTENER_DISCONNECTED_AT_MS, 0L)
        if (!kv.containsKey(KEY_NOTIF_LISTENER_LAST_EVENT_AT_MS)) kv.encode(KEY_NOTIF_LISTENER_LAST_EVENT_AT_MS, 0L)
        if (!kv.containsKey(KEY_EMERGENCY_UNBLOCK_UNTIL_MS)) kv.encode(KEY_EMERGENCY_UNBLOCK_UNTIL_MS, 0L)
        if (!kv.containsKey(KEY_EMERGENCY_UNBLOCK_MODE)) kv.encode(KEY_EMERGENCY_UNBLOCK_MODE, EMERGENCY_UNBLOCK_MODE_NONE)
    }

    // ---- Key constants (shared with JS side in src/storage.ts fastStorage) ----
    const val KEY_CURRENT_DAY      = "current_day"
    const val KEY_TODAY_DISTANCE   = "today_distance_meters"
    const val KEY_TODAY_ELAPSED    = "today_elapsed_seconds"
    const val KEY_GOALS_REACHED    = "today_goals_reached"
    const val KEY_IS_AUTO_TRACKING = "is_auto_tracking"
    const val KEY_TRACKING_MODE    = "tracking_mode"
    const val KEY_TRACKING_REVISION = "tracking_revision"
    const val KEY_TODAY_LAST_UPDATE_MS = "today_last_update_ms"

    // Aggregated goal written by JS whenever active plans change.
    // Consumed by TrackingService to display accurate progress in the notification.
    const val KEY_GOAL_TYPE  = "goal_type"
    const val KEY_GOAL_VALUE = "goal_value"
    const val KEY_GOAL_UNIT  = "goal_unit"
    // New: separate keys for distance/time so multiple goals can be active.
    const val KEY_GOAL_DISTANCE_VALUE = "goal_distance_value"
    const val KEY_GOAL_DISTANCE_UNIT  = "goal_distance_unit"
    const val KEY_GOAL_TIME_VALUE     = "goal_time_value"
    const val KEY_GOAL_TIME_UNIT      = "goal_time_unit"
    // Number of distinct blocked packages currently configured by JS
    const val KEY_BLOCKED_COUNT = "blocked_count"

    // Day scope for aggregated plan goals (YYYY-MM-DD). Written by JS alongside the aggregated goals.
    const val KEY_PLAN_DAY = "plan_day"

    // Whether there is at least one active plan for today (day + time window).
    // Written by JS.
    const val KEY_PLAN_ACTIVE_TODAY = "plan_active_today"

    // Optional: absolute expiry timestamp for current "plan active" snapshot.
    // Written by JS so notifications can fail-closed if the app is terminated.
    const val KEY_PLAN_ACTIVE_UNTIL_MS = "plan_active_until_ms"

    // Whether idle motion monitoring should be running even when no session is active.
    const val KEY_IDLE_MONITORING_ENABLED = "idle_monitoring_enabled"
    const val KEY_LAST_AR_REPLAY_EVENT_NANOS = "last_ar_replay_event_nanos"
    const val KEY_TODAY_NOTIFICATIONS_BLOCKED_TOTAL = "today_notifications_blocked_total"
    const val KEY_TODAY_NOTIFICATIONS_BLOCKED_BY_APP_JSON = "today_notifications_blocked_by_app_json"
    const val KEY_TODAY_BLOCKED_ATTEMPTS_BY_APP_JSON = "today_blocked_attempts_by_app_json"
    const val KEY_NOTIF_LISTENER_CONNECTED_AT_MS = "notif_listener_connected_at_ms"
    const val KEY_NOTIF_LISTENER_DISCONNECTED_AT_MS = "notif_listener_disconnected_at_ms"
    const val KEY_NOTIF_LISTENER_LAST_EVENT_AT_MS = "notif_listener_last_event_at_ms"
    const val KEY_EMERGENCY_UNBLOCK_UNTIL_MS = "emergency_unblock_until_ms"
    const val KEY_EMERGENCY_UNBLOCK_MODE = "emergency_unblock_mode"

    const val EMERGENCY_UNBLOCK_MODE_NONE = "none"
    const val EMERGENCY_UNBLOCK_MODE_5M = "5m"
    const val EMERGENCY_UNBLOCK_MODE_30M = "30m"
    const val EMERGENCY_UNBLOCK_MODE_TODAY = "today"

    data class EmergencyUnblockStatus(
        val active: Boolean,
        val mode: String,
        val untilMs: Long,
        val remainingMs: Long,
    )

    // ---- Distance accumulation (called from TrackingService on each GPS fix) ----

    /**
     * Atomically adds [deltaMeters] to today's accumulated distance.
     * Rolls over automatically at midnight by checking the date stored alongside the value.
     */
    fun accumulateTodayDistance(deltaMeters: Double) {
        val today = todayDate()
        if (kv.decodeString(KEY_CURRENT_DAY) != today) {
            // New day — reset all daily counters
            kv.encode(KEY_CURRENT_DAY, today)
            kv.encode(KEY_TODAY_DISTANCE, deltaMeters)
            kv.encode(KEY_TODAY_ELAPSED, 0L)
            kv.encode(KEY_GOALS_REACHED, false)
        } else {
            val current = kv.decodeDouble(KEY_TODAY_DISTANCE, 0.0)
            kv.encode(KEY_TODAY_DISTANCE, current + deltaMeters)
        }
    }

    fun accumulateTodayElapsed(deltaSeconds: Long) {
        val today = todayDate()
        if (kv.decodeString(KEY_CURRENT_DAY) == today) {
            val current = kv.decodeLong(KEY_TODAY_ELAPSED, 0L)
            kv.encode(KEY_TODAY_ELAPSED, current + deltaSeconds)
        }
    }

    // ---- Readers ----

    fun getCurrentDay(): String = kv.decodeString(KEY_CURRENT_DAY) ?: ""

    fun isCurrentDayToday(): Boolean = getCurrentDay() == todayDate()

    fun rolloverToTodayIfNeeded(): Boolean {
        val today = todayDate()
        if (kv.decodeString(KEY_CURRENT_DAY) == today) return false
        resetForNewDay(today)
        return true
    }

    fun getTodayDistance(): Double = kv.decodeDouble(KEY_TODAY_DISTANCE, 0.0)
    fun getTodayElapsed(): Long    = kv.decodeLong(KEY_TODAY_ELAPSED, 0L)
    fun getGoalsReached(): Boolean = kv.decodeBool(KEY_GOALS_REACHED, false)

    fun getTodayDistanceSafe(): Double = if (isCurrentDayToday()) getTodayDistance() else 0.0
    fun getTodayElapsedSafe(): Long = if (isCurrentDayToday()) getTodayElapsed() else 0L
    fun getGoalsReachedSafe(): Boolean = if (isCurrentDayToday()) getGoalsReached() else false
    fun isAutoTracking(): Boolean  = kv.decodeBool(KEY_IS_AUTO_TRACKING, false)
    fun getTrackingMode(): String  = kv.decodeString(KEY_TRACKING_MODE) ?: "idle"
    fun getTrackingRevision(): Long = kv.decodeLong(KEY_TRACKING_REVISION, 0L)

    // ---- Goal readers ----

    fun getGoalType(): String  = kv.decodeString(KEY_GOAL_TYPE) ?: "distance"
    fun getGoalValue(): Double = kv.decodeDouble(KEY_GOAL_VALUE, 5000.0)
    fun getGoalUnit(): String  = kv.decodeString(KEY_GOAL_UNIT) ?: "m"

    // ---- New: separate goal readers ----
    fun getGoalDistanceValue(): Double = kv.decodeDouble(KEY_GOAL_DISTANCE_VALUE, 0.0)
    fun getGoalDistanceUnit(): String  = kv.decodeString(KEY_GOAL_DISTANCE_UNIT) ?: "m"
    fun getGoalTimeValue(): Double     = kv.decodeDouble(KEY_GOAL_TIME_VALUE, 0.0)
    fun getGoalTimeUnit(): String      = kv.decodeString(KEY_GOAL_TIME_UNIT) ?: "s"

    // Blocked apps fast-path
    fun getBlockedCount(): Int = kv.decodeInt(KEY_BLOCKED_COUNT, 0)

    fun getPlanDay(): String = kv.decodeString(KEY_PLAN_DAY) ?: ""

    fun isPlanActiveToday(): Boolean = kv.decodeBool(KEY_PLAN_ACTIVE_TODAY, false)

    fun getPlanActiveUntilMs(): Long = kv.decodeLong(KEY_PLAN_ACTIVE_UNTIL_MS, 0L)

    fun isIdleMonitoringEnabled(): Boolean = kv.decodeBool(KEY_IDLE_MONITORING_ENABLED, false)

    fun getTodayLastUpdateMs(): Long = kv.decodeLong(KEY_TODAY_LAST_UPDATE_MS, 0L)

    fun getLastArReplayEventNanos(): Long = kv.decodeLong(KEY_LAST_AR_REPLAY_EVENT_NANOS, 0L)

    fun getTodayNotificationsBlockedTotal(): Int {
        ensureTodayRollover()
        return kv.decodeInt(KEY_TODAY_NOTIFICATIONS_BLOCKED_TOTAL, 0)
    }

    fun getTodayNotificationsBlockedByAppJson(): String {
        ensureTodayRollover()
        return kv.decodeString(KEY_TODAY_NOTIFICATIONS_BLOCKED_BY_APP_JSON) ?: "{}"
    }

    fun getTodayNotificationsBlockedForApp(packageName: String): Int {
        if (packageName.isBlank()) return 0
        ensureTodayRollover()
        return try {
            val json = JSONObject(kv.decodeString(KEY_TODAY_NOTIFICATIONS_BLOCKED_BY_APP_JSON) ?: "{}")
            json.optInt(packageName, 0)
        } catch (_: Exception) {
            0
        }
    }

    fun getTodayBlockedAttemptsForApp(packageName: String): Int {
        if (packageName.isBlank()) return 0
        ensureTodayRollover()
        return try {
            val json = JSONObject(kv.decodeString(KEY_TODAY_BLOCKED_ATTEMPTS_BY_APP_JSON) ?: "{}")
            json.optInt(packageName, 0)
        } catch (_: Exception) {
            0
        }
    }

    fun getNotificationListenerConnectedAtMs(): Long = kv.decodeLong(KEY_NOTIF_LISTENER_CONNECTED_AT_MS, 0L)

    fun getNotificationListenerDisconnectedAtMs(): Long = kv.decodeLong(KEY_NOTIF_LISTENER_DISCONNECTED_AT_MS, 0L)

    fun getNotificationListenerLastEventAtMs(): Long = kv.decodeLong(KEY_NOTIF_LISTENER_LAST_EVENT_AT_MS, 0L)

    fun getEmergencyUnblockUntilMs(): Long = kv.decodeLong(KEY_EMERGENCY_UNBLOCK_UNTIL_MS, 0L)

    fun getEmergencyUnblockMode(): String =
        kv.decodeString(KEY_EMERGENCY_UNBLOCK_MODE) ?: EMERGENCY_UNBLOCK_MODE_NONE

    fun getEmergencyUnblockStatus(nowMs: Long = System.currentTimeMillis()): EmergencyUnblockStatus {
        val untilMs = getEmergencyUnblockUntilMs()
        val mode = getEmergencyUnblockMode()

        if (untilMs <= nowMs || mode == EMERGENCY_UNBLOCK_MODE_NONE) {
            if (untilMs != 0L || mode != EMERGENCY_UNBLOCK_MODE_NONE) {
                clearEmergencyUnblock()
            }
            return EmergencyUnblockStatus(
                active = false,
                mode = EMERGENCY_UNBLOCK_MODE_NONE,
                untilMs = 0L,
                remainingMs = 0L,
            )
        }

        return EmergencyUnblockStatus(
            active = true,
            mode = mode,
            untilMs = untilMs,
            remainingMs = untilMs - nowMs,
        )
    }

    fun getEmergencyUnblockRemainingMs(nowMs: Long = System.currentTimeMillis()): Long {
        return getEmergencyUnblockStatus(nowMs).remainingMs
    }

    // ---- Writers ----

    fun setGoalsReached(v: Boolean) = kv.encode(KEY_GOALS_REACHED, v)
    fun setAutoTracking(v: Boolean) = kv.encode(KEY_IS_AUTO_TRACKING, v)
    fun setTrackingMode(v: String) = kv.encode(KEY_TRACKING_MODE, v)
    fun bumpTrackingRevision(): Long {
        val next = kv.decodeLong(KEY_TRACKING_REVISION, 0L) + 1L
        kv.encode(KEY_TRACKING_REVISION, next)
        return next
    }

    fun setTodayLastUpdateMs(v: Long) = kv.encode(KEY_TODAY_LAST_UPDATE_MS, v)

    fun setLastArReplayEventNanos(v: Long) {
        kv.encode(KEY_LAST_AR_REPLAY_EVENT_NANOS, v)
    }

    fun setNotificationListenerConnectedAtMs(v: Long) {
        kv.encode(KEY_NOTIF_LISTENER_CONNECTED_AT_MS, v)
    }

    fun setNotificationListenerDisconnectedAtMs(v: Long) {
        kv.encode(KEY_NOTIF_LISTENER_DISCONNECTED_AT_MS, v)
    }

    fun setNotificationListenerLastEventAtMs(v: Long) {
        kv.encode(KEY_NOTIF_LISTENER_LAST_EVENT_AT_MS, v)
    }

    fun setEmergencyUnblockUntilMs(v: Long) {
        kv.encode(KEY_EMERGENCY_UNBLOCK_UNTIL_MS, v)
    }

    fun setEmergencyUnblockMode(v: String) {
        kv.encode(KEY_EMERGENCY_UNBLOCK_MODE, v)
    }

    fun setEmergencyUnblock(mode: String, untilMs: Long) {
        kv.encode(KEY_EMERGENCY_UNBLOCK_MODE, mode)
        kv.encode(KEY_EMERGENCY_UNBLOCK_UNTIL_MS, untilMs)
    }

    fun clearEmergencyUnblock() {
        kv.encode(KEY_EMERGENCY_UNBLOCK_UNTIL_MS, 0L)
        kv.encode(KEY_EMERGENCY_UNBLOCK_MODE, EMERGENCY_UNBLOCK_MODE_NONE)
    }

    /**
     * Overwrites today's elapsed seconds with an absolute value.
     * Used by TrackingService on each state update to keep elapsed current
     * without double-counting (unlike [accumulateTodayElapsed] which adds a delta).
     */
    fun setTodayElapsed(v: Long) {
        val today = todayDate()
        if (kv.decodeString(KEY_CURRENT_DAY) != today) {
            resetForNewDay(today)
        }
        kv.encode(KEY_TODAY_ELAPSED, v)
    }

    /**
     * Overwrites today's distance meters with an absolute value.
     * Used by TrackingService to project canonical state into MMKV.
     */
    fun setTodayDistance(v: Double) {
        val today = todayDate()
        if (kv.decodeString(KEY_CURRENT_DAY) != today) {
            resetForNewDay(today)
        }
        kv.encode(KEY_TODAY_DISTANCE, v)
    }

    fun setGoal(type: String, value: Double, unit: String) {
        kv.encode(KEY_GOAL_TYPE, type)
        kv.encode(KEY_GOAL_VALUE, value)
        kv.encode(KEY_GOAL_UNIT, unit)
        // Also write to the separate typed keys for compatibility when JS
        // writes both distance and time goals. This keeps native readers
        // in sync with the fast-path keys.
        when (type) {
            "distance" -> {
                kv.encode(KEY_GOAL_DISTANCE_VALUE, value)
                kv.encode(KEY_GOAL_DISTANCE_UNIT, unit)
            }
            "time" -> {
                kv.encode(KEY_GOAL_TIME_VALUE, value)
                kv.encode(KEY_GOAL_TIME_UNIT, unit)
            }
            else -> {
                // clear typed keys
                kv.encode(KEY_GOAL_DISTANCE_VALUE, 0.0)
                kv.encode(KEY_GOAL_TIME_VALUE, 0.0)
            }
        }
    }

    fun setBlockedCount(count: Int) {
        kv.encode(KEY_BLOCKED_COUNT, count)
    }

    fun setPlanDay(day: String) {
        kv.encode(KEY_PLAN_DAY, day)
    }

    fun setPlanActiveToday(v: Boolean) {
        kv.encode(KEY_PLAN_ACTIVE_TODAY, v)
    }

    fun setPlanActiveUntilMs(v: Long) {
        kv.encode(KEY_PLAN_ACTIVE_UNTIL_MS, v)
    }

    fun setIdleMonitoringEnabled(v: Boolean) {
        kv.encode(KEY_IDLE_MONITORING_ENABLED, v)
    }

    fun incrementTodayNotificationsBlockedForApp(packageName: String) {
        if (packageName.isBlank()) return
        ensureTodayRollover()

        val total = kv.decodeInt(KEY_TODAY_NOTIFICATIONS_BLOCKED_TOTAL, 0)
        kv.encode(KEY_TODAY_NOTIFICATIONS_BLOCKED_TOTAL, total + 1)

        try {
            val json = JSONObject(kv.decodeString(KEY_TODAY_NOTIFICATIONS_BLOCKED_BY_APP_JSON) ?: "{}")
            val next = json.optInt(packageName, 0) + 1
            json.put(packageName, next)
            kv.encode(KEY_TODAY_NOTIFICATIONS_BLOCKED_BY_APP_JSON, json.toString())
        } catch (_: Exception) {
            val json = JSONObject()
            json.put(packageName, 1)
            kv.encode(KEY_TODAY_NOTIFICATIONS_BLOCKED_BY_APP_JSON, json.toString())
        }
    }

    fun incrementTodayBlockedAttemptsForApp(packageName: String) {
        if (packageName.isBlank()) return
        ensureTodayRollover()
        try {
            val json = JSONObject(kv.decodeString(KEY_TODAY_BLOCKED_ATTEMPTS_BY_APP_JSON) ?: "{}")
            val next = json.optInt(packageName, 0) + 1
            json.put(packageName, next)
            kv.encode(KEY_TODAY_BLOCKED_ATTEMPTS_BY_APP_JSON, json.toString())
        } catch (_: Exception) {
            val json = JSONObject()
            json.put(packageName, 1)
            kv.encode(KEY_TODAY_BLOCKED_ATTEMPTS_BY_APP_JSON, json.toString())
        }
    }

    // ---- Helpers ----

    private fun todayDate(): String =
        SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    private fun ensureTodayRollover() {
        val today = todayDate()
        if (kv.decodeString(KEY_CURRENT_DAY) != today) {
            resetForNewDay(today)
        }
    }

    private fun resetForNewDay(today: String) {
        kv.encode(KEY_CURRENT_DAY, today)
        kv.encode(KEY_TODAY_DISTANCE, 0.0)
        kv.encode(KEY_TODAY_ELAPSED, 0L)
        kv.encode(KEY_GOALS_REACHED, false)
        kv.encode(KEY_TRACKING_MODE, "idle")
        kv.encode(KEY_TODAY_LAST_UPDATE_MS, 0L)
        kv.encode(KEY_TODAY_NOTIFICATIONS_BLOCKED_TOTAL, 0)
        kv.encode(KEY_TODAY_NOTIFICATIONS_BLOCKED_BY_APP_JSON, "{}")
        kv.encode(KEY_TODAY_BLOCKED_ATTEMPTS_BY_APP_JSON, "{}")
    }

    fun todayKey(): String = todayDate()
}
