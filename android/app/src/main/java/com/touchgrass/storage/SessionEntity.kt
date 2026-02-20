package com.touchgrass.storage

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * One tracking session (auto or manual). Written by TrackingService on session start and
 * closed on session end. A day can contain multiple sessions (e.g., morning and afternoon walk).
 */
@Entity(tableName = "sessions")
data class SessionEntity(
    @PrimaryKey val id: String,         // UUID generated at session start
    val date: String,                   // "YYYY-MM-DD"
    val mode: String,                   // "auto" | "manual"
    val startMs: Long,
    val endMs: Long?,                   // null while session is active
    val distanceMeters: Double,
    val elapsedSeconds: Long,
    val goalReached: Boolean,
)
