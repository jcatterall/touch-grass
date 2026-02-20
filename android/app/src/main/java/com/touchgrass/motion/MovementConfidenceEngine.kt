package com.touchgrass.motion

import kotlin.math.min

/**
 * Calculates a composite confidence score from multiple sensor signals.
 *
 * Signal weights (per specification):
 *   Activity Recognition:       0.50
 *   Step / Cadence Detection:   0.30
 *   Accelerometer Variance:     0.20
 *   Sustained Duration:         0.20
 *   ────────────────────────────────
 *   Maximum (capped):           1.00
 *
 * The engine prevents false positives by requiring corroborating evidence
 * from multiple independent sources before declaring motion.
 */
object MovementConfidenceEngine {

    /** Weight for the Activity Recognition API signal. */
    private const val WEIGHT_ACTIVITY = 0.50f

    /** Weight for the step detector / cadence signal. */
    private const val WEIGHT_STEP = 0.30f

    /** Weight for accelerometer variance. */
    private const val WEIGHT_VARIANCE = 0.20f

    /** Weight for sustained duration / consistency. */
    private const val WEIGHT_DURATION = 0.20f

    /** Maximum duration bonus (ms). Beyond this, duration contributes full weight. */
    private const val MAX_DURATION_MS = 10_000L

    /** Variance level considered "definitely moving". */
    private const val VARIANCE_SATURATION = 2.0f

    /**
     * Calculates a combined confidence score from all available signals.
     *
     * @param activityRecognitionActive Whether Activity Recognition reported
     *        an active movement type (WALKING, RUNNING, ON_BICYCLE).
     * @param stepDetectedRecently Whether a step was detected within the
     *        recency window (default 2 seconds).
     * @param accelerometerVariance Current rolling variance of accelerometer magnitude.
     * @param varianceThreshold The variance level considered significant (from config).
     * @param sustainedDurationMs How long the current movement bout has lasted.
     *
     * @return Confidence score in the range [0.0, 1.0].
     */
    fun calculate(
        activityRecognitionActive: Boolean,
        stepDetectedRecently: Boolean,
        accelerometerVariance: Float,
        varianceThreshold: Float,
        sustainedDurationMs: Long
    ): Float {
        // 1) Activity Recognition signal
        val activityScore = if (activityRecognitionActive) WEIGHT_ACTIVITY else 0f

        // 2) Step / cadence signal
        val stepScore = if (stepDetectedRecently) WEIGHT_STEP else 0f

        // 3) Accelerometer variance — linearly scaled to saturation point
        val normalizedVariance = min(accelerometerVariance / VARIANCE_SATURATION, 1.0f)
        val varianceScore = if (accelerometerVariance >= varianceThreshold) {
            normalizedVariance * WEIGHT_VARIANCE
        } else {
            0f
        }

        // 4) Sustained duration — linearly ramp from 0 to full weight over MAX_DURATION_MS
        val durationRatio = min(sustainedDurationMs.toFloat() / MAX_DURATION_MS.toFloat(), 1.0f)
        val durationScore = durationRatio * WEIGHT_DURATION

        // Combine and cap at 1.0
        val raw = activityScore + stepScore + varianceScore + durationScore
        return min(raw, 1.0f)
    }
}
