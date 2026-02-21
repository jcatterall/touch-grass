package com.touchgrass.tracking

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.os.Looper
import android.util.Log
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

/**
 * Manages FusedLocationProviderClient lifecycle and GPS power-mode switching.
 *
 * Call [setMode] to switch between OFF / LOW_POWER / HIGH_ACCURACY / BALANCED.
 * Redundant mode switches (same mode requested twice) are ignored.
 * All location results are delivered to [onLocation].
 *
 * Location updates run on the main looper so the callback is always executed
 * on a predictable thread — TrackingController is not thread-safe.
 */
class GpsManager(
    context: Context,
    private val onLocation: (Location) -> Unit
) {

    private val TAG = "GpsManager"
    private val fused = LocationServices.getFusedLocationProviderClient(context)
    private var currentMode = GpsMode.OFF

    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            result.lastLocation?.let(onLocation)
        }
    }

    fun currentMode(): GpsMode = currentMode

    /**
     * Switch to a new GPS mode.
     * Removes any active updates first, then re-registers unless the new mode is OFF.
     */
    @SuppressLint("MissingPermission")
    fun setMode(mode: GpsMode) {
        if (mode == currentMode) return
        Log.d(TAG, "GPS mode: $currentMode → $mode")
        currentMode = mode

        fused.removeLocationUpdates(locationCallback)
        if (mode == GpsMode.OFF) return

        val (priority, intervalMs, minDistM) = when (mode) {
            GpsMode.HIGH_ACCURACY -> Triple(Priority.PRIORITY_HIGH_ACCURACY, 3_000L, 3f)
            GpsMode.LOW_POWER     -> Triple(Priority.PRIORITY_BALANCED_POWER_ACCURACY, 10_000L, 10f)
            GpsMode.BALANCED      -> Triple(Priority.PRIORITY_BALANCED_POWER_ACCURACY, 5_000L, 5f)
            GpsMode.OFF           -> return // already handled above
        }

        val request = LocationRequest.Builder(priority, intervalMs)
            .setMinUpdateIntervalMillis(intervalMs / 2)
            .setMinUpdateDistanceMeters(minDistM)
            .build()

        try {
            fused.requestLocationUpdates(request, locationCallback, Looper.getMainLooper())
            Log.d(TAG, "Location updates active: priority=$priority interval=${intervalMs}ms minDist=${minDistM}m")
        } catch (e: SecurityException) {
            Log.e(TAG, "Location permission denied — cannot start updates", e)
        }
    }

    /** Remove all location updates. Use when the service is destroyed. */
    fun stop() {
        fused.removeLocationUpdates(locationCallback)
        currentMode = GpsMode.OFF
        Log.d(TAG, "GPS stopped")
    }
}
