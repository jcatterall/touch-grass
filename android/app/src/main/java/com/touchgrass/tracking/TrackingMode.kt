package com.touchgrass.tracking

/**
 * High-level tracking state visible to the rest of the system.
 *
 * IDLE            – service is alive, GPS is off, waiting for motion.
 * TRACKING_AUTO   – motion detected; GPS running, distance accumulating.
 * TRACKING_MANUAL – user started a manual session from the UI.
 * PAUSED_VEHICLE  – IN_VEHICLE activity detected; GPS low-power, no distance.
 */
enum class TrackingMode {
    IDLE,
    TRACKING_AUTO,
    TRACKING_MANUAL,
    PAUSED_VEHICLE
}
