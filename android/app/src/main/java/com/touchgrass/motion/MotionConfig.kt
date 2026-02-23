package com.touchgrass.motion

/**
 * Configurable thresholds and timing constants for the deterministic motion detection system.
 * All durations are in milliseconds unless noted.
 *
 * These defaults match the plan specification and are production-tuned for urban walking.
 * Can be overridden from React Native via MotionModule.configure().
 */
data class MotionConfig(

    // ── Movement start detection ────────────────────────────────────────────

    /**
     * Duration movement must be continuously detected before POTENTIAL_MOVEMENT → MOVING.
     * Prevents false starts from a phone bump, brief shift, or casual arm movement.
     * Plan: 3–5 seconds.
     */
    val movementConfirmWindowMs: Long = 4_000L,

    /**
     * Minimum confidence score (0.0–1.0) required to confirm POTENTIAL_MOVEMENT → MOVING.
     * Step alone scores 0.30; step + variance ~0.35–0.40; with Activity Recognition ~0.80+.
     * Threshold of 0.30 means any step event can confirm after the window elapses,
     * while the movementConfirmWindowMs provides the false-positive protection.
     */
    val movementConfidenceThreshold: Float = 0.30f,

    // ── Stop detection ──────────────────────────────────────────────────────

    /**
     * Duration of step absence required before beginning POTENTIAL_STOP evaluation.
     * Ignores short pauses (traffic lights, tying shoes).
     * Plan: ~10 seconds.
     */
    val stepStopTimeoutMs: Long = 10_000L,

    /**
     * Accelerometer variance below which the device is considered stationary.
     * Plan: < 0.12.
     */
    val varianceStopThreshold: Float = 0.12f,

    /**
     * Duration POTENTIAL_STOP must be held before stop is confirmed → IDLE.
     * Debounces micro-pauses at traffic lights and short bench sits.
     * Plan: 8–15 seconds.
     */
    val stopConfirmWindowMs: Long = 10_000L,

    /**
     * Grace period after the last movement signal during which an activity EXIT
     * transition is allowed to arrive before stop conditions are evaluated.
     * Plan: 5 seconds.
     */
    val transitionGraceMs: Long = 5_000L,

    // ── Cycling overrides ───────────────────────────────────────────────────

    /**
     * Extended step absence timeout for cycling (coasting = no pedal steps).
     */
    val stepStopTimeoutCyclingMs: Long = 20_000L,

    // ── Vehicle detection ───────────────────────────────────────────────────
    // IN_VEHICLE ENTER triggers an immediate forced stop regardless of other conditions.

    // ── Sensor configuration ────────────────────────────────────────────────

    /**
     * Accelerometer variance threshold above which motion is considered significant
     * for START detection (higher than stop threshold to require real locomotion).
     */
    val varianceStartThreshold: Float = 0.30f,

    /** Rolling variance window size during MOVING state (~1 second at SENSOR_DELAY_GAME). */
    val accelWindowSize: Int = 50,

    /** Reduced variance window when IDLE or POTENTIAL_STOP (battery saving). */
    val accelWindowSizeIdle: Int = 20,

    /** Time window within which a step is considered "recent" for confidence scoring (ms). */
    val stepRecencyWindowMs: Long = 2_000L,

    /** Inactivity polling interval on the sensor thread (ms). */
    val inactivityCheckIntervalMs: Long = 2_000L,

    // ── Notification ────────────────────────────────────────────────────────

    val notificationChannelId: String = "touchgrass_tracking",
    val notificationChannelName: String = "Motion Tracking",
    val notificationTitle: String = "TouchGrass is active",
    val notificationBody: String = "Watching for movement…",
)
