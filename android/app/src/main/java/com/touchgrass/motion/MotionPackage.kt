package com.touchgrass.motion

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * React Native package that registers MotionModule with the bridge.
 *
 * Add this to your MainApplication's getPackages():
 *
 *   override fun getPackages() = PackageList(this).packages.apply {
 *       add(MotionPackage())
 *   }
 */
class MotionPackage : ReactPackage {

    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): List<NativeModule> {
        return listOf(MotionModule(reactContext))
    }

    override fun createViewManagers(
        reactContext: ReactApplicationContext
    ): List<ViewManager<*, *>> {
        return emptyList()
    }
}
