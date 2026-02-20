package com.touchgrass.motion

/**
 * Represents the lifecycle states of the motion tracking session.
 *
 * State transitions:
 *   STILL → MOVING → AUTO_PAUSED → MOVING (resumed)
 *                   → STOPPED
 *   AUTO_PAUSED → MOVING (resumed)
 *               → STOPPED (timeout or vehicle detected)
 *   Any state → STOPPED (vehicle detected or manual stop)
 */
enum class MotionState {
    /** User is not moving. Initial state. */
    STILL,

    /** Active walking, running, or cycling detected. */
    MOVING,

    /** Brief inactivity detected (traffic lights, short stops). Session preserved. */
    AUTO_PAUSED,

    /** Session ended due to prolonged inactivity, vehicle entry, or manual stop. */
    STOPPED
}
