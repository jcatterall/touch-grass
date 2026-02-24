package com.touchgrass.tracking

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NotificationHelperTest {

    @Test
    fun `no active plan produces two-state no-active text`() {
        val text = NotificationHelper.computeText(
            blockedCount = 5,
            todayKey = "2026-02-24",
            planDay = "",
            planActiveFlag = false,
            goalDistanceValue = 5000.0,
            goalDistanceUnit = "m",
            goalTimeValue = 1800.0,
            goalTimeUnit = "s",
            state = TrackingState(distanceMeters = 1234.0, elapsedSeconds = 999)
        )

        assertEquals("No active blocks for today", text.title)
        assertEquals("", text.body)
    }

    @Test
    fun `active plan uses blocked count title and progress body`() {
        val text = NotificationHelper.computeText(
            blockedCount = 1,
            todayKey = "2026-02-24",
            planDay = "2026-02-24",
            planActiveFlag = true,
            goalDistanceValue = 5000.0,
            goalDistanceUnit = "m",
            goalTimeValue = 1800.0,
            goalTimeUnit = "s",
            state = TrackingState(distanceMeters = 1200.0, elapsedSeconds = 60)
        )

        assertEquals("1 application blocked", text.title)
        assertTrue(text.body.contains("Progress:"))
        assertTrue(text.body.contains("/"))
        // Must never contain the disallowed monitoring wording.
        assertTrue(!text.body.contains("Watching for movement"))
    }
}
