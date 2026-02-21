package com.touchgrass.tracking

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.touchgrass.storage.SessionRepository
import com.touchgrass.motion.MotionService
import com.touchgrass.motion.MotionSessionController
import com.touchgrass.motion.MotionTrackingBridge
import com.touchgrass.MMKVStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class TrackingModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "TrackingModule"

    private var trackingService: TrackingService? = null
    private var bound = false

    /**
     * If TrackingService is already running when the module initialises (e.g. app
     * re-foregrounded while a background session is active), bind to it so that
     * progress events flow to JS immediately.
     */
    override fun initialize() {
        super.initialize()
        try {
            val intent = Intent(reactApplicationContext, TrackingService::class.java)
            val didBind = reactApplicationContext.bindService(intent, connection, 0)
            if (didBind) Log.d(TAG, "initialize: bound to already-running TrackingService")
        } catch (e: Exception) {
            Log.w(TAG, "initialize: could not bind to running service", e)
        }
    }

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as TrackingService.TrackingBinder
            val svc = binder.getService()
            trackingService = svc
            bound = true
            Log.d(TAG, "Service connected")

            svc.onProgressUpdate = { distance, elapsed, goalReached ->
                val params = Arguments.createMap().apply {
                    putDouble("distanceMeters", distance)
                    putDouble("elapsedSeconds", elapsed.toDouble())
                    putBoolean("goalReached", goalReached)
                }
                sendEvent("onTrackingProgress", params)
            }

            svc.onGoalReachedCallback = {
                sendEvent("onGoalReached", Arguments.createMap())
                unbindService()
            }

            svc.onTrackingStoppedCallback = {
                sendEvent("onTrackingStopped", Arguments.createMap())
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
                putExtra(TrackingConstants.EXTRA_GOAL_TYPE, goalType)
                putExtra(TrackingConstants.EXTRA_GOAL_VALUE, goalValue)
                putExtra(TrackingConstants.EXTRA_GOAL_UNIT, goalUnit)
            }

            Log.d(TAG, "Starting tracking: type=$goalType value=$goalValue unit=$goalUnit")
            context.startForegroundService(intent)
            context.bindService(intent, connection, Context.BIND_AUTO_CREATE)

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
            trackingService?.stopTracking()
            val context = reactApplicationContext
            context.stopService(Intent(context, TrackingService::class.java))
            unbindService()
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
            val result = Arguments.createMap().apply {
                putDouble("distanceMeters", service?.distanceMeters ?: 0.0)
                putDouble("elapsedSeconds", (service?.elapsedSeconds ?: 0L).toDouble())
                putBoolean("goalReached", service?.goalReached ?: false)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * Returns any unsaved session data from a previous run.
     * The new architecture holds sessions in-memory (SessionManager) with Room persistence
     * planned as a future extension. Returns null until persistence is wired.
     */
    @ReactMethod
    fun getUnsavedSession(promise: Promise) {
        promise.resolve(null)
    }

    /**
     * Returns today's accumulated distance/elapsed/goalsReached from Room.
     */
    @ReactMethod
    fun getDailyTotalNative(promise: Promise) {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val repo = SessionRepository(reactApplicationContext)
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val total = repo.getDailyTotal(today)
                if (total == null) {
                    promise.resolve(null)
                } else {
                    val result = Arguments.createMap().apply {
                        putDouble("distanceMeters", total.distanceMeters)
                        putDouble("elapsedSeconds", total.elapsedSeconds.toDouble())
                        putBoolean("goalsReached", total.goalsReached)
                    }
                    promise.resolve(result)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to get daily total", e)
                promise.reject("ERROR", e.message)
            }
        }
    }

    /**
     * Starts TrackingService in IDLE state and MotionService for background motion detection.
     * The MotionService signals TrackingService via MotionTrackingBridge when motion is detected.
     */
    @ReactMethod
    fun startIdleService(promise: Promise) {
        try {
            val context = reactApplicationContext

            MotionTrackingBridge.init(context)

            val trackingIntent = Intent(context, TrackingService::class.java).apply {
                action = TrackingConstants.ACTION_START_IDLE
            }
            ContextCompat.startForegroundService(context, trackingIntent)
            context.bindService(trackingIntent, connection, 0)

            MotionService.start(context)

            Log.d(TAG, "Idle service + MotionService started")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start idle service", e)
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * Stops the background idle/tracking service and motion detection.
     */
    @ReactMethod
    fun stopIdleService(promise: Promise) {
        try {
            val context = reactApplicationContext

            MotionService.stop(context)
            MotionSessionController.reset()

            val intent = Intent(context, TrackingService::class.java).apply {
                action = TrackingConstants.ACTION_STOP_BACKGROUND
            }
            context.startService(intent)
            unbindService()

            Log.d(TAG, "Idle service + MotionService stopped")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop idle service", e)
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun getIsAutoTracking(promise: Promise) {
        promise.resolve(MMKVStore.isAutoTracking())
    }

    @ReactMethod
    fun addListener(eventName: String) { /* Required for NativeEventEmitter */ }

    @ReactMethod
    fun removeListeners(count: Int) { /* Required for NativeEventEmitter */ }

    private fun unbindService() {
        if (bound) {
            try {
                trackingService?.onProgressUpdate = null
                trackingService?.onGoalReachedCallback = null
                trackingService?.onTrackingStoppedCallback = null
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
