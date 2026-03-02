package com.touchgrass.storage

import android.content.Context
import android.util.Log
import com.touchgrass.MMKVMetricsStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

/**
 * Thin repository used by TrackingService to manage the Room session lifecycle.
 * All writes are fire-and-forget on the IO dispatcher so they never block the GPS callback.
 */
class SessionRepository(context: Context) {

    companion object {
        private const val TAG = "SessionRepository"
    }

    private val dao = TrackingDatabase.getInstance(context).trackingDao()
    private val scope = CoroutineScope(Dispatchers.IO)

    init {
        // Best-effort init; safe to call multiple times.
        try {
            MMKVMetricsStore.init(context)
        } catch (_: Exception) {
        }
    }

    private var currentSessionId: String? = null
    private var sessionMode: String = "auto"

    fun startSession(mode: String): String {
        val id = UUID.randomUUID().toString()
        val today = todayDate()
        currentSessionId = id
        sessionMode = mode
        scope.launch {
            // Track number of sessions per day (used by derived snapshots).
            dao.bumpSessionCount(today)
            dao.insertSession(
                SessionEntity(
                    id = id,
                    date = today,
                    mode = mode,
                    startMs = System.currentTimeMillis(),
                    endMs = null,
                    distanceMeters = 0.0,
                    elapsedSeconds = 0L,
                    goalReached = false,
                )
            )
        }
        return id
    }

    fun accumulateDaily(deltaDist: Double, deltaElapsed: Long, goalReached: Boolean) {
        val today = todayDate()
        scope.launch {
            dao.accumulateDaily(today, deltaDist, deltaElapsed, goalReached)
        }
    }

    fun closeSession(distanceMeters: Double, elapsedSeconds: Long, goalReached: Boolean) {
        val id = currentSessionId ?: return
        val today = todayDate()
        scope.launch {
            val existing = dao.getSession(id)
            val sessionDate = existing?.date ?: today

            // Idempotency: if closeSession is invoked multiple times for the same
            // session id (e.g., rapid stop+destroy), only accumulate the delta.
            val prevDistance = existing?.distanceMeters ?: 0.0
            val prevElapsed = existing?.elapsedSeconds ?: 0L
            val prevGoalReached = existing?.goalReached ?: false

            val nextGoalReached = prevGoalReached || goalReached

            // Only accumulate positive deltas; defensive against out-of-order updates.
            val deltaDistance = (distanceMeters - prevDistance).coerceAtLeast(0.0)
            val deltaElapsed = (elapsedSeconds - prevElapsed).coerceAtLeast(0L)

            if (existing != null) {
                dao.upsertSession(
                    existing.copy(
                        endMs = System.currentTimeMillis(),
                        distanceMeters = maxOf(existing.distanceMeters, distanceMeters),
                        elapsedSeconds = maxOf(existing.elapsedSeconds, elapsedSeconds),
                        goalReached = nextGoalReached,
                    )
                )
            } else {
                // Defensive: session-start insert is fire-and-forget; if we stop very
                // quickly the row may not exist yet. Write the closed session snapshot.
                val endMs = System.currentTimeMillis()
                val startMs = endMs - (elapsedSeconds.coerceAtLeast(0L) * 1000L)
                dao.upsertSession(
                    SessionEntity(
                        id = id,
                        date = sessionDate,
                        mode = sessionMode,
                        startMs = startMs,
                        endMs = endMs,
                        distanceMeters = distanceMeters,
                        elapsedSeconds = elapsedSeconds,
                        goalReached = nextGoalReached,
                    )
                )
            }

            // Accumulate for the closed session. Also allow a 0-delta write to
            // flip goalsReached from false -> true at the daily level.
            if (deltaDistance > 0.0 || deltaElapsed > 0L || (nextGoalReached && !prevGoalReached)) {
                dao.accumulateDaily(sessionDate, deltaDistance, deltaElapsed, nextGoalReached)
            }

            // Derived snapshots (MMKV metrics) are written from Room once per close.
            // This keeps Room canonical while allowing fast snapshot reads.
            try {
                val daily = dao.getDailyTotal(sessionDate)
                if (daily != null) {
                    MMKVMetricsStore.writeDailySnapshot(daily)
                    MMKVMetricsStore.recomputeAndWriteRolling(dao, endDate = sessionDate)
                    MMKVMetricsStore.recomputeAndWriteMonthly(dao, date = sessionDate)
                    MMKVMetricsStore.recomputeAndWriteAllTime(dao, endDate = sessionDate)
                    Log.d(
                        TAG,
                        "closeSession recompute complete day=$sessionDate distance=${daily.distanceMeters} elapsed=${daily.elapsedSeconds} goals=${daily.goalsReached}",
                    )
                }
            } catch (_: Exception) {
                // best-effort
            }
        }
        currentSessionId = null
    }

    fun checkpointCurrentSession(distanceMeters: Double, elapsedSeconds: Long, goalReached: Boolean) {
        val id = currentSessionId ?: return
        val today = todayDate()
        scope.launch {
            val existing = dao.getSession(id)
            if (existing != null) {
                dao.upsertSession(
                    existing.copy(
                        date = existing.date,
                        mode = sessionMode,
                        endMs = null,
                        distanceMeters = maxOf(existing.distanceMeters, distanceMeters),
                        elapsedSeconds = maxOf(existing.elapsedSeconds, elapsedSeconds),
                        goalReached = existing.goalReached || goalReached,
                    )
                )
            } else {
                val now = System.currentTimeMillis()
                val startMs = now - (elapsedSeconds.coerceAtLeast(0L) * 1000L)
                dao.upsertSession(
                    SessionEntity(
                        id = id,
                        date = today,
                        mode = sessionMode,
                        startMs = startMs,
                        endMs = null,
                        distanceMeters = distanceMeters,
                        elapsedSeconds = elapsedSeconds,
                        goalReached = goalReached,
                    )
                )
            }
        }
    }

    suspend fun getDailyTotal(date: String): DailyTotalEntity? = dao.getDailyTotal(date)

    suspend fun getLatestOpenSessionForDate(date: String): SessionEntity? =
        dao.getLatestOpenSessionForDate(date)

    suspend fun seedDailyTotalIfMissing(
        date: String,
        distanceMeters: Double,
        elapsedSeconds: Long,
        goalsReached: Boolean,
    ) {
        dao.seedDailyTotalIfMissing(date, distanceMeters, elapsedSeconds, goalsReached)
    }

    private fun todayDate(): String =
        SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
}
