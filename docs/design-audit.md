# TouchGrass Onboarding UX Audit

**Auditor:** Senior Product Designer / UX Auditor
**Date:** February 2026
**Scope:** Full onboarding flow (20+ screens, 12 logical steps)
**Framework:** Visual Consistency, Cognitive Load, Accessibility & Contrast, Interaction Design

---

## Current Flow Map

```
Home → Why (3 slides) → Usage Slider → Usage Permissions → Usage Report (5 sub-screens)
→ GoalsSplash → Goals (7 steps) → PlanSplash → Plan → Streak → Paywall → Notification
```

**Total taps to complete:** 20+ minimum
**Estimated completion time:** 3-4 minutes (user expectation set at "less than 2 minutes" on Home screen)

---

## 1. Quick Wins (Highest Impact, Lowest Effort)

### QW-1: Fix the "AppBlock" copy error (CRITICAL)

`src/screens/onboarding/usage/UsageFirstWeek.tsx:49` reads:

> "**AppBlock** can help cut down the time on your phone by up to 32% in the first week of use."

This is a competitor's brand name. Immediate trust destroyer. Change to **"TouchGrass"**.

### QW-2: Remove or merge the two splash screens

**GoalsSplash** and **PlanSplash** are pure friction with zero user value. Each shows one illustration, one sentence, and a Continue button. That's 2 extra taps in an already long flow. Merge the splash copy into the header of their respective screens (Goals / Plan).

### QW-3: Add a progress indicator

12 steps with no progress bar. The "Why" carousel has pagination dots, but once that section ends the user flies blind. Add a thin horizontal progress bar across the top of `OnboardingContainer`. Users who can see the finish line are far less likely to quit.

### QW-4: Reduce the Goals questionnaire from 7 steps to 3

7 single-select questions where the answers aren't visibly used downstream is the #1 drop-off point in this flow. Users will think "why am I answering a survey?" Keep a maximum of 3 (how you feel, biggest time drain, motivation) and move the rest to post-onboarding settings.

### QW-5: Disable Continue button when no Goal answer is selected

In `src/screens/onboarding/Goals.tsx:75`, the Continue button is always enabled even when nothing is selected. Users can tap through 7 empty screens, which undermines the entire section's purpose. Either disable the button until a selection is made, or remove the pretense of requiring answers.

---

## 2. Detailed Audit Table

### Visual Consistency

| Screen | Issue | Severity | Recommended Fix |
|--------|-------|----------|-----------------|
| **Why (Carousel)** | Slide 1 illustration uses `lg` size (415px), slides 2-3 use `md` (300px). Visual rhythm breaks on swipe. | Medium | Use the same illustration size across all 3 slides. |
| **UsageActual** | Hardcoded colors `#FF6B6B` and `#2ECC71` are not in the design token system. Introduces rogue palette. | Medium | Replace with `colors.primary60` (terracotta) and `colors.meadow60` from tokens. |
| **PlanSplash** | Reuses the same clock illustration as UsagePermissions. Feels like deja vu. | Medium | Use a unique illustration, or remove PlanSplash entirely. |
| **Plan - DayChip** | Unselected chips have white background with `#E8E8E8` border on a dark screen. They look detached from the dark UI. | Medium | Create a dark-mode chip variant: dark background, light border when unselected. |
| **Blocklist** | Light-themed screen (white bg, dark text) in a 100% dark-mode flow. Jarring modal transition. | High | Apply the dark theme to the Blocklist screen, or add a visual transition. |
| **Streak** | Fire emoji at large size is the only emoji in the entire flow. Clashes with the illustration-driven visual language. | Low | Replace with a small flame illustration for consistency, or keep if the playfulness is intentional. |
| **Goals** | Select options have `marginHorizontal: 16px` PLUS container has `padding: 24px` = 40px from edge. Noticeably narrower than every other screen's content. | Medium | Remove the extra `marginHorizontal` on `.selectWrapper` in Goals.tsx. |

### Cognitive Load

| Screen | Issue | Severity | Recommended Fix |
|--------|-------|----------|-----------------|
| **Usage Slider** | `gap: spacing.xxxxl` (48px) between heading and slider creates a dead zone in the center of the screen. | Medium | Reduce to `spacing.xxl` (32px). The animated number already draws the eye effectively. |
| **UsageReportComparison** | Heading is two full sentences: "No stress, we've got your back. Let's take a look at your potential." Too long for a heading. | Medium | Split into Heading = "Your potential" / Subtitle = "Based on our research, here's what TouchGrass could do for you." |
| **Goals** | 7 steps with zero step indicator (no "3 of 7"). User has no idea how many questions remain. | **Critical** | Add "Step X of Y" counter or progress dots. Or reduce to 3 questions. |
| **Goals** | "Skip" link is top-right plain text. It skips the current question only, not the section. Ambiguous microcopy. | High | Clarify label: "Skip question" or offer "Skip all" to exit the section entirely. |
| **UsageYearly** | Title variant (22px) appears above heading variant (28px). Typography hierarchy is inverted: smaller text introduces larger text below it. | Medium | Swap: The time stat should be the smaller subtitle above; "In 30 years that adds up to" should be the heading. |
| **Paywall** | Feature list includes "Enjoy the full experience" twice (items 1 and 5). Duplicate copy sourced from RevenueCat metadata. | Medium | Deduplicate in the RevenueCat dashboard. |
| **Home** | Promises "Takes less than 2 minutes to set up" but the actual flow takes 3-4 minutes. Broken expectation = broken trust. | High | Either shorten the flow to match the promise, or change copy to "Takes just a few minutes." |

### Accessibility & Contrast

| Screen | Issue | Severity | Recommended Fix |
|--------|-------|----------|-----------------|
| **Plan** | Distance value "8.0 KM" uses `fontWeight: 300` (light) at 48px on dark background. Thin white-on-dark text has poor contrast. | High | Increase to weight 400 or 500. WCAG AA requires 4.5:1 contrast ratio for normal text; thin strokes reduce effective contrast. |
| **UsagePermissions** | "Continue without report" is styled as plain body text, not a visibly tappable element. Users may miss the opt-out entirely. | High | Use a `variant="link"` button with underline or contrasting color to signal interactivity. |
| **Why (Carousel)** | 48px bottom margin on pagination dots wastes viewport on smaller screens, pushing subtitle text into an uncomfortable reading position. | Low | Reduce to `spacing.xl` (24px). |
| **UsageActual** | Bar chart comparison is only 100px tall. Difficult to visually distinguish proportional differences between bars. | Medium | Increase `BAR_HEIGHT` constant to 140-160px for better data readability. |
| **Paywall** | "Cancel anytime in Settings" text alignment doesn't match the centered button above it. | Low | Ensure the Typography component has `center` prop applied. |

### Interaction Design

| Screen | Issue | Severity | Recommended Fix |
|--------|-------|----------|-----------------|
| **Notification** | This is the final screen. "Maybe later" has no indication this is the last step before the main app. User doesn't know what happens next. | Medium | Add copy like "You're all set!" or change the primary button to "Finish setup". Make the terminal nature of this screen obvious. |
| **Paywall** | "Try free and subscribe" button uses the same sky blue style as every Continue button. No visual emphasis for the conversion event. | High | Use `variant="danger"` (terracotta) or a distinct color for the subscribe CTA to differentiate it from navigation buttons. |
| **Plan** | 4 distinct config sections (days, range, criteria, apps) with `gap: 40px`. Content may overflow on smaller (5") screens with no scroll. | Medium | Wrap content area in a `ScrollView`. Test on smallest supported screen size. |
| **Goals (Continue)** | Button is always active regardless of selection state. No feedback loop for completing a step. | High | Disable button until selection is made. Add a subtle animation or checkmark on selection to reinforce progress. |

---

## 3. Friction Map: Where Users Quit

```
PHASE 1: HOOK (Low Friction)
 Home ─── Why (3 slides) ─── Usage Slider
  ✅         ✅                  ✅
  Strong     Engaging           Fun, interactive
  hero       carousel           slider animation

PHASE 2: SHOCK (Medium Friction)
 Permissions ─── Actual vs Guess ─── Stats ─── Yearly ─── Comparison ─── FirstWeek
  ⚠️ MEDIUM       ✅ Great             ✅       ✅ Gut      ⚠️ Medium     ⚠️ Medium
  First real       emotional           Data     punch       Too many      "AppBlock"
  permission ask   impact              rich     moment      data screens  bug kills
                                                            in a row      trust

PHASE 3: SURVEY (HIGH FRICTION)
 GoalsSplash ─── Goals (7 steps)
  🟡 Remove      🔴 CRITICAL DROP-OFF
  Unnecessary     User has been tapping 2+ minutes.
  tap             Now faces 7 survey questions.
                  No progress indicator. No clear benefit.
                  "Skip" only skips one question at a time.

PHASE 4: SETUP (Medium Friction)
 PlanSplash ─── Plan ─── Streak
  🟡 Remove      ✅ OK     ✅ Quick
  Unnecessary     Core      Nice
  tap             value     gamification
                  screen    intro

PHASE 5: CONVERT (High Friction)
 Paywall ─── Notification
  🔴 HIGH     ⚠️ MEDIUM
  Money gate   Final hurdle
  after long   with unclear
  exhausting   "what's next"
  flow
```

### Primary Drop-Off: Goals Questionnaire (Step 7-13 of 20+)

By this point the user has already:
- Swiped through 3 carousel slides
- Set a usage slider value
- Granted (or skipped) a system permission
- Viewed 5 consecutive screens of usage data
- Tapped through a splash screen
- ...and NOW faces 7 more questions with no visible progress

The user's mental model is **"I want to set up my app blocker."** The goals questionnaire feels like a detour that serves analytics, not the user. The questions are well-written individually, but **quantity kills completion rate**. Research consistently shows each additional onboarding step drops completion by 5-10%.

### Secondary Drop-Off: Paywall After Exhaustion

By the time the user reaches the paywall, they've been through ~18 screens. Paywalls convert best when users feel momentum and excitement, not fatigue. The paywall itself is well-designed visually, but its position at the end of an exhausting flow undermines conversion.

---

## 4. Recommended Flow Restructure

### Current: 20+ taps across 12 logical screens

### Proposed: 9-10 screens total

| Phase | Screens | Taps | Purpose |
|-------|---------|------|---------|
| **Hook** | Home > Why carousel > Usage slider | 5 | Build emotional investment |
| **Shock** | Permissions > Actual vs guess > Yearly projection | 3 | Create urgency with data |
| **Solve** | Plan setup (with inline day chips, range, criteria) > Blocklist | 2 | Deliver core value immediately |
| **Convert** | Paywall > Notification | 2 | Monetize and finalize |

**What gets cut:**
- GoalsSplash (merge into Goals header)
- PlanSplash (merge into Plan header)
- Goals questionnaire (move to post-onboarding "Personalize" section)
- UsageStats, UsageReportComparison, UsageFirstWeek (consolidate 5 usage sub-screens into 2-3)
- Streak screen (move to post-first-walk celebration)

**What gets moved:**
- Goals questionnaire becomes a "Personalize your experience" prompt after the user has been using the app for 1-2 days. Higher engagement, higher quality answers.
- Streak intro appears after the user completes their first walk. Contextually relevant and celebratory.

---

## 5. Code-Level Issues Summary

| File | Line | Issue | Type |
|------|------|-------|------|
| `src/screens/onboarding/usage/UsageFirstWeek.tsx` | 49 | "AppBlock" should be "TouchGrass" | **Bug** |
| `src/screens/onboarding/usage/UsageActual.tsx` | 67, 73 | Hardcoded colors `#FF6B6B`, `#2ECC71` outside token system | Token violation |
| `src/screens/onboarding/usage/UsageYearly.tsx` | 28 | Variable named `bigNumberPurple` but uses `colors.terracotta` | Naming mismatch |
| `src/screens/onboarding/Goals.tsx` | 46 | Inline style `{ ...styles.flex, gap: spacing.xxxxl }` - should be in StyleSheet | Style consistency |
| `src/screens/onboarding/Goals.tsx` | 96-98 | `.selectWrapper` adds `marginHorizontal: spacing.md` that compounds with container padding | Spacing bug |
| `src/screens/onboarding/usage/UsageReportComparison.tsx` | 27 | Inline spread `{ ...styles.content }` - unnecessary, can pass `styles.content` directly | Code quality |
| `src/screens/onboarding/Paywall.tsx` | 225 | "Cancel anytime in Settings" text not explicitly centered | Alignment |
| `src/screens/onboarding/usage/Usage.styles.ts` | 36-44 | `createBigNumberStyle` uses raw fontSize without `moderateScale`, unlike all other text | Scaling inconsistency |

---

## 6. What's Working Well

Credit where due - several things in this flow are genuinely strong:

- **Home screen** is excellent. Clear value prop, engaging illustration, time estimate, single CTA. Don't touch it.
- **Usage slider** with animated font scaling is delightful and interactive. Best engagement moment.
- **"13.1 Years" shock screen** is a powerful emotional gut-punch. Keep it.
- **Plan screen** packs a lot of configuration into one screen without feeling overwhelming. Good information architecture.
- **Button system** is rock-solid: consistent `lg` size, pill shape, sky blue throughout. No button inconsistency.
- **Haptic feedback** on slider interactions adds tactile satisfaction.
- **Animation system** using Reanimated with staggered FadeInUp creates a polished, sequential reveal pattern.
- **Illustration quality** is distinctive and on-brand. The hand-drawn style with the recurring character builds personality.

---

## Priority Action Items

| Priority | Action | Impact | Effort |
|----------|--------|--------|--------|
| P0 | Fix "AppBlock" copy to "TouchGrass" | Trust | 1 min |
| P0 | Add progress indicator to OnboardingContainer | Completion rate | 1 hr |
| P1 | Remove GoalsSplash and PlanSplash screens | -2 taps, less friction | 30 min |
| P1 | Reduce Goals from 7 to 3 questions | Completion rate | 30 min |
| P1 | Disable Continue button without selection in Goals | Data quality | 15 min |
| P1 | Apply dark theme to Blocklist screen | Visual consistency | 1 hr |
| P2 | Consolidate Usage sub-screens from 5 to 2-3 | Flow length | 2 hr |
| P2 | Move Goals to post-onboarding | Architecture | 3 hr |
| P2 | Fix hardcoded colors in UsageActual | Token compliance | 15 min |
| P3 | Dark-mode DayChip variant | Visual polish | 30 min |
| P3 | Fix Plan screen thin font weight | Accessibility | 5 min |
