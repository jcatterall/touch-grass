package com.touchgrass.motion

/**
 * Abstraction for delivering motion start/stop signals to the tracking layer.
 *
 * Stage 5: Allows MotionEngine/MotionSessionController to run in-process without
 * intent IPC.
 */
interface MotionTrackingSink {
    fun onMotionStarted(activityType: String)
    fun onMotionStopped(activityType: String, reason: String)

    /**
     * Activity Recognition (AR) transition latch.
     * Called on ENTER/EXIT for WALKING/RUNNING/ON_BICYCLE.
     */
    fun onArActivityChanged(activityType: String, isActive: Boolean)
}
