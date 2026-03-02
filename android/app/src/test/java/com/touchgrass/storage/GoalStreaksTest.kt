package com.touchgrass.storage

import org.junit.Assert.assertEquals
import org.junit.Test

class GoalStreaksTest {

    @Test
    fun `all reached days increments current and longest`() {
        val rows = listOf(
            row("2026-02-01", true),
            row("2026-02-02", true),
            row("2026-02-03", true),
        )

        val streaks = computeGoalStreaksInRange("2026-02-01", "2026-02-03", rows)

        assertEquals(3, streaks.currentDays)
        assertEquals(3, streaks.longestDays)
    }

    @Test
    fun `false day resets streak run`() {
        val rows = listOf(
            row("2026-02-01", true),
            row("2026-02-02", true),
            row("2026-02-03", false),
            row("2026-02-04", true),
        )

        val streaks = computeGoalStreaksInRange("2026-02-01", "2026-02-04", rows)

        assertEquals(1, streaks.currentDays)
        assertEquals(2, streaks.longestDays)
    }

    @Test
    fun `missing days are neutral and do not break streak`() {
        val rows = listOf(
            row("2026-02-01", true),
            row("2026-02-03", true),
        )

        val streaks = computeGoalStreaksInRange("2026-02-01", "2026-02-03", rows)

        assertEquals(2, streaks.currentDays)
        assertEquals(2, streaks.longestDays)
    }

    @Test
    fun `missing day with active plans breaks streak`() {
        val rows = listOf(
            row("2026-02-01", true),
            row("2026-02-03", true),
        )

        val streaks = computeGoalStreaksInRange(
            "2026-02-01",
            "2026-02-03",
            rows,
            activePlanDays = setOf("2026-02-02"),
        )

        assertEquals(1, streaks.currentDays)
        assertEquals(1, streaks.longestDays)
    }

    @Test
    fun `active plan day marks miss without row`() {
        val rows = emptyList<DailyTotalEntity>()

        val streaks = computeGoalStreaksInRange(
            "2026-02-01",
            "2026-02-03",
            rows,
            activePlanDays = setOf("2026-02-02"),
        )

        assertEquals(0, streaks.currentDays)
        assertEquals(0, streaks.longestDays)
    }

    @Test
    fun `range filter excludes out of range rows`() {
        val rows = listOf(
            row("2026-01-30", true),
            row("2026-02-01", true),
            row("2026-02-02", false),
            row("2026-02-03", true),
            row("2026-02-05", true),
        )

        val streaks = computeGoalStreaksInRange("2026-02-01", "2026-02-03", rows)

        assertEquals(1, streaks.currentDays)
        assertEquals(1, streaks.longestDays)
    }

    @Test
    fun `seeded install day counts as hit without row`() {
        val rows = emptyList<DailyTotalEntity>()

        val streaks = computeGoalStreaksInRange(
            "2026-02-01",
            "2026-02-01",
            rows,
            seededHitDays = setOf("2026-02-01"),
        )

        assertEquals(1, streaks.currentDays)
        assertEquals(1, streaks.longestDays)
    }

    @Test
    fun `seeded hit overrides miss signals for install day`() {
        val rows = listOf(
            row("2026-02-01", false),
        )

        val streaks = computeGoalStreaksInRange(
            "2026-02-01",
            "2026-02-01",
            rows,
            activePlanDays = setOf("2026-02-01"),
            seededHitDays = setOf("2026-02-01"),
        )

        assertEquals(1, streaks.currentDays)
        assertEquals(1, streaks.longestDays)
    }

    private fun row(date: String, reached: Boolean): DailyTotalEntity = DailyTotalEntity(
        date = date,
        distanceMeters = if (reached) 1500.0 else 400.0,
        elapsedSeconds = if (reached) 1200L else 300L,
        goalsReached = reached,
        sessionCount = 1,
        lastUpdatedMs = 0L,
    )
}
