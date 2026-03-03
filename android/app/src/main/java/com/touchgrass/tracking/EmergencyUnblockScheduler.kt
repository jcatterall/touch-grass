package com.touchgrass.tracking

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.touchgrass.MMKVStore

object EmergencyUnblockScheduler {

    private const val REQUEST_CODE = 41022
    private const val TAG = "EmergencyUnblockScheduler"

    fun schedule(context: Context, untilMs: Long) {
        if (untilMs <= 0L) {
            cancel(context)
            return
        }

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val pendingIntent = pendingIntent(context)

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, untilMs, pendingIntent)
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, untilMs, pendingIntent)
            }
        } catch (e: SecurityException) {
            Log.w(TAG, "Exact emergency unblock alarm unavailable; falling back", e)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, untilMs, pendingIntent)
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, untilMs, pendingIntent)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to schedule emergency unblock alarm", e)
        }
    }

    fun cancel(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val pendingIntent = pendingIntent(context)
        try {
            alarmManager.cancel(pendingIntent)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to cancel emergency unblock alarm", e)
        }
    }

    fun syncWithStore(context: Context) {
        val appContext = context.applicationContext
        try {
            MMKVStore.init(appContext)
        } catch (_: Exception) {
            // best-effort, may already be initialized
        }

        val nowMs = System.currentTimeMillis()
        val status = try {
            MMKVStore.getEmergencyUnblockStatus(nowMs)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to read emergency unblock status during sync", e)
            cancel(appContext)
            return
        }

        if (status.active && status.untilMs > nowMs) {
            schedule(appContext, status.untilMs)
        } else {
            cancel(appContext)
        }
    }

    private fun pendingIntent(context: Context): PendingIntent {
        val intent = Intent(context, EmergencyUnblockExpiryReceiver::class.java).apply {
            action = TrackingConstants.ACTION_EMERGENCY_UNBLOCK_EXPIRED
        }
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        return PendingIntent.getBroadcast(context, REQUEST_CODE, intent, flags)
    }
}
