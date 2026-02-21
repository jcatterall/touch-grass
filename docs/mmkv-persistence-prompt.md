You are a senior Android + React Native systems engineer.

Your task is to integrate the existing Motion-driven TrackingService with the app’s MMKV persistence layer and ensure live, reactive progress updates across the notification and home screen.

This is an integration task — NOT a redesign.

The TrackingService already exists and is motion-driven, activity-aware, and GPS-based.

We must:

• Persist daily totals to MMKV  
• Persist session state for crash recovery  
• Keep MMKV as the single source of truth  
• Preserve the existing fastStorage API  
• Avoid breaking useTracking.ts  
• Remove any legacy tracking persistence logic  
• Ensure Android lifecycle & background reliability  
• Ensure thread-safe, non-blocking writes  
• Ensure totals update reactively everywhere  

---

# 🚨 CRITICAL RULES

## DO NOT
❌ create new persistence systems  
❌ change existing MMKV key names  
❌ modify JS API surface  
❌ introduce Room / SQLite  
❌ duplicate totals across layers  
❌ write daily totals from JS  
❌ poll MMKV for updates  

## DO
✅ make TrackingService the only writer to MMKV totals  
✅ support crash recovery (< 1 hour)  
✅ support day rollover  
✅ support offline operation  
✅ use native progress events for UI updates  
✅ ensure notification & UI always match  

---

# ARCHITECTURE PRINCIPLES

## MMKV = Source of Truth

### Daily totals
- today_distance_meters
- today_elapsed_seconds
- today_goals_reached
- current_day

### Session state (ephemeral)
- session_active
- session_start_time_ms
- session_distance_meters
- session_elapsed_seconds
- session_last_update_ms

TrackingService writes all values.  
JS reads only.

---

# PART 1 — ANDROID IMPLEMENTATION

## 1️⃣ Extend MMKVStore.kt

File:
android/app/src/main/java/com/touchgrass/storage/MMKVStore.kt

Provide:

### Daily totals (existing)
setTodayDistance()
setTodayElapsed()
setGoalsReached()
getCurrentDay()
setCurrentDay()

### Session state
setSessionActive()
isSessionActive()

setSessionStartTime()
getSessionStartTime()

setSessionDistance()
getSessionDistance()

setSessionElapsed()
getSessionElapsed()

setSessionLastUpdate()
getSessionLastUpdate()

clearSessionState()

shouldResumeSession():
• return false if inactive  
• return false if older than 1 hour  
• otherwise true  

Use synchronous MMKV access.

Ensure thread safety.

---

## 2️⃣ Update TrackingService.kt

File:
android/app/src/main/java/com/touchgrass/tracking/TrackingService.kt

### A. On session start

When a new session begins:

• setSessionActive(true)  
• setSessionStartTime(now)  
• reset session metrics  
• setCurrentDay(today)  
• call checkDayRollover()  

---

### B. On progress update

On each state update:

Update session state:

• session_distance_meters  
• session_elapsed_seconds  
• session_last_update_ms  

Update daily totals:

• today_distance_meters  
• today_elapsed_seconds  
• today_goals_reached  

Writes must be lightweight and off the main thread.

---

### C. Emit reactive progress events

Emit events to JS containing BOTH session and TOTAL progress:

```

{
sessionDistanceMeters,
sessionElapsedSeconds,
totalDistanceMeters,
totalElapsedSeconds,
goalReached,
isMoving,
activityType
}

```

Where:

totalDistanceMeters =
todayDistanceMeters + sessionDistanceMeters

totalElapsedSeconds =
todayElapsedSeconds + sessionElapsedSeconds

JS must not recompute totals differently.

---

### D. Update foreground notification reactively

Notification must update whenever:

• distance changes  
• elapsed time changes  
• goal reached state changes  
• activity state changes  
• session resumes  

Notification displays:

• TOTAL distance today  
• TOTAL elapsed time today  
• goal completion status  

Rules:

✔ update on each progress tick  
✔ throttle updates (~1–2 seconds)  
✔ skip update if values unchanged  
✔ avoid heavy formatting  

---

### E. On session stop

• flush final totals to MMKV  
• clearSessionState()  
• update notification  

---

### F. Day rollover

Implement checkDayRollover():

If stored day != today:

• reset totals  
• reset goals  
• setCurrentDay(today)  

---

### G. Crash recovery on service start

In onCreate():

If shouldResumeSession():

• restore session distance & elapsed  
• restore start time  
• resume motion & GPS tracking  
• recompute totals  
• update notification immediately  
• emit progress event  

---

# PART 2 — JAVASCRIPT INTEGRATION

## 3️⃣ Extend fastStorage (READ ONLY)

File:
src/storage/index.ts

Add:

getSessionActive()  
getSessionDistance()  
getSessionElapsed()  

Do not modify existing keys.

---

## 4️⃣ useTracking.ts

### A. Crash recovery on mount

If session active:

restore sessionProgress from MMKV.

---

### B. Maintain totalDailyProgress state

Update state from native progress events.

DO NOT poll MMKV.

---

### C. Helper: getTotalDailyProgress()

Return:

distanceMeters = totalDistanceMeters  
elapsedSeconds = totalElapsedSeconds  
goalReached = goalReached  

Use this for:

• Home screen totals  
• goal indicators  
• progress displays  

---

### D. Reactively update UI

On progress event:

• update session progress  
• update totals  
• update goal state  

---

### E. Foreground sync

When app returns to foreground:

• fetch latest MMKV totals  
• request latest progress from native  
• reconcile UI state  

---

# PART 3 — REMOVE LEGACY LOGIC

Search and remove:

• old tracking persistence  
• JS-written totals  
• duplicate storage writes  
• legacy recovery logic  
• outdated caching layers  

TrackingService must be the only writer.

---

# PART 4 — PERFORMANCE & THREADING

Ensure:

• no blocking disk I/O on main thread  
• MMKV writes occur on service thread  
• updates are lightweight  
• notification updates throttled  
• service survives background restrictions  
• START_STICKY retained  

---

# PART 5 — REACTIVE UX REQUIREMENTS

Users must always see identical totals in:

• foreground notification  
• Home screen  
• goal completion state  

TOTAL DAILY PROGRESS =
MMKV totals + active session progress

Totals must update instantly.

No UI drift allowed.

---

# PART 6 — OUTPUT FORMAT

Return:

## ✔ Updated Kotlin files
- MMKVStore.kt
- TrackingService.kt (modified sections)

## ✔ Updated TypeScript
- storage additions
- useTracking changes

## ✔ Removed legacy logic summary

## ✔ Lifecycle & crash recovery explanation

## ✔ Reactive update flow explanation

## ✔ Testing checklist

---

# SUCCESS CRITERIA

✔ Daily totals persist across restarts  
✔ Session resumes after crash (< 1 hour)  
✔ Day rollover works  
✔ Notification & Home screen always match  
✔ Totals update in real time  
✔ Goal completion updates instantly  
✔ No duplicate writes  
✔ No API breaking changes  
✔ Background tracking remains stable  
✔ Battery impact minimized  

Begin implementation.

