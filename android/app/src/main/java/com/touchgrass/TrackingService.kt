package com.touchgrass

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

class TrackingService : Service() {

    companion object {
        const val CHANNEL_ID = "touchgrass_tracking"
        const val NOTIFICATION_ID = 1001

        const val EXTRA_GOAL_TYPE = "goal_type"
        const val EXTRA_GOAL_VALUE = "goal_value"
        const val EXTRA_GOAL_UNIT = "goal_unit"
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

    private val binder = TrackingBinder()

    inner class TrackingBinder : Binder() {
        fun getService(): TrackingService = this@TrackingService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        goalType = intent?.getStringExtra(EXTRA_GOAL_TYPE) ?: "distance"
        goalValue = intent?.getDoubleExtra(EXTRA_GOAL_VALUE, 5000.0) ?: 5000.0
        goalUnit = intent?.getStringExtra(EXTRA_GOAL_UNIT) ?: "km"

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
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10_000L)
            .setMinUpdateIntervalMillis(5_000L)
            .setMinUpdateDistanceMeters(3f)
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
        } catch (e: SecurityException) {
            stopSelf()
        }
    }

    private fun processLocation(location: Location) {
        lastLocation?.let { prev ->
            val delta = prev.distanceTo(location)
            // Filter out GPS jumps (> 50m in one update is likely noise)
            if (delta < 50f) {
                distanceMeters += delta
            }
        }
        lastLocation = location

        elapsedSeconds = (System.currentTimeMillis() - startTimeMs) / 1000

        // Check goal
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

        updateNotification()
        onProgressUpdate?.invoke(distanceMeters, elapsedSeconds, goalReached)

        if (goalReached) {
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

    override fun onDestroy() {
        stopLocationUpdates()
        super.onDestroy()
    }
}
