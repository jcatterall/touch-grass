package com.touchgrass

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
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
            trackingService = null
            bound = false
        }
    }

    @ReactMethod
    fun startTracking(goalType: String, goalValue: Double, goalUnit: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = Intent(context, TrackingService::class.java).apply {
                putExtra(TrackingService.EXTRA_GOAL_TYPE, goalType)
                putExtra(TrackingService.EXTRA_GOAL_VALUE, goalValue)
                putExtra(TrackingService.EXTRA_GOAL_UNIT, goalUnit)
            }

            context.startForegroundService(intent)
            context.bindService(intent, connection, Context.BIND_AUTO_CREATE)

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopTracking(promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = Intent(context, TrackingService::class.java)
            context.stopService(intent)
            unbindService()
            promise.resolve(true)
        } catch (e: Exception) {
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
            } catch (_: Exception) {}
            trackingService = null
            bound = false
        }
    }

    private fun sendEvent(eventName: String, params: com.facebook.react.bridge.WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
}
