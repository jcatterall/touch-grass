package com.touchgrass.tracking

/**
 * GPS power modes used by GpsManager to balance accuracy and battery life.
 *
 * OFF           – no location updates; used when idle or fully stopped.
 * LOW_POWER     – balanced power accuracy; used in vehicle or between fixes.
 * HIGH_ACCURACY – maximum accuracy; used when walking/running/cycling confirmed.
 * BALANCED      – intermediate; available for future tuning.
 */
enum class GpsMode {
    OFF,
    LOW_POWER,
    HIGH_ACCURACY,
    BALANCED
}
