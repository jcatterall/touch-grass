package com.touchgrass

import android.content.Context
import com.tencent.mmkv.MMKV
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
    }

    // ---- Key constants (shared with JS side in src/storage.ts fastStorage) ----
    const val KEY_CURRENT_DAY      = "current_day"
    const val KEY_TODAY_DISTANCE   = "today_distance_meters"
    const val KEY_TODAY_ELAPSED    = "today_elapsed_seconds"
    const val KEY_GOALS_REACHED    = "today_goals_reached"
    const val KEY_IS_AUTO_TRACKING = "is_auto_tracking"

    // Aggregated goal written by JS whenever active plans change.
    // Consumed by TrackingService to display accurate progress in the notification.
    const val KEY_GOAL_TYPE  = "goal_type"
    const val KEY_GOAL_VALUE = "goal_value"
    const val KEY_GOAL_UNIT  = "goal_unit"

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

    fun getTodayDistance(): Double = kv.decodeDouble(KEY_TODAY_DISTANCE, 0.0)
    fun getTodayElapsed(): Long    = kv.decodeLong(KEY_TODAY_ELAPSED, 0L)
    fun getGoalsReached(): Boolean = kv.decodeBool(KEY_GOALS_REACHED, false)
    fun isAutoTracking(): Boolean  = kv.decodeBool(KEY_IS_AUTO_TRACKING, false)

    // ---- Goal readers ----

    fun getGoalType(): String  = kv.decodeString(KEY_GOAL_TYPE) ?: "distance"
    fun getGoalValue(): Double = kv.decodeDouble(KEY_GOAL_VALUE, 5000.0)
    fun getGoalUnit(): String  = kv.decodeString(KEY_GOAL_UNIT) ?: "m"

    // ---- Writers ----

    fun setGoalsReached(v: Boolean) = kv.encode(KEY_GOALS_REACHED, v)
    fun setAutoTracking(v: Boolean) = kv.encode(KEY_IS_AUTO_TRACKING, v)

    /**
     * Overwrites today's elapsed seconds with an absolute value.
     * Used by TrackingService on each state update to keep elapsed current
     * without double-counting (unlike [accumulateTodayElapsed] which adds a delta).
     */
    fun setTodayElapsed(v: Long) {
        val today = todayDate()
        if (kv.decodeString(KEY_CURRENT_DAY) != today) {
            kv.encode(KEY_CURRENT_DAY, today)
            kv.encode(KEY_TODAY_DISTANCE, 0.0)
            kv.encode(KEY_GOALS_REACHED, false)
        }
        kv.encode(KEY_TODAY_ELAPSED, v)
    }

    fun setGoal(type: String, value: Double, unit: String) {
        kv.encode(KEY_GOAL_TYPE, type)
        kv.encode(KEY_GOAL_VALUE, value)
        kv.encode(KEY_GOAL_UNIT, unit)
    }

    // ---- Helpers ----

    private fun todayDate(): String =
        SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
}
