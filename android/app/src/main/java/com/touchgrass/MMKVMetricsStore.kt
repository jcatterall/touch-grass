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
