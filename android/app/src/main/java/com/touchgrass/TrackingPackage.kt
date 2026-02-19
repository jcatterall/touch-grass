package com.touchgrass

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class TrackingPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOfNotNull(
            ActivityRecognitionModule(reactContext),
            TrackingModule(reactContext),
            BuildConfigModule(reactContext),
            AppBlockerModule(reactContext),
            if (BuildConfig.DEBUG) GpxPlaybackModule(reactContext) else null,
        )
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
