package com.touchgrass.tracking

object TrackingConstants {

    const val NOTIFICATION_CHANNEL = "touchgrass_tracking"
    const val NOTIFICATION_CHANNEL_NAME = "TouchGrass"
    const val NOTIFICATION_ID = 1001

    /** Activity Recognition confidence threshold (0-100) to treat a reading as confirmed. */
    const val ACTIVITY_CONFIDENCE_THRESHOLD = 75

    /**
     * Short buffer after motion stops before ending the session (ms).
     * Absorbs brief pauses (traffic lights, doorways) without ending the session.
     */
    const val STATIONARY_BUFFER_MS = 5_000L

    /** Minimum distance delta to accumulate when activity is confirmed walking/running/cycling. */
    const val MIN_DELTA_METERS_ACTIVE = 3f

    /** Minimum distance delta to accumulate when activity is UNKNOWN (GPS plausibility fallback). */
    const val MIN_DELTA_METERS_FALLBACK = 10f

    /** Minimum distance delta to accumulate when the user explicitly started a manual session. */
    const val MIN_DELTA_METERS_MANUAL = 1f

    /**
     * A location delta is considered implausible (GPS glitch) if it exceeds
     * this multiplier times the reported accuracy radius, capped at 200m.
     */
    const val MAX_PLAUSIBLE_MULTIPLIER = 10f

    /** Throttle notification updates so we don't spam the NotificationManager. */
    const val NOTIFICATION_THROTTLE_MS = 15_000L

    /**
     * Minimum GPS speed (m/s) required before a distance delta is accumulated.
     * Rejects stationary GPS noise: real walking is ~1.2–1.8 m/s; 0.5 m/s is a
     * conservative floor that still captures slow movement.
     * Only applied when the location fix includes speed metadata (hasSpeed() == true).
     */
    const val MIN_ACCUMULATE_SPEED_MS = 0.5f

    // Lifecycle actions driven by JS / user
    const val ACTION_START_IDLE      = "com.touchgrass.action.START_IDLE"
    const val ACTION_STOP_BACKGROUND = "com.touchgrass.action.STOP_BACKGROUND"

    // Goal extras for manual tracking start
    const val EXTRA_GOAL_TYPE  = "goal_type"
    const val EXTRA_GOAL_VALUE = "goal_value"
    const val EXTRA_GOAL_UNIT  = "goal_unit"

    // AppBlocker coordination
    const val ACTION_BLOCKER_STARTED = "com.touchgrass.action.BLOCKER_STARTED"
    const val ACTION_BLOCKER_STOPPED = "com.touchgrass.action.BLOCKER_STOPPED"
    // Notification / goals update — JS/native notify to refresh persistent notification
    const val ACTION_GOALS_UPDATED = "com.touchgrass.action.GOALS_UPDATED"
}
