package com.touchgrass

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
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
                .apply()

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun startBlocker(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, AppBlockerService::class.java)
            reactApplicationContext.startForegroundService(intent)
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
}
