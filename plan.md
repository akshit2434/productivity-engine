# Project Title: Dynamic Context Engine (Productivity App)

## 1. Project Overview
**Status:** Dashboard, Portfolio, and AI Assistant (v1) implemented.
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

## 4. Pending Roadmap: Phase 2 (Active Partner)

### **1. Voice Mastery**
*Objective: Implement a premium, low-friction voice experience.*
- [ ] **Real-time Waveforms**: Build a `VoiceVisualizer` component (Web Audio API + Canvas) for the Quick Capture drawer and a new Mic toggle in the Prophet Chat.
- [ ] **In-Chat Audio Ingestion**: Update `route.ts` to accept `audio` parts directly, allowing the Prophet to "listen" and react to voice notes.
- [ ] **Auto-Transcription Pipeline**: Ensure voice-to-note updates in the Task Detail modal use the "Clean Transcription" logic.

### **2. Syllabus Algorithm Integration**
*Objective: Sync the AI's intuition with the codebase's internal math.*
- [ ] **`get_syllabus` Tool**: Implement a function-calling tool that imports `calculateUrgencyScore` from `src/lib/engine.ts`.
- [ ] **Conversational Filtering**: The Prophet should fetch the full mathematical syllabus and then filter it based on user intent (e.g., "I only have 15 mins").
- [ ] **Context Injection**: Pass user intent (e.g., "I have 15 mins") to the tool for precise filtering.

### **3. Health Orchestration**
*Objective: Automate "Boat" rejuvenation via AI actions.*
- [ ] **`complete_task` Tool**: This tool must:
  1. Set task to `Done`.
  2. Update the associated project's `last_touched_at` to `now()`.
  3. Log to `activity_logs`.
- [ ] **KPI Auto-Updates**: Ingest task completion data into project-level KPIs on task finish.
- [ ] **Decay Alerts**: Prophet should proactively warn the user if a high-Tier "Boat" is nearing its decay threshold.

---

## 5. Developer Handover Notes
- **Supabase**: Real-time enabled on `tasks` and `projects`. Use service role key for system bypass if needed.
- **AI SDK**: Using Vercel AI SDK with `gemini-2.0-flash`.
- **Styling**: **Vanilla CSS ONLY**. Do not use Tailwind utility classes; maintain the "High-Performance Minimalism" aesthetic.
- **Urgency Math**: `src/lib/engine.ts` is the single source of truth.