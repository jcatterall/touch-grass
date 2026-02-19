package com.touchgrass

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
import com.touchgrass.db.SessionRepository

/** GPS power modes — controlled by velocity and activity recognition signals. */
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

        // Passive inactivity fallback — fires if GPS stops delivering fixes (e.g. indoors).
        private const val STOP_TIMEOUT_MS = 5 * 60 * 1000L

        // After STILL is confirmed by ActivityRecognition, wait this long before shutting down.
        // 120 seconds covers traffic lights and brief stationary pauses (per QA spec).
        private const val STATIONARY_BUFFER_MS = 120_000L

        // Vehicle speed threshold in km/h — above this, distance accumulation pauses.
        private const val VEHICLE_SPEED_KMH = 25f

        // Intent actions sent by ActivityUpdateReceiver to signal motion state changes
        // mid-session. Handled at the top of onStartCommand before any session re-init.
        const val ACTION_STILL_DETECTED = "com.touchgrass.action.STILL_DETECTED"
        const val ACTION_MOTION_DETECTED = "com.touchgrass.action.MOTION_DETECTED"

        // Idle service lifecycle — used by toggleBackgroundTracking in JS.
        // START_IDLE: service enters low-power watch mode (GPS off, notification visible).
        // START_AUTO_TRACKING: activity recognition detected motion, begin tracking session.
        // STOP_BACKGROUND: user disabled background tracking, stop the service entirely.
        const val ACTION_START_IDLE = "com.touchgrass.action.START_IDLE"
        const val ACTION_START_AUTO_TRACKING = "com.touchgrass.action.START_AUTO_TRACKING"
        const val ACTION_STOP_BACKGROUND = "com.touchgrass.action.STOP_BACKGROUND"

        // Separate notification channel + ID for idle state (low importance, no sound).
        const val IDLE_CHANNEL_ID = "touchgrass_idle"
        const val IDLE_NOTIFICATION_ID = 1002

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

    // Current GPS power mode — transitions driven by velocity and activity signals.
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

    // Service state: IDLE = running but GPS off (waiting for motion signal)
    //               TRACKING = GPS active, distance accumulating
    private var serviceState = ServiceState.IDLE

    private var onProgressUpdate: ((Double, Long, Boolean) -> Unit)? = null
    private var onGoalReachedCallback: (() -> Unit)? = null
    private var lastNotificationUpdateMs: Long = 0

    // Periodic elapsed flush — write delta to MMKV every 30s so elapsed survives process kill
    private var lastFlushedElapsedSeconds: Long = 0
    private var lastElapsedFlushMs: Long = 0

    private val handler = Handler(Looper.getMainLooper())

    // Passive fallback: fires if GPS stops delivering fixes (indoors / GPS blocked).
    // Returns to IDLE rather than stopping, so the service stays alive for the next
    // motion event without needing a startForegroundService() call from the receiver.
    private val stopTimeoutRunnable = Runnable {
        Log.d(TAG, "Stop-detection: no GPS fixes for ${STOP_TIMEOUT_MS / 1000}s")
        stationaryBufferRunnable.run()  // shared session-end + return-to-idle logic
    }

    // 120-second stationary buffer — armed when ActivityRecognition signals STILL.
    // GPS is turned off immediately on STILL; the service waits 120s to confirm the
    // user isn't just pausing at a traffic light before ending the session.
    // If background tracking is still enabled, returns to IDLE instead of stopping.
    private val stationaryBufferRunnable = Runnable {
        Log.d(TAG, "Stationary buffer expired (${STATIONARY_BUFFER_MS / 1000}s) — ending session")
        val wasTracking = serviceState == ServiceState.TRACKING
        if (wasTracking) {
            // Persist the completed session
            val finalElapsed = if (startTimeMs > 0) (System.currentTimeMillis() - startTimeMs) / 1000 else 0L
            val unflushed = finalElapsed - lastFlushedElapsedSeconds
            if (unflushed > 0) MMKVStore.accumulateTodayElapsed(unflushed)
            sessionRepository.closeSession(distanceMeters, elapsedSeconds, goalReached)
            saveSessionToPrefs()
        }
        // Return to IDLE — service stays alive for next motion event.
        // This avoids any future startService() calls from the receiver.
        Log.d(TAG, "Returning to IDLE state after session end")
        serviceState = ServiceState.IDLE
        distanceMeters = 0.0
        elapsedSeconds = 0
        lastFlushedElapsedSeconds = 0
        goalReached = false
        lastLocation = null
        startTimeMs = 0
        MMKVStore.setAutoTracking(false)
        val notification = buildIdleNotification()
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(IDLE_NOTIFICATION_ID, notification)
        // Cancel the tracking notification (different ID)
        manager.cancel(NOTIFICATION_ID)
        // Re-issue as IDLE foreground notification
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(IDLE_NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(IDLE_NOTIFICATION_ID, notification)
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
                // GPS will be started when ActivityUpdateReceiver signals motion.
                Log.d(TAG, "Entering IDLE state — watching for motion")
                serviceState = ServiceState.IDLE
                MMKVStore.setAutoTracking(false)
                val notification = buildIdleNotification()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(IDLE_NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
                } else {
                    startForeground(IDLE_NOTIFICATION_ID, notification)
                }
                HeartbeatManager.schedule(this)
                return START_STICKY
            }

            ACTION_STOP_BACKGROUND -> {
                // User disabled background tracking — stop service entirely.
                Log.d(TAG, "Stopping background tracking service")
                stopSelf()
                return START_NOT_STICKY
            }

            ACTION_START_AUTO_TRACKING -> {
                // ActivityUpdateReceiver detected WALKING/RUNNING/CYCLING while IDLE.
                // Transition to active tracking — goal params may arrive later via
                // a concurrent headless task; for now track with defaults.
                Log.d(TAG, "IDLE → TRACKING: motion detected by activity recognition")
                startTrackingSession(
                    type = intent.getStringExtra(EXTRA_GOAL_TYPE) ?: goalType,
                    value = intent.getDoubleExtra(EXTRA_GOAL_VALUE, goalValue),
                    unit = intent.getStringExtra(EXTRA_GOAL_UNIT) ?: goalUnit,
                    mode = "auto",
                )
                return START_STICKY
            }

            // ---- Mid-session signals from ActivityUpdateReceiver ----

            ACTION_STILL_DETECTED -> {
                if (serviceState == ServiceState.TRACKING) {
                    Log.d(TAG, "STILL_DETECTED: GPS off, arming 120s stationary buffer")
                    handler.removeCallbacks(stopTimeoutRunnable)
                    handler.removeCallbacks(stationaryBufferRunnable)
                    setGpsPriority(GpsMode.OFF)
                    handler.postDelayed(stationaryBufferRunnable, STATIONARY_BUFFER_MS)
                } else {
                    Log.d(TAG, "STILL_DETECTED while IDLE — no-op")
                }
                return START_STICKY
            }

            ACTION_MOTION_DETECTED -> {
                if (serviceState == ServiceState.TRACKING) {
                    Log.d(TAG, "MOTION_DETECTED: stationary buffer cancelled, GPS restarting")
                    handler.removeCallbacks(stationaryBufferRunnable)
                    handler.removeCallbacks(stopTimeoutRunnable)
                    setGpsPriority(GpsMode.LOW_POWER)
                    handler.postDelayed(stopTimeoutRunnable, STOP_TIMEOUT_MS)
                } else if (serviceState == ServiceState.IDLE) {
                    // Motion detected while idle — same as START_AUTO_TRACKING.
                    Log.d(TAG, "MOTION_DETECTED while IDLE → transitioning to TRACKING")
                    startTrackingSession(goalType, goalValue, goalUnit, "auto")
                }
                return START_STICKY
            }

            // ---- Manual tracking start (from JS Play button) ----

            else -> {
                // No specific action = manual start from TrackingModule.startTracking().
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

    // ---- GPS power management ----

    /**
     * Switch GPS to the requested power mode. No-ops if already in that mode.
     * OFF = remove all location updates (battery saving during STILL periods).
     * LOW_POWER = balanced accuracy at 10s / 15m (walking).
     * HIGH_ACCURACY = high accuracy at 5s / 5m (running/cycling).
     */
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
        // Remove existing callback before registering a new one
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
            // Arm passive fallback timer — resets on every genuine movement fix
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
        // Keep GPS running at LOW_POWER to maintain awareness but skip distance.
        if (speedKmh > VEHICLE_SPEED_KMH) {
            if (currentGpsMode != GpsMode.LOW_POWER) setGpsPriority(GpsMode.LOW_POWER)
            lastLocation = location
            Log.d(TAG, "Vehicle speed (${speedKmh}km/h) — distance paused")
            return
        }

        // Velocity-based GPS quality switching (only while tracking)
        val targetMode = if (speedKmh > 6f) GpsMode.HIGH_ACCURACY else GpsMode.LOW_POWER
        if (targetMode != currentGpsMode) setGpsPriority(targetMode)

        lastLocation?.let { prev ->
            val delta = prev.distanceTo(location)

            // Elastic distance filter: scale minimum countable movement with speed.
            //   Walking  ~1.4 m/s → effectiveFilter = max(10, 2.1)  = 10m
            //   Running  ~4 m/s   → effectiveFilter = max(10, 6.0)  = 10m
            //   Cycling  ~10 m/s  → effectiveFilter = max(10, 15.0) = 15m
            val effectiveFilter = maxOf(10f, speedMs * 1.5f)

            // Sanity guard: drop implausible GPS teleportation jumps.
            val maxPlausibleDelta = maxOf(200f, location.accuracy * 10f)

            if (delta >= effectiveFilter && delta < maxPlausibleDelta) {
                distanceMeters += delta
                MMKVStore.accumulateTodayDistance(delta.toDouble())
                MMKVStore.setAutoTracking(true)
                sessionRepository.accumulateDaily(delta.toDouble(), 0L, false)
            } else if (delta >= maxPlausibleDelta) {
                Log.d(TAG, "Filtered GPS jump: ${delta}m (accuracy: ${location.accuracy}m)")
            }

            // Only reset the inactivity timer for genuine movement (> jitter threshold).
            if (delta >= MOVEMENT_THRESHOLD_M) {
                handler.removeCallbacks(stopTimeoutRunnable)
                handler.removeCallbacks(stationaryBufferRunnable)
                handler.postDelayed(stopTimeoutRunnable, STOP_TIMEOUT_MS)
            }
        } ?: run {
            // First fix: arm the passive fallback timer.
            handler.removeCallbacks(stopTimeoutRunnable)
            handler.postDelayed(stopTimeoutRunnable, STOP_TIMEOUT_MS)
        }

        // Always advance lastLocation so the next genuine fix measures from a current position.
        lastLocation = location

        elapsedSeconds = (System.currentTimeMillis() - startTimeMs) / 1000

        // Flush elapsed delta to MMKV every 30s so elapsed time survives process kill.
        // Distance is already written on every fix; this closes the gap for elapsed.
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
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("TouchGrass: Goal in Progress")
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setColor(0xFF4F7942.toInt())
            .setProgress(max, progress, false)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .build()
    }

    private fun updateNotification() {
        val (body, progress, max) = getNotificationContent()
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(if (goalReached) "TouchGrass: Goal Reached!" else "TouchGrass: Goal in Progress")
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(!goalReached)
            .setColor(0xFF4F7942.toInt())
            .setProgress(max, progress, false)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .build()
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, notification)
    }

    private fun getNotificationContent(): Triple<String, Int, Int> {
        return when (goalType) {
            "distance" -> {
                val goalMeters = if (goalUnit == "mi") goalValue * 1609.34 else goalValue * 1000.0
                val currentDisplay = if (distanceMeters >= 1000) {
                    String.format("%.1fkm", distanceMeters / 1000.0)
                } else {
                    String.format("%.0fm", distanceMeters)
                }
                val goalDisplay = if (goalUnit == "mi") {
                    String.format("%.1fmi", goalValue)
                } else {
                    String.format("%.1fkm", goalValue)
                }
                Triple(
                    "$currentDisplay / $goalDisplay",
                    distanceMeters.toInt().coerceAtMost(goalMeters.toInt()),
                    goalMeters.toInt()
                )
            }
            "time" -> {
                val goalMinutes = goalValue.toInt()
                val elapsedMin = (elapsedSeconds / 60).toInt()
                Triple(
                    "${elapsedMin}min / ${goalMinutes}min",
                    elapsedMin.coerceAtMost(goalMinutes),
                    goalMinutes
                )
            }
            else -> Triple("Tracking...", 0, 100)
        }
    }

    private fun buildIdleNotification(): Notification {
        return NotificationCompat.Builder(this, IDLE_CHANNEL_ID)
            .setContentTitle("TouchGrass")
            .setContentText("Watching for movement...")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setColor(0xFF4F7942.toInt())
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun createNotificationChannel() {
        val manager = getSystemService(NotificationManager::class.java)

        // Tracking channel — shown during active GPS session
        val trackingChannel = NotificationChannel(
            CHANNEL_ID,
            "Activity Tracking",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Shows progress toward your walking goal"
            setShowBadge(false)
        }
        manager.createNotificationChannel(trackingChannel)

        // Idle channel — shown while waiting for motion, lowest possible visibility
        val idleChannel = NotificationChannel(
            IDLE_CHANNEL_ID,
            "Background Tracking",
            NotificationManager.IMPORTANCE_MIN
        ).apply {
            description = "TouchGrass is watching for movement in the background"
            setShowBadge(false)
        }
        manager.createNotificationChannel(idleChannel)
    }

    /** Stops GPS and cancels all pending timers. Used by setGpsPriority(OFF) and onDestroy. */
    private fun stopLocationUpdates() {
        handler.removeCallbacks(stopTimeoutRunnable)
        handler.removeCallbacks(stationaryBufferRunnable)
        locationCallback?.let {
            fusedLocationClient.removeLocationUpdates(it)
            locationCallback = null
        }
        currentGpsMode = GpsMode.OFF
    }

    /**
     * Save final session progress to SharedPreferences — backward-compat fallback so
     * useTracking.ts can recover sessions on the first open after upgrading from the
     * old pure-SharedPreferences path. Room (via sessionRepository.closeSession) is
     * the primary persistence now.
     */
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
            // Write only the unflushed remainder — the periodic flush already accumulated
            // the earlier portion to MMKV. Writing the full elapsed again would double-count.
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
