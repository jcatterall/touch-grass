package com.touchgrass.tracking

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Binder
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.touchgrass.storage.SessionRepository
import com.touchgrass.motion.MotionTrackingBridge
import com.touchgrass.MMKVStore
import com.touchgrass.HeartbeatManager

/** GPS power modes — controlled by velocity signals. */
enum class GpsMode { OFF, LOW_POWER, HIGH_ACCURACY }

/** Service lifecycle states. IDLE = running, GPS off, waiting for motion. TRACKING = active GPS session. */
enum class ServiceState { IDLE, TRACKING }

class TrackingService : Service() {

    companion object {
        private const val TAG = "TrackingService"
        const val CHANNEL_ID = "touchgrass_tracking"
        const val NOTIFICATION_ID = 1001

        const val EXTRA_GOAL_TYPE = "goal_type"
        const val EXTRA_GOAL_VALUE = "goal_value"
        const val EXTRA_GOAL_UNIT = "goal_unit"

        // Only reset the inactivity timer for genuine movement.
        // GPS jitter when stationary is typically 2-6m; 10m safely clears that noise.
        private const val MOVEMENT_THRESHOLD_M = 10f

        // Passive inactivity fallback — fires if GPS stops delivering fixes entirely (e.g. deep indoors).
        private const val STOP_TIMEOUT_MS = 90_000L  // 90 seconds

        // After MotionTracker signals STOPPED, wait this long before ending the GPS session.
        // 30s absorbs a traffic-light pause that MotionTracker's auto-pause already filtered.
        private const val STATIONARY_BUFFER_MS = 30_000L

        // Number of consecutive GPS fixes with movement below MOVEMENT_THRESHOLD_M required
        // before the service arms the stationary buffer independently of MotionTracker.
        private const val IDLE_FIX_COUNT_THRESHOLD = 3

        // Vehicle speed threshold in km/h — above this, distance accumulation pauses.
        private const val VEHICLE_SPEED_KMH = 25f

        // Idle service lifecycle — used by toggleBackgroundTracking in JS.
        // START_IDLE: service enters low-power watch mode (GPS off, notification visible).
        // STOP_BACKGROUND: user disabled background tracking, stop the service entirely.
        const val ACTION_START_IDLE = "com.touchgrass.action.START_IDLE"
        const val ACTION_STOP_BACKGROUND = "com.touchgrass.action.STOP_BACKGROUND"

        // Sent by AppBlockerService when it starts/stops, so the shared notification
        // can reflect both tracking progress and blocker state in one slot.
        const val ACTION_BLOCKER_STARTED = "com.touchgrass.action.BLOCKER_STARTED"
        const val ACTION_BLOCKER_STOPPED = "com.touchgrass.action.BLOCKER_STOPPED"

        // Periodic elapsed flush interval — write delta to MMKV every 30s
        private const val ELAPSED_FLUSH_INTERVAL_MS = 30_000L

        private const val PREFS_NAME = "touchgrass_tracking_prefs"
        private const val PREF_DISTANCE = "unsaved_distance"
        private const val PREF_ELAPSED = "unsaved_elapsed"
        private const val PREF_GOAL_REACHED = "unsaved_goal_reached"
        private const val PREF_DATE = "unsaved_date"
    }

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var sessionRepository: SessionRepository
    private var locationCallback: LocationCallback? = null
    private var lastLocation: Location? = null

    // Current GPS power mode — transitions driven by velocity signals.
    private var currentGpsMode = GpsMode.OFF

    // Tracking state
    var distanceMeters: Double = 0.0
        private set
    var elapsedSeconds: Long = 0
        private set
    var goalReached: Boolean = false
        private set

    private var goalType: String = "distance"
    private var goalValue: Double = 5000.0
    private var goalUnit: String = "km"
    private var startTimeMs: Long = 0

    // Counts consecutive GPS fixes where movement was below MOVEMENT_THRESHOLD_M.
    private var consecutiveIdleFixes: Int = 0

    // Service state: IDLE = running but GPS off (waiting for motion signal from MotionTracker)
    //               TRACKING = GPS active, distance accumulating
    private var serviceState = ServiceState.IDLE

    private var onProgressUpdate: ((Double, Long, Boolean) -> Unit)? = null
    private var onGoalReachedCallback: (() -> Unit)? = null
    private var onTrackingStoppedCallback: (() -> Unit)? = null
    private var lastNotificationUpdateMs: Long = 0

    // Set to true while AppBlockerService is running so the shared notification
    // can show blocker state without a second notification appearing.
    private var blockerActive: Boolean = false

    // Periodic elapsed flush — write delta to MMKV every 30s so elapsed survives process kill
    private var lastFlushedElapsedSeconds: Long = 0
    private var lastElapsedFlushMs: Long = 0

    private val handler = Handler(Looper.getMainLooper())

    // Passive fallback: fires if GPS stops delivering fixes (indoors / GPS blocked).
    private val stopTimeoutRunnable = Runnable {
        Log.d(TAG, "Stop-detection: no GPS fixes for ${STOP_TIMEOUT_MS / 1000}s")
        stationaryBufferRunnable.run()
    }

    // Stationary buffer — armed when MotionTracker signals MOTION_STOPPED or GPS idles out.
    private val stationaryBufferRunnable = Runnable {
        Log.d(TAG, "Stationary buffer expired (${STATIONARY_BUFFER_MS / 1000}s) — ending session")
        val wasTracking = serviceState == ServiceState.TRACKING
        if (wasTracking) {
            val finalElapsed = if (startTimeMs > 0) (System.currentTimeMillis() - startTimeMs) / 1000 else 0L
            val unflushed = finalElapsed - lastFlushedElapsedSeconds
            if (unflushed > 0) MMKVStore.accumulateTodayElapsed(unflushed)
            sessionRepository.closeSession(distanceMeters, elapsedSeconds, goalReached)
            saveSessionToPrefs()
        }
        Log.d(TAG, "Returning to IDLE state after session end")
        serviceState = ServiceState.IDLE
        distanceMeters = 0.0
        elapsedSeconds = 0
        lastFlushedElapsedSeconds = 0
        goalReached = false
        lastLocation = null
        consecutiveIdleFixes = 0
        startTimeMs = 0
        MMKVStore.setAutoTracking(false)
        if (wasTracking) onTrackingStoppedCallback?.invoke()
        val notification = buildNotification()
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, notification)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private val binder = TrackingBinder()

    inner class TrackingBinder : Binder() {
        fun getService(): TrackingService = this@TrackingService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        sessionRepository = SessionRepository(this)
        createNotificationChannel()
        Log.d(TAG, "Service created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            // ---- Idle lifecycle (background tracking enabled/disabled from JS) ----

            ACTION_START_IDLE -> {
                // Enter low-power watch mode: foreground service running, GPS off.
                // MotionTracker (via MotionTrackingBridge) will signal when motion is detected.
                Log.d(TAG, "Entering IDLE state — MotionTracker will signal when motion detected")
                serviceState = ServiceState.IDLE
                MMKVStore.setAutoTracking(false)
                val notification = buildNotification()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
                } else {
                    startForeground(NOTIFICATION_ID, notification)
                }
                HeartbeatManager.schedule(this)
                return START_STICKY
            }

            ACTION_STOP_BACKGROUND -> {
                Log.d(TAG, "Stopping background tracking service")
                stopSelf()
                return START_NOT_STICKY
            }

            ACTION_BLOCKER_STARTED -> {
                blockerActive = true
                Log.d(TAG, "Blocker started — refreshing notification")
                refreshNotification()
                return START_STICKY
            }

            ACTION_BLOCKER_STOPPED -> {
                blockerActive = false
                Log.d(TAG, "Blocker stopped — refreshing notification")
                refreshNotification()
                return START_STICKY
            }

            // ---- MotionTracker bridge: motion detected (walking/running/cycling) ----

            MotionTrackingBridge.ACTION_MOTION_STARTED -> {
                val activityType = intent.getStringExtra(MotionTrackingBridge.EXTRA_ACTIVITY_TYPE) ?: "walking"
                Log.d(TAG, "MotionTracker MOTION_STARTED ($activityType)")
                if (serviceState == ServiceState.IDLE) {
                    // Service is IDLE — transition to TRACKING
                    Log.d(TAG, "IDLE → TRACKING: motion detected by MotionTracker")
                    startTrackingSession(goalType, goalValue, goalUnit, "auto")
                } else if (serviceState == ServiceState.TRACKING) {
                    // Already TRACKING — cancel any pending stationary buffer, keep GPS alive
                    Log.d(TAG, "Already TRACKING — cancelling stationary buffer, resuming GPS")
                    consecutiveIdleFixes = 0
                    handler.removeCallbacks(stationaryBufferRunnable)
                    handler.removeCallbacks(stopTimeoutRunnable)
                    if (currentGpsMode == GpsMode.OFF) {
                        setGpsPriority(GpsMode.LOW_POWER)
                        handler.postDelayed(stopTimeoutRunnable, STOP_TIMEOUT_MS)
                    }
                }
                return START_STICKY
            }

            // ---- MotionTracker bridge: motion stopped (inactivity/vehicle/manual) ----

            MotionTrackingBridge.ACTION_MOTION_STOPPED -> {
                val reason = intent.getStringExtra(MotionTrackingBridge.EXTRA_STOP_REASON) ?: "inactivity_timeout"
                Log.d(TAG, "MotionTracker MOTION_STOPPED reason=$reason")
                if (serviceState == ServiceState.TRACKING) {
                    Log.d(TAG, "TRACKING → arming stationary buffer (${STATIONARY_BUFFER_MS / 1000}s)")
                    handler.removeCallbacks(stopTimeoutRunnable)
                    handler.removeCallbacks(stationaryBufferRunnable)
                    setGpsPriority(GpsMode.OFF)
                    handler.postDelayed(stationaryBufferRunnable, STATIONARY_BUFFER_MS)
                }
                return START_STICKY
            }

            // ---- Manual tracking start (from JS Play button) ----

            else -> {
                val type = intent?.getStringExtra(EXTRA_GOAL_TYPE) ?: "distance"
                val value = intent?.getDoubleExtra(EXTRA_GOAL_VALUE, 5000.0) ?: 5000.0
                val unit = intent?.getStringExtra(EXTRA_GOAL_UNIT) ?: "km"
                Log.d(TAG, "Manual tracking start: type=$type value=$value unit=$unit")
                startTrackingSession(type, value, unit, "manual")
                return START_STICKY
            }
        }
    }

    /** Shared init for both manual and auto tracking sessions. */
    private fun startTrackingSession(type: String, value: Double, unit: String, mode: String) {
        serviceState = ServiceState.TRACKING
        goalType = type
        goalValue = value
        goalUnit = unit
        distanceMeters = 0.0
        elapsedSeconds = 0
        lastFlushedElapsedSeconds = 0
        lastElapsedFlushMs = 0
        goalReached = false
        lastLocation = null
        consecutiveIdleFixes = 0
        startTimeMs = System.currentTimeMillis()
        MMKVStore.setAutoTracking(true)

        sessionRepository.startSession(mode)

        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        setGpsPriority(GpsMode.LOW_POWER)
        HeartbeatManager.schedule(this)
    }

    fun setProgressListener(listener: ((Double, Long, Boolean) -> Unit)?) {
        onProgressUpdate = listener
    }

    fun setGoalReachedListener(listener: (() -> Unit)?) {
        onGoalReachedCallback = listener
    }

    fun setTrackingStoppedListener(listener: (() -> Unit)?) {
        onTrackingStoppedCallback = listener
    }

    // ---- GPS power management ----

    fun setGpsPriority(mode: GpsMode) {
        if (mode == currentGpsMode) return
        Log.d(TAG, "GPS mode: $currentGpsMode → $mode")
        currentGpsMode = mode
        when (mode) {
            GpsMode.OFF -> stopLocationUpdatesOnly()
            GpsMode.LOW_POWER -> restartLocationUpdates(
                priority = Priority.PRIORITY_BALANCED_POWER_ACCURACY,
                intervalMs = 10_000L,
                minDistanceM = 15f,
            )
            GpsMode.HIGH_ACCURACY -> restartLocationUpdates(
                priority = Priority.PRIORITY_HIGH_ACCURACY,
                intervalMs = 5_000L,
                minDistanceM = 5f,
            )
        }
    }

    private fun restartLocationUpdates(priority: Int, intervalMs: Long, minDistanceM: Float) {
        locationCallback?.let { fusedLocationClient.removeLocationUpdates(it) }

        val req = LocationRequest.Builder(priority, intervalMs)
            .setMinUpdateIntervalMillis(intervalMs / 2)
            .setMinUpdateDistanceMeters(minDistanceM)
            .build()

        val cb = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                for (location in result.locations) processLocation(location)
            }
        }
        locationCallback = cb

        try {
            fusedLocationClient.requestLocationUpdates(req, cb, Looper.getMainLooper())
            handler.removeCallbacks(stopTimeoutRunnable)
            handler.postDelayed(stopTimeoutRunnable, STOP_TIMEOUT_MS)
            Log.d(TAG, "Location updates started: priority=$priority interval=${intervalMs}ms")
        } catch (e: SecurityException) {
            Log.e(TAG, "Location permission denied, stopping", e)
            stopSelf()
        }
    }

    /** Stop GPS updates without clearing the locationCallback reference. */
    private fun stopLocationUpdatesOnly() {
        locationCallback?.let { fusedLocationClient.removeLocationUpdates(it) }
        handler.removeCallbacks(stopTimeoutRunnable)
    }

    // ---- Location processing ----

    private fun processLocation(location: Location) {
        val speedMs = if (location.hasSpeed()) location.speed else 0f
        val speedKmh = speedMs * 3.6f

        // Vehicle filter: speed > 25 km/h → pause distance accumulation.
        if (speedKmh > VEHICLE_SPEED_KMH) {
            if (currentGpsMode != GpsMode.LOW_POWER) setGpsPriority(GpsMode.LOW_POWER)
            lastLocation = location
            Log.d(TAG, "Vehicle speed (${speedKmh}km/h) — distance paused")
            return
        }

        // Velocity-based GPS quality switching
        val targetMode = if (speedKmh > 6f) GpsMode.HIGH_ACCURACY else GpsMode.LOW_POWER
        if (targetMode != currentGpsMode) setGpsPriority(targetMode)

        lastLocation?.let { prev ->
            val delta = prev.distanceTo(location)

            val effectiveFilter = maxOf(10f, speedMs * 1.5f)
            val maxPlausibleDelta = maxOf(200f, location.accuracy * 10f)

            if (delta >= effectiveFilter && delta < maxPlausibleDelta) {
                distanceMeters += delta
                MMKVStore.accumulateTodayDistance(delta.toDouble())
                MMKVStore.setAutoTracking(true)
                sessionRepository.accumulateDaily(delta.toDouble(), 0L, false)
            } else if (delta >= maxPlausibleDelta) {
                Log.d(TAG, "Filtered GPS jump: ${delta}m (accuracy: ${location.accuracy}m)")
            }

            // GPS-fix-based idle detection
            if (delta >= MOVEMENT_THRESHOLD_M) {
                consecutiveIdleFixes = 0
                handler.removeCallbacks(stopTimeoutRunnable)
                handler.removeCallbacks(stationaryBufferRunnable)
                handler.postDelayed(stopTimeoutRunnable, STOP_TIMEOUT_MS)
            } else {
                consecutiveIdleFixes++
                Log.d(TAG, "Idle fix #$consecutiveIdleFixes (delta=${delta}m, threshold=$MOVEMENT_THRESHOLD_M)")
                if (consecutiveIdleFixes >= IDLE_FIX_COUNT_THRESHOLD) {
                    Log.d(TAG, "GPS-fix idle threshold reached ($IDLE_FIX_COUNT_THRESHOLD fixes) — arming stationary buffer")
                    handler.removeCallbacks(stopTimeoutRunnable)
                    handler.removeCallbacks(stationaryBufferRunnable)
                    setGpsPriority(GpsMode.OFF)
                    handler.postDelayed(stationaryBufferRunnable, STATIONARY_BUFFER_MS)
                    consecutiveIdleFixes = 0
                }
            }
        } ?: run {
            handler.removeCallbacks(stopTimeoutRunnable)
            handler.postDelayed(stopTimeoutRunnable, STOP_TIMEOUT_MS)
        }

        lastLocation = location

        elapsedSeconds = (System.currentTimeMillis() - startTimeMs) / 1000

        val nowMs = System.currentTimeMillis()
        if (nowMs - lastElapsedFlushMs >= ELAPSED_FLUSH_INTERVAL_MS) {
            lastElapsedFlushMs = nowMs
            val delta = elapsedSeconds - lastFlushedElapsedSeconds
            if (delta > 0) {
                MMKVStore.accumulateTodayElapsed(delta)
                lastFlushedElapsedSeconds = elapsedSeconds
            }
        }

        goalReached = when (goalType) {
            "distance" -> {
                val goalMeters = if (goalUnit == "mi") goalValue * 1609.34 else goalValue * 1000.0
                distanceMeters >= goalMeters
            }
            "time" -> {
                val goalSeconds = goalValue * 60.0
                elapsedSeconds >= goalSeconds
            }
            else -> false
        }

        val now = System.currentTimeMillis()
        if (now - lastNotificationUpdateMs >= 15_000 || goalReached) {
            lastNotificationUpdateMs = now
            updateNotification()
        }

        onProgressUpdate?.invoke(distanceMeters, elapsedSeconds, goalReached)

        if (goalReached) {
            Log.d(TAG, "Goal reached! distance=${distanceMeters}m elapsed=${elapsedSeconds}s")
            MMKVStore.setGoalsReached(true)
            onGoalReachedCallback?.invoke()
            setGpsPriority(GpsMode.OFF)
            stopSelf()
        }
    }

    // ---- Notification ----

    private fun buildNotification(): Notification {
        val (body, progress, max) = getNotificationContent()
        val title = when {
            goalReached -> "TouchGrass: Goal Reached!"
            else -> "TouchGrass is active"
        }
        val text = buildString {
            append(body)
            if (blockerActive) append(" · App blocker on")
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(!goalReached)
            .setColor(0xFF4F7942.toInt())
            .setProgress(max, progress, false)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun refreshNotification() {
        val notification = buildNotification()
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification)
    }

    private fun updateNotification() {
        refreshNotification()
    }

    private fun getNotificationContent(): Triple<String, Int, Int> {
        val goalType  = MMKVStore.getGoalType()
        val goalValue = MMKVStore.getGoalValue()

        return when (goalType) {
            "distance" -> {
                val goalMeters = goalValue
                // getTodayDistance() already accumulates the current session's distance
                // on every GPS fix (via accumulateTodayDistance). Do NOT add distanceMeters
                // again — that would double-count the current session.
                val displayDist = MMKVStore.getTodayDistance()
                val currentDisplay = if (displayDist >= 1000) {
                    String.format("%.1fkm", displayDist / 1000.0)
                } else {
                    String.format("%.0fm", displayDist)
                }
                val goalDisplay = if (goalMeters >= 1000) {
                    String.format("%.1fkm", goalMeters / 1000.0)
                } else {
                    String.format("%.0fm", goalMeters)
                }
                val progressVal = displayDist.toInt().coerceAtMost(goalMeters.toInt())
                Triple("$currentDisplay / $goalDisplay", progressVal, goalMeters.toInt())
            }
            "time" -> {
                val goalSec = goalValue.toLong()
                // getTodayElapsed() holds the flushed portion only (updated every 30s).
                // Add the unflushed remainder so the notification stays current.
                val todayElapsedSec = MMKVStore.getTodayElapsed()
                val displayElapsed = if (serviceState == ServiceState.TRACKING) {
                    todayElapsedSec + (elapsedSeconds - lastFlushedElapsedSeconds)
                } else {
                    todayElapsedSec
                }
                val elapsedMin = (displayElapsed / 60).toInt()
                val goalMin = (goalSec / 60).toInt()
                Triple(
                    "${elapsedMin}min / ${goalMin}min",
                    elapsedMin.coerceAtMost(goalMin),
                    goalMin
                )
            }
            else -> Triple("Watching for movement...", 0, 0)
        }
    }

    private fun createNotificationChannel() {
        val manager = getSystemService(NotificationManager::class.java)
        val trackingChannel = NotificationChannel(
            CHANNEL_ID,
            "TouchGrass",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Shows TouchGrass activity status and goal progress"
            setShowBadge(false)
        }
        manager.createNotificationChannel(trackingChannel)
    }

    private fun stopLocationUpdates() {
        handler.removeCallbacks(stopTimeoutRunnable)
        handler.removeCallbacks(stationaryBufferRunnable)
        locationCallback?.let {
            fusedLocationClient.removeLocationUpdates(it)
            locationCallback = null
        }
        currentGpsMode = GpsMode.OFF
    }

    private fun saveSessionToPrefs() {
        if (distanceMeters == 0.0 && elapsedSeconds == 0L) return

        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
            .format(java.util.Date())

        val existingDate = prefs.getString(PREF_DATE, null)
        val existingDistance = if (existingDate == today) {
            java.lang.Double.longBitsToDouble(prefs.getLong(PREF_DISTANCE, 0L))
        } else 0.0
        val existingElapsed = if (existingDate == today) prefs.getLong(PREF_ELAPSED, 0L) else 0L
        val existingGoal = if (existingDate == today) prefs.getBoolean(PREF_GOAL_REACHED, false) else false

        prefs.edit()
            .putString(PREF_DATE, today)
            .putLong(PREF_DISTANCE, java.lang.Double.doubleToRawLongBits(existingDistance + distanceMeters))
            .putLong(PREF_ELAPSED, existingElapsed + elapsedSeconds)
            .putBoolean(PREF_GOAL_REACHED, existingGoal || goalReached)
            .apply()

        Log.d(TAG, "Saved session to prefs: distance=${distanceMeters}m elapsed=${elapsedSeconds}s")
    }

    override fun onDestroy() {
        Log.d(TAG, "Service destroyed (state=$serviceState)")
        stopLocationUpdates()
        HeartbeatManager.cancel(this)
        if (serviceState == ServiceState.TRACKING && startTimeMs > 0) {
            val finalElapsed = (System.currentTimeMillis() - startTimeMs) / 1000
            val unflushed = finalElapsed - lastFlushedElapsedSeconds
            if (unflushed > 0) MMKVStore.accumulateTodayElapsed(unflushed)
        }
        MMKVStore.setAutoTracking(false)
        if (serviceState == ServiceState.TRACKING) {
            sessionRepository.closeSession(distanceMeters, elapsedSeconds, goalReached)
            saveSessionToPrefs()
        }
        super.onDestroy()
    }
}
