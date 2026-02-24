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
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        try {
            // Boot receivers can run in a fresh process where Application hasn't
            // initialized MMKV yet.
            MMKVStore.init(context.applicationContext)
        } catch (e: Exception) {
            Log.w(TAG, "Boot completed: failed to init MMKV — cannot restore idle monitoring", e)
            return
        }

        if (!MMKVStore.isIdleMonitoringEnabled()) {
            Log.d(TAG, "Boot completed: idle monitoring disabled — no-op")
            return
        }

        Log.i(TAG, "Boot completed: restoring idle monitoring")
        val svcIntent = Intent(context, TrackingService::class.java).apply {
            action = TrackingConstants.ACTION_START_IDLE
        }

        try {
            ContextCompat.startForegroundService(context, svcIntent)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to start TrackingService on boot", e)
        }
    }
}
