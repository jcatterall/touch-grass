package com.touchgrass.storage

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Aggregate daily total, updated incrementally as each session writes distance.
 * This is the source of truth for MetricsScreen history and headless task remaining-goal
 * calculation (replaces the AsyncStorage daily_activity array for the native path).
 */
@Entity(tableName = "daily_totals")
data class DailyTotalEntity(
    @PrimaryKey val date: String,       // "YYYY-MM-DD"
    val distanceMeters: Double,
    val elapsedSeconds: Long,
    val goalsReached: Boolean,
    val sessionCount: Int,
    val lastUpdatedMs: Long,
)
