# Android Background Location — Complete Implementation Guide

A best-practice blueprint for building a production-grade background location tracking system in a React Native Android application, based on the architecture of **react-native-background-location**.

---

## Table of Contents

* Architecture Overview
* Project Setup & Dependencies
* Android Manifest Configuration
* Native Android Layer (Kotlin)

  * 4.1 Configuration DTOs
  * 4.2 Room Database & Persistence
  * 4.3 Location Provider Abstraction
  * 4.4 Location Processor Pipeline
  * 4.5 Batched Storage Layer
  * 4.6 Event Broadcasting (Service ↔ Module)
  * 4.7 Foreground Service
  * 4.8 Crash Recovery Worker
  * 4.9 React Native Bridge Module
  * 4.10 Package Registration
* TypeScript Layer

  * 5.1 TurboModule Native Spec
  * 5.2 Type Definitions
  * 5.3 Module Wrapper
  * 5.4 Hooks
  * 5.5 Utility Functions
* Critical Patterns & Anti-Patterns
* Android Version-Specific Handling
* Battery Optimization & OEM Quirks
* Google Play Compliance
* Testing Checklist

---

# 1. Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                        React Native (JS)                          │
│  ┌──────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │useBackgroundLoc. │  │useLocationUpd.  │  │useLocPermissions │  │
│  └────────┬─────────┘  └───────┬─────────┘  └────────┬─────────┘  │
│           │                    │                      │            │
│           ▼                    ▼                      │            │
│  ┌─────────────────────────────────────────┐          │            │
│  │  BackgroundLocation (index.tsx wrapper) │          │            │
│  └────────────────────┬────────────────────┘          │            │
│                       │  TurboModule                  │            │
├───────────────────────┼───────────────────────────────┼────────────┤
│                       ▼                      Android  │            │
│  ┌─────────────────────────────────────────┐          │            │
│  │   BackgroundLocationModule (Kotlin)     │◄─────────┘            │
│  │   - BroadcastReceiver (LocalBroadcast)  │                       │
│  │   - RCTDeviceEventEmitter → JS events   │                       │
│  └─────────┬───────────────────────────────┘                       │
│            │ start/stop                                            │
│            ▼                              ▲ LocalBroadcast events  │
│  ┌─────────────────────────────────────────┐                       │
│  │   LocationService (Foreground Service)  │                       │
│  │   - Notification management             │                       │
│  │   - LocationProvider (Fused/Android)    │                       │
│  │   - LocationProcessor pipeline          │                       │
│  │   - Stop token mechanism                │                       │
│  │   - Crash loop detection                │                       │
│  └─────────┬───────────────┬───────────────┘                       │
│            │               │                                       │
│            ▼               ▼                                       │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │LocationStorage│  │RecoveryWorker    │  │LocationEventBroadcast│  │
│  │(Batched writes│  │(WorkManager)     │  │(LocalBroadcastMgr)   │  │
│  │ to Room DB)  │  │(Crash recovery)  │  │                      │  │
│  └──────┬───────┘  └──────────────────┘  └──────────────────────┘  │
│         ▼                                                          │
│  ┌──────────────────────────────────────────┐                      │
│  │  Room Database (LocationDatabase)        │                      │
│  │  - locations table (indexed by tripId)   │                      │
│  │  - tracking_state table (single row)     │                      │
│  └──────────────────────────────────────────┘                      │
└────────────────────────────────────────────────────────────────────┘
```

---

## Key Design Principles

### Service ↔ Module Decoupling

The `LocationService` never holds a reference to the React module.
Communication occurs via **LocalBroadcastManager**, ensuring lifecycle independence.

### Crash-Resilient State

Tracking state & locations persist in **Room DB**.
`RecoveryWorker` restarts tracking after crashes.

### Stop Token Pattern

A time-limited flag prevents restart after intentional stops.

### Provider Abstraction

Swappable providers:

* Google Play Services
* Android LocationManager fallback

### Batched I/O

Locations buffered in memory → flushed in batches to reduce disk overhead.

---

# 2. Project Setup & Dependencies

## 2.1 Gradle Properties

```properties
# android/gradle.properties
BackgroundLocation_kotlinVersion=2.1.20
BackgroundLocation_minSdkVersion=24
BackgroundLocation_targetSdkVersion=34
BackgroundLocation_compileSdkVersion=35
BackgroundLocation_ndkVersion=27.1.12297006
```

---

## 2.2 Gradle Build File

```gradle
plugins {
    id 'com.android.library'
    id 'kotlin-android'
    id 'kotlin-parcelize'
    id 'com.google.devtools.ksp'     // Room annotation processor
    id 'com.facebook.react'          // React Native integration
}

android {
    namespace "com.backgroundlocation"
    compileSdk project.properties['BackgroundLocation_compileSdkVersion'].toInteger()

    defaultConfig {
        minSdk project.properties['BackgroundLocation_minSdkVersion'].toInteger()
        targetSdk project.properties['BackgroundLocation_targetSdkVersion'].toInteger()
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }

    kotlinOptions {
        jvmTarget = '1.8'
    }

    buildTypes {
        release {
            minifyEnabled false
        }
    }
}

// Room schema generation
ksp {
    arg("room.schemaLocation", "$projectDir/schemas")
    arg("room.incremental", "true")
}

dependencies {
    implementation "com.facebook.react:react-android"
    implementation "org.jetbrains.kotlin:kotlin-stdlib:$kotlin_version"

    // Google Play Services Location
    implementation "com.google.android.gms:play-services-location:21.3.0"

    // LocalBroadcastManager
    implementation "androidx.localbroadcastmanager:localbroadcastmanager:1.1.0"

    // WorkManager
    implementation "androidx.work:work-runtime-ktx:2.9.0"

    // Room
    implementation "androidx.room:room-runtime:2.6.1"
    implementation "androidx.room:room-ktx:2.6.1"
    ksp "androidx.room:room-compiler:2.6.1"
}
```

---

## 2.3 Source File Structure

```
android/src/main/
├── AndroidManifest.xml
└── java/com/backgroundlocation/
    ├── BackgroundLocationModule.kt
    ├── BackgroundLocationPackage.kt
    ├── broadcast/
    │   └── LocationEventBroadcaster.kt
    ├── config/
    │   ├── LocationAccuracy.kt
    │   └── TrackingOptions.kt
    ├── database/
    │   ├── LocationDatabase.kt
    │   ├── LocationEntity.kt
    │   ├── LocationDao.kt
    │   ├── TrackingStateEntity.kt
    │   ├── TrackingStateDao.kt
    │   └── Migrations.kt
    ├── processor/
    │   └── LocationProcessor.kt
    ├── provider/
    │   ├── LocationProvider.kt
    │   ├── FusedLocationProvider.kt
    │   ├── AndroidLocationProvider.kt
    │   └── LocationProviderFactory.kt
    ├── recovery/
    │   └── RecoveryWorker.kt
    ├── service/
    │   └── LocationService.kt
    └── storage/
        └── LocationStorage.kt
```

---

# 3. Android Manifest Configuration

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
          xmlns:tools="http://schemas.android.com/tools">

    <!-- Core location -->
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

    <!-- Background location -->
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />

    <!-- Foreground service -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />

    <!-- Notifications -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application>

        <service
            android:name=".LocationService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="location"
            android:stopWithTask="false" />

        <!-- Required for Android 14+ -->
        <service
            android:name="androidx.work.impl.foreground.SystemForegroundService"
            android:foregroundServiceType="location"
            tools:node="merge" />

    </application>
</manifest>
```

---

## Why Each Permission Matters

| Permission                  | Min API | Purpose                   |
| --------------------------- | ------- | ------------------------- |
| ACCESS_FINE_LOCATION        | All     | GPS precision             |
| ACCESS_COARSE_LOCATION      | All     | Network precision         |
| ACCESS_BACKGROUND_LOCATION  | 29      | Background tracking       |
| FOREGROUND_SERVICE          | 28      | Run foreground service    |
| FOREGROUND_SERVICE_LOCATION | 34      | Required for location FGS |
| POST_NOTIFICATIONS          | 33      | Persistent notification   |

---

# 4. Native Android Layer (Kotlin)

---

## 4.1 Configuration DTOs

### LocationAccuracy.kt

```kotlin
enum class LocationAccuracy(val value: String) {
    HIGH_ACCURACY("HIGH_ACCURACY"),
    BALANCED_POWER_ACCURACY("BALANCED_POWER_ACCURACY"),
    LOW_POWER("LOW_POWER"),
    NO_POWER("NO_POWER"),
    PASSIVE("PASSIVE");

    companion object {
        fun fromString(value: String?): LocationAccuracy {
            return values().find { it.value == value } ?: HIGH_ACCURACY
        }
    }
}
```

### Android Priority Mapping

| Accuracy                | Android Priority                 |
| ----------------------- | -------------------------------- |
| HIGH_ACCURACY           | PRIORITY_HIGH_ACCURACY           |
| BALANCED_POWER_ACCURACY | PRIORITY_BALANCED_POWER_ACCURACY |
| LOW_POWER               | PRIORITY_LOW_POWER               |
| PASSIVE                 | PRIORITY_PASSIVE                 |

---

### TrackingOptions.kt

```kotlin
data class TrackingOptions(
    val updateInterval: Long? = null,
    val fastestInterval: Long? = null,
    val maxWaitTime: Long? = null,
    val accuracy: LocationAccuracy? = null,
    val waitForAccurateLocation: Boolean? = null,
    val notificationTitle: String? = null,
    val notificationText: String? = null,
    val notificationChannelName: String? = null,
    val notificationPriority: String? = null,
    val foregroundOnly: Boolean? = null,
    val distanceFilter: Float? = null
)
```

**Defaults**

* update interval: **5000 ms**
* fastest interval: **3000 ms**
* distance filter: **0**
* accuracy: **HIGH_ACCURACY**

---

## Configuration Presets

| Use Case   | Interval | Accuracy | Distance | Battery |
| ---------- | -------- | -------- | -------- | ------- |
| Walking    | 5s       | High     | 0        | High    |
| Driving    | 15s      | Balanced | 10m      | Medium  |
| Monitoring | 30s      | Low      | 50m      | Low     |
| Passive    | 60s      | Passive  | 0        | Minimal |

---

## 4.2 Room Database & Persistence

### LocationEntity.kt

```kotlin
@Entity(
    tableName = "locations",
    indices = [Index(value = ["tripId"])]
)
data class LocationEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val tripId: String,
    val latitude: Double,
    val longitude: Double,
    val timestamp: Long,
    val accuracy: Float? = null,
    val altitude: Double? = null,
    val speed: Float? = null,
    val bearing: Float? = null,
    val provider: String? = null,
    val isFromMockProvider: Boolean? = null
)
```

### LocationDao.kt

```kotlin
@Dao
interface LocationDao {
    @Insert suspend fun insert(location: LocationEntity): Long
    @Insert suspend fun insertAll(locations: List<LocationEntity>)
    @Query("SELECT * FROM locations WHERE tripId = :tripId ORDER BY timestamp ASC")
    suspend fun getLocationsByTripId(tripId: String): List<LocationEntity>
}
```

---

### TrackingStateEntity.kt

Crash-recovery keystone:

```kotlin
@Entity(tableName = "tracking_state")
data class TrackingStateEntity(
    @PrimaryKey val id: Int = 1,
    val isActive: Boolean = false,
    val tripId: String? = null,
    val updateInterval: Long? = null,
    val accuracy: String? = null
)
```

---

### LocationDatabase.kt

```kotlin
@Database(
    entities = [LocationEntity::class, TrackingStateEntity::class],
    version = 1,
    exportSchema = true
)
abstract class LocationDatabase : RoomDatabase() {
    abstract fun locationDao(): LocationDao
    abstract fun trackingStateDao(): TrackingStateDao
}
```

⚠️ **No `fallbackToDestructiveMigration()`**
Prevents silent data loss.

---

## 4.3 Location Provider Abstraction

### Interface

```kotlin
interface LocationProvider {
    fun initialize(context: Context)
    fun requestLocationUpdates(...)
    fun removeLocationUpdates()
    fun getLastLocation(callback: (Location?) -> Unit)
    fun isAvailable(): Boolean
    fun cleanup()
}
```

### Implementations

* **FusedLocationProvider** → primary
* **AndroidLocationProvider** → fallback

---

## 4.4 Location Processor Pipeline

```kotlin
interface LocationProcessor {
    fun shouldStore(location: Location): Boolean = true
    fun process(location: Location): Location = location
}
```

Supports:

* filtering
* snapping
* geofencing
* accuracy thresholds

---

## 4.5 Batched Storage Layer

**Purpose:** reduce disk writes.

Key design:

* concurrent queue buffer
* flush at batch size OR timeout
* safe retry on DB failure

```kotlin
private val BATCH_SIZE = 10
private val BATCH_TIMEOUT_MS = 5000L
```

Precision preserved by sending lat/lng as **strings** across RN bridge.

---

## 4.6 Event Broadcasting (Service ↔ Module)

Uses **LocalBroadcastManager**.

Events:

```
ACTION_LOCATION_UPDATE
ACTION_LOCATION_ERROR
ACTION_LOCATION_WARNING
```

Location converted:

* Android Location → Bundle
* Bundle → React Native WritableMap

---

## 4.7 Foreground Service

### Critical startup rule

**Must call `startForeground()` within ~5 seconds.**

### Responsibilities

* request location updates
* manage notification
* persist locations
* broadcast events
* crash protection

### Stop Token Pattern

Prevents unwanted restart.

```kotlin
STOP_TOKEN_VALIDITY_MS = 60000L
```

---

## 4.8 Crash Recovery Worker

Uses **WorkManager** to restart tracking safely.

Why:

* avoids Android 12 background restrictions
* uses `setForeground()`
* triple stop-token safety checks

---

## 4.9 React Native Bridge Module

Responsibilities:

* receive broadcasts
* emit JS events
* start/stop service
* manage permissions
* expose API

Events emitted:

```
onLocationUpdate
onLocationError
onLocationWarning
```

---

## 4.10 Package Registration

Registers TurboModule for React Native.

---

# 5. TypeScript Layer

## 5.1 TurboModule Spec

```ts
export interface Spec extends TurboModule {
  startTracking(tripId?: string, options?: TrackingOptionsSpec): Promise<string>;
  stopTracking(): Promise<void>;
  isTracking(): Promise<TrackingStatus>;
  getLocations(tripId: string): Promise<Coords[]>;
}
```

---

## 5.2 Core Types

### Coords

```ts
export interface Coords {
  latitude: string;   // precision preserved
  longitude: string;
  timestamp: number;
  accuracy?: number;
  altitude?: number;
}
```

---

## 5.3 Module Wrapper

Adds:

* enum → string conversion
* safety checks
* graceful simulator fallback

---

## 5.4 Permission Hook Flow

Sequential checks:

1. Fine & coarse location
2. Background location (Android 10+)
3. Notifications (Android 13+)

Detects:

* denied
* blocked ("Don't ask again")

---

# Critical Design Decisions

## Why lat/lng are strings

Prevents precision loss when crossing the JS bridge.

## Why WorkManager recovery

Required for Android 12+ background execution limits.

## Why stop token exists

Prevents service restart after user stops tracking.

## Why batching is used

Improves battery & storage efficiency.