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
 *   - Step detector monitoring
 *   - Accelerometer variance calculation
 *   - Gyroscope data collection (optional smoothing)
 *   - Activity Recognition transition handling
 *   - Movement confidence scoring
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

    @Volatile
    private var running = false

    /** Synchronized rolling window of accelerometer deviation from gravity. */
    private val accelWindow: MutableList<Float> =
        Collections.synchronizedList(mutableListOf<Float>())

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
        registerSensors(fullRate = false)
        Log.d(TAG, "Sensors reduced to passive mode (IDLE). Monitoring for next movement.")
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
        lastStepTime = System.currentTimeMillis()
        Log.d(TAG, "Step detected at $lastStepTime")

        val confidence = computeConfidence(
            activityRecognitionActive = isActiveActivityType(),
            stepDetectedRecently = true
        )

        MotionSessionController.onMovementDetected(
            confidence,
            MotionSessionController.currentActivityType
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
        val confidence = computeConfidence(
            activityRecognitionActive = isActiveActivityType(),
            stepDetectedRecently = isStepRecent()
        )

        // Only emit start signals when variance is above the START threshold
        if (variance >= config.varianceStartThreshold && confidence >= config.movementConfidenceThreshold) {
            MotionSessionController.onMovementDetected(
                confidence,
                MotionSessionController.currentActivityType
            )
        }

        Log.d(TAG, "Accel: variance=$variance confidence=$confidence state=${MotionSessionController.currentState}")
    }

    private fun handleGyroscope(event: SensorEvent) {
        // Gyroscope data available for orientation filtering if needed.
        // Placeholder for future refinement — not currently used in confidence scoring.
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
                    val conf = computeConfidence(activityRecognitionActive = true, stepDetectedRecently = isStepRecent())
                    MotionSessionController.onMovementDetected(conf, "walking")
                } else {
                    MotionSessionController.onMovementEnded("walking_exit")
                }
            }
            DetectedActivity.RUNNING -> {
                if (isEntering) {
                    val conf = computeConfidence(activityRecognitionActive = true, stepDetectedRecently = isStepRecent())
                    MotionSessionController.onMovementDetected(conf, "running")
                } else {
                    MotionSessionController.onMovementEnded("running_exit")
                }
            }
            DetectedActivity.ON_BICYCLE -> {
                if (isEntering) {
                    val conf = computeConfidence(activityRecognitionActive = true, stepDetectedRecently = false)
                    MotionSessionController.onMovementDetected(conf, "cycling")
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
        MotionSessionController.currentActivityType in listOf("walking", "running", "cycling")

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
