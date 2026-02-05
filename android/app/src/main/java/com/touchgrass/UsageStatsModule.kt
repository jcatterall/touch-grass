package com.touchgrass

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.io.ByteArrayOutputStream
import java.util.Calendar

class UsageStatsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "UsageStatsModule"

    @ReactMethod
    fun hasPermission(promise: Promise) {
        try {
            val granted = checkUsageStatsPermission()
            promise.resolve(granted)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun requestPermission(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * Get daily usage stats for the past 7 days
     * Returns an array of objects with day name, hours, and minutes
     */
    @ReactMethod
    fun getWeeklyUsage(promise: Promise) {
        try {
            if (!checkUsageStatsPermission()) {
                promise.reject("PERMISSION_DENIED", "Usage stats permission not granted")
                return
            }

            val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val result: WritableArray = Arguments.createArray()

            val calendar = Calendar.getInstance()
            val dayNames = arrayOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")

            // Get stats for each of the past 7 days
            for (i in 6 downTo 0) {
                calendar.timeInMillis = System.currentTimeMillis()
                calendar.add(Calendar.DAY_OF_YEAR, -i)

                // Set to start of day
                calendar.set(Calendar.HOUR_OF_DAY, 0)
                calendar.set(Calendar.MINUTE, 0)
                calendar.set(Calendar.SECOND, 0)
                calendar.set(Calendar.MILLISECOND, 0)
                val startTime = calendar.timeInMillis

                // Set to end of day
                calendar.set(Calendar.HOUR_OF_DAY, 23)
                calendar.set(Calendar.MINUTE, 59)
                calendar.set(Calendar.SECOND, 59)
                calendar.set(Calendar.MILLISECOND, 999)
                val endTime = calendar.timeInMillis

                val stats = usageStatsManager.queryUsageStats(
                    UsageStatsManager.INTERVAL_DAILY,
                    startTime,
                    endTime
                )

                var totalTime: Long = 0
                stats?.forEach { usageStats ->
                    totalTime += usageStats.totalTimeInForeground
                }

                val totalMinutes = (totalTime / 1000 / 60).toInt()
                val hours = totalMinutes / 60
                val minutes = totalMinutes % 60

                val dayData: WritableMap = Arguments.createMap()
                dayData.putString("day", dayNames[calendar.get(Calendar.DAY_OF_WEEK) - 1])
                dayData.putInt("hours", hours)
                dayData.putInt("minutes", minutes)
                dayData.putInt("totalMinutes", totalMinutes)

                result.pushMap(dayData)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * Get app usage stats for the past 7 days
     * Returns an array of objects with app name, package name, and usage time
     */
    @ReactMethod
    fun getAppUsage(promise: Promise) {
        try {
            if (!checkUsageStatsPermission()) {
                promise.reject("PERMISSION_DENIED", "Usage stats permission not granted")
                return
            }

            val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val packageManager = reactApplicationContext.packageManager

            val calendar = Calendar.getInstance()
            calendar.add(Calendar.DAY_OF_YEAR, -7)
            val startTime = calendar.timeInMillis
            val endTime = System.currentTimeMillis()

            val stats = usageStatsManager.queryUsageStats(
                UsageStatsManager.INTERVAL_WEEKLY,
                startTime,
                endTime
            )

            // Aggregate usage by package
            val usageMap = mutableMapOf<String, Long>()
            stats?.forEach { usageStats ->
                if (usageStats.totalTimeInForeground > 0) {
                    val currentTotal = usageMap[usageStats.packageName] ?: 0L
                    usageMap[usageStats.packageName] = currentTotal + usageStats.totalTimeInForeground
                }
            }

            // Sort by usage time and get top apps
            val sortedApps = usageMap.entries
                .sortedByDescending { it.value }
                .take(10)

            val result: WritableArray = Arguments.createArray()

            for (entry in sortedApps) {
                val packageName = entry.key
                val totalTime = entry.value

                val totalMinutes = (totalTime / 1000 / 60).toInt()
                if (totalMinutes < 1) continue // Skip apps with less than 1 minute usage

                val hours = totalMinutes / 60
                val minutes = totalMinutes % 60

                var appName = packageName
                var iconBase64: String? = null

                try {
                    val appInfo = packageManager.getApplicationInfo(packageName, 0)
                    appName = packageManager.getApplicationLabel(appInfo).toString()

                    // Get the app icon
                    val icon = packageManager.getApplicationIcon(appInfo)
                    iconBase64 = drawableToBase64(icon)
                } catch (e: PackageManager.NameNotFoundException) {
                    // Keep packageName as appName, icon will be null
                }

                val appData: WritableMap = Arguments.createMap()
                appData.putString("name", appName)
                appData.putString("packageName", packageName)
                appData.putInt("hours", hours)
                appData.putInt("minutes", minutes)
                appData.putInt("totalMinutes", totalMinutes)
                appData.putString("time", formatTime(hours, minutes))
                if (iconBase64 != null) {
                    appData.putString("icon", iconBase64)
                }

                result.pushMap(appData)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * Get the number of times the device was unlocked/picked up today
     * Uses KEYGUARD_HIDDEN events primarily, with SCREEN_INTERACTIVE as fallback
     * (more reliable on emulators)
     */
    @ReactMethod
    fun getDailyPickups(promise: Promise) {
        try {
            if (!checkUsageStatsPermission()) {
                promise.reject("PERMISSION_DENIED", "Usage stats permission not granted")
                return
            }

            val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

            val calendar = Calendar.getInstance()
            calendar.set(Calendar.HOUR_OF_DAY, 0)
            calendar.set(Calendar.MINUTE, 0)
            calendar.set(Calendar.SECOND, 0)
            calendar.set(Calendar.MILLISECOND, 0)
            val startTime = calendar.timeInMillis
            val endTime = System.currentTimeMillis()

            val events = usageStatsManager.queryEvents(startTime, endTime)
            var keyguardCount = 0
            var screenOnCount = 0

            val event = UsageEvents.Event()
            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                when (event.eventType) {
                    18 -> keyguardCount++ // KEYGUARD_HIDDEN - device unlocked
                    15 -> screenOnCount++ // SCREEN_INTERACTIVE - screen turned on
                }
            }

            // Use keyguard count if available (real device), otherwise use screen on count (emulator)
            val pickupCount = if (keyguardCount > 0) keyguardCount else screenOnCount

            promise.resolve(pickupCount)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    private fun checkUsageStatsPermission(): Boolean {
        val appOps = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                reactApplicationContext.packageName
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                reactApplicationContext.packageName
            )
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun formatTime(hours: Int, minutes: Int): String {
        return if (hours > 0) {
            "${hours}h ${minutes}m"
        } else {
            "${minutes}m"
        }
    }

    private fun drawableToBase64(drawable: Drawable, size: Int = 96): String? {
        return try {
            val bitmap = if (drawable is BitmapDrawable) {
                drawable.bitmap
            } else {
                // Create bitmap from drawable
                val width = if (drawable.intrinsicWidth > 0) drawable.intrinsicWidth else size
                val height = if (drawable.intrinsicHeight > 0) drawable.intrinsicHeight else size
                val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                val canvas = Canvas(bitmap)
                drawable.setBounds(0, 0, canvas.width, canvas.height)
                drawable.draw(canvas)
                bitmap
            }

            // Scale down if needed for performance
            val scaledBitmap = if (bitmap.width > size || bitmap.height > size) {
                Bitmap.createScaledBitmap(bitmap, size, size, true)
            } else {
                bitmap
            }

            // Convert to base64
            val outputStream = ByteArrayOutputStream()
            scaledBitmap.compress(Bitmap.CompressFormat.PNG, 90, outputStream)
            val byteArray = outputStream.toByteArray()
            Base64.encodeToString(byteArray, Base64.NO_WRAP)
        } catch (e: Exception) {
            null
        }
    }
}
