package com.touchgrass.motion

/**
 * Represents the lifecycle states of the deterministic motion tracking session.
 *
 * State machine:
 *   UNKNOWN → IDLE → POTENTIAL_MOVEMENT → MOVING → POTENTIAL_STOP → IDLE
 *
 * Transitions:
 *   UNKNOWN      → IDLE              (first sensor signal received)
 *   IDLE         → POTENTIAL_MOVEMENT (step detected OR activity ENTER OR variance spike)
 *   POTENTIAL_MOVEMENT → MOVING      (movement sustained for MOVEMENT_CONFIRM_WINDOW_MS)
 *   POTENTIAL_MOVEMENT → IDLE        (movement drops off before confirmed)
 *   MOVING       → POTENTIAL_STOP    (no steps + low variance + no recent activity)
 *   POTENTIAL_STOP → MOVING          (movement resumes during grace window)
 *   POTENTIAL_STOP → IDLE            (confirmed stop after STOP_CONFIRM_WINDOW_MS)
 *   Any          → IDLE              (vehicle detected)
 */
enum class MotionState {
    /** App just started; sensors not yet initialized. */
    UNKNOWN,

    /** User is not moving. Low-power passive listening. */
    IDLE,

    /** Movement candidate detected; waiting to confirm it is sustained. */
    POTENTIAL_MOVEMENT,

    /** Active walking, running, or cycling confirmed. Full sensors + GPS active. */
    MOVING,

    /** Stop conditions met; waiting to confirm the stop is not just a brief pause. */
    POTENTIAL_STOP,
}
