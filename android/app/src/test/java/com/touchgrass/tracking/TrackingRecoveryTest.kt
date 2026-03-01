package com.touchgrass.tracking

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TrackingRecoveryTest {

    @Test
    fun `reconcileDayTotals includes open session contribution`() {
        val totals = reconcileDayTotals(
            dailyDistanceMeters = 1200.0,
            dailyElapsedSeconds = 42L,
            dailyGoalReached = false,
            openSessionDistanceMeters = 300.0,
            openSessionElapsedSeconds = 15L,
            openSessionGoalReached = false,
            mmkvDistanceMeters = 0.0,
            mmkvElapsedSeconds = 0L,
            mmkvGoalReached = false,
            includeMmkvFallback = false,
        )

        assertEquals(1500.0, totals.distanceMeters, 0.0001)
        assertEquals(57L, totals.elapsedSeconds)
        assertFalse(totals.goalReached)
    }

    @Test
    fun `reconcileDayTotals uses mmkv fallback when requested`() {
        val totals = reconcileDayTotals(
            dailyDistanceMeters = 1200.0,
            dailyElapsedSeconds = 42L,
            dailyGoalReached = false,
            openSessionDistanceMeters = 300.0,
            openSessionElapsedSeconds = 15L,
            openSessionGoalReached = false,
            mmkvDistanceMeters = 1700.0,
            mmkvElapsedSeconds = 62L,
            mmkvGoalReached = true,
            includeMmkvFallback = true,
        )

        assertEquals(1700.0, totals.distanceMeters, 0.0001)
        assertEquals(62L, totals.elapsedSeconds)
        assertTrue(totals.goalReached)
    }

    @Test
    fun `computeStartupBaseline merges room daily plus open session over mmkv`() {
        val baseline = computeStartupBaseline(
            roomDistanceMeters = 3000.0,
            roomElapsedSeconds = 1800L,
            roomGoalReached = false,
            mmkvDistanceMeters = 1200.0,
            mmkvElapsedSeconds = 600L,
            mmkvGoalReached = false,
        )

        assertNotNull(baseline)
        assertEquals(3000.0, baseline!!.distanceMeters, 0.0001)
        assertEquals(1800L, baseline.elapsedSeconds)
        assertFalse(baseline.goalReached)
    }

    @Test
    fun `computeStartupBaseline keeps larger same-day mmkv snapshot when higher`() {
        val baseline = computeStartupBaseline(
            roomDistanceMeters = 1000.0,
            roomElapsedSeconds = 300L,
            roomGoalReached = false,
            mmkvDistanceMeters = 2200.0,
            mmkvElapsedSeconds = 900L,
            mmkvGoalReached = true,
        )

        assertNotNull(baseline)
        assertEquals(2200.0, baseline!!.distanceMeters, 0.0001)
        assertEquals(900L, baseline.elapsedSeconds)
        assertTrue(baseline.goalReached)
    }

    @Test
    fun `computeStartupBaseline returns null when no same-day progress exists`() {
        val baseline = computeStartupBaseline(
            roomDistanceMeters = 0.0,
            roomElapsedSeconds = 0L,
            roomGoalReached = false,
            mmkvDistanceMeters = 0.0,
            mmkvElapsedSeconds = 0L,
            mmkvGoalReached = false,
        )

        assertNull(baseline)
    }
}
