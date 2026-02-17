package com.touchgrass

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class TrackingModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "TrackingModule"

    private var trackingService: TrackingService? = null
    private var bound = false

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as TrackingService.TrackingBinder
            trackingService = binder.getService()
            bound = true
            Log.d(TAG, "Service connected")

            trackingService?.setProgressListener { distance, elapsed, goalReached ->
                val params = Arguments.createMap().apply {
                    putDouble("distanceMeters", distance)
                    putDouble("elapsedSeconds", elapsed.toDouble())
                    putBoolean("goalReached", goalReached)
                }
                sendEvent("onTrackingProgress", params)
            }

            trackingService?.setGoalReachedListener {
                val params = Arguments.createMap()
                sendEvent("onGoalReached", params)
                unbindService()
            }
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            Log.d(TAG, "Service disconnected")
            trackingService = null
            bound = false
        }
    }

    @ReactMethod
    fun startTracking(goalType: String, goalValue: Double, goalUnit: String, promise: Promise) {
        if (bound && trackingService != null) {
            Log.d(TAG, "Already tracking, ignoring duplicate start")
            promise.resolve(true)
            return
        }

        try {
            val context = reactApplicationContext
            val intent = Intent(context, TrackingService::class.java).apply {
                putExtra(TrackingService.EXTRA_GOAL_TYPE, goalType)
                putExtra(TrackingService.EXTRA_GOAL_VALUE, goalValue)
                putExtra(TrackingService.EXTRA_GOAL_UNIT, goalUnit)
            }

            Log.d(TAG, "Starting tracking: type=$goalType value=$goalValue unit=$goalUnit")
            context.startForegroundService(intent)
            context.bindService(intent, connection, Context.BIND_AUTO_CREATE)

            // Notify JS that tracking has started, so the UI can sync
            sendEvent("onTrackingStarted", Arguments.createMap())

            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start tracking", e)
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopTracking(promise: Promise) {
        try {
            Log.d(TAG, "Stopping tracking")
            val context = reactApplicationContext
            val intent = Intent(context, TrackingService::class.java)
            context.stopService(intent)
            unbindService()

            // Clear SharedPreferences so onDestroy's save doesn't get
            // double-counted — JS handles persistence via saveAndResetSession
            context.getSharedPreferences("touchgrass_tracking_prefs", Context.MODE_PRIVATE)
                .edit().clear().apply()

            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop tracking", e)
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun getProgress(promise: Promise) {
        try {
            val service = trackingService
            if (service == null) {
                val result = Arguments.createMap().apply {
                    putDouble("distanceMeters", 0.0)
                    putDouble("elapsedSeconds", 0.0)
                    putBoolean("goalReached", false)
                }
                promise.resolve(result)
                return
            }
            val result = Arguments.createMap().apply {
                putDouble("distanceMeters", service.distanceMeters)
                putDouble("elapsedSeconds", service.elapsedSeconds.toDouble())
                putBoolean("goalReached", service.goalReached)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * Returns any unsaved session data from SharedPreferences (written by
     * TrackingService.onDestroy when the service ran without JS) and clears it.
     * Returns null fields if nothing is pending.
     */
    @ReactMethod
    fun getUnsavedSession(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(
                "touchgrass_tracking_prefs", Context.MODE_PRIVATE
            )
            val date = prefs.getString("unsaved_date", null)
            if (date == null) {
                promise.resolve(null)
                return
            }

            val result = Arguments.createMap().apply {
                putString("date", date)
                putDouble("distanceMeters",
                    java.lang.Double.longBitsToDouble(prefs.getLong("unsaved_distance", 0L)))
                putDouble("elapsedSeconds", prefs.getLong("unsaved_elapsed", 0L).toDouble())
                putBoolean("goalsReached", prefs.getBoolean("unsaved_goal_reached", false))
            }

            // Clear after reading
            prefs.edit().clear().apply()
            Log.d(TAG, "Retrieved and cleared unsaved session for $date")

            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get unsaved session", e)
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for NativeEventEmitter
    }

    private fun unbindService() {
        if (bound) {
            try {
                trackingService?.setProgressListener(null)
                trackingService?.setGoalReachedListener(null)
                reactApplicationContext.unbindService(connection)
            } catch (e: Exception) {
                Log.w(TAG, "Error unbinding service", e)
            }
            trackingService = null
            bound = false
        }
    }

    private fun sendEvent(eventName: String, params: com.facebook.react.bridge.WritableMap) {
        try {
            if (!reactApplicationContext.hasActiveReactInstance()) return
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to send event $eventName", e)
        }
    }

    companion object {
        private const val TAG = "TrackingModule"
    }
}