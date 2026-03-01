package com.touchgrass.tracking

import kotlin.math.max

data class StartupBaseline(
    val distanceMeters: Double,
    val elapsedSeconds: Long,
    val goalReached: Boolean,
)

data class ReconciledDayTotals(
    val distanceMeters: Double,
    val elapsedSeconds: Long,
    val goalReached: Boolean,
)

fun computeStartupBaseline(
    roomDistanceMeters: Double,
    roomElapsedSeconds: Long,
    roomGoalReached: Boolean,
    mmkvDistanceMeters: Double,
    mmkvElapsedSeconds: Long,
    mmkvGoalReached: Boolean,
): StartupBaseline? {
    val distance = max(roomDistanceMeters, mmkvDistanceMeters)
    val elapsed = max(roomElapsedSeconds, mmkvElapsedSeconds)
    val goalReached = roomGoalReached || mmkvGoalReached
    if (distance <= 0.0 && elapsed <= 0L && !goalReached) return null
    return StartupBaseline(
        distanceMeters = distance,
        elapsedSeconds = elapsed,
        goalReached = goalReached,
    )
}

fun reconcileDayTotals(
    dailyDistanceMeters: Double,
    dailyElapsedSeconds: Long,
    dailyGoalReached: Boolean,
    openSessionDistanceMeters: Double,
    openSessionElapsedSeconds: Long,
    openSessionGoalReached: Boolean,
    mmkvDistanceMeters: Double,
    mmkvElapsedSeconds: Long,
    mmkvGoalReached: Boolean,
    includeMmkvFallback: Boolean,
): ReconciledDayTotals {
    val roomDistance = (dailyDistanceMeters + openSessionDistanceMeters).coerceAtLeast(0.0)
    val roomElapsed = (dailyElapsedSeconds + openSessionElapsedSeconds).coerceAtLeast(0L)
    val roomGoalReached = dailyGoalReached || openSessionGoalReached

    val distance = if (includeMmkvFallback) max(roomDistance, mmkvDistanceMeters) else roomDistance
    val elapsed = if (includeMmkvFallback) max(roomElapsed, mmkvElapsedSeconds) else roomElapsed
    val goalReached = if (includeMmkvFallback) roomGoalReached || mmkvGoalReached else roomGoalReached

    return ReconciledDayTotals(
        distanceMeters = distance,
        elapsedSeconds = elapsed,
        goalReached = goalReached,
    )
}
