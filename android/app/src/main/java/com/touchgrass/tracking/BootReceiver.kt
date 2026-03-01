package com.touchgrass.tracking

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat
import com.touchgrass.MMKVStore

class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val actionName = intent.action ?: return
        val supported = setOf(
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_DATE_CHANGED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
        )
        if (actionName !in supported) return

        try {
            // Boot receivers can run in a fresh process where Application hasn't
            // initialized MMKV yet.
            MMKVStore.init(context.applicationContext)
        } catch (e: Exception) {
            Log.w(TAG, "Receiver action=$actionName failed to init MMKV", e)
            return
        }

        val idleEnabled = MMKVStore.isIdleMonitoringEnabled()
        if (idleEnabled) {
            Log.i(TAG, "Receiver action=$actionName restoring idle monitoring")
        } else {
            Log.i(TAG, "Receiver action=$actionName restoring sticky notification state")
        }

        val svcIntent = Intent(context, TrackingService::class.java).apply {
            action = if (idleEnabled) {
                TrackingConstants.ACTION_START_IDLE
            } else {
                TrackingConstants.ACTION_GOALS_UPDATED
            }
        }

        if (!TrackingPermissionGate.canStartForegroundTracking(context)) {
            Log.w(TAG, "Skipping TrackingService foreground start for action=$actionName: missing runtime HEALTH/LOCATION permissions")
            return
        }

        try {
            ContextCompat.startForegroundService(context, svcIntent)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to start TrackingService for action=$actionName", e)
        }
    }

}
