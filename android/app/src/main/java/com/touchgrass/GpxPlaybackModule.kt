package com.touchgrass

import android.location.Location
import android.location.LocationManager
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Debug-only module that injects mock GPS locations to simulate a 1km walk.
 * Used for end-to-end QA: verifies the full pipeline from GPS fix → distance accumulation
 * → daily goal completion → headless task trigger, without needing a physical device outdoors.
 *
 * Only registered in debug builds (see TrackingPackage). Returns an error in release builds.
 *
 * Usage from JS:
 *   GpxPlayback.startPlayback()  // injects 10 points, 100m apart, 5s interval
 *   GpxPlayback.stopPlayback()   // cancel early
 */
class GpxPlaybackModule(reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "GpxPlaybackModule"

    // 10 waypoints ~100m apart, forming a short loop near central London.
    // Each step is ~0.0009° latitude ≈ 100m.
    private val WALK_1KM = listOf(
        Pair(51.5074, -0.1278),
        Pair(51.5083, -0.1278),
        Pair(51.5092, -0.1278),
        Pair(51.5101, -0.1278),
        Pair(51.5110, -0.1278),
        Pair(51.5110, -0.1268),
        Pair(51.5101, -0.1268),
        Pair(51.5092, -0.1268),
        Pair(51.5083, -0.1268),
        Pair(51.5074, -0.1268),
    )

    private val handler = Handler(Looper.getMainLooper())
    private var playbackRunnable: Runnable? = null

    @ReactMethod
    fun startPlayback(promise: Promise) {
        if (!BuildConfig.DEBUG) {
            promise.reject("UNAVAILABLE", "GPX playback is only available in debug builds")
            return
        }

        stopPlaybackInternal()

        var index = 0
        val locationManager = reactApplicationContext
            .getSystemService(android.content.Context.LOCATION_SERVICE) as LocationManager

        try {
            locationManager.addTestProvider(
                LocationManager.GPS_PROVIDER,
                false, false, false, false, true, true, true,
                android.location.Criteria.POWER_LOW,
                android.location.Criteria.ACCURACY_FINE,
            )
            locationManager.setTestProviderEnabled(LocationManager.GPS_PROVIDER, true)
        } catch (_: Exception) {
            // Provider may already be registered — safe to continue
        }

        playbackRunnable = object : Runnable {
            override fun run() {
                if (index >= WALK_1KM.size) {
                    Log.d(TAG, "GPX playback complete — all ${WALK_1KM.size} waypoints injected")
                    stopPlaybackInternal()
                    return
                }
                val (lat, lon) = WALK_1KM[index]
                val mockLoc = Location(LocationManager.GPS_PROVIDER).apply {
                    latitude = lat
                    longitude = lon
                    accuracy = 5f
                    speed = 1.4f      // walking speed ~5 km/h
                    time = System.currentTimeMillis()
                    elapsedRealtimeNanos = SystemClock.elapsedRealtimeNanos()
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                        verticalAccuracyMeters = 3f
                    }
                }
                try {
                    locationManager.setTestProviderLocation(LocationManager.GPS_PROVIDER, mockLoc)
                    Log.d(TAG, "Injected waypoint $index: ($lat, $lon)")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to inject waypoint $index", e)
                }
                index++
                handler.postDelayed(this, STEP_INTERVAL_MS)
            }
        }
        handler.post(playbackRunnable!!)
        Log.d(TAG, "GPX playback started — ${WALK_1KM.size} waypoints, ${STEP_INTERVAL_MS}ms interval")
        promise.resolve(true)
    }

    @ReactMethod
    fun stopPlayback(promise: Promise) {
        stopPlaybackInternal()
        promise.resolve(true)
    }

    private fun stopPlaybackInternal() {
        playbackRunnable?.let { handler.removeCallbacks(it) }
        playbackRunnable = null
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    companion object {
        private const val TAG = "GpxPlayback"
        private const val STEP_INTERVAL_MS = 5_000L   // one waypoint every 5s (real walking pace)
    }
}
