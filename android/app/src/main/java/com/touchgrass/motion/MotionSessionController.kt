package com.touchgrass.motion

import android.os.Handler
import android.os.Looper
import android.util.Log

/**
 * Manages the motion session state machine and enforces transition rules.
 *
 * State transitions:
 *   STILL ──(movement)──▸ MOVING
 *   MOVING ──(brief inactivity)──▸ AUTO_PAUSED
 *   MOVING ──(vehicle detected)──▸ STOPPED
 *   AUTO_PAUSED ──(movement resumes)──▸ MOVING
 *   AUTO_PAUSED ──(stop timeout)──▸ STOPPED
 *   AUTO_PAUSED ──(vehicle detected)──▸ STOPPED
 *
 * Thread-safety: All state mutations are posted to the main looper to
 * serialize access and avoid data races between sensor callbacks,
 * broadcast receivers, and timer runnables.
 */
object MotionSessionController {

    private const val TAG = "MotionSession"

    var config: MotionConfig = MotionConfig()
        @Synchronized set

    @Volatile
    var currentState: MotionState = MotionState.STILL
        private set

    @Volatile
    var currentActivityType: String = "unknown"
        private set

    /** Timestamp when the current movement bout started. */
    @Volatile
    var movementStartTime: Long = 0L
        private set

    /** Timestamp of the last confirmed movement signal. */
    @Volatile
    private var lastMovementTime: Long = 0L

    private val mainHandler = Handler(Looper.getMainLooper())
    private var autoPauseRunnable: Runnable? = null
    private var stopRunnable: Runnable? = null

    // ─────────────────────────────────────────────
    // Public API (called from MotionEngine threads)
    // ─────────────────────────────────────────────

    /**
     * Called when sensors indicate movement above the confidence threshold.
     * Must be safe to call from any thread.
     */
    fun onMovementDetected(confidence: Float, activityType: String) {
        mainHandler.post {
            handleMovement(confidence, activityType)
        }
    }

    /**
     * Called periodically or when Activity Recognition reports STILL.
     * Must be safe to call from any thread.
     */
    fun onInactivityDetected() {
        mainHandler.post {
            handleInactivity()
        }
    }

    /**
     * Called when IN_VEHICLE is detected. Immediately stops the session.
     * Must be safe to call from any thread.
     */
    fun forceStop(reason: String = "vehicle_detected") {
        mainHandler.post {
            handleForceStop(reason)
        }
    }

    /**
     * Resets the controller to initial state (called on manual stop or service teardown).
     */
    fun reset() {
        mainHandler.post {
            cancelTimers()
            currentState = MotionState.STILL
            currentActivityType = "unknown"
            movementStartTime = 0L
            lastMovementTime = 0L
            Log.d(TAG, "Session reset to STILL")
        }
    }

    // ─────────────────────────────────────────────
    // State machine logic (always runs on main)
    // ─────────────────────────────────────────────

    private fun handleMovement(confidence: Float, activityType: String) {
        lastMovementTime = System.currentTimeMillis()
        currentActivityType = activityType

        when (currentState) {
            MotionState.STILL -> {
                if (confidence >= config.movementConfidenceThreshold) {
                    transitionTo(MotionState.MOVING, activityType)
                    movementStartTime = System.currentTimeMillis()
                }
            }

            MotionState.AUTO_PAUSED -> {
                // Resume immediately
                cancelTimers()
                transitionTo(MotionState.MOVING, activityType)
                Log.d(TAG, "Resumed from AUTO_PAUSED → MOVING ($activityType)")
            }

            MotionState.MOVING -> {
                // Refresh auto-pause timer
                cancelAutoPauseTimer()
                scheduleAutoPause(activityType)
            }

            MotionState.STOPPED -> {
                // Must call startMonitoring() again to restart
                Log.d(TAG, "Movement detected in STOPPED state — ignoring")
            }
        }
    }

    private fun handleInactivity() {
        if (currentState == MotionState.MOVING) {
            val elapsed = System.currentTimeMillis() - lastMovementTime
            val delay = getAutoPauseDelay()
            if (elapsed >= delay) {
                transitionTo(MotionState.AUTO_PAUSED, currentActivityType)
                scheduleStopTimer()
            }
        }
    }

    private fun handleForceStop(reason: String) {
        if (currentState == MotionState.STOPPED) return
        cancelTimers()
        Log.i(TAG, "Force stop: $reason")
        transitionTo(MotionState.STOPPED, currentActivityType, reason)
    }

    // ─────────────────────────────────────────────
    // State transitions
    // ─────────────────────────────────────────────

    private fun transitionTo(newState: MotionState, activityType: String, reason: String? = null) {
        val oldState = currentState
        if (oldState == newState) return

        currentState = newState
        Log.i(TAG, "State: $oldState → $newState (type=$activityType, reason=$reason)")

        // Emit events to React Native and signal TrackingService
        when (newState) {
            MotionState.MOVING -> {
                if (oldState == MotionState.AUTO_PAUSED) {
                    MotionEventEmitter.emitResumed(activityType)
                    // Resume after auto-pause — TrackingService keeps GPS session alive
                } else {
                    MotionEventEmitter.emitStarted(activityType)
                    MotionTrackingBridge.onMotionStarted(activityType)
                }
            }
            MotionState.AUTO_PAUSED -> {
                MotionEventEmitter.emitAutoPaused(activityType)
                // Don't stop TrackingService yet — wait for STOPPED transition
            }
            MotionState.STOPPED -> {
                MotionEventEmitter.emitStopped(activityType, reason ?: "inactivity")
                MotionTrackingBridge.onMotionStopped(activityType, reason ?: "inactivity")
            }
            MotionState.STILL -> {
                // No event for initial/reset state
            }
        }

        // Notify MotionEngine to adjust sensor rates
        when (newState) {
            MotionState.AUTO_PAUSED -> MotionEngine.onAutoPaused()
            MotionState.MOVING -> MotionEngine.onResumed()
            MotionState.STOPPED -> MotionEngine.onStopped()
            else -> {}
        }
    }

    // ─────────────────────────────────────────────
    // Timers
    // ─────────────────────────────────────────────

    private fun getAutoPauseDelay(): Long {
        return when (currentActivityType) {
            "cycling" -> config.autoPauseDelayCycling
            else -> config.autoPauseDelayWalkRun
        }
    }

    private fun scheduleAutoPause(activityType: String) {
        cancelAutoPauseTimer()
        val delay = getAutoPauseDelay()
        autoPauseRunnable = Runnable {
            if (currentState == MotionState.MOVING) {
                val elapsed = System.currentTimeMillis() - lastMovementTime
                if (elapsed >= delay) {
                    transitionTo(MotionState.AUTO_PAUSED, activityType)
                    scheduleStopTimer()
                }
            }
        }
        mainHandler.postDelayed(autoPauseRunnable!!, delay)
    }

    private fun scheduleStopTimer() {
        cancelStopTimer()
        stopRunnable = Runnable {
            if (currentState == MotionState.AUTO_PAUSED) {
                handleForceStop("inactivity_timeout")
            }
        }
        mainHandler.postDelayed(stopRunnable!!, config.stopDelay)
    }

    private fun cancelAutoPauseTimer() {
        autoPauseRunnable?.let { mainHandler.removeCallbacks(it) }
        autoPauseRunnable = null
    }

    private fun cancelStopTimer() {
        stopRunnable?.let { mainHandler.removeCallbacks(it) }
        stopRunnable = null
    }

    private fun cancelTimers() {
        cancelAutoPauseTimer()
        cancelStopTimer()
    }
}
