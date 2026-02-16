package com.touchgrass

import android.content.Intent
import android.os.Bundle
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Boots the React Native JS engine in the background to run the
 * "TouchGrassActivityTask" headless task. This allows the app to
 * evaluate plans and start tracking even when the app UI is killed.
 */
class ActivityHeadlessTaskService : HeadlessJsTaskService() {

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val extras: Bundle = intent?.extras ?: return null

        val data = Arguments.createMap().apply {
            putString("activity", extras.getString("activity", "UNKNOWN"))
            putString("transition", extras.getString("transition", "UNKNOWN"))
        }

        return HeadlessJsTaskConfig(
            "TouchGrassActivityTask",
            data,
            30_000L, // 30 second timeout
            true     // allow task to run in foreground
        )
    }
}
