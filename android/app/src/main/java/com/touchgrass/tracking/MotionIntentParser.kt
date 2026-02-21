package com.touchgrass.tracking

import android.content.Intent

/**
 * Parses motion intents delivered by MotionTrackingBridge into [ActivitySnapshot] values.
 *
 * The MotionService encodes activity information as intent extras:
 *   EXTRA_ACTIVITY_TYPE        – Int, maps to [ActivityType] ordinal encoding below.
 *   EXTRA_ACTIVITY_CONFIDENCE  – Int, 0-100.
 *   EXTRA_ACTIVITY_TIMESTAMP   – Long, epoch ms (defaults to now if absent).
 *
 * Integer → ActivityType encoding (matches Google Activity Recognition API types):
 *   0 = IN_VEHICLE
 *   1 = ON_BICYCLE
 *   2 = RUNNING
 *   3 = WALKING
 *   4 = STILL
 *   anything else = UNKNOWN
 */
object MotionIntentParser {

    fun parse(intent: Intent?): ActivitySnapshot? {
        if (intent == null) return null

        // Only parse intents that carry motion data.
        val action = intent.action
        if (action != TrackingConstants.ACTION_MOTION_STARTED &&
            action != TrackingConstants.ACTION_MOTION_STOPPED
        ) return null

        val typeCode   = intent.getIntExtra(TrackingConstants.EXTRA_ACTIVITY_TYPE, -1)
        val confidence = intent.getIntExtra(TrackingConstants.EXTRA_ACTIVITY_CONFIDENCE, 0)
        val ts         = intent.getLongExtra(TrackingConstants.EXTRA_ACTIVITY_TIMESTAMP, System.currentTimeMillis())

        // MOTION_STOPPED without an explicit type → treat as STILL so the controller stops immediately.
        val activityType = if (action == TrackingConstants.ACTION_MOTION_STOPPED && typeCode == -1) {
            ActivityType.STILL
        } else {
            when (typeCode) {
                0 -> ActivityType.IN_VEHICLE
                1 -> ActivityType.ON_BICYCLE
                2 -> ActivityType.RUNNING
                3 -> ActivityType.WALKING
                4 -> ActivityType.STILL
                else -> ActivityType.UNKNOWN
            }
        }

        val confirmed = confidence >= TrackingConstants.ACTIVITY_CONFIDENCE_THRESHOLD

        return ActivitySnapshot(activityType, confidence, ts, confirmed)
    }
}
