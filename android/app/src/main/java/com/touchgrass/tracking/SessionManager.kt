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
    private var startTimeMs = 0L

    /** Begin a new session, resetting all accumulators. */
    fun start() {
        distance = 0.0
        startTimeMs = System.currentTimeMillis()
    }

    /** Add [meters] to the running distance total. */
    fun addDistance(meters: Float) {
        if (meters > 0f) distance += meters
    }

    /** Elapsed seconds since [start] was called. */
    fun elapsedSeconds(): Long =
        if (startTimeMs == 0L) 0L
        else (System.currentTimeMillis() - startTimeMs) / 1000

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
        startTimeMs = 0L
        return result
    }

    fun isActive(): Boolean = startTimeMs > 0L
}
