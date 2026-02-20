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
 * Core sensor engine that monitors accelerometer, step detector, and
 * Activity Recognition API to produce movement confidence scores.
 *
 * Thread-safety:
 *   - Sensor callbacks run on a dedicated HandlerThread ("MotionSensorThread").
 *   - Shared mutable state uses @Volatile or synchronized collections.
 *   - State machine mutations are delegated to MotionSessionController
 *     which serializes them on the main looper.
 *
 * Battery optimization:
 *   - AUTO_PAUSED reduces accelerometer to SENSOR_DELAY_NORMAL (~200ms).
 *   - STOPPED unregisters all sensors; only Activity Recognition remains.
 *   - The rolling variance window shrinks during AUTO_PAUSED.
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

    // ── Thread-safe shared state ────────────────────────────────

    @Volatile
    private var lastStepTime: Long = 0L

    @Volatile
    private var running = false

    /** Synchronized rolling window of accelerometer deviation from gravity. */
    private val accelWindow: MutableList<Float> =
        Collections.synchronizedList(mutableListOf<Float>())

    private var config: MotionConfig = MotionConfig()

    // ── Public API ──────────────────────────────────────────────

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

        // Start sensor handler thread
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

    // ── Battery optimization callbacks from MotionSessionController ─

    /** Reduce sensor rate when auto-paused. */
    fun onAutoPaused() {
        sensorManager?.unregisterListener(this)
        registerSensors(fullRate = false)
        Log.d(TAG, "Sensors reduced to low-power mode (AUTO_PAUSED)")
    }

    /** Restore full sensor rate when movement resumes. */
    fun onResumed() {
        sensorManager?.unregisterListener(this)
        registerSensors(fullRate = true)
        Log.d(TAG, "Sensors restored to full rate (MOVING)")
    }

    /** Unregister sensors on stop. Activity Recognition stays active. */
    fun onStopped() {
        sensorManager?.unregisterListener(this)
        accelWindow.clear()
        Log.d(TAG, "Sensors unregistered (STOPPED). Activity Recognition still active.")
    }

    // ── SensorEventListener ─────────────────────────────────────

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

    // ── Sensor handlers ─────────────────────────────────────────

    private fun handleStepDetected() {
        lastStepTime = System.currentTimeMillis()

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
            val maxSize = if (MotionSessionController.currentState == MotionState.AUTO_PAUSED) {
                config.accelWindowSizePaused
            } else {
                config.accelWindowSize
            }
            while (accelWindow.size > maxSize) {
                accelWindow.removeAt(0)
            }
        }

        val confidence = computeConfidence(
            activityRecognitionActive = isActiveActivityType(),
            stepDetectedRecently = isStepRecent()
        )

        if (confidence >= config.movementConfidenceThreshold) {
            MotionSessionController.onMovementDetected(
                confidence,
                MotionSessionController.currentActivityType
            )
        }
    }

    private fun handleGyroscope(event: SensorEvent) {
        // Gyroscope data can be used to filter out orientation changes vs. actual locomotion.
        // Placeholder for future refinement.
    }

    // ── Activity Recognition ────────────────────────────────────

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
                activityTransition(DetectedActivity.STILL, ActivityTransition.ACTIVITY_TRANSITION_ENTER)
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
     */
    fun onActivityTransitionDetected(type: Int, isEntering: Boolean) {
        Log.d(TAG, "Activity transition: type=$type, entering=$isEntering")

        when (type) {
            DetectedActivity.WALKING -> {
                if (isEntering) {
                    val conf = computeConfidence(activityRecognitionActive = true, stepDetectedRecently = isStepRecent())
                    MotionSessionController.onMovementDetected(conf, "walking")
                }
            }
            DetectedActivity.RUNNING -> {
                if (isEntering) {
                    val conf = computeConfidence(activityRecognitionActive = true, stepDetectedRecently = isStepRecent())
                    MotionSessionController.onMovementDetected(conf, "running")
                }
            }
            DetectedActivity.ON_BICYCLE -> {
                if (isEntering) {
                    val conf = computeConfidence(activityRecognitionActive = true, stepDetectedRecently = false)
                    MotionSessionController.onMovementDetected(conf, "cycling")
                }
            }
            DetectedActivity.IN_VEHICLE -> {
                if (isEntering) {
                    Log.i(TAG, "IN_VEHICLE detected — forcing stop")
                    MotionSessionController.forceStop("vehicle_detected")
                }
            }
            DetectedActivity.STILL -> {
                if (isEntering) {
                    MotionSessionController.onInactivityDetected()
                }
            }
        }
    }

    // ── Inactivity polling ──────────────────────────────────────

    private fun scheduleInactivityCheck() {
        inactivityRunnable = object : Runnable {
            override fun run() {
                MotionSessionController.onInactivityDetected()
                sensorHandler?.postDelayed(this, config.inactivityCheckInterval)
            }
        }
        sensorHandler?.postDelayed(inactivityRunnable!!, config.inactivityCheckInterval)
    }

    private fun cancelInactivityCheck() {
        inactivityRunnable?.let { sensorHandler?.removeCallbacks(it) }
        inactivityRunnable = null
    }

    // ── Sensor registration ─────────────────────────────────────

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
            // Gyroscope only useful at full rate
            if (fullRate) {
                sensorManager?.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME, handler)
            }
        }
    }

    // ── Helpers ──────────────────────────────────────────────────

    private fun isStepRecent(): Boolean {
        return (System.currentTimeMillis() - lastStepTime) < config.stepRecencyWindow
    }

    private fun isActiveActivityType(): Boolean {
        return MotionSessionController.currentActivityType in listOf("walking", "running", "cycling")
    }

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
            varianceThreshold = config.varianceThreshold,
            sustainedDurationMs = sustainedMs
        )
    }
}
