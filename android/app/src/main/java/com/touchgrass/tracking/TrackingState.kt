package com.touchgrass.tracking

/**
 * Single source of truth for the tracking system's observable state.
 *
 * Exposed as a [kotlinx.coroutines.flow.StateFlow] from [TrackingService].
 * TrackingController produces new copies on every meaningful transition.
 * The React Native bridge (future work) will subscribe and push events to JS.
 *
 * @param mode               Current lifecycle mode (IDLE / TRACKING_AUTO / etc.).
 * @param gpsMode            Active GPS priority level.
 * @param distanceMeters     Accumulated distance for the current session.
 * @param elapsedSeconds     Elapsed seconds since the session started.
 * @param goalReached        Whether the user's goal has been satisfied.
 * @param activityType       Most recently detected activity type.
 * @param activityConfidence Raw confidence value (0-100) for the activity type.
 * @param lastUpdateMs       System time of the last state mutation (for staleness checks).
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
