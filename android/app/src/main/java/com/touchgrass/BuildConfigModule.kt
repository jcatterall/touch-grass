package com.touchgrass

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

class BuildConfigModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String = "BuildConfigModule"

    override fun getConstants(): Map<String, Any> = mapOf(
        "REVENUECAT_API_KEY" to BuildConfig.REVENUECAT_API_KEY
    )
}
