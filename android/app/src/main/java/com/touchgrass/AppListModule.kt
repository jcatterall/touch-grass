package com.touchgrass

import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.io.ByteArrayOutputStream

class AppListModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AppListModule"

    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val packageManager = reactApplicationContext.packageManager
            val apps = packageManager.getInstalledApplications(PackageManager.GET_META_DATA)

            val result: WritableArray = Arguments.createArray()

            for (app in apps) {
                // Skip apps without launcher intent (no UI)
                val launchIntent = packageManager.getLaunchIntentForPackage(app.packageName)
                if (launchIntent == null) continue

                // Skip self
                if (app.packageName == reactApplicationContext.packageName) continue

                val appInfo: WritableMap = Arguments.createMap()
                appInfo.putString("id", app.packageName)
                appInfo.putString("name", packageManager.getApplicationLabel(app).toString())
                appInfo.putString("packageName", app.packageName)
                appInfo.putBoolean("isSystemApp", (app.flags and ApplicationInfo.FLAG_SYSTEM) != 0)

                // Convert icon to Base64
                try {
                    val drawable = packageManager.getApplicationIcon(app.packageName)
                    val base64Icon = drawableToBase64(drawable)
                    if (base64Icon != null) {
                        appInfo.putString("icon", "data:image/png;base64,$base64Icon")
                    } else {
                        appInfo.putNull("icon")
                    }
                } catch (e: Exception) {
                    appInfo.putNull("icon")
                }

                result.pushMap(appInfo)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
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
