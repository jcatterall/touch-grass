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
        * Plan: 3–6 seconds. Increase slightly to avoid short shakes triggering movement.
     */
        val movementConfirmWindowMs: Long = 6_000L,

    /**
     * Minimum confidence score (0.0–1.0) required to confirm POTENTIAL_MOVEMENT → MOVING.
     * Step alone scores 0.30; step + variance ~0.35–0.40; with Activity Recognition ~0.80+.
        * Raised slightly from 0.30 to make brief shakes less likely to confirm.
     * while the movementConfirmWindowMs provides the false-positive protection.
     */
        val movementConfidenceThreshold: Float = 0.35f,

    // ── Stop detection ──────────────────────────────────────────────────────

    /**
     * Duration of step absence required before beginning POTENTIAL_STOP evaluation.
     * Ignores short pauses (traffic lights, tying shoes).
     * Reduced from 10s → 7s for faster stop detection.
     */
    val stepStopTimeoutMs: Long = 7_000L,

    /**
     * Accelerometer variance below which the device is considered stationary.
     * Plan: < 0.12.
     */
    val varianceStopThreshold: Float = 0.12f,

    /**
     * Duration POTENTIAL_STOP must be held before stop is confirmed → IDLE.
     * Debounces micro-pauses at traffic lights and short bench sits.
     * Reduced from 10s → 9s for slightly tighter confirmation.
     */
    val stopConfirmWindowMs: Long = 9_000L,

    /**
     * Grace period after the last movement signal during which an activity EXIT
     * transition is allowed to arrive before stop conditions are evaluated.
     * Reduced from 5s → 3.5s for faster stop response.
     */
    val transitionGraceMs: Long = 3_500L,

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
        * for START detection. Raised slightly to make short high-frequency shakes
        * less likely to pass the start guard. Real walking variance is 0.25+.
     */
        val varianceStartThreshold: Float = 0.22f,

    /** Rolling variance window size during MOVING state (~1 second at SENSOR_DELAY_GAME). */
    val accelWindowSize: Int = 50,

    /** Reduced variance window when IDLE or POTENTIAL_STOP (battery saving). */
    val accelWindowSizeIdle: Int = 20,

    /** Time window within which a step is considered "recent" for confidence scoring (ms). */
    val stepRecencyWindowMs: Long = 2_000L,

    /** Inactivity polling interval on the sensor thread (ms). */
    val inactivityCheckIntervalMs: Long = 2_000L,

    // ── Multi-signal corroboration ──────────────────────────────────────────

    /**
     * Minimum number of distinct signal types that must fire within [corroborationWindowMs]
     * before IDLE → POTENTIAL_MOVEMENT is allowed.
     * Signal types: step, accelerometer variance spike, Activity Recognition ENTER.
     */
    val corroborationMinSignals: Int = 2,

    /**
     * Time window (ms) within which [corroborationMinSignals] distinct signal types
     * must have fired to trigger IDLE → POTENTIAL_MOVEMENT.
     */
    val corroborationWindowMs: Long = 3_000L,

    // ── Cadence validation ──────────────────────────────────────────────────

    /**
     * Minimum cadence (steps/sec) required before POTENTIAL_MOVEMENT → MOVING is confirmed.
     * 0.8 steps/sec ≈ 4 steps in 5 seconds. Prevents phantom steps or desk bumps from confirming.
     */
    val cadenceConfirmMinStepsSec: Float = 0.8f,

    /**
     * Rolling window (ms) used to compute cadence from the step ring buffer.
     */
    val cadenceMeasureWindowMs: Long = 5_000L,

    // ── Stationary surface lock ─────────────────────────────────────────────

    /**
     * Accelerometer variance below which the surface is considered ultra-stable.
     * Must be sustained for [stationaryLockDurationMs] with zero cadence to engage lock.
     */
    val stationaryLockVariance: Float = 0.08f,

    /**
     * Duration (ms) of ultra-low variance + zero cadence required to engage stationary lock.
     * Once engaged, movement candidates are rejected until variance spikes above [stationaryUnlockVariance].
     */
    // Shorten the stationary lock so users can re-trigger more quickly after brief stops.
    val stationaryLockDurationMs: Long = 10_000L,

    /**
     * Variance must exceed this to release the stationary lock.
     * Slightly reduced to make it easier to exit a locked state on real movement.
     */
    val stationaryUnlockVariance: Float = 0.25f,

    // ── Cadence drop detection ──────────────────────────────────────────────

    /**
     * Cadence (steps/sec) below which cadence is considered "dropped".
     * If sustained for [cadenceDropDurationMs], triggers early POTENTIAL_STOP evaluation.
     */
    val cadenceDropThreshold: Float = 0.3f,

    /**
     * Duration (ms) cadence must stay below [cadenceDropThreshold] before
     * cadence drop triggers POTENTIAL_STOP evaluation (alternative to step timeout).
     */
    val cadenceDropDurationMs: Long = 5_000L,

    // ── Micro-movement guard ────────────────────────────────────────────────

    /**
     * During POTENTIAL_STOP, if variance exceeds this threshold, the device is
     * still moving and the state returns to MOVING (prevents stopping at traffic lights
     * or other brief pauses with residual motion).
     */
    val microMovementVarianceGuard: Float = 0.20f,

    // ── Failsafe stop ───────────────────────────────────────────────────────

    /**
     * Maximum duration (ms) the session can remain MOVING or POTENTIAL_STOP with
     * zero step activity. If no step is detected for this long, a failsafe stop is
     * triggered regardless of Activity Recognition state.
     *
     * This catches the case where AR is stuck reporting WALKING but sensors show
     * the device is fully stationary (elevator, escalator, urban queue).
     *
     * Must be longer than [stepStopTimeoutMs] + [stopConfirmWindowMs] combined so
     * normal stop detection fires first. 45s is a safe ceiling.
     */
    val maxNoStepMovementMs: Long = 45_000L,

    // ── Notification ────────────────────────────────────────────────────────

    val notificationChannelId: String = "touchgrass_tracking",
    val notificationChannelName: String = "Motion Tracking",
    val notificationTitle: String = "TouchGrass is active",
    val notificationBody: String = "Watching for movement…",
)
