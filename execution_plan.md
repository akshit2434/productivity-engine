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

# Productivity Engine: Refined Execution Plan

## 🔴 NEW CORE PRIORITIES (Phase 2: Power User Features)

These are the immediate next steps to make the app truly "Essential".

### 1. Advanced Task Visibility
- [ ] **Completed Tasks View**: Ability to toggle/view completed tasks inside project details and main manager.
- [ ] **Project Task Filters**: Tabs for [Upcoming], [All], [Completed] within the Project Detail page.

### 2. Multi-KPI Tracking
- [ ] **Schema Update**: Migration to support multiple KPIs per project (name-value pairs).
- [ ] **Portfolio UX**: Dedicated modal or inline form to quickly add and manage multiple KPIs.

### 3. AI & Natural Language Expansion
- [ ] **NL Recurrence**: "Remind me every 15 days" parsing in Quick Capture.
- [ ] **Custom Intervals**: Support for any integer day interval for recurrence.
- [ ] **Interaction Hub**: A dedicated [Chat & AI] view for audio dumps, context chatting, and voice interaction.

---

## 🟡 PHASE 3: THE AESTHETIC & RESPONSIVE OVERHAUL

This phase moves away from the "Pilot Cockpit" neon style toward a premium, professional "Flow State" UI.

### 1. Aesthetic Pivot
- [ ] **De-Neonification**: Remove harsh glow/neon effects.
- [ ] **Professional Copy**: Replace "System Status", "Bot_ID", and "In Storage" with professional, functional terminology.
- [ ] **Color Palette**: Use a more sophisticated, balanced palette (Deep slates, smooth grays, accent primary).

### 2. Responsive Architecture
- [ ] **Desktop Layout**: Move away from fixed-mobile-width. Use a sidebar-content or multi-panel layout for desktop space.
- [ ] **Transitions**: Implement smooth Framer Motion page transitions and micro-animations.

---

## ✅ COMPLETED (Phase 1: Foundation)
- [x] Basic Urgency Engine & Scoring.
- [x] Basic Quick Capture (AI Parsing).
- [x] Portfolio View (Health & KPI).
- [x] Project Detail Pages (Edit Mode).
- [x] Real-time Analytics (Velocity & Stagnation).
- [x] Smart Recurrence (Manual set).
- [x] Solo Mode (No Auth required).
