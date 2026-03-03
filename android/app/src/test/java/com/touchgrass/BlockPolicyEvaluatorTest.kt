package com.touchgrass

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BlockPolicyEvaluatorTest {

    @Test
    fun `emergency active and non-permanent target allows`() {
        val decision = BlockPolicyEvaluator.evaluateTargetPackagePolicy(
            hasPermanent = false,
            emergencyActive = true,
            goalsReached = false,
        )

        assertFalse(decision.shouldBlock)
        assertEquals("emergency_unblock_active", decision.reason)
    }

    @Test
    fun `emergency active and permanent target blocks`() {
        val decision = BlockPolicyEvaluator.evaluateTargetPackagePolicy(
            hasPermanent = true,
            emergencyActive = true,
            goalsReached = true,
        )

        assertTrue(decision.shouldBlock)
        assertEquals("permanent_plan", decision.reason)
    }

    @Test
    fun `expired emergency with unmet goals blocks`() {
        val decision = BlockPolicyEvaluator.evaluateTargetPackagePolicy(
            hasPermanent = false,
            emergencyActive = false,
            goalsReached = false,
        )

        assertTrue(decision.shouldBlock)
        assertEquals("active_day_unmet_goals", decision.reason)
    }
}
