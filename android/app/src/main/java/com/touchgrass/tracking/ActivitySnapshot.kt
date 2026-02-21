package com.touchgrass.tracking

/**
 * Activity types that MotionService can report.
 *
 * Maps 1:1 to Google Activity Recognition API types for clarity.
 * Integer codes used in intents:
 *   0 = IN_VEHICLE, 1 = ON_BICYCLE, 2 = RUNNING, 3 = WALKING, 4 = STILL
 */
enum class ActivityType {
    WALKING,
    RUNNING,
    ON_BICYCLE,
    IN_VEHICLE,
    STILL,
    UNKNOWN
}

/**
 * Snapshot of the current detected activity, as received from MotionService.
 *
 * @param type        The activity type.
 * @param confidence  Raw confidence in the 0-100 range.
 * @param timestampMs When the activity was detected (epoch ms).
 * @param confirmed   True when confidence >= ACTIVITY_CONFIDENCE_THRESHOLD.
 */
data class ActivitySnapshot(
    val type: ActivityType,
    val confidence: Int,
    val timestampMs: Long,
    val confirmed: Boolean
)
