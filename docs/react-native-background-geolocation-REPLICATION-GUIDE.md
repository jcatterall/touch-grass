# Background Geolocation for Android — Complete Replication Guide

A comprehensive, best-practice reference for building background location services in a React Native Android application, derived from the architecture of `react-native-background-geolocation`. 

## Table of Contents

1. 
**Architecture Overview** 


2. 
**Android Native Layer** 


3. 
**React Native Bridge Layer** 


4. 
**Headless Task System** 


5. 
**JavaScript API Layer** 


6. 
**Configuration Reference** 


7. 
**Data Schemas** 


8. 
**Enums & Constants** 


9. 
**Gradle Build Configuration** 


10. 
**ProGuard / R8 Rules** 


11. 
**OEM Battery Optimization Handling** 


12. 
**Example Usage Pattern** 


13. 
**Implementation Checklist** 



---

## 1. Architecture Overview

The system uses a **layered architecture** with clear separation of concerns: 

```text
┌──────────────────────────────────────────────────────────┐
│                    JavaScript Layer                       │
│  BackgroundGeolocation (Public API)                       │
│  └── NativeModule.js (Bridge Wrapper)                    │
│       └── TurboModuleRegistry / NativeModules fallback   │
├──────────────────────────────────────────────────────────┤
│                React Native Bridge Layer                  │
│  RNBackgroundGeolocationModule.java                      │
│  ├── Promise-based @ReactMethod handlers                 │
│  ├── Event callbacks → RCTDeviceEventEmitter             │
│  └── Data conversion (Map↔WritableMap, JSON↔ReadableMap) │
├──────────────────────────────────────────────────────────┤
│                 Android Native Layer                      │
│  ├── ForegroundService + Persistent Notification         │
│  ├── FusedLocationProviderClient (play-services-location) │
│  ├── ActivityRecognitionClient (motion detection)        │
│  ├── GeofencingClient (geofence monitoring)              │
│  ├── SQLite Database (location persistence)              │
│  ├── HTTP Service (auto-sync to server)                  │
│  ├── BroadcastReceiver (BOOT_COMPLETED)                  │
│  └── HeadlessTask + EventBus (terminated-app execution)  │
└──────────────────────────────────────────────────────────┘

```



### Key Architectural Patterns

| Pattern | Description |
| --- | --- |
| **Singleton Adapter** | A single `BackgroundGeolocation.getInstance(context)` manages all native tracking. 

 |
| **Event-Driven** | All native→JS communication uses `RCTDeviceEventEmitter.emit()` with 16 event types. 

 |
| **EventBus (GreenRobot)** | Inter-component communication in the native layer, especially for headless task delivery. 

 |
| **Config-as-State** | Configuration doubles as runtime state — `getState()` returns config + runtime fields (`enabled`, `isMoving`, `odometer`). 

 |
| **SQLite Persistence** | Locations stored in local DB; deleted only after successful HTTP upload (200/201/204). 

 |
| **Elastic Distance Filter** | <br>`distanceFilter` auto-scales with speed for battery optimization. 

 |
| **Spatial Geofencing** | Overcomes platform geofence limits (100 on Android) using spatial DB queries. 

 |

### Data Flow: Location Recording

1. 
**GPS/Network Provider (FusedLocationProviderClient)** 


2. → **ForegroundService** receives location update 


3. → Apply filters (`distanceFilter`, `desiredAccuracy`, `desiredOdometerAccuracy`) 


4. → Insert into **SQLite database** 


5. → Emit **"location" event** via `RCTDeviceEventEmitter` 


6. → `NativeEventEmitter` → **JavaScript** `onLocation` callback 


7. → If `autoSync: true` → **HTTP POST** to configured URL 


8. → On 200/201/204 → **DELETE** from SQLite 


9. → On failure → **UNLOCK** record, retry later 



### Data Flow: Headless (App Terminated)

1. 
**ForegroundService** (still running, `stopOnTerminate: false`) 


2. → Location/Geofence/Heartbeat event fires 


3. → `EventBus.post(HeadlessEvent)` 


4. → `HeadlessTask.onHeadlessEvent()` receives via `@Subscribe` 


5. → `HeadlessTaskManager.startTask()` 


6. → Create/reuse **ReactContext** (supports old + bridgeless arch) 


7. → `AppRegistry.startHeadlessTask()` → JS callback 


8. → JS calls `finishHeadlessTask(taskId)` when done 



---

## 2. Android Native Layer

### 2.1 Foreground Service & Location Provider

Android requires a **Foreground Service** with a persistent notification for continuous background location access (Android 8.0+). 

#### Implementation Steps

Create a `LocationService` extending `Service`: 

```java
public class LocationService extends Service {
    private static final int NOTIFICATION_ID = 1001;
    private static final String CHANNEL_ID = "background_location_channel";
    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;

    @Override
    public void onCreate() {
        super.onCreate();
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION_ID, buildNotification());
        requestLocationUpdates();
        // START_STICKY: Restart service if killed by OS
        return START_STICKY;
    }

    private void requestLocationUpdates() {
        LocationRequest locationRequest = new LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            1000  // locationUpdateInterval in ms
        )
        .setMinUpdateDistanceMeters(10f)     // distanceFilter
        .setMaxUpdateDelayMillis(0)          // deferTime
        .setMinUpdateIntervalMillis(10000)   // fastestLocationUpdateInterval
        .build();

        fusedLocationClient.requestLocationUpdates(
            locationRequest,
            locationCallback,
            Looper.getMainLooper()
        );
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Location Tracking",
                NotificationManager.IMPORTANCE_LOW  // Maps to NotificationPriority
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification() {
        // See Section 6.5 for full notification configuration options
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Tracking Location")
            .setContentText("App is tracking your location")
            .setSmallIcon(R.drawable.ic_notification)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        fusedLocationClient.removeLocationUpdates(locationCallback);
        super.onDestroy();
    }
}

```



**Map `LocationRequest.Builder` parameters to config options:**
| Config Option | LocationRequest Method | Default |
| :--- | :--- | :--- |
| `desiredAccuracy` | Priority parameter | `PRIORITY_HIGH_ACCURACY` |
| `distanceFilter` | `setMinUpdateDistanceMeters()` | 10 meters |
| `locationUpdateInterval` | Constructor interval parameter | 1000 ms |
| `fastestLocationUpdateInterval` | `setMinUpdateIntervalMillis()` | 10000 ms |
| `deferTime` | `setMaxUpdateDelayMillis()` | 0 ms |


**Map `desiredAccuracy` enum values to FusedLocation priorities:**
| Enum Value | Numeric | FusedLocation Priority |
| :--- | :--- | :--- |
| `DESIRED_ACCURACY_NAVIGATION` | -2 | `PRIORITY_HIGH_ACCURACY` (iOS only concept, map to HIGH) |
| `DESIRED_ACCURACY_HIGH` | -1 | `PRIORITY_HIGH_ACCURACY` |
| `DESIRED_ACCURACY_MEDIUM` | 10 | `PRIORITY_BALANCED_POWER_ACCURACY` |
| `DESIRED_ACCURACY_LOW` | 100 | `PRIORITY_LOW_POWER` |
| `DESIRED_ACCURACY_VERY_LOW` | 1000 | `PRIORITY_PASSIVE` |
| `DESIRED_ACCURACY_LOWEST` | 3000 | `PRIORITY_PASSIVE` |


**Implement Elastic Distance Filter (automatic speed-based scaling):**

```java
/**
 * Auto-scale distanceFilter based on current speed.
 * Formula: adjustedFilter = (round(speed, 5) / 5) * distanceFilter * elasticityMultiplier
 */
private float calculateElasticDistanceFilter(float speedMs, float baseDistanceFilter,
                                              float elasticityMultiplier) {
    if (elasticityMultiplier <= 0) return baseDistanceFilter;
    float roundedSpeed = Math.round(speedMs / 5.0f) * 5.0f;
    float multiplier = roundedSpeed / 5.0f;
    if (multiplier < 1) multiplier = 1;
    return multiplier * baseDistanceFilter * elasticityMultiplier;
}

```



### 2.2 AndroidManifest.xml — Permissions, Services & Receivers

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="com.google.android.gms.permission.ACTIVITY_RECOGNITION" />
    <uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application>
        <meta-data
            android:name="com.transistorsoft.locationmanager.license"
            android:value="YOUR_LICENSE_KEY" />

        <service
            android:name=".LocationService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="location" />

        <receiver
            android:name=".BootReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>
    </application>
</manifest>

```



#### Permission Request Strategy (Runtime)

The library uses a two-phase approach for location permissions: 

* 
**Phase 1**: Request `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` (grants "While In Use"). 


* 
**Phase 2**: Request `ACCESS_BACKGROUND_LOCATION` (grants "Always" — requires separate prompt on Android 11+). 



```java
@ReactMethod
public void requestPermission(final Promise response) {
    // Implementation should handle both phases and return status:
    // 0 = NotDetermined, 1 = Restricted, 2 = Denied, 3 = Always, 4 = WhenInUse
    getAdapter().requestPermission(new TSRequestPermissionCallback() {
        @Override public void onSuccess(int status) { response.resolve(status); }
        @Override public void onFailure(int status) {
            response.reject("Permission denied with status: " + status);
        }
    });
}

```



### 2.3 Motion Activity Recognition

Use `ActivityRecognitionClient` to detect device motion state (`still`, `walking`, `running`, `in_vehicle`, `on_bicycle`): 

```java
public class ActivityRecognitionService {
    private ActivityRecognitionClient activityClient;
    private PendingIntent pendingIntent;

    public void startActivityRecognition(Context context) {
        activityClient = ActivityRecognition.getClient(context);
        Intent intent = new Intent(context, ActivityRecognitionReceiver.class);
        pendingIntent = PendingIntent.getBroadcast(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
        );
        // Request updates every 10 seconds (configurable)
        activityClient.requestActivityUpdates(10000, pendingIntent);
    }
}

public class ActivityRecognitionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (ActivityRecognitionResult.hasResult(intent)) {
            ActivityRecognitionResult result = ActivityRecognitionResult.extractResult(intent);
            DetectedActivity mostProbable = result.getMostProbableActivity();
            String activity = mapActivityType(mostProbable.getType());
            int confidence = mostProbable.getConfidence();
            // Emit activitychange event: { activity: "still", confidence: 95 }
            // Use this for stop-detection: if "still" for stopTimeout minutes → stop tracking
        }
    }

    private String mapActivityType(int type) {
        switch (type) {
            case DetectedActivity.STILL: return "still";
            case DetectedActivity.WALKING: return "walking";
            case DetectedActivity.RUNNING: return "running";
            case DetectedActivity.IN_VEHICLE: return "in_vehicle";
            case DetectedActivity.ON_BICYCLE: return "on_bicycle";
            case DetectedActivity.ON_FOOT: return "on_foot";
            default: return "unknown";
        }
    }
}

```



#### Stop-Detection Logic

When `ActivityRecognition` reports `STILL`: 

* Start a `stopTimeout` countdown (default: 5 minutes). 


* If the device remains `STILL` for the full `stopTimeout`: 


* Transition to `stationary` state. 


* Stop GPS location updates (conserve battery). 


* Emit `motionchange` event with `isMoving: false`. 




* If motion resumes before timeout expires → cancel countdown. 



### 2.4 Boot Receiver (startOnBoot)

```java
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            // Read persisted config from SharedPreferences or SQLite
            Config config = ConfigManager.getInstance(context).getConfig();
            if (config.startOnBoot && !config.stopOnTerminate) {
                // Restart the foreground service
                Intent serviceIntent = new Intent(context, LocationService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            }
        }
    }
}

```



### 2.5 SQLite Persistence Layer

All recorded locations are stored in a local SQLite database to ensure no data is lost when the network is unavailable. 

#### Schema

```sql
CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    json TEXT NOT NULL,           -- Full location JSON
    timestamp INTEGER NOT NULL,  -- Unix timestamp in ms
    event TEXT,                  -- 'motionchange', 'geofence', 'heartbeat'
    locked INTEGER DEFAULT 0,   -- 1 = being uploaded, 0 = available
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS geofences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT UNIQUE NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    radius REAL NOT NULL,
    notify_on_entry INTEGER DEFAULT 1,
    notify_on_exit INTEGER DEFAULT 0,
    notify_on_dwell INTEGER DEFAULT 0,
    loitering_delay INTEGER DEFAULT 0,
    extras TEXT,                  -- JSON extras
    vertices TEXT                 -- JSON array for polygon geofences
);

```



#### Key Operations

| Operation | Method | Description |
| --- | --- | --- |
| **Insert** | `insertLocation(json)` | Store a new location record; generate UUID. 

 |
| **Get All** | `getLocations()` | Return all persisted records. 

 |
| **Get Count** | `getCount()` | Return count of persisted records. 

 |
| **Destroy All** | `destroyLocations()` | Delete all records. 

 |
| **Destroy One** | `destroyLocation(uuid)` | Delete a specific record by UUID. 

 |
| **Lock for Sync** | `lockLocations(limit)` | Set `locked=1` on N records for HTTP upload. 

 |
| **Unlock** | `unlockLocations(uuids)` | Set `locked=0` on failed uploads. 

 |
| **Delete Synced** | `deleteLocations(uuids)` | Delete successfully uploaded records. 

 |
| **Purge Old** | `purgeOldRecords(maxDays)` | Delete records older than `maxDaysToPersist`. 

 |

#### Persistence Config Options

| Option | Default | Description |
| --- | --- | --- |
| `maxDaysToPersist` | 1 | Days to keep unsent records before auto-deleting. 

 |
| `maxRecordsToPersist` | -1 (unlimited) | Max records in DB; `0` = disable persistence. 

 |
| `persistMode` | `PersistMode.All (-1)` | What to persist: `All`, `Location` (1), `Geofence` (2), `None` (0). 

 |
| `locationsOrderDirection` | `"ASC"` | Order for sync: `ASC` (oldest first) or `DESC` (newest first). 

 |

### 2.6 HTTP Sync Service

The HTTP service automatically uploads persisted locations to your server. 

#### Sync Flow

1. 
**Trigger** (new location recorded, app resume, boot, heartbeat, connectivity change) 


2. **Check**: `autoSync` enabled? Network available? `autoSyncThreshold` met? 


3. 
**Lock N records** in SQLite (prevent duplicate uploads) 


4. 
**Build HTTP request**: 


* Method: `POST`/`PUT` (configurable) 


* URL: configured `url` 


* Headers: configured `headers` + Authorization 


* Body: location JSON wrapped in `httpRootProperty` (default: `"location"`) 




5. 
**Send request** (timeout: `httpTimeout`, default 60000ms) 


6. 
**Response**: 


* 200/201/204 → **DELETE** record from SQLite → emit "http" event (success) 


* 401 → If Authorization configured → attempt token refresh → retry 


* Other → **UNLOCK** record → emit "http" event (failure) → retry later 





#### HTTP Request Body Format

**Single location (default, `batchSync: false`):**

```json
{
  "location": {
    "uuid": "abc-123",
    "timestamp": "2026-02-18T10:30:00.000Z",
    "coords": {
      "latitude": 45.5192,
      "longitude": -73.617,
      "accuracy": 12.5,
      "altitude": 50.0,
      "heading": 180.0,
      "speed": 5.2
    },
    "activity": { "type": "walking", "confidence": 85 },
    "battery": { "is_charging": false, "level": 0.72 },
    "odometer": 1523.4,
    "is_moving": true,
    "extras": {}
  }
}

```



**Batch sync (`batchSync: true`):**

```json
{
  "location": [
    { "uuid": "abc-123", "coords": { "...": "..." } },
    { "uuid": "def-456", "coords": { "...": "..." } },
    { "uuid": "ghi-789", "coords": { "...": "..." } }
  ]
}

```



#### HTTP Config Options

| Option | Default | Description |
| --- | --- | --- |
| `url` | undefined | Server URL for HTTP POST. 

 |
| `method` | `"POST"` | HTTP method: `POST`, `PUT`, `OPTIONS`. 

 |
| `headers` | `{}` | Custom HTTP headers. 

 |
| `params` | `{}` | Extra params merged into each request body. 

 |
| `extras` | `{}` | Extra data attached to each location record. 

 |
| `httpRootProperty` | `"location"` | JSON root key for location data; `"."` for root. 

 |
| `autoSync` | true | Auto-upload each new location. 

 |
| `autoSyncThreshold` | 0 | Minimum records before auto-sync triggers. 

 |
| `batchSync` | false | Upload all pending locations in one request. 

 |
| `maxBatchSize` | -1 | Max records per batch (`-1` = unlimited). 

 |
| `httpTimeout` | 60000 | HTTP request timeout in ms. 

 |
| `locationTemplate` | undefined | Custom location JSON template. 

 |
| `geofenceTemplate` | undefined | Custom geofence JSON template. 

 |

### 2.7 Geofencing Engine

#### Circular Geofences

Uses Android's `GeofencingClient`: 

```java
public void addGeofence(GeofenceConfig config) {
    Geofence geofence = new Geofence.Builder()
        .setRequestId(config.identifier)
        .setCircularRegion(config.latitude, config.longitude, config.radius)
        .setTransitionTypes(
            (config.notifyOnEntry ? Geofence.GEOFENCE_TRANSITION_ENTER : 0) |
            (config.notifyOnExit ? Geofence.GEOFENCE_TRANSITION_EXIT : 0) |
            (config.notifyOnDwell ? Geofence.GEOFENCE_TRANSITION_DWELL : 0)
        )
        .setLoiteringDelay(config.loiteringDelay)
        .setExpirationDuration(Geofence.NEVER_EXPIRE)
        .build();

    GeofencingRequest request = new GeofencingRequest.Builder()
        .addGeofence(geofence)
        .setInitialTrigger(config.geofenceInitialTriggerEntry
            ? GeofencingRequest.INITIAL_TRIGGER_ENTER
            : 0)
        .build();

    geofencingClient.addGeofences(request, pendingIntent);
}

```



#### Spatial Database (Infinite Geofencing)

Android limits simultaneous geofences to **100**. The library overcomes this: 

1. Store **all** geofences in SQLite with lat/lng. 


2. On each location update, perform a **spatial query** within `geofenceProximityRadius` (default 1000m). 


3. Activate/deactivate geofences dynamically — only monitor the nearest ones. 


4. Emit `geofenceschange` event with `{ on: [...activated], off: [...deactivated] }`. 



**Flow:** Current Location → Spatial Query → Determine nearest (up to 100) → Update monitored list → Emit event. 

#### Geofence Configuration

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `identifier` | string | required | Unique identifier. 

 |
| `latitude` | number | required | Center latitude. 

 |
| `longitude` | number | required | Center longitude. 

 |
| `radius` | number | required | Radius in meters. 

 |
| `notifyOnEntry` | boolean | true | Fire on enter. 

 |
| `notifyOnExit` | boolean | false | Fire on exit. 

 |
| `notifyOnDwell` | boolean | false | Fire on dwell (lingering). 

 |
| `loiteringDelay` | number | 0 | Milliseconds to linger before dwell fires. 

 |
| `extras` | object | `{}` | Custom data attached to geofence events. 

 |
| `vertices` | `number[][]` | undefined | Array of `[lat, lng]` for polygon geofences. 

 |

### 2.8 Logging System

The library maintains its own **SQLite log database** separate from location data. 

```java
// Insert log entries
TSLog.log("error", "Something failed");
TSLog.log("warn", "Battery is low");
TSLog.log("info", "Started tracking");

// Query logs
SQLQuery query = SQLQuery.create();
query.setStart(startTimestamp);
query.setEnd(endTimestamp);
query.setOrder(SQLQuery.ORDER_DESC);
query.setLimit(100);

// Actions
String log = TSLog.getLog(query);
TSLog.emailLog(activity, email, query);
TSLog.uploadLog(context, url, query);
TSLog.destroyLog();

```



| Config | Default | Description |
| --- | --- | --- |
| `debug` | false | Enable debug sounds/notifications for lifecycle events. 

 |
| `logLevel` | `Verbose (5)` | Verbosity: Off(0), Error(1), Warning(2), Info(3), Debug(4), Verbose(5). 

 |
| `logMaxDays` | 3 | Days to retain log entries. 

 |

---

## 3. React Native Bridge Layer

### 3.1 ReactPackage Registration

```java
/**
 * ReactPackage — registers the native module for old architecture + autolinking.
 * New architecture uses codegen + TurboModule spec.
 */
@ReactModule(name = "RNBackgroundGeolocation")
public class RNBackgroundGeolocation implements ReactPackage {
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new RNBackgroundGeolocationModule(reactContext));
        return modules;
    }
    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}

```



### 3.2 Native Module

The main `RNBackgroundGeolocationModule` class:

* 
**Extends**: `NativeRNBackgroundGeolocationSpec` (codegen base for TurboModules). 


* 
**Implements**: `ActivityEventListener`, `LifecycleEventListener`. 



#### Core Native Methods (all `@ReactMethod`, Promise-based)

**Lifecycle & Config:**
| Method | Signature | Description |
| :--- | :--- | :--- |
| `ready` | `(ReadableMap params, Promise)` | Initialize with config; first-boot detection.  |
| `configure` | `(ReadableMap params, Promise)` | Deprecated → use `ready`.  |
| `setConfig` | `(ReadableMap params, Promise)` | Merge new config into current.  |
| `reset` | `(ReadableMap defaultConfig, Promise)`| Reset to defaults + apply config.  |
| `start` | `(Promise)` | Start location tracking.  |
| `stop` | `(Promise)` | Stop location tracking.  |
| `getState` | `(Promise)` | Return current config + runtime state.  |

**Geolocation:**
| Method | Signature | Description |
| :--- | :--- | :--- |
| `getCurrentPosition`| `(ReadableMap options, Promise)`| One-shot location fix.  |
| `watchPosition` | `(ReadableMap options, Promise)`| Continuous location stream.  |
| `getOdometer` | `(Promise)` | Get current odometer (meters).  |
| `setOdometer` | `(double value, Promise)` | Set odometer value.  |

**Persistence & HTTP:**
| Method | Signature | Description |
| :--- | :--- | :--- |
| `getLocations` | `(Promise)` | Get all persisted locations.  |
| `getCount` | `(Promise)` | Count of persisted locations.  |
| `sync` | `(Promise)` | Manual HTTP sync of pending records.  |

**Logging:**
| Method | Signature | Description |
| :--- | :--- | :--- |
| `log` | `(String level, String message, Promise)`| Insert custom log entry.  |
| `getLog` | `(ReadableMap params, Promise)` | Query logs.  |
| `emailLog` | `(String email, ReadableMap params, Promise)`| Email log file.  |

### 3.3 Event System — Native → JavaScript

Events are emitted using `RCTDeviceEventEmitter`: 

```java
private void sendEvent(String eventName, WritableMap params) {
    getReactApplicationContext()
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
        .emit(eventName, params);
}

```



**Complete Event Registry (16 events):**
| Event Name | Data Shape |
| :--- | :--- |
| `location` | Location map (coords, activity, battery, etc.)  |
| `motionchange` | `{ isMoving: boolean, location: Location }`  |
| `activitychange` | `{ activity: string, confidence: number }`  |
| `providerchange` | Provider status and authorization info.  |
| `geofenceschange`| `{ on: Geofence[], off: Geofence[] }`  |
| `geofence` | Geofence event details.  |
| `http` | `{ success: boolean, status: int, responseText: string }`  |
| `connectivitychange`| `{ connected: boolean }`  |

### 3.4 Data Conversion Utilities

The library includes bidirectional conversion between React Native's `ReadableMap`/`WritableMap` and Java's `Map`/`JSONObject`. 

* 
`mapToWritableMap(Map<String, ?>)` 


* 
`mapToJson(ReadableMap)` 


* 
`jsonToMap(JSONObject)` 


* 
`iterableToWritableArray(Iterable)` 



### 3.5 TurboModule / New Architecture Support

The library supports both old and new architectures. It uses a Flow-typed **Codegen Spec** (`src/specs/NativeRNBackgroundGeolocation.js`) to generate the native base class. 

---

## 4. Headless Task System

Allows JS execution even when the app is terminated. 

### 4.1 HeadlessTask — EventBus Receiver

```java
@Subscribe(threadMode = ThreadMode.MAIN)
public void onHeadlessEvent(HeadlessEvent event) {
    String name = event.getName();
    WritableMap clientEvent = new WritableNativeMap();
    clientEvent.putString("name", name);
    // ... map event params ...
    HeadlessTaskManager.getInstance().startTask(context, 
        new HeadlessTaskManager.Task.Builder()
        .setName("BackgroundGeolocation")
        .setParams(clientEvent)
        .setTimeout(120000)
        .build()
    );
}

```



### 4.2 HeadlessTaskManager

Handles creating/reusing a **React Native context** when the app is terminated. 

* 
`startTask(context, task)`: Creates context if needed and invokes task. 


* 
`finishTask(context, taskId)`: Signals completion from JS side. 



---

## 5. JavaScript API Layer

(Refer to the `index.js` example for usage). 

---

## 6. Configuration Reference

### 6.1 Geolocation Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `desiredAccuracy` | number | High | Target accuracy level. 

 |
| `distanceFilter` | number | 10 | Distance (meters) before recording. 

 |
| `locationUpdateInterval` | number | 1000 | Location update frequency (ms). 

 |
| `elasticityMultiplier` | number | 0 | Elasticity for distanceFilter scaling. 

 |

### 6.2 Activity Recognition Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `stopTimeout` | number | 5 | Minutes of stillness before stopping. 

 |
| `disableStopDetection` | boolean | false | Disable accelerometer stop detection. 

 |

### 6.3 HTTP & Persistence Options

* 
`url`: Server endpoint. 


* 
`autoSync`: true (Upload immediately). 


* 
`batchSync`: false (Upload individually). 


* 
`maxDaysToPersist`: 1 day. 



### 6.4 Application Options

* 
`stopOnTerminate`: false (Continue tracking if app is killed). 


* 
`startOnBoot`: true (Restart tracking after reboot). 


* 
`enableHeadless`: true (Enable background JS tasks). 



---

## 7. Data Schemas

### 7.1 Location Interface

```typescript
interface Location {
  timestamp: string; // ISO-8601 UTC
  uuid: string;
  is_moving: boolean;
  odometer: number;
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    speed: number;
    heading: number;
  };
  activity: { type: string; confidence: number; };
  battery: { is_charging: boolean; level: number; };
}

```



---

## 8. Enums & Constants

* 
**LogLevel**: `Off(0)` to `Verbose(5)` 


* 
**DesiredAccuracy**: `High(-1)`, `Medium(10)`, `Low(100)` 


* 
**AuthorizationStatus**: `Always(3)`, `WhenInUse(4)` 



---

## 12. Example Usage Pattern

### Headless Task (`index.js`)

```javascript
import { AppRegistry } from "react-native";
import BackgroundGeolocation from "react-native-background-geolocation";

BackgroundGeolocation.registerHeadlessTask(async (event) => {
    const { name, params } = event;
    switch (name) {
        case "location":
            console.log("[HeadlessTask] location:", params.coords);
            break;
        case "terminate":
            console.log("[HeadlessTask] app terminated, service continues");
            break;
        case "boot":
            console.log("[HeadlessTask] device rebooted");
            break;
    }
});

AppRegistry.registerComponent("MyApp", () => App);

```



---

## 13. Implementation Checklist

* **Phase 1: Core Android Native Layer**
* 
`LocationService` with `FusedLocationProviderClient`. 


* Foreground service + persistent notification. 


* Runtime permission flow (Fine → Background). 




* **Phase 2: Activity Recognition**
* Integrate `ActivityRecognitionClient`. 


* Implement stop-detection timer. 




* **Phase 3: Persistence & HTTP**
* SQLite database CRUD. 


* Auto-sync logic with OkHttp. 




* **Phase 4: Bridge & Headless**
* React Native Bridge module. 


* Headless JS task execution system. 





> **Note**: The core tracking engine in `react-native-background-geolocation` (the `tslocationmanager` AAR) is closed-source commercial software. This guide documents the architecture so you can build your own implementation using the same patterns. 
> 
>