package com.touchgrass.motion

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionRequest
import com.google.android.gms.location.DetectedActivity
import java.util.Collections
import kotlin.math.abs
import kotlin.math.pow
import kotlin.math.sqrt

/**
 * Core sensor engine responsible for:
 *   - Step detector monitoring + cadence ring buffer
 *   - Accelerometer variance calculation
 *   - Gyroscope data collection (optional smoothing)
 *   - Activity Recognition transition handling
 *   - Movement confidence scoring
 *   - Multi-signal corroboration tracking
 *   - Stationary surface lock (suppresses phantom triggers from desk vibration)
 *   - Cadence drop detection (early POTENTIAL_STOP trigger)
 *   - Emitting signals to MotionSessionController
 *
 * Thread-safety:
 *   - Sensor callbacks run on a dedicated HandlerThread ("MotionSensorThread").
 *   - Shared mutable state uses @Volatile or synchronized collections.
 *   - State machine mutations are delegated to MotionSessionController
 *     which serializes them on the main looper.
 *
 * Battery optimization:
 *   - IDLE / POTENTIAL_STOP: accelerometer at SENSOR_DELAY_NORMAL (~5 Hz), gyroscope off.
 *   - MOVING / POTENTIAL_MOVEMENT: accelerometer at SENSOR_DELAY_GAME (~50 Hz), gyroscope on.
 *   - IDLE: sensors unregistered; only Activity Recognition passive listener remains.
 */
object MotionEngine : SensorEventListener {

    private const val TAG = "MotionEngine"
    private const val CADENCE_BUFFER_SIZE = 32

    private lateinit var appContext: Context
    private var sensorManager: SensorManager? = null
    private var stepSensor: Sensor? = null
    private var accelSensor: Sensor? = null
    private var gyroSensor: Sensor? = null

    // Dedicated thread for sensor callbacks (avoids blocking UI)
    private var sensorThread: HandlerThread? = null
    private var sensorHandler: Handler? = null

    // Inactivity polling on the sensor thread
    private var inactivityRunnable: Runnable? = null

    // ── Thread-safe shared state ──────────────────────────────────────────────

    /** Timestamp of the most recent step detector event. */
    @Volatile
    private var lastStepTime: Long = 0L

    /** Timestamp of last accelerometer variance spike above varianceStartThreshold. */
    @Volatile
    private var lastVarianceSpikeTime: Long = 0L

    /** Timestamp of last Activity Recognition ENTER transition (walking/running/cycling). */
    @Volatile
    private var lastActivityEnterTime: Long = 0L

    @Volatile
    private var running = false

    /** Synchronized rolling window of accelerometer deviation from gravity. */
    private val accelWindow: MutableList<Float> =
        Collections.synchronizedList(mutableListOf<Float>())

    /**
     * Ring buffer of recent step timestamps for cadence computation.
     * Access is guarded by [stepTimestampsLock].
     */
    private val stepTimestamps: ArrayDeque<Long> = ArrayDeque(CADENCE_BUFFER_SIZE)
    private val stepTimestampsLock = Any()

    // ── Stationary surface lock ───────────────────────────────────────────────

    /**
     * When true, movement candidates from IDLE are rejected until variance spikes
     * above [MotionConfig.stationaryUnlockVariance].
     * Written only on sensor thread; read from main looper via @Volatile.
     */
    @Volatile
    private var stationaryLockActive: Boolean = false

    /** Timestamp when the ultra-low variance + zero-cadence period began. */
    @Volatile
    private var stationaryLockCandidateStart: Long = 0L

    // ── Cadence drop detection ────────────────────────────────────────────────

    /** Timestamp when cadence first dropped below [MotionConfig.cadenceDropThreshold]. */
    @Volatile
    private var cadenceDropStart: Long = 0L

    private var config: MotionConfig = MotionConfig()

    // ── Public API ────────────────────────────────────────────────────────────

    fun start(ctx: Context, motionConfig: MotionConfig = MotionConfig()) {
        if (running) {
            Log.w(TAG, "MotionEngine already running")
            return
        }
        appContext = ctx.applicationContext
        config = motionConfig
        MotionSessionController.config = motionConfig

        sensorManager = appContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        stepSensor = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)
        accelSensor = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        gyroSensor = sensorManager?.getDefaultSensor(Sensor.TYPE_GYROSCOPE)

        sensorThread = HandlerThread("MotionSensorThread").also { it.start() }
        sensorHandler = Handler(sensorThread!!.looper)

        registerSensors(fullRate = true)
        startActivityRecognition()
        scheduleInactivityCheck()
        running = true
        Log.i(TAG, "MotionEngine started")
    }

    fun stop() {
        if (!running) return
        sensorManager?.unregisterListener(this)
        stopActivityRecognition()
        cancelInactivityCheck()
        sensorThread?.quitSafely()
        sensorThread = null
        sensorHandler = null
        accelWindow.clear()
        synchronized(stepTimestampsLock) { stepTimestamps.clear() }
        stationaryLockActive = false
        stationaryLockCandidateStart = 0L
        cadenceDropStart = 0L
        lastVarianceSpikeTime = 0L
        lastActivityEnterTime = 0L
        running = false
        Log.i(TAG, "MotionEngine stopped")
    }

    fun isRunning(): Boolean = running

    // ── Stop condition helpers (called from MotionSessionController) ──────────

    /**
     * Returns true if no step has been detected for at least [MotionConfig.stepStopTimeoutMs].
     * Cycling uses an extended timeout ([MotionConfig.stepStopTimeoutCyclingMs]).
     */
    fun hasStepsStopped(): Boolean {
        val timeout = if (MotionSessionController.currentActivityType == "cycling") {
            config.stepStopTimeoutCyclingMs
        } else {
            config.stepStopTimeoutMs
        }
        val elapsed = System.currentTimeMillis() - lastStepTime
        Log.d(TAG, "hasStepsStopped: lastStep=${elapsed}ms ago, timeout=${timeout}ms")
        return elapsed > timeout
    }

    /**
     * Returns true if the current accelerometer variance is below [MotionConfig.varianceStopThreshold].
     * A stable device indicates the user is stationary.
     */
    fun isDeviceStable(): Boolean {
        val variance = computeVariance()
        Log.d(TAG, "isDeviceStable: variance=$variance threshold=${config.varianceStopThreshold}")
        return variance < config.varianceStopThreshold
    }

    /** Returns the current accelerometer variance (public for debug logging). */
    fun getVariance(): Float = computeVariance()

    /** Returns whether a step has been detected recently (within [MotionConfig.stepRecencyWindowMs]). */
    fun isStepDetectedRecently(): Boolean = isStepRecent()

    /**
     * Returns current cadence in steps/sec, computed over the last [MotionConfig.cadenceMeasureWindowMs].
     * Thread-safe: synchronizes on stepTimestampsLock.
     */
    fun getCadence(): Float {
        val windowMs = config.cadenceMeasureWindowMs
        val cutoff = System.currentTimeMillis() - windowMs
        synchronized(stepTimestampsLock) {
            val recentCount = stepTimestamps.count { it >= cutoff }
            return recentCount.toFloat() / (windowMs / 1000f)
        }
    }

    /** Returns whether stationary lock is currently active (for debug logging). */
    fun isStationaryLocked(): Boolean = stationaryLockActive

    /**
     * Returns the timestamp of the most recent step detector event.
     * Used by MotionSessionController for the failsafe no-step timeout check.
     */
    fun getLastStepTime(): Long = lastStepTime

    /**
     * Returns true if cadence meets the minimum threshold for movement start confirmation.
     * Called by MotionSessionController during POTENTIAL_MOVEMENT → MOVING evaluation.
     */
    fun isCadenceSufficientForStart(): Boolean =
        getCadence() >= config.cadenceConfirmMinStepsSec

    /**
     * Returns true if ≥[MotionConfig.corroborationMinSignals] distinct signal types fired
     * within [MotionConfig.corroborationWindowMs].
     * Signal types: step (lastStepTime), variance spike (lastVarianceSpikeTime),
     *               Activity Recognition ENTER (lastActivityEnterTime).
     */
    fun hasCorroboration(): Boolean {
        val now = System.currentTimeMillis()
        val window = config.corroborationWindowMs
        var count = 0
        if ((now - lastStepTime) <= window) count++
        if ((now - lastVarianceSpikeTime) <= window) count++
        if ((now - lastActivityEnterTime) <= window) count++
        Log.d(TAG, "hasCorroboration: count=$count (step=${now - lastStepTime}ms, variance=${now - lastVarianceSpikeTime}ms, activity=${now - lastActivityEnterTime}ms)")
        return count >= config.corroborationMinSignals
    }

    /**
     * Returns true if cadence has been below [MotionConfig.cadenceDropThreshold]
     * continuously for at least [MotionConfig.cadenceDropDurationMs].
     * Used by MotionSessionController as an early stop trigger.
     */
    fun hasCadenceDropped(): Boolean {
        val cadence = getCadence()
        val now = System.currentTimeMillis()
        return if (cadence < config.cadenceDropThreshold) {
            if (cadenceDropStart == 0L) cadenceDropStart = now
            val dropDuration = now - cadenceDropStart
            Log.d(TAG, "Cadence drop: cadence=$cadence for ${dropDuration}ms (threshold: ${config.cadenceDropDurationMs}ms)")
            dropDuration >= config.cadenceDropDurationMs
        } else {
            cadenceDropStart = 0L
            false
        }
    }

    // ── Battery optimization callbacks from MotionSessionController ───────────

    /** Reduce sensor rate when in POTENTIAL_STOP (device may be stopping). */
    fun onAutoPaused() {
        sensorManager?.unregisterListener(this)
        registerSensors(fullRate = false)
        Log.d(TAG, "Sensors reduced to low-power mode (POTENTIAL_STOP)")
    }

    /** Restore full sensor rate when MOVING or confirming movement. */
    fun onResumed() {
        sensorManager?.unregisterListener(this)
        registerSensors(fullRate = true)
        cadenceDropStart = 0L
        Log.d(TAG, "Sensors restored to full rate (MOVING/POTENTIAL_MOVEMENT)")
    }

    /**
     * Switch to low-power passive listening when IDLE.
     * Keeps step detector and accelerometer active at low rate so the next
     * bout of movement can be detected and start a new session.
     * Activity Recognition also remains active.
     * Full sensor shutdown only happens in [stop] (service teardown).
     */
    fun onStopped() {
        sensorManager?.unregisterListener(this)
        accelWindow.clear()
        synchronized(stepTimestampsLock) { stepTimestamps.clear() }
        cadenceDropStart = 0L
        stationaryLockCandidateStart = 0L
        // stationaryLockActive intentionally NOT cleared here —
        // the lock persists across IDLE re-entry until variance spikes above stationaryUnlockVariance.
        registerSensors(fullRate = false)
        Log.d(TAG, "Sensors reduced to passive mode (IDLE). stationaryLock=$stationaryLockActive")
    }

    // ── SensorEventListener ───────────────────────────────────────────────────

    override fun onSensorChanged(event: SensorEvent?) {
        event ?: return
        when (event.sensor.type) {
            Sensor.TYPE_STEP_DETECTOR -> handleStepDetected()
            Sensor.TYPE_ACCELEROMETER -> handleAccelerometer(event)
            Sensor.TYPE_GYROSCOPE -> handleGyroscope(event)
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        Log.d(TAG, "Sensor accuracy changed: ${sensor?.name} → $accuracy")
    }

    // ── Sensor handlers ───────────────────────────────────────────────────────

    private fun handleStepDetected() {
        val now = System.currentTimeMillis()
        lastStepTime = now

        // Maintain cadence ring buffer
        synchronized(stepTimestampsLock) {
            stepTimestamps.addLast(now)
            val cutoff = now - config.cadenceMeasureWindowMs
            while (stepTimestamps.isNotEmpty() && stepTimestamps.first() < cutoff) {
                stepTimestamps.removeFirst()
            }
            while (stepTimestamps.size > CADENCE_BUFFER_SIZE) {
                stepTimestamps.removeFirst()
            }
        }

        Log.d(TAG, "Step detected at $now, cadence=${getCadence()} steps/sec")

        val confidence = computeConfidence(
            activityRecognitionActive = isActiveActivityType(),
            stepDetectedRecently = true
        )

        // Use lastKnownRealActivityType so that if the user stops and immediately starts again,
        // the step signal carries the correct activity type (e.g. "walking") even before Android
        // AR fires a new ENTER transition. currentActivityType is "unknown" during IDLE.
        MotionSessionController.onMovementDetected(
            confidence,
            MotionSessionController.lastKnownRealActivityType
        )
    }

    private fun handleAccelerometer(event: SensorEvent) {
        val magnitude = sqrt(
            event.values[0].toDouble().pow(2.0) +
                    event.values[1].toDouble().pow(2.0) +
                    event.values[2].toDouble().pow(2.0)
        ).toFloat()

        val deviation = abs(magnitude - SensorManager.GRAVITY_EARTH)

        synchronized(accelWindow) {
            accelWindow.add(deviation)
            val maxSize = when (MotionSessionController.currentState) {
                MotionState.IDLE, MotionState.POTENTIAL_STOP -> config.accelWindowSizeIdle
                else -> config.accelWindowSize
            }
            while (accelWindow.size > maxSize) {
                accelWindow.removeAt(0)
            }
        }

        val variance = computeVariance()

        // Track variance spike time for corroboration
        if (variance >= config.varianceStartThreshold) {
            lastVarianceSpikeTime = System.currentTimeMillis()
        }

        // Update stationary surface lock
        updateStationaryLock(variance)

        val confidence = computeConfidence(
            activityRecognitionActive = isActiveActivityType(),
            stepDetectedRecently = isStepRecent()
        )

        // Only emit start signals when not locked and variance is above the START threshold.
        // Use lastKnownRealActivityType for the same reason as in handleStepDetected — so
        // re-trigger works correctly after a stop when AR hasn't re-emitted an ENTER.
        if (!stationaryLockActive
            && variance >= config.varianceStartThreshold
            && confidence >= config.movementConfidenceThreshold
        ) {
            MotionSessionController.onMovementDetected(
                confidence,
                MotionSessionController.lastKnownRealActivityType
            )
        }

        Log.d(TAG, "Accel: variance=$variance cadence=${getCadence()} locked=$stationaryLockActive confidence=$confidence state=${MotionSessionController.currentState}")
    }

    private fun handleGyroscope(event: SensorEvent) {
        // Gyroscope data available for orientation filtering if needed.
        // Placeholder for future refinement — not currently used in confidence scoring.
    }

    // ── Stationary surface lock ───────────────────────────────────────────────

    /**
     * Engages or releases the stationary surface lock.
     *
     * Lock engages when:
     *   - Variance stays below [MotionConfig.stationaryLockVariance]
     *   - Cadence is zero (no steps in the measurement window)
     *   - Both conditions hold for [MotionConfig.stationaryLockDurationMs]
     *
     * Lock releases when:
     *   - Variance exceeds [MotionConfig.stationaryUnlockVariance]
     *
     * Only evaluated when state is IDLE.
     */
    private fun updateStationaryLock(variance: Float) {
        if (MotionSessionController.currentState != MotionState.IDLE) {
            // Clear lock candidate when not in IDLE; lock itself persists until variance unlocks it
            stationaryLockCandidateStart = 0L
            return
        }

        // Release condition takes priority
        if (stationaryLockActive) {
            if (variance > config.stationaryUnlockVariance) {
                stationaryLockActive = false
                stationaryLockCandidateStart = 0L
                Log.i(TAG, "Stationary lock released (variance=$variance)")
            }
            return
        }

        // Accumulate lock candidate time
        val noCadence = getCadence() == 0f
        val ultraLowVariance = variance < config.stationaryLockVariance

        if (ultraLowVariance && noCadence) {
            if (stationaryLockCandidateStart == 0L) {
                stationaryLockCandidateStart = System.currentTimeMillis()
            } else if (System.currentTimeMillis() - stationaryLockCandidateStart >= config.stationaryLockDurationMs) {
                stationaryLockActive = true
                Log.i(TAG, "Stationary lock engaged after ${config.stationaryLockDurationMs}ms of ultra-low variance + zero cadence")
            }
        } else {
            stationaryLockCandidateStart = 0L
        }
    }

    // ── Activity Recognition ──────────────────────────────────────────────────

    private fun startActivityRecognition() {
        try {
            val client = ActivityRecognition.getClient(appContext)
            val transitions = listOf(
                activityTransition(DetectedActivity.WALKING, ActivityTransition.ACTIVITY_TRANSITION_ENTER),
                activityTransition(DetectedActivity.WALKING, ActivityTransition.ACTIVITY_TRANSITION_EXIT),
                activityTransition(DetectedActivity.RUNNING, ActivityTransition.ACTIVITY_TRANSITION_ENTER),
                activityTransition(DetectedActivity.RUNNING, ActivityTransition.ACTIVITY_TRANSITION_EXIT),
                activityTransition(DetectedActivity.ON_BICYCLE, ActivityTransition.ACTIVITY_TRANSITION_ENTER),
                activityTransition(DetectedActivity.ON_BICYCLE, ActivityTransition.ACTIVITY_TRANSITION_EXIT),
                activityTransition(DetectedActivity.IN_VEHICLE, ActivityTransition.ACTIVITY_TRANSITION_ENTER),
                activityTransition(DetectedActivity.STILL, ActivityTransition.ACTIVITY_TRANSITION_ENTER),
            )
            val request = ActivityTransitionRequest(transitions)
            val pendingIntent = getActivityPendingIntent()

            client.requestActivityTransitionUpdates(request, pendingIntent)
                .addOnSuccessListener {
                    Log.i(TAG, "Activity Recognition registered successfully")
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "Failed to register Activity Recognition", e)
                }
        } catch (e: SecurityException) {
            Log.e(TAG, "ACTIVITY_RECOGNITION permission not granted", e)
        }
    }

    private fun stopActivityRecognition() {
        try {
            val client = ActivityRecognition.getClient(appContext)
            client.removeActivityTransitionUpdates(getActivityPendingIntent())
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping Activity Recognition", e)
        }
    }

    private fun getActivityPendingIntent(): PendingIntent {
        val intent = Intent(appContext, ActivityTransitionReceiver::class.java)
        return PendingIntent.getBroadcast(
            appContext,
            1001,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
    }

    private fun activityTransition(activityType: Int, transitionType: Int): ActivityTransition {
        return ActivityTransition.Builder()
            .setActivityType(activityType)
            .setActivityTransition(transitionType)
            .build()
    }

    /**
     * Called from [ActivityTransitionReceiver] when a transition event fires.
     * Maps Activity Recognition events to MotionSessionController signals.
     */
    fun onActivityTransitionDetected(type: Int, isEntering: Boolean) {
        Log.d(TAG, "Activity transition: type=$type, entering=$isEntering")

        when (type) {
            DetectedActivity.WALKING -> {
                if (isEntering) {
                    // If Activity Recognition reports WALKING, be more aggressive about
                    // releasing the stationary lock and nudging the state machine so
                    // re-trigger works even when sensors are still ramping up.
                    if (stationaryLockActive) {
                        stationaryLockActive = false
                        stationaryLockCandidateStart = 0L
                        Log.i(TAG, "Stationary lock force-released on AR WALKING ENTER")
                    }
                    lastActivityEnterTime = System.currentTimeMillis()
                    val conf = computeConfidence(activityRecognitionActive = true, stepDetectedRecently = isStepRecent())
                    if (!isDeviceStable()) {
                        MotionSessionController.onMovementDetected(conf, "walking")
                    } else {
                        Log.d(TAG, "AR WALKING ENTER while device stable — nudging state machine (variance=${getVariance()})")
                        // Use a slightly reduced confidence when device is stable to avoid false positives
                        MotionSessionController.onMovementDetected(conf * 0.8f, "walking")
                    }
                } else {
                    MotionSessionController.onMovementEnded("walking_exit")
                }
            }
            DetectedActivity.RUNNING -> {
                if (isEntering) {
                    if (stationaryLockActive) {
                        stationaryLockActive = false
                        stationaryLockCandidateStart = 0L
                        Log.i(TAG, "Stationary lock force-released on AR RUNNING ENTER")
                    }
                    lastActivityEnterTime = System.currentTimeMillis()
                    val conf = computeConfidence(activityRecognitionActive = true, stepDetectedRecently = isStepRecent())
                    if (!isDeviceStable()) {
                        MotionSessionController.onMovementDetected(conf, "running")
                    } else {
                        Log.d(TAG, "AR RUNNING ENTER while device stable — nudging state machine (variance=${getVariance()})")
                        MotionSessionController.onMovementDetected(conf * 0.8f, "running")
                    }
                } else {
                    MotionSessionController.onMovementEnded("running_exit")
                }
            }
            DetectedActivity.ON_BICYCLE -> {
                if (isEntering) {
                    if (stationaryLockActive) {
                        stationaryLockActive = false
                        stationaryLockCandidateStart = 0L
                        Log.i(TAG, "Stationary lock force-released on AR CYCLING ENTER")
                    }
                    lastActivityEnterTime = System.currentTimeMillis()
                    val conf = computeConfidence(activityRecognitionActive = true, stepDetectedRecently = false)
                    if (!isDeviceStable()) {
                        MotionSessionController.onMovementDetected(conf, "cycling")
                    } else {
                        Log.d(TAG, "AR CYCLING ENTER while device stable — nudging state machine (variance=${getVariance()})")
                        MotionSessionController.onMovementDetected(conf * 0.8f, "cycling")
                    }
                } else {
                    MotionSessionController.onMovementEnded("cycling_exit")
                }
            }
            DetectedActivity.IN_VEHICLE -> {
                if (isEntering) {
                    Log.i(TAG, "IN_VEHICLE detected — forcing stop immediately")
                    MotionSessionController.forceStop("vehicle_detected")
                }
            }
            DetectedActivity.STILL -> {
                if (isEntering) {
                    // STILL is an optional confirmation signal, not a standalone trigger.
                    // Nudge inactivity evaluation to check stop conditions.
                    MotionSessionController.onInactivityCheck()
                }
            }
        }
    }

    // ── Inactivity polling ────────────────────────────────────────────────────

    private fun scheduleInactivityCheck() {
        inactivityRunnable = object : Runnable {
            override fun run() {
                MotionSessionController.onInactivityCheck()
                sensorHandler?.postDelayed(this, config.inactivityCheckIntervalMs)
            }
        }
        sensorHandler?.postDelayed(inactivityRunnable!!, config.inactivityCheckIntervalMs)
    }

    private fun cancelInactivityCheck() {
        inactivityRunnable?.let { sensorHandler?.removeCallbacks(it) }
        inactivityRunnable = null
    }

    // ── Sensor registration ───────────────────────────────────────────────────

    private fun registerSensors(fullRate: Boolean) {
        val accelDelay = if (fullRate) {
            SensorManager.SENSOR_DELAY_GAME   // ~50 Hz
        } else {
            SensorManager.SENSOR_DELAY_NORMAL // ~5 Hz — battery saving
        }

        val handler = sensorHandler ?: return

        stepSensor?.let {
            sensorManager?.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL, handler)
        }
        accelSensor?.let {
            sensorManager?.registerListener(this, it, accelDelay, handler)
        }
        gyroSensor?.let {
            if (fullRate) {
                sensorManager?.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME, handler)
            }
            // Gyroscope disabled at low power
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun isStepRecent(): Boolean =
        (System.currentTimeMillis() - lastStepTime) < config.stepRecencyWindowMs

    private fun isActiveActivityType(): Boolean =
        MotionSessionController.lastKnownRealActivityType in listOf("walking", "running", "cycling")

    private fun computeVariance(): Float {
        synchronized(accelWindow) {
            if (accelWindow.isEmpty()) return 0f
            val mean = accelWindow.average().toFloat()
            return accelWindow.map { (it - mean).pow(2) }.average().toFloat()
        }
    }

    private fun computeConfidence(
        activityRecognitionActive: Boolean,
        stepDetectedRecently: Boolean
    ): Float {
        val variance = computeVariance()
        val sustainedMs = if (MotionSessionController.movementStartTime > 0) {
            System.currentTimeMillis() - MotionSessionController.movementStartTime
        } else {
            0L
        }

        return MovementConfidenceEngine.calculate(
            activityRecognitionActive = activityRecognitionActive,
            stepDetectedRecently = stepDetectedRecently,
            accelerometerVariance = variance,
            varianceThreshold = config.varianceStartThreshold,
            sustainedDurationMs = sustainedMs
        )
    }
}
