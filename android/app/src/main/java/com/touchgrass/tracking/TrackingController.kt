package com.touchgrass.tracking

import android.location.Location
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.touchgrass.MMKVStore

/**
 * Core motion-driven state machine for tracking.
 *
 * Responsibilities:
 *  · Receive [ActivitySnapshot] events from MotionService via [onMotion].
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
    private val onStateChanged: (TrackingState) -> Unit
) {

    private val TAG = "TrackingController"
    private val handler = Handler(Looper.getMainLooper())

    private var state = TrackingState()
    private var lastLocation: Location? = null
    private var lastNotificationMs = 0L
    // Baseline offsets merged from persisted daily totals (not owned by SessionManager)
    private var baselineDistanceOffset = 0.0
    private var baselineElapsedOffset = 0L

    // Pending Runnable that ends the session after the stationary buffer expires.
    private val stationaryBufferRunnable = Runnable {
        Log.d(TAG, "Stationary buffer expired — ending session")
        finaliseSession()
    }

    // Runnable that publishes elapsed/distance every second while a manual
    // session is active so the UI sees ticking time even if no GPS delta
    // has yet been accepted.
    private val manualTickerRunnable = object : Runnable {
        override fun run() {
            if (state.mode == TrackingMode.TRACKING_MANUAL && sessions.isActive()) {
                state = state.copy(
                    elapsedSeconds = sessions.elapsedSeconds() + baselineElapsedOffset,
                    distanceMeters = sessions.currentDistance() + baselineDistanceOffset,
                    lastUpdateMs = System.currentTimeMillis()
                )
                publishState()
                handler.postDelayed(this, 1000L)
            }
        }
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /** Process a new activity snapshot from MotionService. */
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
                // Cancel any pending stationary buffer.
                handler.removeCallbacks(stationaryBufferRunnable)
                ensureTracking()
                gps.setMode(GpsMode.HIGH_ACCURACY)
                state = state.copy(gpsMode = GpsMode.HIGH_ACCURACY)
            }

            ActivityType.IN_VEHICLE -> {
                // Pause accumulation; keep GPS alive at low power for plausibility.
                handler.removeCallbacks(stationaryBufferRunnable)
                gps.setMode(GpsMode.LOW_POWER)
                state = state.copy(
                    mode = TrackingMode.PAUSED_VEHICLE,
                    gpsMode = GpsMode.LOW_POWER
                )
            }

            ActivityType.STILL -> {
                // STILL at high confidence → end immediately, no buffer.
                if (snapshot.confirmed) {
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
     * Called when MotionService signals that motion has stopped
     * (inactivity timeout, manual stop, etc.) without a specific activity type.
     * Arms the stationary buffer — if motion doesn't resume within the buffer
     * window the session is ended.
     */
    fun onMotionStopped() {
        Log.d(TAG, "Motion stopped — arming stationary buffer (${TrackingConstants.STATIONARY_BUFFER_MS}ms)")
        if (state.mode == TrackingMode.TRACKING_AUTO || state.mode == TrackingMode.TRACKING_MANUAL) {
            armStationaryBuffer()
        }
    }

    /** Process an incoming GPS location fix. */
    fun onLocation(location: Location) {
        // GPS drift guard: only accumulate while actively tracking (auto or manual).
        if (state.mode != TrackingMode.TRACKING_AUTO && state.mode != TrackingMode.TRACKING_MANUAL) {
            lastLocation = location  // keep last position fresh for when tracking resumes
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
            MMKVStore.accumulateTodayDistance(delta.toDouble())
            state = state.copy(
                distanceMeters = sessions.currentDistance() + baselineDistanceOffset,
                elapsedSeconds = sessions.elapsedSeconds() + baselineElapsedOffset,
                lastUpdateMs = System.currentTimeMillis()
            )
            publishState()
        } else if (state.mode == TrackingMode.TRACKING_MANUAL) {
            // No distance delta accepted, but in manual mode we should still
            // publish elapsed time so the UI shows progress.
            state = state.copy(
                distanceMeters = sessions.currentDistance() + baselineDistanceOffset,
                elapsedSeconds = sessions.elapsedSeconds() + baselineElapsedOffset,
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
        state = state.copy(
            mode = TrackingMode.TRACKING_MANUAL,
            distanceMeters = 0.0 + baselineDistanceOffset,
            elapsedSeconds = 0 + baselineElapsedOffset,
            goalReached = false,
            gpsMode = GpsMode.HIGH_ACCURACY,
            lastUpdateMs = System.currentTimeMillis()
        )
        gps.setMode(GpsMode.HIGH_ACCURACY)
        publishState()
        // Start a periodic ticker so elapsedSeconds updates even without
        // an accepted GPS delta.
        handler.removeCallbacks(manualTickerRunnable)
        handler.postDelayed(manualTickerRunnable, 1000L)
        Log.d(TAG, "Manual session started")
    }

    /** Stop any active session immediately (e.g. user tapped Stop). */
    fun stopManualSession() {
        handler.removeCallbacks(stationaryBufferRunnable)
        finaliseSession()
    }

    /** Return the current state snapshot (used by the service on start). */
    fun currentState(): TrackingState = state

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /**
     * Ensure tracking is active. If the service was IDLE or PAUSED_VEHICLE,
     * starts a new session and transitions to TRACKING_AUTO.
     */
    private fun ensureTracking() {
        if (state.mode == TrackingMode.TRACKING_AUTO || state.mode == TrackingMode.TRACKING_MANUAL) return
        // Cancel any manual ticker when switching to auto tracking.
        handler.removeCallbacks(manualTickerRunnable)
        sessions.start()
        state = state.copy(
            mode = TrackingMode.TRACKING_AUTO,
            distanceMeters = 0.0 + baselineDistanceOffset,
            elapsedSeconds = 0 + baselineElapsedOffset,
            goalReached = false,
            lastUpdateMs = System.currentTimeMillis()
        )
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

        // Cancel the manual ticker before we snapshot/finish the session so
        // no concurrent ticker run can publish an intermediate value.
        handler.removeCallbacks(manualTickerRunnable)

        if (wasActive) {
            val (distance, elapsed) = sessions.finish()
            finalDistance = distance
            finalElapsed = elapsed
            Log.d(TAG, "Session finalised: distance=${distance}m elapsed=${elapsed}s")
        }

        gps.setMode(GpsMode.OFF)
        lastLocation = null

        state = state.copy(
            mode = TrackingMode.IDLE,
            gpsMode = GpsMode.OFF,
            distanceMeters = if (wasActive) finalDistance + baselineDistanceOffset else 0.0 + baselineDistanceOffset,
            elapsedSeconds = if (wasActive) finalElapsed + baselineElapsedOffset else 0L + baselineElapsedOffset,
            lastUpdateMs = System.currentTimeMillis()
        )

        publishState()
    }

    /**
     * Publish the current state immediately and, if enough time has passed,
     * also trigger a notification refresh (throttled to avoid spamming).
     */
    private fun publishState() {
        onStateChanged(state)
    }

    /**
     * Apply a persisted daily baseline so the controller reports `baseline + session`.
     * This is idempotent and can be called once at service startup.
     */
    fun applyBaseline(distanceOffset: Double, elapsedOffset: Long) {
        baselineDistanceOffset = distanceOffset
        baselineElapsedOffset = elapsedOffset
        // Recompute state to include the baseline
        state = state.copy(
            distanceMeters = sessions.currentDistance() + baselineDistanceOffset,
            elapsedSeconds = sessions.elapsedSeconds() + baselineElapsedOffset,
            lastUpdateMs = System.currentTimeMillis()
        )
        publishState()
    }
}
