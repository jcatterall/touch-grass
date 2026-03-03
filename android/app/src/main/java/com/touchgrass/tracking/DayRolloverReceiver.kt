package com.touchgrass.tracking

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat
import com.touchgrass.MMKVStore
import com.touchgrass.MMKVMetricsStore

class DayRolloverReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "DayRolloverReceiver"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != TrackingConstants.ACTION_DAY_ROLLOVER) return

        try {
            MMKVStore.init(context.applicationContext)
            MMKVMetricsStore.init(context.applicationContext)

            val previousDay = MMKVStore.getCurrentDay()
            if (previousDay.matches(Regex("\\d{4}-\\d{2}-\\d{2}"))) {
                MMKVMetricsStore.writePlanDayActivity(
                    previousDay,
                    MMKVStore.isPlanActiveToday(),
                )
            }

            MMKVStore.rolloverToTodayIfNeeded()
            MMKVStore.clearEmergencyUnblock()
            EmergencyUnblockScheduler.cancel(context)
            DayRolloverScheduler.scheduleNext(context)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to prime MMKV on rollover", e)
        }

        if (!TrackingPermissionGate.canStartForegroundTracking(context)) {
            return
        }

        try {
            val serviceIntent = Intent(context, TrackingService::class.java).apply {
                action = TrackingConstants.ACTION_DAY_ROLLOVER
            }
            ContextCompat.startForegroundService(context, serviceIntent)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to notify TrackingService for day rollover", e)
        }
    }
}
