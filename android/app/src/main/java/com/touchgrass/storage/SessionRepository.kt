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
            dao.upsertSession(
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
            if (existing != null) {
                dao.upsertSession(
                    existing.copy(
                        endMs = System.currentTimeMillis(),
                        distanceMeters = distanceMeters,
                        elapsedSeconds = elapsedSeconds,
                        goalReached = goalReached,
                    )
                )
            }
            // Final accumulation for the closed session
            dao.accumulateDaily(today, distanceMeters, elapsedSeconds, goalReached)
        }
        currentSessionId = null
    }

    suspend fun getDailyTotal(date: String): DailyTotalEntity? = dao.getDailyTotal(date)

    private fun todayDate(): String =
        SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
}
