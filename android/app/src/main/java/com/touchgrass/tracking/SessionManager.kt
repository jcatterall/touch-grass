package com.touchgrass.tracking

/**
 * In-memory session accumulator.
 *
 * Tracks the distance and elapsed time for a single active session.
 * Designed as a thin persistence hook — swap the finish() implementation
 * to write to Room / MMKV without touching any other class.
 *
 * All mutations are expected to happen on the same thread (main looper via
 * TrackingController) so no synchronisation is needed here.
 */
class SessionManager {

    private var distance = 0.0
    private var elapsedMs = 0L
    private var lastTickMs = 0L

    /** Begin a new session, resetting all accumulators. */
    fun start() {
        distance = 0.0
        elapsedMs = 0L
        lastTickMs = System.currentTimeMillis()
    }

    /** Add [meters] to the running distance total. */
    fun addDistance(meters: Float) {
        if (meters > 0f) distance += meters
    }

    /**
     * Advance elapsed time. If [eligible] is false, time does not accumulate.
     *
     * Caller controls the tick frequency (typically 1s and/or on GPS fixes).
     */
    fun tick(eligible: Boolean) {
        if (lastTickMs == 0L) {
            lastTickMs = System.currentTimeMillis()
            return
        }
        val now = System.currentTimeMillis()
        val delta = now - lastTickMs
        lastTickMs = now
        if (eligible && delta > 0) {
            elapsedMs += delta
        }
    }

    /** Elapsed whole seconds accumulated via [tick]. */
    fun elapsedSeconds(): Long = elapsedMs / 1000

    /** Snapshot of the accumulated distance without ending the session. */
    fun currentDistance(): Double = distance

    /**
     * Finalise the session and return (distanceMeters, elapsedSeconds).
     *
     * Extension point: future implementations should persist the result to Room or
     * MMKV here before returning. The returned pair can be used by the caller to
     * emit a "session ended" event to the React Native layer.
     */
    fun finish(): Pair<Double, Long> {
        val result = distance to elapsedSeconds()
        distance = 0.0
        elapsedMs = 0L
        lastTickMs = 0L
        return result
    }

    fun isActive(): Boolean = lastTickMs > 0L
}
