# Developer Documentation: Technical Architecture

Welcome to the **Entropy UI** codebase. This project is built for high-speed iteration and data density.

## 1. Technical Stack
- **Framework:** [Next.js 15+](https://nextjs.org/) (App Router, Turbopack)
- **Styling:** Vanilla CSS + Tailwind (Utility only where needed)
- **Database/Auth:** [Supabase](https://supabase.com/) (PostgreSQL + SSR)
- **AI Engine:** [Google Gemini AI](https://ai.google.dev/) (Task Parsing/Context Inference)
- **State Management:** [Zustand](https://github.com/pmndrs/zustand) (Client-side preferences)

## 2. Core Modules

### `src/lib/engine.ts` (The Urgency Engine)
This is the heart of the app. It handles the probabilistic sorting logic.
- `calculateUrgencyScore()`: Implements the non-linear decay formula.
- `sortTasksByUrgency()`: Takes user context (Mode/Time) and filters the backlog.

### `src/components/ui/QuickCaptureDrawer.tsx`
Handles the AI interface.
- Sends raw text to `/api/parse-task`.
- Gemini returns structured JSON (Task, Project, Duration, Energy).
- Handles project matching and fallback to "Inbox" if no project is found.

### `src/lib/supabase.ts`
Client configuration. **Note:** Currently running in "Solo Mode" (RLS disabled, user_id optional) for personal/local use.

## 3. Database Schema (`supabase/schema.sql`)
- **`projects`**: The "Boats" with tiers and decay thresholds.
- **`tasks`**: Individual units of work with states (Active, Waiting, Blocked, Done).
- **`activity_logs`**: Immutable record of completed work for the Analytics engine.

## 4. Key Developer Workflows
- **Running Locally:** `pnpm dev`
- **Modifying Schema:** Edit `supabase/schema.sql` and apply in Supabase SQL editor.
- **AI Prompts:** Managed in `src/app/api/parse-task/route.ts`.

## 5. Environment Variables
Requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `GEMINI_API_KEY`.
Refer to `.env.example`.
