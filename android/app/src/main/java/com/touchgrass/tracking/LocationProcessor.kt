package com.touchgrass.tracking

import android.location.Location
import kotlin.math.max

/**
 * Pure stateless location distance processor.
 *
 * Given a previous and current [Location] plus the current [ActivitySnapshot],
 * returns the distance delta (in metres) that should be accumulated, or 0f if
 * the delta should be rejected.
 *
 * Rejection criteria (applied in order):
 *  1. No previous location  → 0f (first fix, can't compute a delta).
 *  2. IN_VEHICLE activity   → 0f (never accumulate distance in a vehicle).
 *  3. Implausible GPS jump  → 0f (delta >> accuracy × MAX_PLAUSIBLE_MULTIPLIER).
 *  4. Below minimum filter  → 0f (suppresses GPS jitter when stationary).
 *     · Confirmed walk/run/bike: MIN_DELTA_METERS_ACTIVE (3 m)
 *     · Unconfirmed / UNKNOWN:   MIN_DELTA_METERS_FALLBACK (10 m)
 */
class LocationProcessor {

    fun process(
        prev: Location?,
        current: Location,
        activity: ActivitySnapshot
    ): Float {
        if (prev == null) return 0f

        // Never accumulate while in a vehicle regardless of GPS.
        if (activity.type == ActivityType.IN_VEHICLE) return 0f

        val delta = prev.distanceTo(current)

        // Reject GPS glitches: delta must not wildly exceed the accuracy radius.
        val maxPlausible = max(200f, current.accuracy * TrackingConstants.MAX_PLAUSIBLE_MULTIPLIER)
        if (delta >= maxPlausible) return 0f

        // Choose minimum threshold based on activity confidence.
        val activeTypes = setOf(ActivityType.WALKING, ActivityType.RUNNING, ActivityType.ON_BICYCLE)
        val minDelta = if (activity.confirmed && activity.type in activeTypes) {
            TrackingConstants.MIN_DELTA_METERS_ACTIVE
        } else {
            TrackingConstants.MIN_DELTA_METERS_FALLBACK
        }

        return if (delta >= minDelta) delta else 0f
    }
}
