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

class TrackingService : Service() {

    companion object {
        private const val TAG = "TrackingService"
        const val CHANNEL_ID = "touchgrass_tracking"
        const val NOTIFICATION_ID = 1001

        const val EXTRA_GOAL_TYPE = "goal_type"
        const val EXTRA_GOAL_VALUE = "goal_value"
        const val EXTRA_GOAL_UNIT = "goal_unit"

        private const val PREFS_NAME = "touchgrass_tracking_prefs"
        private const val PREF_DISTANCE = "unsaved_distance"
        private const val PREF_ELAPSED = "unsaved_elapsed"
        private const val PREF_GOAL_REACHED = "unsaved_goal_reached"
        private const val PREF_DATE = "unsaved_date"
    }

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var locationCallback: LocationCallback? = null
    private var lastLocation: Location? = null

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

    private var onProgressUpdate: ((Double, Long, Boolean) -> Unit)? = null
    private var onGoalReachedCallback: (() -> Unit)? = null
    private var lastNotificationUpdateMs: Long = 0

    private val binder = TrackingBinder()

    inner class TrackingBinder : Binder() {
        fun getService(): TrackingService = this@TrackingService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()
        Log.d(TAG, "Service created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        goalType = intent?.getStringExtra(EXTRA_GOAL_TYPE) ?: "distance"
        goalValue = intent?.getDoubleExtra(EXTRA_GOAL_VALUE, 5000.0) ?: 5000.0
        goalUnit = intent?.getStringExtra(EXTRA_GOAL_UNIT) ?: "km"

        Log.d(TAG, "Starting: type=$goalType value=$goalValue unit=$goalUnit")

        distanceMeters = 0.0
        elapsedSeconds = 0
        goalReached = false
        lastLocation = null
        startTimeMs = System.currentTimeMillis()

        val notification = buildNotification()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        startLocationUpdates()

        return START_STICKY
    }

    fun setProgressListener(listener: ((Double, Long, Boolean) -> Unit)?) {
        onProgressUpdate = listener
    }

    fun setGoalReachedListener(listener: (() -> Unit)?) {
        onGoalReachedCallback = listener
    }

    private fun startLocationUpdates() {
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, 15_000L)
            .setMinUpdateIntervalMillis(10_000L)
            .setMinUpdateDistanceMeters(5f)
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                for (location in result.locations) {
                    processLocation(location)
                }
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback!!,
                Looper.getMainLooper()
            )
            Log.d(TAG, "Location updates started")
        } catch (e: SecurityException) {
            Log.e(TAG, "Location permission denied, stopping", e)
            stopSelf()
        }
    }

    private fun processLocation(location: Location) {
        lastLocation?.let { prev ->
            val delta = prev.distanceTo(location)
            if (delta < 50f) {
                distanceMeters += delta
            } else {
                Log.d(TAG, "Filtered GPS jump: ${delta}m")
            }
        }
        lastLocation = location

        elapsedSeconds = (System.currentTimeMillis() - startTimeMs) / 1000

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

        // Throttle notification updates to every 15s to reduce overhead
        val now = System.currentTimeMillis()
        if (now - lastNotificationUpdateMs >= 15_000 || goalReached) {
            lastNotificationUpdateMs = now
            updateNotification()
        }

        onProgressUpdate?.invoke(distanceMeters, elapsedSeconds, goalReached)

        if (goalReached) {
            Log.d(TAG, "Goal reached! distance=${distanceMeters}m elapsed=${elapsedSeconds}s")
            onGoalReachedCallback?.invoke()
            stopLocationUpdates()
            stopSelf()
        }
    }

    private fun buildNotification(): Notification {
        val (body, progress, max) = getNotificationContent()

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("TouchGrass: Goal in Progress")
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setColor(0xFF4F7942.toInt()) // meadowGreen
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
            .setColor(0xFF4F7942.toInt()) // meadowGreen
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

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Activity Tracking",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Shows progress toward your walking goal"
            setShowBadge(false)
        }
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)
    }

    private fun stopLocationUpdates() {
        locationCallback?.let {
            fusedLocationClient.removeLocationUpdates(it)
            locationCallback = null
        }
    }

    /**
     * Save final session progress to SharedPreferences so it can be
     * picked up by JS on next app open — covers the case where the
     * service ran in the background with no JS to persist to AsyncStorage.
     */
    private fun saveSessionToPrefs() {
        if (distanceMeters == 0.0 && elapsedSeconds == 0L) return

        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
            .format(java.util.Date())

        // Accumulate if there's already an unsaved session from today
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
        Log.d(TAG, "Service destroyed")
        stopLocationUpdates()
        saveSessionToPrefs()
        super.onDestroy()
    }
}
