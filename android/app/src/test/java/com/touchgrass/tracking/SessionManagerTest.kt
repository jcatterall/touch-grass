package com.touchgrass.tracking

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SessionManagerTest {

    @Test
    fun `tick does not accumulate time when not eligible`() {
        val sessions = SessionManager()
        sessions.start()

        Thread.sleep(50)
        sessions.tick(false)
        Thread.sleep(50)
        sessions.tick(false)

        assertEquals(0L, sessions.elapsedSeconds())
    }

    @Test
    fun `tick accumulates time when eligible`() {
        val sessions = SessionManager()
        sessions.start()

        Thread.sleep(1100)
        sessions.tick(true)

        assertTrue("expected at least 1s elapsed", sessions.elapsedSeconds() >= 1L)
    }
}
