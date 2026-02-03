# Project Title: Dynamic Context Engine (Productivity App)

## 1. Project Overview
**Status:** Dashboard, Portfolio, and AI Assistant (v2 - Phase 2) implemented.
**Objective:** Build a high-performance, mobile-first productivity application designed for a power user managing multiple complex projects ("boats") simultaneously.

---

## 2. App Architecture & Navigation
**Platform:** Next.js 15 (App Router). Responsive web app (PWA).

### **Sitemap:**
1. **Dashboard (Syllabus)** – The execution view (Implemented).
2. **Portfolio (Boats)** – High-level project health tracking (Implemented).
3. **The Prophet (Chat)** – "God Mode" AI Assistant (Implemented).
4. **Task Detail** – Enrichment with notes and subtasks (Implemented).

---

## 3. Core Functional Logic (Implemented)

### **A. The Sorting Algorithm (The "Syllabus" Logic)**
`Score = (Tier Weight) × (Days Since Last Touch / Decay Threshold)^1.5 × (Context Multiplier)`
- **Tier Weights:** 1 (2.0), 2 (1.5), 3 (1.0), 4 (0.5).
- **Deadline Override:** Tasks due within 24h are forced to the top.

### **B. Project Decay (Entropy)**
Projects track `last_touched_at`. If the gap exceeds `decay_threshold_days`, the project is considered "Decayed," affecting its tasks' urgency scores.

---

## 4. Pending Roadmap: Phase 3 (Cognitive Resonance)

### **1. Proactive Maintenance**
- [ ] **Decay Notifications**: Implement background jobs (or simple triggers) for the Prophet to alert the user about critical "Boat" decay.
- [ ] **Dynamic KPI Suggestions**: AI should suggest new KPIs based on task completion patterns.

### **2. Execution Sprints**
- [ ] **"Admin Hour" Mode**: Prophet suggests batching all <10m tasks into a single focused sprint.
- [ ] **Pomodoro Integration**: Sync chat status with a timer for Deep Work sessions.

---

## 5. Developer Handover Notes
- **Supabase**: Real-time enabled on `tasks` and `projects`. Use service role key for system bypass if needed.
- **AI SDK**: Using Vercel AI SDK with `gemini-2.0-flash`.
- **Styling**: **Vanilla CSS ONLY**. Do not use Tailwind utility classes; maintain the "High-Performance Minimalism" aesthetic.
- **Urgency Math**: `src/lib/engine.ts` is the single source of truth.