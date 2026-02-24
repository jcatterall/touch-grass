package com.touchgrass.tracking

/**
 * Canonical tracking state model separating session-scoped vs daily-scoped totals.
 *
 * - session* values reset on each new session.
 * - today* values represent the running daily totals (baseline + completed sessions + current session).
 */
data class TrackingSessionState(
    val mode: TrackingMode = TrackingMode.IDLE,
    val gpsMode: GpsMode = GpsMode.OFF,

    // Session-scoped
    val sessionDistanceMeters: Double = 0.0,
    val sessionElapsedSeconds: Long = 0L,

    // Daily-scoped (baseline + completed sessions + current session)
    val todayDistanceMeters: Double = 0.0,
    val todayElapsedSeconds: Long = 0L,

    val goalReached: Boolean = false,
    val activityType: ActivityType = ActivityType.UNKNOWN,
    val activityConfidence: Int = 0,
    val lastUpdateMs: Long = System.currentTimeMillis()
)

fun TrackingSessionState.toLegacyTrackingState(): TrackingState = TrackingState(
    mode = mode,
    gpsMode = gpsMode,
    distanceMeters = todayDistanceMeters,
    elapsedSeconds = todayElapsedSeconds,
    goalReached = goalReached,
    activityType = activityType,
    activityConfidence = activityConfidence,
    lastUpdateMs = lastUpdateMs
)
