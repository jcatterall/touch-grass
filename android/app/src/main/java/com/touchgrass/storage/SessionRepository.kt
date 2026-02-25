package com.touchgrass.storage

import android.content.Context
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

    private val dao = TrackingDatabase.getInstance(context).trackingDao()
    private val scope = CoroutineScope(Dispatchers.IO)

    private var currentSessionId: String? = null
    private var sessionMode: String = "auto"

    fun startSession(mode: String): String {
        val id = UUID.randomUUID().toString()
        val today = todayDate()
        currentSessionId = id
        sessionMode = mode
        scope.launch {
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
                        date = today,
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
                dao.accumulateDaily(today, deltaDistance, deltaElapsed, nextGoalReached)
            }
        }
        currentSessionId = null
    }

    suspend fun getDailyTotal(date: String): DailyTotalEntity? = dao.getDailyTotal(date)

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
