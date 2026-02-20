package com.touchgrass.motion

/**
 * Configurable thresholds and parameters for the motion tracking engine.
 * All durations are in milliseconds unless noted otherwise.
 *
 * These defaults are production-tuned but can be overridden via
 * MotionModule.configure() from React Native.
 */
data class MotionConfig(
    /** Delay before auto-pausing for walking/running (ms). */
    val autoPauseDelayWalkRun: Long = 5_000L,

    /** Delay before auto-pausing for cycling — longer to allow coasting (ms). */
    val autoPauseDelayCycling: Long = 12_000L,

    /** Delay after auto-pause before fully stopping the session (ms). */
    val stopDelay: Long = 20_000L,

    /** Minimum confidence score (0.0–1.0) to transition from STILL to MOVING. */
    val movementConfidenceThreshold: Float = 0.6f,

    /** Accelerometer variance threshold above which motion is considered significant. */
    val varianceThreshold: Float = 0.3f,

    /** Number of accelerometer samples in the rolling variance window.
     *  At SENSOR_DELAY_GAME (~50Hz): 50 samples ≈ 1 second. */
    val accelWindowSize: Int = 50,

    /** Reduced accelerometer window when auto-paused (battery saving). */
    val accelWindowSizePaused: Int = 20,

    /** Time window within which a step is considered "recent" (ms). */
    val stepRecencyWindow: Long = 2_000L,

    /** Inactivity polling interval (ms). */
    val inactivityCheckInterval: Long = 2_000L,

    /** Notification channel ID for the foreground service. */
    val notificationChannelId: String = "touchgrass_tracking",

    /** Notification channel name displayed in system settings. */
    val notificationChannelName: String = "Motion Tracking",

    /** Foreground service notification title. */
    val notificationTitle: String = "TouchGrass is active",

    /** Foreground service notification body. */
    val notificationBody: String = "Watching for movement…"
)
