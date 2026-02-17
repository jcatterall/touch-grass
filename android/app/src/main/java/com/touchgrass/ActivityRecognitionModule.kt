package com.touchgrass

import android.Manifest
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.location.ActivityRecognition

class ActivityRecognitionModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ActivityRecognitionModule"

    private var activityRecognitionPendingIntent: PendingIntent? = null

    @ReactMethod
    fun start(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                if (ContextCompat.checkSelfPermission(
                        reactApplicationContext,
                        Manifest.permission.ACTIVITY_RECOGNITION
                    ) != PackageManager.PERMISSION_GRANTED
                ) {
                    Log.w(TAG, "ACTIVITY_RECOGNITION permission not granted")
                    promise.reject("PERMISSION_DENIED", "ACTIVITY_RECOGNITION permission not granted")
                    return
                }
            }

            val intent = Intent(reactApplicationContext, ActivityUpdateReceiver::class.java).apply {
                action = ActivityUpdateReceiver.ACTION_ACTIVITY_UPDATE
            }
            activityRecognitionPendingIntent = PendingIntent.getBroadcast(
                reactApplicationContext,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            )

            val client = ActivityRecognition.getClient(reactApplicationContext)
            client.requestActivityUpdates(POLLING_INTERVAL_MS, activityRecognitionPendingIntent!!)
                .addOnSuccessListener {
                    Log.d(TAG, "Activity recognition updates registered (polling, 10s interval)")
                    promise.resolve(true)
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "Failed to register activity updates", e)
                    promise.reject("ERROR", e.message)
                }
        } catch (e: Exception) {
            Log.e(TAG, "Error starting activity recognition", e)
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            activityRecognitionPendingIntent?.let {
                val client = ActivityRecognition.getClient(reactApplicationContext)
                client.removeActivityUpdates(it)
                it.cancel()
                activityRecognitionPendingIntent = null
                Log.d(TAG, "Activity recognition updates removed")
            }
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping activity recognition", e)
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * For debug builds, allows triggering a fake activity update to test the receiver logic.
     * This now bypasses the receiver and directly invokes the headless service to accurately
     * simulate a background event.
     */
    @ReactMethod
    fun triggerTest(activityType: String, promise: Promise) {
        if (!BuildConfig.DEBUG) {
            promise.reject("UNAVAILABLE", "Test trigger is only available in debug builds.")
            return
        }

        try {
            val context = reactApplicationContext
            Log.d(TAG, "Triggering a background test for the HEADLESS TASK with activity: $activityType")

            // Directly start the headless service, bypassing the receiver,
            // to simulate what happens when the app is in the background.
            val serviceIntent = Intent(context, ActivityHeadlessTaskService::class.java).apply {
                val extras = Bundle().apply {
                    putString("activity", activityType.uppercase())
                    putString("transition", "ENTER")
                }
                putExtras(extras)
            }
            context.startService(serviceIntent)

            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to trigger headless task test", e)
            promise.reject("ERROR", e.message)
        }
    }


    /**
     * Emit a detected activity event to JS. Called from ActivityUpdateReceiver
     * when the React instance is alive.
     */
    fun emitActivityToJs(activity: String, confidence: Int) {
        if (!reactApplicationContext.hasActiveReactInstance()) {
            return
        }
        val params = Arguments.createMap().apply {
            putString("activity", activity)
            putInt("confidence", confidence)
        }
        sendEvent("onActivityDetected", params)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for NativeEventEmitter
    }

    private fun sendEvent(eventName: String, params: com.facebook.react.bridge.WritableMap) {
        try {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to send event $eventName", e)
        }
    }

    companion object {
        private const val TAG = "ActivityRecognition"
        private const val POLLING_INTERVAL_MS = 10_000L
    }
}