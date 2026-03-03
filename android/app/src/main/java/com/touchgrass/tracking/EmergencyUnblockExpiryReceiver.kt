package com.touchgrass.tracking

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat
import com.touchgrass.MMKVStore

class EmergencyUnblockExpiryReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "EmergencyUnblockExpiryRx"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != TrackingConstants.ACTION_EMERGENCY_UNBLOCK_EXPIRED) return

        val appContext = context.applicationContext
        val nowMs = System.currentTimeMillis()

        try {
            MMKVStore.init(appContext)
            MMKVStore.getEmergencyUnblockStatus(nowMs)
            EmergencyUnblockScheduler.syncWithStore(appContext)
        } catch (e: Exception) {
            Log.w(TAG, "Failed handling emergency-unblock expiry", e)
        }

        if (!TrackingPermissionGate.canStartForegroundTracking(appContext)) {
            return
        }

        try {
            val serviceIntent = Intent(appContext, TrackingService::class.java).apply {
                action = TrackingConstants.ACTION_GOALS_UPDATED
            }
            ContextCompat.startForegroundService(appContext, serviceIntent)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to notify TrackingService on emergency expiry", e)
        }
    }
}
