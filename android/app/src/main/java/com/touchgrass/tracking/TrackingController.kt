package com.touchgrass.tracking

import android.location.Location
import android.os.Handler
import android.os.Looper
import android.util.Log

/**
 * Core motion-driven state machine for tracking.
 *
 * Responsibilities:
 *  · Receive [ActivitySnapshot] events from MotionEngine via [onMotion].
 *  · Receive GPS [Location] fixes via [onLocation].
 *  · Maintain a single [TrackingState] and publish updates through [onStateChanged].
 *  · Control [GpsManager] power modes based on activity type.
 *  · Drive [SessionManager] for distance / elapsed accumulation.
 *
 * All methods must be called from the same thread (main looper).
 * The Handler used internally also runs on the main looper so no locking is needed.
 *
 * State machine transitions:
 *
 *   IDLE ──(WALKING/RUNNING/BIKE)──▶ TRACKING_AUTO  (GPS HIGH_ACCURACY)
 *   TRACKING_AUTO ──(IN_VEHICLE)──▶ PAUSED_VEHICLE  (GPS LOW_POWER)
 *   PAUSED_VEHICLE ──(WALKING/RUNNING/BIKE)──▶ TRACKING_AUTO
 *   TRACKING_AUTO ──(MOTION_STOPPED)──▶ arm stationary buffer
 *   buffer expires  ──▶ IDLE  (GPS OFF, session finalised)
 *   STILL (high confidence) ──▶ IDLE immediately
 *
 * @param gps          GpsManager to switch GPS modes.
 * @param processor    LocationProcessor for distance delta filtering.
 * @param sessions     SessionManager for accumulation and finalisation.
 * @param onStateChanged Callback invoked on every state change (runs on main looper).
 */
class TrackingController(
    private val gps: GpsManager,
    private val processor: LocationProcessor,
    private val sessions: SessionManager,
    private val onStateChanged: (TrackingSessionState) -> Unit,
    private val goalReachedEvaluator: (todayDistanceMeters: Double, todayElapsedSeconds: Long) -> Boolean = { _, _ -> false },
    private val onSessionFinalised: (distanceMeters: Double, elapsedSeconds: Long, goalReached: Boolean) -> Unit = { _, _, _ -> }
) {

    private val TAG = "TrackingController"
    private val handler = Handler(Looper.getMainLooper())

    private var state = TrackingSessionState()
    private var lastLocation: Location? = null

    // Motion + Activity Recognition gates for eligible time accumulation.
    private var motionMoving: Boolean = false
    private var arIsActive: Boolean = false
    private var arActiveType: ActivityType = ActivityType.UNKNOWN

    // Daily base (baseline + completed sessions) merged from persistence and updated on session finish.
    private var baseDistanceMeters = 0.0
    private var baseElapsedSeconds = 0L

    // Pending Runnable that ends the session after the stationary buffer expires.
    private val stationaryBufferRunnable = Runnable {
        Log.d(TAG, "Stationary buffer expired — ending session")
        finaliseSession()
    }

    // Runnable that advances eligible elapsed time every second while a
    // session is active so the UI/notification stays fresh even when GPS
    // deltas are sparse.
    private val sessionTickerRunnable = object : Runnable {
        override fun run() {
            if (!sessions.isActive()) return
            if (state.mode != TrackingMode.TRACKING_MANUAL && state.mode != TrackingMode.TRACKING_AUTO) return

            val eligible = isTimeEligible()
            sessions.tick(eligible)

            val sessionElapsed = sessions.elapsedSeconds()
            val sessionDistance = sessions.currentDistance()
            val todayElapsed = baseElapsedSeconds + sessionElapsed
            val todayDistance = baseDistanceMeters + sessionDistance
            state = state.copy(
                sessionElapsedSeconds = sessionElapsed,
                sessionDistanceMeters = sessionDistance,
                todayElapsedSeconds = todayElapsed,
                todayDistanceMeters = todayDistance,
                goalReached = evaluateGoalReached(todayDistance, todayElapsed),
                isTimeEligible = eligible,
                lastUpdateMs = System.currentTimeMillis()
            )
            publishState()
            handler.postDelayed(this, 1000L)
        }
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /** Process a new activity snapshot from MotionEngine. */
    fun onMotion(snapshot: ActivitySnapshot) {
        Log.d(TAG, "onMotion: ${snapshot.type} confidence=${snapshot.confidence}")

        state = state.copy(
            activityType = snapshot.type,
            activityConfidence = snapshot.confidence,
            lastUpdateMs = System.currentTimeMillis()
        )

        when (snapshot.type) {

            ActivityType.WALKING,
            ActivityType.RUNNING,
            ActivityType.ON_BICYCLE -> {
                motionMoving = true
                // Cancel any pending stationary buffer.
                handler.removeCallbacks(stationaryBufferRunnable)
                ensureTracking()
                gps.setMode(GpsMode.HIGH_ACCURACY)
                state = state.copy(gpsMode = GpsMode.HIGH_ACCURACY)
            }

            ActivityType.IN_VEHICLE -> {
                motionMoving = false
                // Manual sessions are user-owned and must be immune to motion/AR stop signals.
                if (state.mode == TrackingMode.TRACKING_MANUAL) {
                    Log.d(TAG, "IN_VEHICLE ignored in manual mode")
                } else {
                    // Pause accumulation; keep GPS alive at low power for plausibility.
                    handler.removeCallbacks(stationaryBufferRunnable)
                    gps.setMode(GpsMode.LOW_POWER)
                    state = state.copy(
                        mode = TrackingMode.PAUSED_VEHICLE,
                        gpsMode = GpsMode.LOW_POWER
                    )
                }
            }

            ActivityType.STILL -> {
                // STILL at high confidence → end immediately, no buffer.
                if (snapshot.confirmed) {
                    if (state.mode == TrackingMode.TRACKING_MANUAL) {
                        Log.d(TAG, "STILL (confirmed) ignored in manual mode")
                        publishState()
                        return
                    }
                    Log.d(TAG, "STILL (confirmed) — ending session immediately")
                    handler.removeCallbacks(stationaryBufferRunnable)
                    finaliseSession()
                    return
                }
                // Unconfirmed STILL → arm the buffer just in case.
                armStationaryBuffer()
            }

            ActivityType.UNKNOWN -> {
                // Keep tracking but don't change GPS mode.
                // LocationProcessor already applies stricter distance filtering for UNKNOWN.
            }
        }

        publishState()
    }

    /**
    * Called when the motion engine signals that motion has stopped
     * (inactivity timeout, manual stop, etc.) without a specific activity type.
     * Arms the stationary buffer — if motion doesn't resume within the buffer
     * window the session is ended.
     */
    fun onMotionStopped() {
        Log.d(TAG, "Motion stopped — arming stationary buffer (${TrackingConstants.STATIONARY_BUFFER_MS}ms)")
        motionMoving = false
        if (state.mode == TrackingMode.TRACKING_AUTO) {
            armStationaryBuffer()
        } else if (state.mode == TrackingMode.TRACKING_MANUAL) {
            Log.d(TAG, "Motion stopped ignored in manual mode")
        }
    }

    /** Update the Activity Recognition latch state (Option B: latched until EXIT). */
    fun onArActivityChanged(activityType: ActivityType, isActive: Boolean) {
        val allowed = activityType == ActivityType.WALKING ||
                activityType == ActivityType.RUNNING ||
                activityType == ActivityType.ON_BICYCLE

        if (isActive && allowed) {
            arIsActive = true
            arActiveType = activityType
            state = state.copy(
                activityType = activityType,
                activityConfidence = 80,
                lastUpdateMs = System.currentTimeMillis()
            )
        } else {
            // Clear only when the exiting type matches the currently latched type.
            if (arActiveType == activityType) {
                arIsActive = false
                arActiveType = ActivityType.UNKNOWN
                if (state.mode == TrackingMode.TRACKING_AUTO) {
                    // Robust auto behavior: if AR becomes inactive while auto tracking,
                    // begin graceful stop countdown unless movement re-qualifies.
                    motionMoving = false
                    armStationaryBuffer()
                }
                state = state.copy(
                    activityType = ActivityType.UNKNOWN,
                    activityConfidence = 0,
                    lastUpdateMs = System.currentTimeMillis()
                )
            }
        }

        publishState()
    }

    /** Process an incoming GPS location fix. */
    fun onLocation(location: Location) {
        // GPS drift guard: only accumulate while actively tracking (auto or manual).
        if (state.mode != TrackingMode.TRACKING_AUTO && state.mode != TrackingMode.TRACKING_MANUAL) {
            lastLocation = location  // keep last position fresh for when tracking resumes
            return
        }

        // Keep elapsed current even when GPS deltas are rejected.
        val eligible = isTimeEligible()
        sessions.tick(eligible)

        // Strict auto-mode policy: only accumulate distance while auto time is eligible
        // (moving + AR active + walking/running/cycling). Keep last location fresh so
        // resuming eligibility doesn't create a large jump delta.
        if (state.mode == TrackingMode.TRACKING_AUTO && !eligible) {
            lastLocation = location
            val sessionDistance = sessions.currentDistance()
            val sessionElapsed = sessions.elapsedSeconds()
            val todayDistance = baseDistanceMeters + sessionDistance
            val todayElapsed = baseElapsedSeconds + sessionElapsed
            state = state.copy(
                sessionDistanceMeters = sessionDistance,
                sessionElapsedSeconds = sessionElapsed,
                todayDistanceMeters = todayDistance,
                todayElapsedSeconds = todayElapsed,
                goalReached = evaluateGoalReached(todayDistance, todayElapsed),
                isTimeEligible = false,
                lastUpdateMs = System.currentTimeMillis()
            )
            publishState()
            return
        }

        // GPS drift guard: require meaningful speed (≥ 0.5 m/s) to filter stationary GPS noise.
        // Skip this guard for manual sessions so slow walking still accumulates.
        if (state.mode != TrackingMode.TRACKING_MANUAL && location.hasSpeed() && location.speed < TrackingConstants.MIN_ACCUMULATE_SPEED_MS) {
            Log.d(TAG, "GPS drift guard: speed=${location.speed} m/s < ${TrackingConstants.MIN_ACCUMULATE_SPEED_MS} — skipping")
            lastLocation = location
            return
        }

        // Build a transient snapshot for the processor (uses current activity state).
        val activitySnap = ActivitySnapshot(
            type = state.activityType,
            confidence = state.activityConfidence,
            timestampMs = System.currentTimeMillis(),
            confirmed = state.activityConfidence >= TrackingConstants.ACTIVITY_CONFIDENCE_THRESHOLD
        )

        val delta = processor.process(lastLocation, location, activitySnap, state.mode == TrackingMode.TRACKING_MANUAL)
        lastLocation = location

        if (delta > 0f) {
            sessions.addDistance(delta)

            val sessionDistance = sessions.currentDistance()
            val sessionElapsed = sessions.elapsedSeconds()
            val todayDistance = baseDistanceMeters + sessionDistance
            val todayElapsed = baseElapsedSeconds + sessionElapsed
            state = state.copy(
                sessionDistanceMeters = sessionDistance,
                sessionElapsedSeconds = sessionElapsed,
                todayDistanceMeters = todayDistance,
                todayElapsedSeconds = todayElapsed,
                goalReached = evaluateGoalReached(todayDistance, todayElapsed),
                isTimeEligible = eligible,
                lastUpdateMs = System.currentTimeMillis()
            )
            publishState()
        } else {
            // Even if no distance delta was accepted, elapsed may have advanced.
            val sessionDistance = sessions.currentDistance()
            val sessionElapsed = sessions.elapsedSeconds()
            val todayDistance = baseDistanceMeters + sessionDistance
            val todayElapsed = baseElapsedSeconds + sessionElapsed
            state = state.copy(
                sessionDistanceMeters = sessionDistance,
                sessionElapsedSeconds = sessionElapsed,
                todayDistanceMeters = todayDistance,
                todayElapsedSeconds = todayElapsed,
                goalReached = evaluateGoalReached(todayDistance, todayElapsed),
                isTimeEligible = eligible,
                lastUpdateMs = System.currentTimeMillis()
            )
            publishState()
        }
    }

    /** Start a manual tracking session (e.g. user tapped Play). */
    fun startManualSession() {
        handler.removeCallbacks(stationaryBufferRunnable)
        if (state.mode == TrackingMode.TRACKING_MANUAL || state.mode == TrackingMode.TRACKING_AUTO) return
        sessions.start()
        val todayDistance = baseDistanceMeters
        val todayElapsed = baseElapsedSeconds
        state = state.copy(
            mode = TrackingMode.TRACKING_MANUAL,
            sessionDistanceMeters = 0.0,
            sessionElapsedSeconds = 0L,
            todayDistanceMeters = todayDistance,
            todayElapsedSeconds = todayElapsed,
            isTimeEligible = true,
            goalReached = evaluateGoalReached(todayDistance, todayElapsed),
            gpsMode = GpsMode.HIGH_ACCURACY,
            lastUpdateMs = System.currentTimeMillis()
        )
        gps.setMode(GpsMode.HIGH_ACCURACY)
        publishState()
        // Start a periodic ticker so elapsedSeconds updates even without
        // an accepted GPS delta.
        handler.removeCallbacks(sessionTickerRunnable)
        handler.postDelayed(sessionTickerRunnable, 1000L)
        Log.d(TAG, "Manual session started")
    }

    /** Stop any active session immediately (e.g. user tapped Stop). */
    fun stopManualSession() {
        handler.removeCallbacks(stationaryBufferRunnable)
        if (state.mode != TrackingMode.TRACKING_MANUAL) {
            Log.d(TAG, "stopManualSession ignored: mode=${state.mode}")
            return
        }
        finaliseSession()
    }

    /** Stop whichever session is currently active (manual or auto). */
    fun stopActiveSession() {
        handler.removeCallbacks(stationaryBufferRunnable)
        finaliseSession()
    }

    /** Return the current session state snapshot (used by the service on start). */
    fun currentState(): TrackingSessionState = state

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /**
     * Ensure tracking is active. If the service was IDLE or PAUSED_VEHICLE,
     * starts a new session and transitions to TRACKING_AUTO.
     */
    private fun ensureTracking() {
        if (state.mode == TrackingMode.TRACKING_AUTO || state.mode == TrackingMode.TRACKING_MANUAL) return
        // Cancel any ticker before switching modes.
        handler.removeCallbacks(sessionTickerRunnable)
        sessions.start()
        val todayDistance = baseDistanceMeters
        val todayElapsed = baseElapsedSeconds
        state = state.copy(
            mode = TrackingMode.TRACKING_AUTO,
            sessionDistanceMeters = 0.0,
            sessionElapsedSeconds = 0L,
            todayDistanceMeters = todayDistance,
            todayElapsedSeconds = todayElapsed,
            isTimeEligible = isTimeEligible(),
            goalReached = evaluateGoalReached(todayDistance, todayElapsed),
            lastUpdateMs = System.currentTimeMillis()
        )
        handler.postDelayed(sessionTickerRunnable, 1000L)
        Log.d(TAG, "Tracking session started (auto)")
    }

    /** Arms a short timer; finalises the session if it fires. */
    private fun armStationaryBuffer() {
        // If a buffer is already armed, remove it so we restart the countdown.
        handler.removeCallbacks(stationaryBufferRunnable)
        if (sessions.isActive()) {
            handler.postDelayed(stationaryBufferRunnable, TrackingConstants.STATIONARY_BUFFER_MS)
        }
    }

    /** Tear down the session: stop GPS, finalise SessionManager, reset state. */
    private fun finaliseSession() {
        val wasActive = sessions.isActive()
        var finalDistance = 0.0
        var finalElapsed = 0L

        // Cancel the ticker before we snapshot/finish the session so
        // no concurrent ticker run can publish an intermediate value.
        handler.removeCallbacks(sessionTickerRunnable)

        if (wasActive) {
            sessions.tick(isTimeEligible())
            val (distance, elapsed) = sessions.finish()
            finalDistance = distance
            finalElapsed = elapsed
            Log.d(TAG, "Session finalised: distance=${distance}m elapsed=${elapsed}s")

            val finalTodayDistance = baseDistanceMeters + finalDistance
            val finalTodayElapsed = baseElapsedSeconds + finalElapsed
            val finalGoalReached = evaluateGoalReached(finalTodayDistance, finalTodayElapsed)

            // Update the daily base and notify the owner so persistence can record session-scoped values.
            baseDistanceMeters += finalDistance
            baseElapsedSeconds += finalElapsed
            onSessionFinalised(finalDistance, finalElapsed, finalGoalReached)
            state = state.copy(goalReached = finalGoalReached)
        }

        gps.setMode(GpsMode.OFF)
        lastLocation = null

        state = state.copy(
            mode = TrackingMode.IDLE,
            gpsMode = GpsMode.OFF,
            sessionDistanceMeters = 0.0,
            sessionElapsedSeconds = 0L,
            todayDistanceMeters = baseDistanceMeters,
            todayElapsedSeconds = baseElapsedSeconds,
            isTimeEligible = false,
            activityType = ActivityType.UNKNOWN,
            activityConfidence = 0,
            lastUpdateMs = System.currentTimeMillis()
        )

        publishState()
    }

    private fun isTimeEligible(): Boolean {
        return when (state.mode) {
            TrackingMode.TRACKING_MANUAL -> true
            TrackingMode.TRACKING_AUTO -> motionMoving && arIsActive &&
                    (arActiveType == ActivityType.WALKING ||
                            arActiveType == ActivityType.RUNNING ||
                            arActiveType == ActivityType.ON_BICYCLE)
            else -> false
        }
    }

    /**
     * Publish the current state immediately and, if enough time has passed,
     * also trigger a notification refresh (throttled to avoid spamming).
     */
    private fun publishState() {
        val eligible = isTimeEligible()
        if (state.isTimeEligible != eligible) {
            state = state.copy(isTimeEligible = eligible)
        }
        onStateChanged(state)
    }

    private fun evaluateGoalReached(todayDistanceMeters: Double, todayElapsedSeconds: Long): Boolean {
        if (state.goalReached) return true
        return goalReachedEvaluator(todayDistanceMeters, todayElapsedSeconds)
    }

    /**
     * Apply a persisted daily baseline so the controller reports `baseline + session`.
     * This is idempotent and can be called once at service startup.
     */
    fun applyBaseline(distanceOffset: Double, elapsedOffset: Long) {
        baseDistanceMeters = distanceOffset
        baseElapsedSeconds = elapsedOffset

        // Recompute state to include the baseline.
        val sessionDistance = if (sessions.isActive()) sessions.currentDistance() else 0.0
        val sessionElapsed = if (sessions.isActive()) sessions.elapsedSeconds() else 0L
        val todayDistance = baseDistanceMeters + sessionDistance
        val todayElapsed = baseElapsedSeconds + sessionElapsed
        state = state.copy(
            sessionDistanceMeters = sessionDistance,
            sessionElapsedSeconds = sessionElapsed,
            todayDistanceMeters = todayDistance,
            todayElapsedSeconds = todayElapsed,
            goalReached = goalReachedEvaluator(todayDistance, todayElapsed),
            isTimeEligible = isTimeEligible(),
            lastUpdateMs = System.currentTimeMillis()
        )
        publishState()
    }
}
