package com.touchgrass

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Schedules a WorkManager periodic task that fires every 3 minutes while tracking is active.
 * Purpose: On Android 15, foreground services that are "quiet" (no CPU activity) can be
 * deprioritised. The heartbeat ensures the process stays high-priority by touching the
 * system's work scheduler regularly.
 *
 * The worker itself is minimal — it just logs and returns success. The scheduling alone is
 * sufficient to signal liveness to the OS process priority manager.
 */
object HeartbeatManager {

    private const val TAG = "Heartbeat"
    private const val WORK_NAME = "touchgrass_heartbeat"

    fun schedule(context: Context) {
        val request = PeriodicWorkRequestBuilder<HeartbeatWorker>(3, TimeUnit.MINUTES)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
        Log.d(TAG, "Heartbeat scheduled (3 min period)")
    }

    fun cancel(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        Log.d(TAG, "Heartbeat cancelled")
    }
}

class HeartbeatWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        Log.d("Heartbeat", "Heartbeat fired — tracking service alive")
        return Result.success()
    }
}
