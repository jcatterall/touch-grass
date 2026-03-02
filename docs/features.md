# TouchGrass — Feature Reference

A behavior-modification app that gamifies outdoor exercise (walking, running, cycling) by blocking distracting apps until daily activity goals are met.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [App Entry & Navigation](#app-entry--navigation)
3. [Onboarding Flow](#onboarding-flow)
4. [Tracking System](#tracking-system)
5. [Motion Detection Engine](#motion-detection-engine)
6. [GPS & Distance Filtering](#gps--distance-filtering)
7. [App Blocking System](#app-blocking-system)
8. [Notification Blocking](#notification-blocking)
9. [Plans & Criteria](#plans--criteria)
10. [Metrics & Analytics](#metrics--analytics)
11. [Streak System](#streak-system)
12. [Storage Layers](#storage-layers)
13. [Permissions](#permissions)
14. [Screens & UI](#screens--ui)
15. [Component Library](#component-library)
16. [Theme System](#theme-system)
17. [Monetization](#monetization)

---

## Tech Stack

**React Native / JS**
- React Native 0.83.1, React 19.2.0, TypeScript 5.8.3
- `react-native-mmkv` (v3.2.0) — fast synchronous key-value store, shared with native layer
- `react-native-purchases` (v9.7.6) — RevenueCat subscription management
- `react-native-reanimated` (v4.2.1) — animations
- `react-native-svg` (v15.15.1) — SVG rendering
- AsyncStorage — persistent user data (plans, onboarding state)

**Android / Kotlin**
- Kotlin foreground services for GPS tracking and app blocking
- Google FusedLocationProviderClient — GPS sessions
- Google Activity Recognition API — motion detection
- MMKV (multi-process mode) — shared state across processes
- Room database — persistent session and daily totals
- NotificationListenerService — notification interception

---

## App Entry & Navigation

**Entry point:** `src/App.tsx`

- Initializes RevenueCat SDK with key from `BuildConfig`
- Shows splash screen for a minimum 1-second load
- Routes to **Onboarding** (first launch) or **MainApp** (returning user)
- Onboarding completion persisted to AsyncStorage

**Post-onboarding navigation (`src/screens/main/MainApp.tsx`):**
- `HomeScreen` — always-visible base layer
- Bottom tab bar with two buttons: Plans (notebook icon) and Metrics (chart icon)
- Top-right Crown button → Paywall
- Overlay system for Plans, Metrics, and Paywall screens (z-index 10)
- `BlockingScreen` sits at z-index 20 (above all overlays)
- Polls every 1 second to check if an app is currently being blocked

---

## Onboarding Flow

**File:** `src/screens/onboarding/onboarding.tsx`

14-step sequential wizard:

| Step | Screen | Purpose |
|------|--------|---------|
| 1 | Home | Welcome screen |
| 2 | Why | App purpose explanation |
| 3 | Usage | Current phone usage data |
| 4 | UsagePermissions | Request usage stats permission |
| 5 | UsageReport | Display collected usage data |
| 6 | GoalsSplash | Introduction to goals |
| 7 | Goals | User answers questions to define goals |
| 8 | PlanSplash | Introduction to plans |
| 9 | Plan | Create first blocking plan (skippable) |
| 10 | PlanBuilding | Confirmation/building animation |
| 11 | Streak | Explain streak concept |
| 12 | Paywall | Subscription pitch |
| 13 | NotificationBlock | Request notification listener permission |
| 14 | Notification | Final instructions |

Data collected: `blockingPlans` (array) and `answers` (goal question responses).

---

## Tracking System

### Manual Tracking

**JS orchestration:** `src/hooks/useTracking.ts`
**Native interface:** `src/tracking/Tracking.ts`
**Native implementation:** `android/.../TrackingService.kt`, `TrackingController.kt`

- User taps Play → `startManual()` → `Tracking.startTracking(goalType, goalValue, goalUnit)`
- Launches `TrackingService` as Android foreground service (sticky notification)
- GPS starts in HIGH_ACCURACY mode (3s interval, 3m min distance)
- Distance and elapsed time accumulate in `SessionManager`
- Native emits `onProgress` events; JS ticks the UI at 1 Hz using anchor snapshots
- When goals are reached, `onGoalReached` event fires; session can auto-stop
- On stop, daily totals are reconciled between Room DB, MMKV, and AsyncStorage

### Background / Auto-Tracking

- User taps Footprints button → `toggleBackgroundTracking()`
- Calls `Tracking.startIdleService()` → starts `TrackingService` in IDLE state
- `MotionSessionController` listens for motion signals
- When movement confirmed → native auto-starts GPS session
- When stationary confirmed → native auto-stops GPS (after ~20s buffer)
- JS receives `onTrackingStarted` / `onTrackingStopped` events and syncs UI
- State persisted in MMKV: `is_auto_tracking`

### Foreground Service Notification

- Displays today's distance and elapsed time
- Shows number of blocked apps when blocker is active
- Updates throttled to 2-second minimum interval
- Foreground service type: `LOCATION` + `HEALTH` (Android Q+)

### Anchor Pattern (UI Ticking)

`getTrackingAnchor()` returns a snapshot:
- `todayDistanceMeters`, `todayElapsedSeconds` — running daily totals
- `sessionDistanceMeters`, `sessionElapsedSeconds` — current session
- `goalReached`, `isTracking`, `mode`, `shouldTick`, `lastUpdateMs`

JS uses anchor as baseline and increments elapsed at 1 Hz when `shouldTick = true`. Re-syncs when: 5m distance delta, 15s elapsed, or any state change.

### Day Rollover

- `DayRolloverScheduler` sets a midnight AlarmManager alarm
- On rollover: persists yesterday's plan activity snapshot, resets MMKV counters, loads new day's baseline from Room DB
- Rollover is idempotent — multiple calls have no side effects
- JS also detects rollover via MMKV `current_day` key mismatch

---

## Motion Detection Engine

**Files:** `android/.../MotionEngine.kt`, `MotionSessionController.kt`

### Sensors

- Runs on dedicated HandlerThread (`MotionSensorThread`)
- Step Detector, Accelerometer, Gyroscope
- Google Activity Recognition API (WALKING, RUNNING, ON_BICYCLE, IN_VEHICLE, STILL)

Power modes:
- IDLE/POTENTIAL_STOP: Accel at ~5 Hz, gyro off
- MOVING/POTENTIAL_MOVEMENT: Accel at ~50 Hz, gyro on

### Signal Processing

- **Step cadence:** 32-slot ring buffer, steps/sec over 5-second window
- **Accelerometer variance:** Rolling deviation from gravity (9.8 m/s²), 500ms debounce
- **Activity Recognition:** ENTER/EXIT transitions from Google Play Services
- **Stationary surface lock:** Prevents phantom triggers from vibration (desk, vehicle)
  - Engage: Variance < 0.08 + zero cadence for 10 seconds
  - Release: Variance spike > 0.25

### Movement Corroboration

Requires ≥2 distinct signals (step, variance, AR ENTER) within 3 seconds before confirming MOVING.

### State Machine

```
UNKNOWN → IDLE → POTENTIAL_MOVEMENT → MOVING → POTENTIAL_STOP → IDLE
```

**Start conditions (IDLE → MOVING):**
- POTENTIAL_MOVEMENT sustained 6 seconds
- Confidence ≥ 0.75 + cadence ≥ 0.8 steps/sec

**Stop conditions (MOVING → IDLE):** All must be true:
1. No steps for 7 seconds (20s for cycling)
2. Variance < 0.12
3. Last movement signal > 3.5 seconds ago
4. POTENTIAL_STOP sustained 9 seconds

**Micro-movement guard:** Variance > 0.20 during POTENTIAL_STOP returns to MOVING (catches traffic light pauses)

**Failsafe stop:** No steps for 45 seconds (catches escalators, stuck AR state)

**Vehicle override:** IN_VEHICLE ENTER immediately forces IDLE from any state

---

## GPS & Distance Filtering

**File:** `android/.../GpsManager.kt`, `TrackingController.kt`

### GPS Power Modes

| Mode | Priority | Interval | Min Distance |
|------|----------|----------|--------------|
| HIGH_ACCURACY | PRIORITY_HIGH_ACCURACY | 3s | 3m |
| LOW_POWER | PRIORITY_BALANCED_POWER_ACCURACY | 10s | 10m |
| BALANCED | PRIORITY_BALANCED_POWER_ACCURACY | 5s | 5m |
| OFF | — | — | — |

Uses FusedLocationProviderClient. `minUpdateInterval = interval / 2`.

Vehicle detection switches to LOW_POWER. Returning to active switches back to HIGH_ACCURACY.

### Distance Filtering (LocationProcessor)

- Rejects all deltas while in IN_VEHICLE state
- Implausible jump rejection: `delta > accuracy × 10` (capped at 200m)
- Minimum distance thresholds before accumulating:
  - Manual mode: 1m
  - Auto (confirmed WALK/RUN/BIKE): 3m
  - UNKNOWN / fallback: 10m
- Speed validation: ≥ 0.5 m/s required

### Elapsed Time Gates

- Manual: Always accumulates
- Auto: Only when both `motionMoving` AND `arIsActive` with an eligible activity type (WALKING, RUNNING, CYCLING)
- Prevents time accumulation during vehicle rides even if GPS shows movement

---

## App Blocking System

### Architecture

**JS interface:** `src/native/AppBlocker.ts`
**Native module:** `android/.../AppBlockerModule.kt`
**Native service:** `android/.../AppBlockerService.kt`
**Policy evaluator:** `android/.../BlockPolicyEvaluator.kt`

### Blocker Configuration

`updateBlockerConfig(blockedPackages[], goalsReached, hasPermanent)`:
- Writes config to SharedPreferences (`touchgrass_blocker_prefs`)
- Syncs blocked count to MMKV for fast notification reads
- Clears `currently_blocked` if app removed from list
- Notifies TrackingService to refresh its notification

### Polling Strategy

- `AppBlockerService` polls foreground app via `UsageStatsManager.queryEvents()` (5s window)
- Interval: 500ms when actively blocking, 1000ms when idle
- Deduplication: Repeated blocks of same app within 1500ms are ignored

### Blocking Decision (BlockPolicyEvaluator)

```
package not in blocked list → ALLOW
hasPermanent = true → BLOCK (always)
goalsReached = true → ALLOW
else → BLOCK
```

Decision reasons: `blank_package`, `not_target_package`, `permanent_plan`, `goals_reached`, `active_day_unmet_goals`

### Blocking UI Flow

1. Foreground app matches blocked list → increment blocked attempt counter
2. Launch `MainActivity` with `SHOW_BLOCKER=true` intent extra
3. `MainApp.tsx` polls `getCurrentlyBlockedApp()` every 1s
4. If app blocked → render `BlockingScreen` at z-index 20
5. `BlockingScreen` sets immersive mode (hides nav bar)
6. Hardware back button intercepted — cannot dismiss
7. When goals met, close button allows return to app

### Gesture Blocker Overlay

- 80dp transparent overlay at screen bottom
- `TYPE_APPLICATION_OVERLAY`, `FLAG_NOT_FOCUSABLE`, `FLAG_LAYOUT_NO_LIMITS`
- `PixelFormat.TRANSLUCENT` to preserve visual fidelity

### Blocked Attempt Metrics

Per-app and total daily counters stored in MMKV, with midnight rollover.

---

## Notification Blocking

**File:** `android/.../NotificationBlockListenerService.kt`

- Extends `NotificationListenerService`
- On `onNotificationPosted()`: checks `BlockPolicyEvaluator` for the posting package
- If blocked → `cancelNotification(sbn.key)`
- Increments per-app counter in `MMKVStore` and `MMKVMetricsStore`
- Deduplication: 1500ms window prevents duplicate cancellations
- Auto-rebinds on disconnect (`requestRebind()`, API 24+)

Metrics exposed to JS via `AppBlockerModule`:
- `getNotificationsBlockedTodayForApp(packageName)`
- `getNotificationsBlockedTodayTotal()`

---

## Plans & Criteria

### Plan Structure (`src/types/index.ts`)

```typescript
BlockingPlan {
  id: string                          // UUID
  active: boolean
  days: DayKey[]                      // 'MON'|'TUE'|'WED'|'THU'|'FRI'|'SAT'|'SUN'
  duration:
    | { type: 'entire_day' }
    | { type: 'specific_hours', from: string, to: string }
  criteria:
    | { type: 'distance', value: number, unit: 'km'|'mi' }
    | { type: 'time', value: number }      // seconds
    | { type: 'permanent' }
  blockedApps: BlockedApp[]           // { id, name, icon? }
}
```

### Plan Management (`src/storage/index.ts`)

- `getPlans()` — returns all plans sorted (active first)
- `createPlan()`, `updatePlan()`, `deletePlan()`
- `duplicatePlan()` — clones plan with new UUID
- `togglePlanActive()` — enable/disable without deleting
- `PLANS_CHANGED_EVENT` emitted via `DeviceEventEmitter` on any plan mutation

### Plan Activation Logic (`src/hooks/useTracking.ts`)

`findActivePlansForToday()`:
1. Plan must have `active = true`
2. Today's `DayKey` must be in plan's `days` array
3. If `duration.type = 'specific_hours'`, current time must be within the window

`findBlockingPlansForToday()` — same as above but requires `blockedApps.length > 0`

`aggregateGoals()` — combines all active plans' distance/time goals into a single target

`checkAllGoalsReached()` — verifies current totals meet all aggregated goals

### Plan CRUD UI (`src/screens/main/PlanList.tsx`)

Per-plan context menu: Edit, Duplicate, Pause/Resume, Delete (with confirmation).
Empty state shows illustration with prompt to create first plan.

---

## Metrics & Analytics

**Screen:** `src/screens/main/MetricsScreen.tsx`
**Native queries:** `TrackingModule.getMetricsSummary()` / `getMetricsSeries()`

### Period Views

- Day / Week / Month selector (SegmentedControl)
- All-time cumulative stats always shown at bottom

### Metric Categories

**Activity:**
- Total distance (meters, converted to km/mi for display)
- Total elapsed time
- Days with goals reached

**Blocking:**
- Blocked attempts (for period + daily)
- Notifications blocked (for period + daily)

**Streaks:**
- Current goal streak (days)
- Longest goal streak (days)
- Refreshes when tracking stops

**Usage (requires usage stats permission):**
- Top 3 apps by screen time
- Daily device pickups

**Period Insights:**
- Average daily distance
- Number of days in selected period

### Native Metrics Pipeline

1. `TrackingModule.getMetricsSummary(period, anchorDate?)` — returns `NativeMetricsSummary`
2. `TrackingModule.getMetricsSeries(period, anchorDate?)` — returns daily data points with streak state
3. Results cached in `MMKVMetricsStore` (daily snapshots, rolling 7/30/365-day windows, monthly, all-time)
4. Today's open session reconciled from Room DB + MMKV before returning

### NativeMetricsSummary Shape

```typescript
{
  period, startDate, endDate,
  distanceMeters, elapsedSeconds, sessions,
  goalsReachedDays,
  blockedAttempts, notificationsBlocked,
  currentGoalStreakDays, longestGoalStreakDays,
  computedAtMs
}
```

---

## Streak System

**Hook:** `src/hooks/useStreakData.ts`
**Computation:** `android/.../GoalStreaks.kt`

- Queries `getMetricsSummary('alltime')` and `getMetricsSeries('week')`
- Returns: `currentStreak`, `longestStreak`, `todayComplete`
- Supports manual refresh via `refreshKey` prop (triggered on tracking stop)

**Streak computation rules:**
- A day counts toward streak if goals were reached AND a plan was active that day
- Accounts for install day (seeded via `ensureInstallDaySeeded()`)
- Gaps (days without active plans) do not break a streak

**MMKV Metrics keys:**
- `metrics:alltime` — includes `currentGoalStreakDays`, `longestGoalStreakDays`
- `metrics:plans:daily:YYYY-MM-DD` — `{hasActivePlans}` used by streak computation

---

## Storage Layers

### 1. MMKV Fast Storage (`src/storage/index.ts` → `fastStorage`)

Multi-process, synchronous, mmap-backed. Shared between JS and Kotlin native layers.

**Today's tracking state:**

| Key | Type | Description |
|-----|------|-------------|
| `current_day` | string | YYYY-MM-DD, used for rollover detection |
| `today_distance_meters` | number | Accumulated distance today |
| `today_elapsed_seconds` | number | Accumulated time today |
| `today_goals_reached` | boolean | Whether goals are met |
| `today_last_update_ms` | number | Last native projection timestamp |

**Goal configuration (written by JS, read by native):**

| Key | Type | Description |
|-----|------|-------------|
| `goal_type` | string | `'distance'` \| `'time'` \| `'none'` |
| `goal_distance_value` | number | Distance goal value |
| `goal_distance_unit` | string | `'km'` \| `'mi'` |
| `goal_time_value` | number | Time goal in seconds |
| `goal_time_unit` | string | Unit string |

**Plan state:**

| Key | Type | Description |
|-----|------|-------------|
| `plan_active_today` | boolean | Whether any plan is active today |
| `plan_day` | string | Date string for plan expiry tracking |
| `plan_active_until_ms` | number | Expiry timestamp (midnight or end of time window) |

**Blocking metrics (auto-rollover at midnight):**

| Key | Type | Description |
|-----|------|-------------|
| `today_notifications_blocked_total` | number | Total notifications blocked today |
| `today_notifications_blocked_by_app` | JSON | `{packageName: count}` |
| `today_blocked_attempts_by_app` | JSON | `{packageName: count}` |

**Other:**
- `is_auto_tracking` — background tracking enabled flag
- `tracking_mode` — `"idle"` \| `"auto"` \| `"manual"`
- `tracking_revision` — bumped on every state change (cache invalidation)
- `blocked_count` — number of currently blocked packages

### 2. Room Database

**Entities:**

`sessions` table:
```
id (UUID), date (YYYY-MM-DD), mode (auto|manual),
startMs, endMs (null if open), distanceMeters, elapsedSeconds, goalReached
```

`daily_totals` table:
```
date (PK, YYYY-MM-DD), distanceMeters, elapsedSeconds,
goalsReached, sessionCount, lastUpdatedMs
```

**Key DAO operations:**
- `upsertSession()`, `getLatestOpenSessionForDate()` — session lifecycle
- `upsertDailyTotal()`, `accumulateDaily()` — atomic delta accumulation
- `getDailyTotalsBetween(start, end)` — range queries for metrics

### 3. MMKV Metrics Store (`MMKVMetricsStore`)

Derived snapshots computed from Room and written periodically.

| Key pattern | Content |
|-------------|---------|
| `metrics:daily:YYYY-MM-DD` | DailyTotalEntity snapshot |
| `metrics:rolling:7d` / `30d` / `365d` | Window aggregates |
| `metrics:monthly:YYYY-MM` | Monthly totals + goal days |
| `metrics:alltime` | All-time stats + streak data |
| `metrics:blocking:daily:YYYY-MM-DD` | Blocking metrics per day |
| `metrics:plans:daily:YYYY-MM-DD` | `{hasActivePlans}` |
| `metrics:install:day` | Install date (streak seed) |

Indices bounded at 400 entries for efficient iteration.

### 4. AsyncStorage (Persistent User Data)

- `getOnboardingComplete()` / `setOnboardingComplete()` — first-launch gate
- `getPlans()` / CRUD — blocking plan definitions
- `getDailyActivities()` / `saveDailyActivity()` — historical activity log
- `getBackgroundTrackingEnabled()` — user preference for auto-tracking

---

## Permissions

**File:** `src/tracking/Permissions.ts`

Requested sequentially on first tracking attempt:

| Permission | Android API | Purpose |
|------------|-------------|---------|
| `ACTIVITY_RECOGNITION` | 10+ | Detect when user is walking/running |
| `ACCESS_FINE_LOCATION` | all | Precise GPS coordinates |
| `ACCESS_BACKGROUND_LOCATION` | 10+ | Track when screen is off |
| `POST_NOTIFICATIONS` | 13+ | Show tracking progress notification |

**Managed via AppBlockerModule:**
- `SYSTEM_ALERT_WINDOW` (overlay) — display blocking screen over other apps
- `OPSTR_GET_USAGE_STATS` (usage stats) — detect foreground app for blocking
- `NOTIFICATION_LISTENER_SETTINGS` — intercept and cancel notifications

HomeScreen shows a Shield button to prompt for missing blocker permissions.

---

## Screens & UI

### HomeScreen (`src/screens/main/HomeScreen.tsx`)

Primary active-tracking interface:
- **Progress Ring** — circular indicator (220px diameter, 14px stroke width)
- **Distance/Time display** — `"2.5km / 5km"` format
- **Dynamic status text** — changes based on tracking state
- **Play/Stop button** — manual tracking toggle (hidden in background mode)
- **Footprints button** — toggle background auto-tracking
- **Shield button** — request blocker permissions (shown only if missing)
- **Debug panel** — real-time GPS state, step cadence, variance metrics (dev only)

### MetricsScreen (`src/screens/main/MetricsScreen.tsx`)

Analytics dashboard:
- Period selector (Day / Week / Month)
- Activity, blocking, and streak metrics (see [Metrics & Analytics](#metrics--analytics))
- All-time stats at bottom
- Usage section with top 3 apps (if permission granted)

### PlanList (`src/screens/main/PlanList.tsx`)

Plan management:
- Cards for each plan with active/inactive indicator
- Per-plan menu: Edit, Duplicate, Pause/Resume, Delete
- Empty state illustration when no plans exist

### BlockingScreen (`src/screens/main/BlockingScreen.tsx`)

Full-screen blocking overlay:
- Immersive mode — hides navigation bar to prevent gesture escape
- Hardware back button intercepted
- Random motivational quotes (`"Time to touch some grass!"`, etc.)
- Current progress toward goal
- Distance/time remaining to unlock
- Per-app blocking stats (notifications blocked, attempts blocked)
- Close button to dismiss and return to the blocked app
- `"Goal Reached!"` status badge when criteria met

### PaywallScreen (`src/screens/main/PaywallScreen.tsx`)

- Integrates RevenueCat `react-native-purchases-ui`
- Premium features presentation and subscription purchase

---

## Component Library

**Layout:**
- `Main` — basic wrapper layout
- `MainScreen` — modal-like screen with close button and header
- `NestedScreen` — nested modal with header and footer actions

**Controls:**
- `Button` — variants: primary, secondary, tertiary, danger, link; sizes: sm/md/lg/xl
- `Toggle` — switch (56×32px track, 24px thumb)
- `Select` — dropdown (blue or orange color scheme)
- `Slider` — range input
- `TimeRangeSlider` — dual-handle for time windows
- `RadioRow` — radio button with label
- `SelectionRow` — checkbox with label

**Display:**
- `Card` — container with optional chevron/icon
- `Typography` — preset variants: heading, title, subtitle, body
- `ProgressRing` — circular SVG progress indicator
- `Chip` — small tag
- `DayChip` — day-of-week selector
- `TimePill` — readable time display
- `AppIcon` — app icon with fallback
- `Illustration` — SVG illustrations for onboarding

**Navigation & Overlays:**
- `SegmentedControl` — tab-like selector
- `Carousel` — swipeable content
- `Pagination` — dots or bars
- `Menu` / `OverlayMenu` — dropdown and context menus
- `ConfirmModal` — confirmation dialog
- `Tooltip` — floating info tooltip

**Plan-Specific:**
- `Plan` — main plan builder interface
- `PlanBlockList` — blocked apps list management
- `PlanCriteria` — goal type selector (distance/time/permanent)
- `PlanDays` — day-of-week selection grid
- `PlanDayRange` — entire day vs. specific hours picker
- `PlanListCard` — plan display card with menu

**Tracking/Metrics:**
- `Streak` — current/longest streak display
- `DailyStreak` — visual daily indicator
- `UsageChart` — usage visualization
- `UsageApps` — top apps display
- `UsagePickups` — device pickup count
- `UsageComparison` — usage comparison view

---

## Theme System

**File:** `src/theme/theme.ts`
Dark mode only.

### Brand Colors

| Name | Hex | Use |
|------|-----|-----|
| `meadowGreen` | `#4F7942` | Primary brand |
| `skyBlue` | `#87CEEB` | Primary buttons |
| `terracotta` | `#E2725B` | Danger / secondary |
| `oatmeal` | `#F5F5DC` | Light accent |
| `charcoal` | `#2F2F2F` | Dark backgrounds |

### Spacing Scale

`xxxs: 2` / `xxs: 4` / `xs: 8` / `sm: 12` / `md: 16` / `lg: 20` / `xl: 24` / `xxl: 32` / `xxxl: 40` / `xxxxl: 48` (all px)

### Border Radius

`xs: 4` / `sm: 8` / `md: 12` / `lg: 16` / `xl: 20` / `xxl: 24` / `pill: 999`

### Button Sizes

| Size | Height |
|------|--------|
| sm | 32px |
| md | 40px |
| lg | 48px |
| xl | 56px |

### Shadows

Five levels (none → xl) with corresponding Android elevation values.

---

## Monetization

**Library:** `react-native-purchases` (RevenueCat)

- SDK initialized in `App.tsx` with key from `BuildConfig.REVENUECAT_API_KEY`
- `PaywallScreen` uses `react-native-purchases-ui` for native paywall rendering
- Crown button in `MainApp` top bar opens paywall
- Paywall also appears as step 12 of the onboarding flow
- Subscription state used to gate premium features (specific gating logic in RevenueCat entitlements)
