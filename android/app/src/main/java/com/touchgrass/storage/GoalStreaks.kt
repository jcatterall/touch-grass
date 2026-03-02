package com.touchgrass.storage

data class GoalStreaks(
    val currentDays: Int,
    val longestDays: Int,
)

/**
 * Computes goal streaks from persisted daily rows within [startDate, endDate].
 *
 * Streak semantics:
 * - goalsReached=true  => contributes to streak run
 * - goalsReached=false with active plan day => breaks streak run
 * - missing day row + active plan day => breaks streak run
 * - missing day row + no active plan marker => neutral (does not increment or break)
 */
fun computeGoalStreaksInRange(
    startDate: String,
    endDate: String,
    rows: List<DailyTotalEntity>,
    activePlanDays: Set<String> = emptySet(),
    seededHitDays: Set<String> = emptySet(),
): GoalStreaks {
    if (startDate > endDate) return GoalStreaks(currentDays = 0, longestDays = 0)

    val byDate = rows
        .asSequence()
        .filter { it.date >= startDate && it.date <= endDate }
        .associateBy { it.date }

    var run = 0
    var longest = 0
    var cursor = startDate
    while (cursor <= endDate) {
        val row = byDate[cursor]
        val hasActivePlans = activePlanDays.contains(cursor)
        val isHit = seededHitDays.contains(cursor) || row?.goalsReached == true
        val isMiss = if (isHit) {
            false
        } else if (row != null) {
            !row.goalsReached || hasActivePlans
        } else {
            hasActivePlans
        }

        if (isHit) {
            run += 1
            if (run > longest) longest = run
        } else if (isMiss) {
            run = 0
        }

        cursor = addDays(cursor, 1)
    }

    return GoalStreaks(currentDays = run, longestDays = longest)
}

private fun addDays(date: String, deltaDays: Int): String {
    val parts = date.split("-")
    if (parts.size != 3) return date
    val y = parts[0].toIntOrNull() ?: return date
    val m = parts[1].toIntOrNull() ?: return date
    val d = parts[2].toIntOrNull() ?: return date
    val local = java.time.LocalDate.of(y, m, d).plusDays(deltaDays.toLong())
    return local.toString()
}
