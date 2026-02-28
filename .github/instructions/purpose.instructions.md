---
description: When building features for touchgrass, it's important to keep the core purpose of the app in mind. This file outlines the main goals and features of touchgrass to ensure that all development efforts are aligned with the app's mission.
applyTo: When building features for touchgrass
---

# TouchGrass

TouchGrass is an Android-first app blocker built to reduce compulsive app use by requiring intentional physical activity before selected apps are unblocked.

This file is a **guiding contract**, not a rigid spec. It should prevent regressions and preserve the app’s core behavior while still allowing new features and architectural evolution.

## Purpose

- **Reduce screen addiction** - Make distracting apps harder to access during configured windows.
- **Reclaim intentional time** - Tie app access to real-world movement and routine.
- **Improve mental wellbeing** - Encourage healthy breaks from digital overstimulation.
- **Build trust through reliability** - Tracking and unblock logic must be predictable, transparent, and battery-aware.

## Product Scope (Current)

- **Plans are the product core**:
  - Users choose blocked apps.
  - Users choose days and time windows (entire day or specific range).
  - Users choose unlock criteria: distance, time, or always blocked.
  - When criteria is met, apps are unblocked for the rest of that plan day.
- **Background-first behavior**:
  - Works when app is foregrounded, backgrounded, or process is restarted.
  - Uses Android foreground-service patterns for reliability.
- **Metrics and progress visibility**:
  - Daily/weekly movement and goal progress are surfaced to users.

## System Architecture (Current)

TouchGrass is React Native UI + native Android services/modules.

- **React Native layer**
  - Owns UI, plans management UX, and user-facing state presentation.
  - Uses JS bridges (`Tracking.ts`, `MotionTracker.ts`) to interact with native systems.
- **Native Android layer**
  - Owns motion detection, activity recognition integration, GPS/location tracking, foreground service lifecycle, and persistent notifications.
  - Uses a single tracking orchestrator service with motion + tracking coordination.
- **Persistence model**
  - Room is authoritative for session history and daily aggregates.
  - MMKV is fast-path shared state for live flags, goals, and cross-process snapshots.

## Core Behavior Contracts (Anti-Regression)

These are expected behaviors that future changes should preserve unless intentionally redesigned.

### Motion Detection + Activity Recognition

- Motion detection is a **state machine**, not a one-off event.
- State transitions should remain deterministic and debounced (e.g., IDLE → POTENTIAL_MOVEMENT → MOVING → POTENTIAL_STOP).
- Activity Recognition signals (walking/running/cycling/still/in-vehicle) are key context for start/stop decisions.
- Movement start must resist false positives (sensor corroboration + confidence + timing windows).
- Stop decisions should remain resilient to short pauses and noise while still ending sessions promptly when movement truly stops.
- Vehicle detection must prevent accidental walking-distance accumulation.

### Tracking

- Tracking is motion-driven for battery efficiency:
  - GPS should stay off/low-power while idle.
  - GPS should escalate during confirmed movement.
- Distance/time accumulation should use filtered, plausible location deltas.
- Session lifecycle should be explicit: start, update, stop, persist.
- Daily totals must remain consistent across app restarts and service restarts.
- Goal completion logic must stay aligned with plan criteria and day scope.

### Notification System

- Foreground-service notification is required for background reliability and transparency.
- Notification content should communicate:
  - whether plans are active today,
  - blocked-app count,
  - progress toward active goal(s) (distance/time) when applicable.
- Notification updates should be efficient (throttled/idempotent) to avoid battery/UI churn.
- Tracking and blocker services should maintain clear notification ownership boundaries to avoid race conditions.

### App Blocking Integration

- Blocking behavior is the user-facing outcome of plans + tracking progress.
- Tracking status and blocker state must stay coherent (no silent divergence between UI, service state, and actual block state).
- “Always blocked” criteria should bypass movement-based unlocking semantics.

## Engineering Principles for Future Work

- **Preserve intent over implementation details**: internal classes can change, but user-observable behavior should remain stable.
- **Fail safely**: if data is uncertain/corrupt, default to conservative behavior that avoids accidental over-unlocking.
- **Prefer single-source-of-truth flows** for live state; avoid duplicate mutable state across JS/native.
- **Keep battery impact explicit** in design decisions (sampling rates, polling, notification churn, GPS mode).
- **Android-first constraints are real**: respect modern background-execution requirements and foreground-service rules.
- **Instrumentation matters**: keep debug signals/logging around motion/tracking transitions to diagnose edge cases.

## Extensibility (Non-Restrictive Guardrails)

Future features are encouraged (new criteria, smarter insights, expanded platform support, richer automation) if they preserve the core mission:

- Do not remove the “intentional movement unlock” value proposition.
- Do not weaken reliability of background tracking/blocking flows.
- Do not introduce UX that obscures why apps are blocked/unblocked.
- Do not make the system so rigid that new sensors, models, or criteria cannot be integrated.

When introducing new capabilities, treat this document as a baseline contract and update it alongside major behavioral changes.

## Change Checklist (Use Before Merging)

- Does this change support reducing compulsive app usage through intentional action?
- Does it preserve or improve reliability of motion → tracking → unblock flow?
- Does it maintain coherence between notification state, persisted state, and UI state?
- Does it avoid regressions in battery behavior and foreground-service compliance?
- If behavior changed intentionally, was this file updated to reflect the new contract?

## Considerations

- Android is the production target and source of truth for tracking/blocking behavior.
- iOS code may exist in repo, but core product guarantees currently prioritize Android behavior.
