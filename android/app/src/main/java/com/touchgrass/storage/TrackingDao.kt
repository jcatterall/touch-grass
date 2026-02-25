package com.touchgrass.storage

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update

@Dao
interface TrackingDao {

    // ---- Sessions ----

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertSession(session: SessionEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSession(session: SessionEntity)

    @Query("SELECT * FROM sessions WHERE id = :id LIMIT 1")
    suspend fun getSession(id: String): SessionEntity?

    @Query("SELECT * FROM sessions WHERE date = :date ORDER BY startMs DESC")
    suspend fun getSessionsForDate(date: String): List<SessionEntity>

    // ---- Daily totals ----

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertDailyTotal(total: DailyTotalEntity)

    @Query("SELECT * FROM daily_totals WHERE date = :date LIMIT 1")
    suspend fun getDailyTotal(date: String): DailyTotalEntity?

    /**
     * Seeds the daily_totals row with absolute values if it doesn't exist.
     * This must not be implemented via accumulateDaily, otherwise calling it
     * multiple times would double-count.
     */
    @Transaction
    suspend fun seedDailyTotalIfMissing(
        date: String,
        distanceMeters: Double,
        elapsedSeconds: Long,
        goalsReached: Boolean,
    ) {
        val existing = getDailyTotal(date)
        if (existing != null) return
        upsertDailyTotal(
            DailyTotalEntity(
                date = date,
                distanceMeters = distanceMeters,
                elapsedSeconds = elapsedSeconds,
                goalsReached = goalsReached,
                sessionCount = 0,
                lastUpdatedMs = System.currentTimeMillis(),
            )
        )
    }

    @Query("SELECT * FROM daily_totals ORDER BY date DESC LIMIT :limit")
    suspend fun getRecentDailyTotals(limit: Int): List<DailyTotalEntity>

    /**
     * Atomically accumulates [deltaDist] and [deltaElapsed] into today's daily total row,
     * creating it if it doesn't exist yet. Called from TrackingService on each GPS fix
     * and again with the full session values when the session closes.
     */
    @Transaction
    suspend fun accumulateDaily(
        date: String,
        deltaDist: Double,
        deltaElapsed: Long,
        goalReached: Boolean,
    ) {
        val existing = getDailyTotal(date)
        val updated = if (existing != null) {
            existing.copy(
                distanceMeters = existing.distanceMeters + deltaDist,
                elapsedSeconds = existing.elapsedSeconds + deltaElapsed,
                goalsReached = existing.goalsReached || goalReached,
                lastUpdatedMs = System.currentTimeMillis(),
            )
        } else {
            DailyTotalEntity(
                date = date,
                distanceMeters = deltaDist,
                elapsedSeconds = deltaElapsed,
                goalsReached = goalReached,
                sessionCount = 1,
                lastUpdatedMs = System.currentTimeMillis(),
            )
        }
        upsertDailyTotal(updated)
    }
}
