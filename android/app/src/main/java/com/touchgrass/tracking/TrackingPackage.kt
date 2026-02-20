package com.touchgrass.tracking

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.touchgrass.BuildConfigModule
import com.touchgrass.AppBlockerModule
import com.touchgrass.BuildConfig

class TrackingPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOfNotNull(
            TrackingModule(reactContext),
            BuildConfigModule(reactContext),
            AppBlockerModule(reactContext),
        )
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
