package com.touchgrass

import android.app.AppOpsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Process
import android.provider.Settings
import android.provider.Settings.Secure
import android.view.WindowInsets
import android.view.WindowInsetsController
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.UiThreadUtil
import androidx.core.content.ContextCompat
import com.touchgrass.tracking.TrackingPermissionGate
import org.json.JSONArray

class AppBlockerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AppBlockerModule"

    @ReactMethod
    fun hasOverlayPermission(promise: Promise) {
        promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
    }

    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        try {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                android.net.Uri.parse("package:${reactApplicationContext.packageName}")
            )
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun hasUsageStatsPermission(promise: Promise) {
        val appOps = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = appOps.unsafeCheckOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            reactApplicationContext.packageName
        )
        promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
    }

    @ReactMethod
    fun requestUsageStatsPermission(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun updateBlockerConfig(blockedPackages: ReadableArray, goalsReached: Boolean, hasPermanent: Boolean, promise: Promise) {
        try {
            val jsonArr = JSONArray()
            for (i in 0 until blockedPackages.size()) {
                jsonArr.put(blockedPackages.getString(i))
            }

            reactApplicationContext.getSharedPreferences(
                AppBlockerService.PREFS_NAME, Context.MODE_PRIVATE
            ).edit()
                .putString(AppBlockerService.PREF_BLOCKED_PACKAGES, jsonArr.toString())
                .putBoolean(AppBlockerService.PREF_GOALS_REACHED, goalsReached)
                .putBoolean(AppBlockerService.PREF_HAS_PERMANENT, hasPermanent)
                .putString(AppBlockerService.PREF_CONFIG_DAY, MMKVStore.todayKey())
                .putLong(AppBlockerService.PREF_CONFIG_UPDATED_AT_MS, System.currentTimeMillis())
                .apply()

            // Mirror the blocked package count into MMKV so native notifications
            // can synchronously read the number of blocked apps without bridge overhead.
            try {
                MMKVStore.setBlockedCount(blockedPackages.size())
            } catch (e: Exception) {
                // Non-fatal — log and continue
            }
            // Also notify TrackingService to refresh its persistent notification
            try {
                if (canStartTrackingForeground()) {
                    val intent = Intent(reactApplicationContext, com.touchgrass.tracking.TrackingService::class.java).apply {
                        action = com.touchgrass.tracking.TrackingConstants.ACTION_GOALS_UPDATED
                    }
                    ContextCompat.startForegroundService(reactApplicationContext, intent)
                }
            } catch (e: Exception) {
                // best-effort
            }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun startBlocker(promise: Promise) {
        try {
            // Ensure TrackingService is running so there's a single sticky notification.
            // ACTION_GOALS_UPDATED refreshes the existing notification without enabling motion.
            try {
                if (canStartTrackingForeground()) {
                    val trackingIntent = Intent(reactApplicationContext, com.touchgrass.tracking.TrackingService::class.java).apply {
                        action = com.touchgrass.tracking.TrackingConstants.ACTION_GOALS_UPDATED
                    }
                    ContextCompat.startForegroundService(reactApplicationContext, trackingIntent)
                }
            } catch (_: Exception) {
                // best-effort
            }

            val intent = Intent(reactApplicationContext, AppBlockerService::class.java)
            reactApplicationContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopBlocker(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, AppBlockerService::class.java)
            reactApplicationContext.stopService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun getCurrentlyBlockedApp(promise: Promise) {
        val prefs = reactApplicationContext.getSharedPreferences(
            AppBlockerService.PREFS_NAME, Context.MODE_PRIVATE
        )
        promise.resolve(prefs.getString(AppBlockerService.PREF_CURRENTLY_BLOCKED, null))
    }

    @ReactMethod
    fun clearCurrentlyBlockedApp(promise: Promise) {
        reactApplicationContext.getSharedPreferences(
            AppBlockerService.PREFS_NAME, Context.MODE_PRIVATE
        ).edit()
            .remove(AppBlockerService.PREF_CURRENTLY_BLOCKED)
            .apply()
        promise.resolve(true)
    }

    @ReactMethod
    fun hasNotificationListenerPermission(promise: Promise) {
        try {
            val enabledListeners = Secure.getString(
                reactApplicationContext.contentResolver,
                "enabled_notification_listeners"
            ) ?: ""
            val componentName = ComponentName(
                reactApplicationContext,
                NotificationBlockListenerService::class.java
            ).flattenToString()
            promise.resolve(enabledListeners.contains(componentName))
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun requestNotificationListenerPermission(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun getNotificationsBlockedTodayForApp(packageName: String, promise: Promise) {
        try {
            promise.resolve(MMKVStore.getTodayNotificationsBlockedForApp(packageName))
        } catch (e: Exception) {
            promise.resolve(0)
        }
    }

    @ReactMethod
    fun getNotificationsBlockedTodayTotal(promise: Promise) {
        try {
            promise.resolve(MMKVStore.getTodayNotificationsBlockedTotal())
        } catch (e: Exception) {
            promise.resolve(0)
        }
    }

    @ReactMethod
    fun setImmersiveMode(enabled: Boolean, promise: Promise) {
        UiThreadUtil.runOnUiThread {
            try {
                val activity = getCurrentActivity() ?: run {
                    promise.resolve(false)
                    return@runOnUiThread
                }
                val controller: WindowInsetsController? = activity.window.insetsController
                if (controller != null) {
                    if (enabled) {
                        controller.hide(WindowInsets.Type.navigationBars())
                        controller.systemBarsBehavior =
                            WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                    } else {
                        controller.show(WindowInsets.Type.navigationBars())
                    }
                }
                promise.resolve(true)
            } catch (e: Exception) {
                promise.resolve(false)
            }
        }
    }

    @ReactMethod
    fun dismissBlockingScreen(promise: Promise) {
        try {
            // Clear the blocked state so the service stops re-launching
            reactApplicationContext.getSharedPreferences(
                AppBlockerService.PREFS_NAME, Context.MODE_PRIVATE
            ).edit()
                .remove(AppBlockerService.PREF_CURRENTLY_BLOCKED)
                .apply()

            // Send user to the home screen (minimizes the app)
            val intent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    private fun canStartTrackingForeground(): Boolean {
        return TrackingPermissionGate.canStartForegroundTracking(reactApplicationContext)
    }
}
