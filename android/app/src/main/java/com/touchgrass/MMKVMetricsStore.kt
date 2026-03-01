package com.touchgrass

import android.content.Context
import com.tencent.mmkv.MMKV
import com.touchgrass.storage.DailyTotalEntity
import com.touchgrass.storage.TrackingDao
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/**
 * Low-frequency, Room-derived snapshot store.
 *
 * This is intentionally separate from [MMKVStore] (touchgrass_state):
 *  - touchgrass_state: high-frequency "today projection" used by UI + notifications
 *  - touchgrass_metrics: low-frequency immutable/derived snapshots (daily/rolling/monthly)
 */
object MMKVMetricsStore {

    private const val MMKV_ID = "touchgrass_metrics"
    private const val METRICS_SCHEMA_VERSION = 1
    private const val KEY_BLOCKING_INDEX_DAILY = "metrics:index:blocking:daily"

    private lateinit var kv: MMKV

    private val df = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    fun init(context: Context) {
        MMKV.initialize(context)
        kv = MMKV.mmkvWithID(MMKV_ID, MMKV.MULTI_PROCESS_MODE)
    }

    fun writeDailySnapshot(daily: DailyTotalEntity) {
        ensureInit()
        updateDailyIndex(daily.date)

        val json = JSONObject()
            .put("date", daily.date)
            .put("distanceMeters", daily.distanceMeters)
            .put("elapsedSeconds", daily.elapsedSeconds)
            .put("sessions", daily.sessionCount)
            .put("goalsReached", daily.goalsReached)
            .put("lastUpdatedMs", daily.lastUpdatedMs)

        kv.encode("metrics:daily:${daily.date}", json.toString())
    }

    suspend fun recomputeAndWriteRolling(dao: TrackingDao, endDate: String) {
        ensureInit()
        writeRollingWindow(dao, windowDays = 7, endDate = endDate)
        writeRollingWindow(dao, windowDays = 30, endDate = endDate)
        writeRollingWindow(dao, windowDays = 365, endDate = endDate)
    }

    suspend fun recomputeAndWriteMonthly(dao: TrackingDao, date: String) {
        ensureInit()
        if (date.length < 7) return
        val month = date.substring(0, 7) // YYYY-MM
        val start = "$month-01"

        val cal = Calendar.getInstance(Locale.US)
        cal.time = df.parse(start) ?: Date()
        cal.add(Calendar.MONTH, 1)
        cal.add(Calendar.DAY_OF_MONTH, -1)
        val end = df.format(cal.time)

        val rows = dao.getDailyTotalsBetween(start, end)
        var dist = 0.0
        var elapsed = 0L
        var goalsDays = 0
        for (r in rows) {
            dist += r.distanceMeters
            elapsed += r.elapsedSeconds
            if (r.goalsReached) goalsDays += 1
        }

        val json = JSONObject()
            .put("month", month)
            .put("distanceMeters", dist)
            .put("elapsedSeconds", elapsed)
            .put("days", rows.size)
            .put("goalsReachedDays", goalsDays)
            .put("computedAtMs", System.currentTimeMillis())

        kv.encode("metrics:monthly:$month", json.toString())
    }

    suspend fun recomputeAndWriteAllTime(dao: TrackingDao, endDate: String) {
        ensureInit()
        val rows = dao.getDailyTotalsBetween("1970-01-01", endDate)

        val blocking = getBlockingTotalsBetween("1970-01-01", endDate)
        val existing = try {
            kv.decodeString("metrics:alltime", null)?.let { JSONObject(it) }
        } catch (_: Exception) {
            null
        }

        var totalDistance = 0.0
        var totalElapsed = 0L
        var totalSessions = 0
        var goalsReachedDays = 0

        var currentStreakDays = 0
        var longestStreakDays = 0
        var streakRun = 0

        for (row in rows) {
            totalDistance += row.distanceMeters
            totalElapsed += row.elapsedSeconds
            totalSessions += row.sessionCount

            if (row.goalsReached) {
                goalsReachedDays += 1
                streakRun += 1
                if (streakRun > longestStreakDays) {
                    longestStreakDays = streakRun
                }
            } else {
                streakRun = 0
            }
        }

        currentStreakDays = streakRun

        val json = JSONObject()
            .put("distanceMeters", totalDistance)
            .put("elapsedSeconds", totalElapsed)
            .put("sessions", totalSessions)
            .put("goalsReachedDays", goalsReachedDays)
            .put("currentGoalStreakDays", currentStreakDays)
            .put("longestGoalStreakDays", longestStreakDays)
            .put("focusMinutes", existing?.opt("focusMinutes") ?: JSONObject.NULL)
            .put("notificationsBlockedTotal", blocking.notificationsBlocked)
            .put("blockedAttemptsTotal", blocking.blockedAttempts)
            .put("computedAtMs", System.currentTimeMillis())
            .put("schemaVersion", METRICS_SCHEMA_VERSION)

        kv.encode("metrics:alltime", json.toString())
    }

    fun incrementBlockedAttempt(packageName: String?) {
        ensureInit()
        val date = df.format(Date())
        val payload = getBlockingDailyJson(date)
        payload.put("blockedAttempts", payload.optInt("blockedAttempts", 0) + 1)
        if (!packageName.isNullOrBlank()) {
            putIncrementByApp(payload, "blockedAttemptsByApp", packageName)
        }
        payload.put("lastUpdatedMs", System.currentTimeMillis())
        writeBlockingDailyJson(date, payload, blockedAttemptsDelta = 1, notificationsDelta = 0)
    }

    fun incrementNotificationBlocked(packageName: String?) {
        ensureInit()
        val date = df.format(Date())
        val payload = getBlockingDailyJson(date)
        payload.put("notificationsBlocked", payload.optInt("notificationsBlocked", 0) + 1)
        if (!packageName.isNullOrBlank()) {
            putIncrementByApp(payload, "notificationsBlockedByApp", packageName)
        }
        payload.put("lastUpdatedMs", System.currentTimeMillis())
        writeBlockingDailyJson(date, payload, blockedAttemptsDelta = 0, notificationsDelta = 1)
    }

    fun getBlockingDaily(date: String): JSONObject? {
        ensureInit()
        val raw = kv.decodeString("metrics:blocking:daily:$date", null) ?: return null
        return try {
            JSONObject(raw)
        } catch (_: Exception) {
            null
        }
    }

    data class BlockingTotals(
        val blockedAttempts: Int,
        val notificationsBlocked: Int,
    )

    fun getBlockingTotalsBetween(startDate: String, endDate: String): BlockingTotals {
        ensureInit()
        val index = getBlockingIndex()
        var blockedAttempts = 0
        var notificationsBlocked = 0

        for (date in index) {
            if (date < startDate || date > endDate) continue
            val row = getBlockingDaily(date) ?: continue
            blockedAttempts += row.optInt("blockedAttempts", 0)
            notificationsBlocked += row.optInt("notificationsBlocked", 0)
        }

        return BlockingTotals(
            blockedAttempts = blockedAttempts,
            notificationsBlocked = notificationsBlocked,
        )
    }

    private fun getBlockingDailyJson(date: String): JSONObject {
        val existing = kv.decodeString("metrics:blocking:daily:$date", null)
        return try {
            if (existing.isNullOrBlank()) {
                JSONObject()
                    .put("date", date)
                    .put("blockedAttempts", 0)
                    .put("notificationsBlocked", 0)
                    .put("blockedAttemptsByApp", JSONObject())
                    .put("notificationsBlockedByApp", JSONObject())
                    .put("lastUpdatedMs", 0L)
            } else {
                JSONObject(existing)
            }
        } catch (_: Exception) {
            JSONObject()
                .put("date", date)
                .put("blockedAttempts", 0)
                .put("notificationsBlocked", 0)
                .put("blockedAttemptsByApp", JSONObject())
                .put("notificationsBlockedByApp", JSONObject())
                .put("lastUpdatedMs", 0L)
        }
    }

    private fun writeBlockingDailyJson(
        date: String,
        payload: JSONObject,
        blockedAttemptsDelta: Int,
        notificationsDelta: Int,
    ) {
        updateBlockingIndex(date)
        kv.encode("metrics:blocking:daily:$date", payload.toString())

        val existingAllTime = try {
            kv.decodeString("metrics:alltime", null)?.let { JSONObject(it) }
        } catch (_: Exception) {
            null
        }
        if (existingAllTime != null) {
            val currentBlocked = if (existingAllTime.isNull("blockedAttemptsTotal")) {
                0
            } else {
                existingAllTime.optInt("blockedAttemptsTotal", 0)
            }
            val currentNotifications = if (existingAllTime.isNull("notificationsBlockedTotal")) {
                0
            } else {
                existingAllTime.optInt("notificationsBlockedTotal", 0)
            }
            existingAllTime.put(
                "blockedAttemptsTotal",
                (currentBlocked + blockedAttemptsDelta).coerceAtLeast(0),
            )
            existingAllTime.put(
                "notificationsBlockedTotal",
                (currentNotifications + notificationsDelta).coerceAtLeast(0),
            )
            existingAllTime.put("computedAtMs", System.currentTimeMillis())
            existingAllTime.put("schemaVersion", METRICS_SCHEMA_VERSION)
            kv.encode("metrics:alltime", existingAllTime.toString())
        }
    }

    private fun putIncrementByApp(payload: JSONObject, key: String, packageName: String) {
        val byApp = try {
            payload.optJSONObject(key) ?: JSONObject()
        } catch (_: Exception) {
            JSONObject()
        }
        byApp.put(packageName, byApp.optInt(packageName, 0) + 1)
        payload.put(key, byApp)
    }

    private fun getBlockingIndex(): List<String> {
        val existing = kv.decodeString(KEY_BLOCKING_INDEX_DAILY, null)
        val arr = try {
            if (existing.isNullOrBlank()) JSONArray() else JSONArray(existing)
        } catch (_: Exception) {
            JSONArray()
        }

        val out = mutableListOf<String>()
        for (i in 0 until arr.length()) {
            val d = arr.optString(i)
            if (d.isNotBlank()) out.add(d)
        }
        return out
    }

    private fun updateBlockingIndex(date: String) {
        val existing = kv.decodeString(KEY_BLOCKING_INDEX_DAILY, null)
        val arr = try {
            if (existing.isNullOrBlank()) JSONArray() else JSONArray(existing)
        } catch (_: Exception) {
            JSONArray()
        }

        var has = false
        for (i in 0 until arr.length()) {
            if (arr.optString(i) == date) {
                has = true
                break
            }
        }
        if (!has) {
            arr.put(date)
        }

        val list = mutableListOf<String>()
        for (i in 0 until arr.length()) {
            val d = arr.optString(i)
            if (d.isNotBlank()) list.add(d)
        }
        list.sort()
        val bounded = if (list.size > 400) list.takeLast(400) else list

        val out = JSONArray()
        for (d in bounded) out.put(d)
        kv.encode(KEY_BLOCKING_INDEX_DAILY, out.toString())
    }

    private suspend fun writeRollingWindow(dao: TrackingDao, windowDays: Int, endDate: String) {
        if (windowDays <= 0) return
        val startDate = addDays(endDate, -(windowDays - 1))
        val rows = dao.getDailyTotalsBetween(startDate, endDate)

        var dist = 0.0
        var elapsed = 0L
        var goalsDays = 0
        for (r in rows) {
            dist += r.distanceMeters
            elapsed += r.elapsedSeconds
            if (r.goalsReached) goalsDays += 1
        }

        val windowKey = "${windowDays}d"
        val json = JSONObject()
            .put("window", windowKey)
            .put("startDate", startDate)
            .put("endDate", endDate)
            .put("distanceMeters", dist)
            .put("elapsedSeconds", elapsed)
            .put("days", rows.size)
            .put("goalsReachedDays", goalsDays)
            .put("computedAtMs", System.currentTimeMillis())

        kv.encode("metrics:rolling:$windowKey", json.toString())
    }

    private fun updateDailyIndex(date: String) {
        val key = "metrics:index:daily"
        val existing = kv.decodeString(key, null)

        val arr = try {
            if (existing.isNullOrBlank()) JSONArray() else JSONArray(existing)
        } catch (_: Exception) {
            JSONArray()
        }

        var has = false
        for (i in 0 until arr.length()) {
            if (arr.optString(i) == date) {
                has = true
                break
            }
        }
        if (!has) {
            arr.put(date)
        }

        // Keep the index sorted and bounded.
        val list = mutableListOf<String>()
        for (i in 0 until arr.length()) {
            val d = arr.optString(i)
            if (d.isNotBlank()) list.add(d)
        }
        list.sort()
        val bounded = if (list.size > 400) list.takeLast(400) else list

        val out = JSONArray()
        for (d in bounded) out.put(d)
        kv.encode(key, out.toString())
    }

    private fun addDays(date: String, deltaDays: Int): String {
        val cal = Calendar.getInstance(Locale.US)
        cal.time = df.parse(date) ?: Date()
        cal.add(Calendar.DAY_OF_YEAR, deltaDays)
        return df.format(cal.time)
    }

    private fun ensureInit() {
        if (!::kv.isInitialized) {
            throw IllegalStateException("MMKVMetricsStore not initialized")
        }
    }
}
