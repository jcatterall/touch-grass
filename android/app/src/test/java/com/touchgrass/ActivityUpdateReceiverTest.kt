package com.touchgrass

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.test.core.app.ApplicationProvider
import com.google.android.gms.location.DetectedActivity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows
import org.robolectric.annotation.Config

/**
 * Robolectric tests for ActivityUpdateReceiver routing logic.
 *
 * These tests mock ActivityRecognitionResult delivery via the test-activity
 * injection path (EXTRA_TEST_ACTIVITY_TYPE) to verify that:
 *   1. STILL while service running → ACTION_STILL_DETECTED sent to TrackingService
 *   2. WALKING while service not running → headless task (ActivityHeadlessTaskService) started
 *   3. IN_VEHICLE → no headless task started in any scenario
 *
 * Note: Since the real ActivityRecognitionResult format requires Google Play Services
 * bundled data, the tests drive the receiver via the test-injection path which bypasses
 * that parsing — this is the same path used by the in-app debug trigger button.
 */
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [33])
class ActivityUpdateReceiverTest {

    private val context: Context = ApplicationProvider.getApplicationContext()
    private val receiver = ActivityUpdateReceiver()

    // ---- helper: build a test-injection intent ----

    private fun testIntent(activityType: String): Intent =
        Intent(ActivityUpdateReceiver.ACTION_ACTIVITY_UPDATE).apply {
            putExtra(ActivityUpdateReceiver.EXTRA_TEST_ACTIVITY_TYPE, activityType)
        }

    // ---- helper: check if a service was started ----

    private fun lastStartedServiceClass(): String? {
        val shadow = Shadows.shadowOf(context)
        return shadow.nextStartedService?.component?.className
    }

    // ---- tests ----

    @Test
    fun `STILL detected while service running sends ACTION_STILL_DETECTED`() {
        // Simulate TrackingService appearing in running services
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val shadowAm = Shadows.shadowOf(am)
        val info = ActivityManager.RunningServiceInfo().apply {
            service = android.content.ComponentName(context, TrackingService::class.java)
        }
        shadowAm.setRunningServiceInfo(listOf(info))

        receiver.onReceive(context, testIntent("STILL"))

        val started = Shadows.shadowOf(context).nextStartedService
        assertNotNull("Expected a service intent to be started", started)
        assertEquals(
            "Expected ACTION_STILL_DETECTED to be sent to TrackingService",
            TrackingService.ACTION_STILL_DETECTED,
            started?.action,
        )
    }

    @Test
    fun `WALKING detected with service not running launches headless task`() {
        // No running services — TrackingService is not active
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        Shadows.shadowOf(am).setRunningServiceInfo(emptyList())

        receiver.onReceive(context, testIntent("WALKING"))

        val started = Shadows.shadowOf(context).nextStartedService
        assertNotNull("Expected headless task service to be started", started)
        assertEquals(
            "Expected ActivityHeadlessTaskService to be launched",
            ActivityHeadlessTaskService::class.java.name,
            started?.component?.className,
        )
    }

    @Test
    fun `IN_VEHICLE never starts a headless task`() {
        // Ensure service is not running
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        Shadows.shadowOf(am).setRunningServiceInfo(emptyList())

        receiver.onReceive(context, testIntent("IN_VEHICLE"))

        val started = Shadows.shadowOf(context).nextStartedService
        assertNull(
            "IN_VEHICLE should never start a headless task or any service",
            started,
        )
    }

    @Test
    fun `IN_VEHICLE with service running sends no intent`() {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val shadowAm = Shadows.shadowOf(am)
        val info = ActivityManager.RunningServiceInfo().apply {
            service = android.content.ComponentName(context, TrackingService::class.java)
        }
        shadowAm.setRunningServiceInfo(listOf(info))

        receiver.onReceive(context, testIntent("IN_VEHICLE"))

        // IN_VEHICLE while service running: log only, no intent
        val started = Shadows.shadowOf(context).nextStartedService
        assertNull(
            "IN_VEHICLE while tracking should not send any service intent",
            started,
        )
    }
}
