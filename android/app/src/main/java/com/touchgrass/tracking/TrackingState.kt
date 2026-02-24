package com.touchgrass.tracking

/**
 * Legacy tracking state consumed by NotificationHelper and the RN bridge today.
 *
 * Canonical state now lives in [TrackingSessionState]. This model is a projection
 * where [distanceMeters]/[elapsedSeconds] represent *today's totals* (baseline +
 * completed sessions + current session).
 */
data class TrackingState(
    val mode: TrackingMode = TrackingMode.IDLE,
    val gpsMode: GpsMode = GpsMode.OFF,
    val distanceMeters: Double = 0.0,
    val elapsedSeconds: Long = 0,
    val goalReached: Boolean = false,
    val activityType: ActivityType = ActivityType.UNKNOWN,
    val activityConfidence: Int = 0,
    val lastUpdateMs: Long = System.currentTimeMillis()
)
