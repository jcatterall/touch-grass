package com.touchgrass.tracking

/**
 * In-process runtime snapshot for modules that should not depend on MMKV polling.
 *
 * Stage 6: MMKV is a cross-process snapshot; in-process observers can use this.
 */
object TrackingRuntimeState {
    @Volatile
    var isTrackingActive: Boolean = false
}
