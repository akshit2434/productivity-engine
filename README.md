# Entropy UI | Dynamic Context Engine

**Project Status:** Active Beta (God Mode Enabled)
**Core Concept:** Probabilistic Scheduling & Dynamic Context

> *"In an era of infinite distraction, the greatest luxury is focus."*

Entropy UI is a high-performance productivity engine designed for power users. It treats potential work as living entities that compete for your attention. By modeling work as **Entropy** (the inevitable decay of neglected priorities), the system ensures that nothing critical slips through the cracks while hiding the clutter that doesn't matter *now*.

---

## 1. The Philosophy
We have moved away from "Industrial Zen" toward a **High-Performance Minimalism**.
- **Vibe:** Swiss Design meets Modern IDE. Slate, Charcoal, and targeted Primary accents.
- **Copy:** Professional and functional. No "gaming" or "pilot cockpit" roleplay.
- **Typography:** Inter for readability, JetBrains Mono for data-dense numeric tracking.

### Key Concepts

#### Projects
Each project is a persistent entity requiring maintenance:
- **Tier 1-4:** Prioritization level (1 = Urgent, 4 = Maintenance).
- **Decay Threshold:** The heartbeat of the system. Defines how often a project needs touching before it "rots."
- **KPIs:** Track real-world impact metrics, not just "tasks completed."
- **Rejuvenation:** Completing tasks "rejuvenates" project health, preventing decay.

#### The Dashboard (The "Execution" Algorithm)
The home screen is a curated list of what to execute *next*, calculated dynamically:
`Score = (Tier Weight) × (Days Since Last Touch / Decay Threshold) × (Context Multiplier)`

- **Filters:** By Time Available (15m, 30m, 1h) and Energy Mode (**Deep Work**, **Creative**, **Low Energy**, **Admin**).
- **Deadlines:** Integrated "Mission Critical" logic for tasks due within 24h.
- **Zero-Delay Sync:** Powered by Supabase Realtime & TanStack Query for instant feedback.

#### Strategy & Notes (Knowledge Base)
A dedicated secure archive for strategic dumps, meeting notes, and project brainstorming.
- **Markdown-First:** Full rich-text editing with a distraction-free interface.
- **AI Refinement:** "Refine" button to restructure brain dumps into clean, actionable intelligence.
- **Context Awareness:** Notes can be linked directly to Projects and Tasks for contextual retrieval.

---

## 2. Technical Architecture

### Core Stack
- **Framework:** Next.js 15+ (App Router)
- **State/Caching:** TanStack Query (React Query) v5
- **Database:** Supabase (PostgreSQL + Realtime)
- **Styling:** Vanilla CSS (Tailwind excluded for flexibility) + Framer Motion
- **AI:** Google Gemini 2.0 Flash (Multimodal)

### Key Modules
- **`src/lib/engine.ts`**: The urgency scoring algorithm.
- **`src/app/api/chat/route.ts`**: The AI Assistant's "God Mode" interface.
- **`src/hooks/useTaskFulfillment.ts`**: Centralized logic for task completion and project health.

---

## 3. AI & Voice Integration
The productivity engine is managed by an active **Intelligence Partner**.

- **AI Assistant**: A high-capability Assistant with "God Mode" access to the engine's database. It can create tasks, manage projects, and analyze performance trends.
- **Quick Capture**: "Record, Confirm, Done." Voice dumps are parsed into structured JSON by the AI.
- **Enrichment**: AI-powered transcription for task notes and automated subtask generation.

---

## 4. Getting Started

### Prerequisites
- Node.js 20+
- pnpm

### Installation

```bash
# Install dependencies
pnpm install

# Setup Environment
cp .env.example .env.local
# Add: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY

# Developer Handover
For the current Phase 2 roadmap and technical architecture details, please refer to:
- [plan.md](./plan.md) (PRD & Future Logic)
- [ai_assistant_spec.md](./ai_assistant_spec.md) (AI Assistant & Voice Design)

# Run Development Server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

## 5. Deployment
The app is optimized for Vercel deployment. It also supports PWA installation (Manifest included) for a native-like mobile experience.
