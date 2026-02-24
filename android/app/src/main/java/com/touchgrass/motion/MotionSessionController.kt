package com.touchgrass.motion

import android.os.Handler
import android.os.Looper
import android.util.Log

/**
 * Central state machine and single source of truth for motion detection.
 *
 * State machine:
 *   UNKNOWN → IDLE → POTENTIAL_MOVEMENT → MOVING → POTENTIAL_STOP → IDLE
 *
 * Movement start (IDLE → POTENTIAL_MOVEMENT → MOVING):
 *   - Triggered by: step detected, activity ENTER, accelerometer variance spike
 *   - Confirmed after movement sustained for [MotionConfig.movementConfirmWindowMs] (3–5s)
 *
 * Stop detection (MOVING → POTENTIAL_STOP → IDLE) — ALL must be true:
 *   1. No steps for [MotionConfig.stepStopTimeoutMs] (~10s)
 *   2. Accelerometer variance < [MotionConfig.varianceStopThreshold] (0.12)
 *   3. Last movement signal older than [MotionConfig.transitionGraceMs] (5s)
 *   4. Stop confirmed after [MotionConfig.stopConfirmWindowMs] (8–15s)
 *
 * Vehicle override:
 *   - IN_VEHICLE ENTER → immediately transition to IDLE from any state
 *
 * Thread-safety: all state mutations are posted to the main looper.
 */
object MotionSessionController {

    private const val TAG = "MotionSession"

    // ── Configuration ────────────────────────────────────────────────────────

    var config: MotionConfig = MotionConfig()
        @Synchronized set

    // ── State ────────────────────────────────────────────────────────────────

    @Volatile
    var currentState: MotionState = MotionState.UNKNOWN
        private set

    @Volatile
    var currentActivityType: String = "unknown"
        private set

    /**
     * Last real activity type received from Activity Recognition or sensors.
     * Unlike [currentActivityType], this is NOT reset to "unknown" when transitioning
     * to IDLE. It is used internally so that re-trigger logic (e.g. step detected while
     * AR is still in WALKING) works correctly even after a stop.
     */
    @Volatile
    var lastKnownRealActivityType: String = "unknown"
        private set

    /** Timestamp when the MOVING state began (used for distance context). */
    @Volatile
    var movementStartTime: Long = 0L
        private set

    /** Timestamp of the last movement signal (step, high variance, or activity ENTER). */
    @Volatile
    var lastMovementSignalTime: Long = 0L
        private set

    /**
     * Timestamp when the first movement candidate was observed in IDLE state.
     * Reset to 0 when movement drops off before being confirmed.
     */
    @Volatile
    private var potentialMovementStartTime: Long = 0L

    /**
     * Timestamp when POTENTIAL_STOP was entered.
     * 0 when not in POTENTIAL_STOP state.
     */
    @Volatile
    private var potentialStopStartTime: Long = 0L

    private val mainHandler = Handler(Looper.getMainLooper())
    private var stopEvalRunnable: Runnable? = null

    private val eligibleArTypes = setOf("walking", "running", "cycling")

    /**
     * Tracks whether we've already signalled a tracking start for the current MOVING period.
     * Reset when transitioning to IDLE or when a new MOVING period begins from IDLE/POTENTIAL_MOVEMENT.
     */
    @Volatile
    private var trackingStartSignalled: Boolean = false

    /**
     * Destination for motion start/stop signals.
     * Default is a no-op; TrackingService installs an in-process sink when running.
     */
    @Volatile
    var trackingSink: MotionTrackingSink = object : MotionTrackingSink {
        override fun onMotionStarted(activityType: String) {}
        override fun onMotionStopped(activityType: String, reason: String) {}
        override fun onArActivityChanged(activityType: String, isActive: Boolean) {}
    }

    // ── Activity Recognition latch (Option B: latched until EXIT) ───────────

    @Volatile
    var arActiveType: String = "unknown"
        private set

    @Volatile
    var arIsActive: Boolean = false
        private set

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Called when sensors detect movement above confidence threshold.
     * Safe to call from any thread.
     */
    fun onMovementDetected(confidence: Float, activityType: String) {
        mainHandler.post { handleMovement(confidence, activityType) }
    }

    /**
     * Called when an Activity Recognition EXIT transition fires for walking/running/cycling.
     * Treated as a movement ended signal — feeds into stop condition evaluation.
     * Safe to call from any thread.
     */
    fun onMovementEnded(reason: String) {
        mainHandler.post { handleMovementEnded(reason) }
    }

    /**
     * Called by MotionEngine on Activity Recognition ENTER/EXIT.
     * Latches the AR activity type until an EXIT clears it.
     */
    fun onArTransition(activityType: String, isEntering: Boolean) {
        mainHandler.post {
            if (isEntering) {
                arActiveType = activityType
                arIsActive = true
            } else {
                if (arActiveType == activityType) {
                    arActiveType = "unknown"
                    arIsActive = false
                }
            }
            trackingSink.onArActivityChanged(activityType, isEntering)

            // If we are already MOVING and AR just became active with an eligible type,
            // signal a delayed start (this covers AR arriving after sensor-based MOVING).
            if (currentState == MotionState.MOVING && isEntering) {
                maybeSignalTrackingStart()
            }
        }
    }

    /**
     * Called periodically by MotionEngine to evaluate stop conditions.
     * Safe to call from any thread.
     */
    fun onInactivityCheck() {
        mainHandler.post {
            // Cancel a stale POTENTIAL_MOVEMENT candidate if no movement signal arrived
            // within the confirmation window (prevents permanent stuck-in-candidate state)
            if (currentState == MotionState.POTENTIAL_MOVEMENT && potentialMovementStartTime > 0L) {
                val candidateAge = System.currentTimeMillis() - potentialMovementStartTime
                // Allow 2× the window before cancelling — gives Activity Recognition time to fire
                if (candidateAge > config.movementConfirmWindowMs * 2) {
                    Log.d(TAG, "POTENTIAL_MOVEMENT candidate expired (${candidateAge}ms) — returning to IDLE")
                    potentialMovementStartTime = 0L
                    transitionTo(MotionState.IDLE, currentActivityType)
                }
            }
            evaluatePotentialStop()
        }
    }

    /**
     * Immediately transitions to IDLE (vehicle detected or manual stop).
     * Safe to call from any thread.
     */
    fun forceStop(reason: String = "vehicle_detected") {
        mainHandler.post { handleForceStop(reason) }
    }

    /**
     * Resets to IDLE state. Called on service teardown or manual restart.
     */
    fun reset() {
        mainHandler.post {
            cancelStopEval()
            currentState = MotionState.IDLE
            currentActivityType = "unknown"
            // Preserve lastKnownRealActivityType across a reset so that
            // temporarily toggling motion monitoring off/on doesn't lose the
            // most-recent real activity reported by AR. Clearing this value can
            // prevent re-trigger when AR is still in an ENTER state.
            // lastKnownRealActivityType = "unknown"
            movementStartTime = 0L
            lastMovementSignalTime = 0L
            potentialMovementStartTime = 0L
            potentialStopStartTime = 0L
            trackingStartSignalled = false
            Log.d(TAG, "Session reset to IDLE")
        }
    }

    // ── State machine logic (always on main looper) ───────────────────────────

    private fun handleMovement(confidence: Float, activityType: String) {
        lastMovementSignalTime = System.currentTimeMillis()

        // Resolve UNKNOWN to IDLE on first signal (before main state machine)
        if (currentState == MotionState.UNKNOWN) {
            currentState = MotionState.IDLE
            Log.d(TAG, "UNKNOWN → IDLE (first sensor signal)")
        }

        when (currentState) {
            MotionState.UNKNOWN -> { /* resolved above */ }

            MotionState.IDLE -> {
                // Movement candidate requires ≥2 distinct signal types within 3s (corroboration).
                // This prevents desk vibration, typing, or single phantom steps from triggering.
                val now = System.currentTimeMillis()
                if (potentialMovementStartTime == 0L) {
                    if (!MotionEngine.hasCorroboration()) {
                        Log.d(TAG, "Movement candidate rejected — insufficient corroboration (need ${config.corroborationMinSignals} signals within ${config.corroborationWindowMs}ms)")
                        return
                    }
                    potentialMovementStartTime = now
                    currentActivityType = activityType
                    lastKnownRealActivityType = activityType
                    transitionTo(MotionState.POTENTIAL_MOVEMENT, activityType)
                    Log.d(TAG, "Movement candidate with corroboration (confidence=$confidence) — waiting ${config.movementConfirmWindowMs}ms to confirm")
                } else {
                    val sustainedMs = now - potentialMovementStartTime
                    currentActivityType = activityType
                    lastKnownRealActivityType = activityType
                    if (sustainedMs >= config.movementConfirmWindowMs && confidence >= config.movementConfidenceThreshold) {
                        if (!MotionEngine.isCadenceSufficientForStart()) {
                            Log.d(TAG, "Sustained ${sustainedMs}ms, confidence OK, but cadence=${MotionEngine.getCadence()} < ${config.cadenceConfirmMinStepsSec} — waiting for cadence")
                            return
                        }
                        potentialMovementStartTime = 0L
                        movementStartTime = now
                        transitionTo(MotionState.MOVING, activityType)
                    } else if (sustainedMs >= config.movementConfirmWindowMs) {
                        // Sustained long enough but confidence still low — keep waiting
                        Log.d(TAG, "Sustained ${sustainedMs}ms but confidence=$confidence < ${config.movementConfidenceThreshold}, waiting")
                    }
                }
            }

            MotionState.POTENTIAL_MOVEMENT -> {
                val now = System.currentTimeMillis()
                currentActivityType = activityType
                lastKnownRealActivityType = activityType
                if (potentialMovementStartTime > 0L) {
                    val sustainedMs = now - potentialMovementStartTime
                    if (sustainedMs >= config.movementConfirmWindowMs) {
                        if (!MotionEngine.isCadenceSufficientForStart()) {
                            Log.d(TAG, "Confirm window elapsed but cadence=${MotionEngine.getCadence()} < ${config.cadenceConfirmMinStepsSec} — still waiting")
                            return
                        }
                        potentialMovementStartTime = 0L
                        movementStartTime = now
                        transitionTo(MotionState.MOVING, activityType)
                    }
                } else {
                    // Shouldn't happen, but handle gracefully
                    potentialMovementStartTime = now
                }
            }

            MotionState.MOVING -> {
                // Refresh movement signal — cancels any pending stop confirmation
                currentActivityType = activityType
                lastKnownRealActivityType = activityType

                // If we entered MOVING before AR became active, allow a delayed start once
                // AR is eligible (but only once per MOVING period).
                maybeSignalTrackingStart()

                if (potentialStopStartTime != 0L) {
                    Log.d(TAG, "Movement resumed — cancelling POTENTIAL_STOP")
                    potentialStopStartTime = 0L
                    cancelStopEval()
                    transitionTo(MotionState.MOVING, activityType)
                }
            }

            MotionState.POTENTIAL_STOP -> {
                // Movement resumed — cancel stop confirmation and return to MOVING
                Log.d(TAG, "Movement detected in POTENTIAL_STOP — returning to MOVING")
                potentialStopStartTime = 0L
                cancelStopEval()
                currentActivityType = activityType
                lastKnownRealActivityType = activityType
                transitionTo(MotionState.MOVING, activityType)
            }
        }
    }

    private fun handleMovementEnded(reason: String) {
        Log.d(TAG, "Movement ended signal: $reason")
        // Treat as a nudge toward stop evaluation — evaluatePotentialStop() will
        // check all conditions deterministically.
        evaluatePotentialStop()
    }

    private fun evaluatePotentialStop() {
        if (currentState != MotionState.MOVING && currentState != MotionState.POTENTIAL_STOP) return

        val now = System.currentTimeMillis()
        val stepsHaveStopped = MotionEngine.hasStepsStopped()
        val deviceIsStable = MotionEngine.isDeviceStable()
        val gracePeriodElapsed = (now - lastMovementSignalTime) >= config.transitionGraceMs
        val cadenceDropped = MotionEngine.hasCadenceDropped()
        val activityStillWalking = currentActivityType == "walking" || currentActivityType == "running"

        Log.d(TAG, "StopEval: stepsStopped=$stepsHaveStopped stable=$deviceIsStable " +
                "graceElapsed=$gracePeriodElapsed cadenceDrop=$cadenceDropped " +
                "activity=$currentActivityType state=$currentState")

        // ── Failsafe: no steps for maxNoStepMovementMs regardless of AR state ──────────
        // Catches AR stuck in WALKING when device is physically stationary.
        val silenceTimeoutExceeded =
            (now - MotionEngine.getLastStepTime()) > config.maxNoStepMovementMs &&
            MotionEngine.getLastStepTime() > 0L  // guard: 0 means engine just started
        if (silenceTimeoutExceeded) {
            Log.w(TAG, "Failsafe stop: no steps for ${now - MotionEngine.getLastStepTime()}ms " +
                    "(limit ${config.maxNoStepMovementMs}ms), activity=$currentActivityType")
            confirmStop()
            return
        }

        // ── Sensor stop override: sensors confirm still, ignore AR walking/running ──────
        // Sensors are ground truth for STOP. AR is not reliable for stop detection.
        val sensorsIndicateStop = stepsHaveStopped && deviceIsStable && gracePeriodElapsed
        val overrideActivityRecognition = sensorsIndicateStop &&
                activityStillWalking &&
                potentialStopStartTime > 0L &&
                (now - potentialStopStartTime) >= config.stopConfirmWindowMs
        if (overrideActivityRecognition) {
            Log.i(TAG, "Sensor stop override: forcing stop despite AR=$currentActivityType " +
                    "(confirmed ${now - potentialStopStartTime}ms)")
            confirmStop()
            return
        }

        if (currentState == MotionState.MOVING) {
            val primaryStop = stepsHaveStopped && deviceIsStable && gracePeriodElapsed
            val cadenceDrop = cadenceDropped && deviceIsStable && gracePeriodElapsed
            if (primaryStop || cadenceDrop) {
                val reason = if (primaryStop) "step_timeout" else "cadence_drop"
                Log.d(TAG, "Stop conditions met via $reason — entering POTENTIAL_STOP " +
                        "(stepsHaveStopped=$stepsHaveStopped, stable=$deviceIsStable, graceElapsed=$gracePeriodElapsed, cadenceDrop=$cadenceDropped)")
                potentialStopStartTime = now
                transitionTo(MotionState.POTENTIAL_STOP, currentActivityType)
                scheduleStopConfirmEval()
            } else {
                Log.d(TAG, "Stop conditions not met: stepsHaveStopped=$stepsHaveStopped " +
                        "stable=$deviceIsStable graceElapsed=$gracePeriodElapsed cadenceDrop=$cadenceDropped")
            }
        } else if (currentState == MotionState.POTENTIAL_STOP) {
            // Micro-movement guard: if variance spikes, user is still moving
            val microMovement = MotionEngine.getVariance() > config.microMovementVarianceGuard
            if (microMovement) {
                Log.d(TAG, "Micro-movement guard triggered (variance=${MotionEngine.getVariance()} > ${config.microMovementVarianceGuard}) — returning to MOVING")
                potentialStopStartTime = 0L
                cancelStopEval()
                transitionTo(MotionState.MOVING, currentActivityType)
                return
            }
            if (!stepsHaveStopped || !deviceIsStable) {
                // Conditions no longer met — movement resumed, cancel
                Log.d(TAG, "POTENTIAL_STOP cancelled — conditions no longer met")
                potentialStopStartTime = 0L
                cancelStopEval()
                transitionTo(MotionState.MOVING, currentActivityType)
            } else {
                val confirmedMs = now - potentialStopStartTime
                if (confirmedMs >= config.stopConfirmWindowMs) {
                    Log.i(TAG, "Stop confirmed after ${confirmedMs}ms — transitioning to IDLE")
                    confirmStop()
                }
            }
        }
    }

    private fun confirmStop() {
        potentialStopStartTime = 0L
        cancelStopEval()
        transitionTo(MotionState.IDLE, currentActivityType, "inactivity_timeout")
    }

    private fun handleForceStop(reason: String) {
        if (currentState == MotionState.IDLE || currentState == MotionState.UNKNOWN) return
        cancelStopEval()
        potentialMovementStartTime = 0L
        potentialStopStartTime = 0L
        Log.i(TAG, "Force stop: $reason")
        transitionTo(MotionState.IDLE, currentActivityType, reason)
    }

    // ── Transitions ──────────────────────────────────────────────────────────

    private fun transitionTo(newState: MotionState, activityType: String, reason: String? = null) {
        val oldState = currentState
        if (oldState == newState) return

        currentState = newState
        Log.i(TAG, "State: $oldState → $newState (type=$activityType, reason=$reason)")

        // When transitioning to IDLE, emit "unknown" activity type so the debug UI and
        // AppBlocker never see a stale walking/running state after the session ends.
        val emitActivityType = if (newState == MotionState.IDLE) "unknown" else activityType

        // Signal TrackingService via native IPC BEFORE emitting state so RN sees
        // an event aligned with native tracking intent. Track whether we signalled
        // the TrackingService to include in the emitted payload.
        var trackingSignalled = false
        when {
            newState == MotionState.MOVING && (oldState == MotionState.POTENTIAL_MOVEMENT || oldState == MotionState.IDLE) -> {
                // New MOVING period — clear any previous start signal state.
                trackingStartSignalled = false

                // Only signal a tracking start when BOTH:
                // - motion detection is MOVING (we are here), and
                // - Activity Recognition is active in an eligible type.
                trackingSignalled = maybeSignalTrackingStart()
            }
            newState == MotionState.MOVING && oldState == MotionState.POTENTIAL_STOP -> {
                // Resumed from POTENTIAL_STOP — no new start signal; GPS already running
                trackingSignalled = false
            }
            newState == MotionState.IDLE && oldState != MotionState.UNKNOWN -> {
                trackingSink.onMotionStopped(activityType, reason ?: "inactivity_timeout")
                trackingSignalled = true
                movementStartTime = 0L
                trackingStartSignalled = false
                // Reset currentActivityType to "unknown" so the debug UI and AppBlocker never
                // see a stale walking/running state after the session ends.
                // lastKnownRealActivityType is intentionally NOT reset here — it preserves the
                // last real AR state so re-trigger logic works correctly when the user starts
                // moving again before Android AR fires a new ENTER transition.
                currentActivityType = "unknown"
            }
        }

        // Emit unified MotionStateChanged event to React Native with extra context
        MotionEventEmitter.emitStateChanged(
            state = newState,
            activityType = emitActivityType,
            confidence = 1.0f,
            distanceMeters = 0.0,
            timestamp = System.currentTimeMillis(),
            lastKnownActivity = lastKnownRealActivityType,
            trackingSignalled = trackingSignalled
        )

        // Notify MotionEngine to adjust sensor power
        when (newState) {
            MotionState.IDLE -> MotionEngine.onStopped()
            MotionState.POTENTIAL_MOVEMENT -> MotionEngine.onResumed()  // full rate for confirmation
            MotionState.MOVING -> MotionEngine.onResumed()
            MotionState.POTENTIAL_STOP -> MotionEngine.onAutoPaused()   // reduce rate while evaluating stop
            MotionState.UNKNOWN -> {}
        }
    }

    /**
     * Signals TrackingService to start auto tracking, but only when AR is currently active
     * in an eligible activity type. Returns true if a start signal was emitted.
     */
    private fun maybeSignalTrackingStart(): Boolean {
        if (trackingStartSignalled) return false
        if (currentState != MotionState.MOVING) return false
        if (!arIsActive) return false
        if (arActiveType !in eligibleArTypes) return false

        try {
            // Use the AR-latched type as the canonical start type.
            trackingSink.onMotionStarted(arActiveType)
            trackingStartSignalled = true
            // Emit an event even if there was no state transition (delayed start case).
            MotionEventEmitter.emitStateChanged(
                state = currentState,
                activityType = currentActivityType,
                confidence = 1.0f,
                distanceMeters = 0.0,
                timestamp = System.currentTimeMillis(),
                lastKnownActivity = lastKnownRealActivityType,
                trackingSignalled = true
            )
            return true
        } catch (_: Exception) {
            return false
        }
    }

    // ── Stop evaluation scheduling ───────────────────────────────────────────

    private fun scheduleStopConfirmEval() {
        cancelStopEval()
        stopEvalRunnable = object : Runnable {
            override fun run() {
                if (currentState == MotionState.POTENTIAL_STOP) {
                    evaluatePotentialStop()
                    mainHandler.postDelayed(this, 1_000L)
                }
            }
        }
        mainHandler.postDelayed(stopEvalRunnable!!, 1_000L)
    }

    private fun cancelStopEval() {
        stopEvalRunnable?.let { mainHandler.removeCallbacks(it) }
        stopEvalRunnable = null
    }
}
