package com.touchgrass

import android.content.Context
import org.json.JSONArray

object BlockPolicyEvaluator {

    data class Decision(
        val shouldBlock: Boolean,
        val reason: String,
    )

    fun evaluateTargetPackagePolicy(
        hasPermanent: Boolean,
        emergencyActive: Boolean,
        goalsReached: Boolean,
    ): Decision {
        if (hasPermanent) return Decision(true, "permanent_plan")
        if (emergencyActive) return Decision(false, "emergency_unblock_active")
        if (goalsReached) return Decision(false, "goals_reached")
        return Decision(true, "active_day_unmet_goals")
    }

    fun evaluatePackage(context: Context, packageName: String): Decision {
        if (packageName.isBlank()) return Decision(false, "blank_package")

        val prefs = context.getSharedPreferences(AppBlockerService.PREFS_NAME, Context.MODE_PRIVATE)
        val blockedJson = prefs.getString(AppBlockerService.PREF_BLOCKED_PACKAGES, "[]") ?: "[]"
        val blockedPackages = mutableSetOf<String>()

        try {
            val arr = JSONArray(blockedJson)
            for (i in 0 until arr.length()) {
                blockedPackages.add(arr.optString(i))
            }
        } catch (_: Exception) {
            return Decision(false, "invalid_blocked_config")
        }

        if (packageName !in blockedPackages) return Decision(false, "not_target_package")

        val hasPermanent = prefs.getBoolean(AppBlockerService.PREF_HAS_PERMANENT, false)
        val configDay = prefs.getString(AppBlockerService.PREF_CONFIG_DAY, "")
        val isConfigForToday = configDay == MMKVStore.todayKey()
        val goalsReached = isConfigForToday && prefs.getBoolean(AppBlockerService.PREF_GOALS_REACHED, false)
        val emergencyActive = MMKVStore.getEmergencyUnblockRemainingMs() > 0L

        return evaluateTargetPackagePolicy(
            hasPermanent = hasPermanent,
            emergencyActive = emergencyActive,
            goalsReached = goalsReached,
        )
    }
}
