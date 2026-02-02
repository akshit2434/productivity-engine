# Productivity Engine: Gap Analysis & Completion Plan

This document identifies all missing or partially implemented features based on [plan.md](file:///Users/akshit2434/github/productivity-engine/plan.md) and [Design.md](file:///Users/akshit2434/github/productivity-engine/Design.md).

---

## Critical Missing Features

### 1. Project Detail Page
**Status:** ❌ Not Implemented  
**Requirement (plan.md, View 3):**
- Click on a Project in Portfolio → Open a dedicated page.
- Shows: Decay Threshold settings, Project-specific Task Backlog, Notes/Context section.

**Implementation:**
- Create `/portfolio/[id]/page.tsx` for dynamic project routes.
- Fetch project data and related tasks from Supabase.
- Add UI for editing `Decay Threshold`, `KPI Name`, `KPI Value`.

---

### 2. KPI Tracking System
**Status:** ⚠️ Partially Implemented (DB columns exist, no UI)  
**Requirement (plan.md, View 3):**
- Each Project has a **North Star KPI** (e.g., "Outreach Sent: 50").
- Users should be able to set and update this metric.

**Implementation:**
- Add KPI edit form to Project Detail Page.
- Add quick KPI increment/decrement buttons on Portfolio cards.

---

### 3. Performance Analytics (Review Page)
**Status:** 🔴 Fake Data  
**Requirement (plan.md, View 4):**
- **Input vs. Output Chart:** Real data from `activity_logs` table.
- **Project Distribution Chart:** Time split by Tier.
- **Stagnation Report:** Real tasks/projects untouched > 30 days.
- **Waiting On List:** Tasks in `Waiting` state.

**Implementation:**
- Fetch aggregated data from `activity_logs` and `tasks` tables.
- Calculate real metrics: tasks completed per day, time spent by Tier.
- Replace mock chart data with live queries.

---

### 4. Task State Management
**Status:** ⚠️ Partial (Active/Done exist, Waiting/Blocked not exposed)  
**Requirement (plan.md, Section 4B):**
- **Waiting On:** Hidden until a specific date or manual trigger.
- **Blocked:** Hidden until a parent task is completed.

**Implementation:**
- Add UI to set `waiting_until` date and `blocked_by_id` reference.
- Filter these tasks from Dashboard/Task Manager.
- Add a "Waiting On" view in Analytics/Review.

---

### 5. Smart Recurrence (Decay-Based)
**Status:** ❌ Not Implemented  
**Requirement (plan.md, Section 4B):**
- Tasks reset the counter upon completion (e.g., "Haircut every 20 days").

**Implementation:**
- Add `recurrence_interval_days` column to `tasks` table.
- On task completion, if recurrence exists, create a new task with updated `created_at`.

---

### 6. Swipe Gestures (Dashboard)
**Status:** ❌ Not Implemented  
**Requirement (plan.md, Dashboard):**
- Swipe Right to Complete.
- Swipe Left to Snooze/Defer.

**Implementation:**
- Add `react-swipeable` or similar library.
- Implement gesture handlers on `FocusCard`.

---

### 7. Time Available Selector
**Status:** ❌ Not Implemented  
**Requirement (plan.md, Dashboard):**
- Session Header with "Time Available" selector (15m, 30m, 1h, 2h+).
- Filters tasks based on `est_duration_minutes`.

**Implementation:**
- Add time filter to `ModeSelector` or Dashboard header.
- Pass constraint to `sortTasksByUrgency` to exclude long tasks.

---

### 8. Visual Effects & Fatigue Mode
**Status:** ❌ Not Implemented  
**Requirement (Design.md, Section 4):**
- **Zeigarnik Effect:** Ghost effect on unfinished tasks from yesterday.
- **Fatigue Mode:** App dims, bright colors desaturate in "Low Energy" mode.

**Implementation:**
- Add CSS class for "ghost" effect based on `created_at` < yesterday.
- Apply global class when `mode === 'Low Energy'` to reduce contrast.

---

### 9. Voice Capture (Audio Recording)
**Status:** ❌ Not Implemented  
**Requirement (plan.md, Quick Capture):**
- Text Field + **Audio Recording Button**.
- Transcribe audio → Parse with AI.

**Implementation:**
- Add Web Speech API or `@xenova/transformers` for local Whisper.
- Send transcript to `/api/parse-task`.

---

### 10. Offline-First / PWA
**Status:** ❌ Not Implemented
**Requirement (plan.md, Section 6):**
- Capture and edits must work offline and sync when connection is restored.

**Implementation:**
- Add `manifest.json` and service worker.
- Use `localForage` or IndexedDB for local task cache.
- Sync to Supabase on reconnect.

---

## 🔴 NECESSITIES (Core Functionality)

These are required for the app to function as a complete productivity engine.

| #   | Feature                 | Status        | Why It's Core                                |
| --- | ----------------------- | ------------- | -------------------------------------------- |
| 1   | Project Detail Page     | ✅ Implemented | Can't manage projects without it             |
| 2   | KPI Tracking UI         | ✅ Implemented | North Star metrics are central to the system |
| 3   | Live Analytics          | ✅ Implemented | Weekly review is useless without real data   |
| 4   | Waiting/Blocked States  | ✅ Implemented | Task lifecycle is incomplete                 |
| 5   | Smart Recurrence        | ✅ Implemented | Core "decay-based" philosophy                |
| 6   | Swipe Gestures          | ❌ Missing     | Primary interaction method in plan.md        |
| 7   | Time Available Selector | ❌ Missing     | Context-aware filtering is core              |

---

## 🟢 ENHANCEMENTS (Polish & Advanced)

Nice-to-have features that improve UX but aren't blocking core functionality.

| #   | Feature                  | Status    | Why It's Polish                |
| --- | ------------------------ | --------- | ------------------------------ |
| 8   | Fatigue Mode / Zeigarnik | ❌ Missing | Visual flair, not functional   |
| 9   | Voice Capture            | ❌ Missing | Text input works fine for now  |
| 10  | PWA / Offline Support    | ❌ Missing | Works online, offline is bonus |

---

## Recommended Implementation Order

### Phase 1: Core Completion
1.  Project Detail Page + KPI UI
2.  Live Analytics (real data)
3.  Waiting/Blocked States + Recurrence

### Phase 2: UX Polish
4.  Swipe Gestures
5.  Time Available Selector

### Phase 3: Enhancements
6.  Fatigue Mode / Zeigarnik Effects
7.  Voice Capture
8.  PWA / Offline
