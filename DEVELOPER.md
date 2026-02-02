# Developer Documentation: Technical Architecture

## 1. Core Architecture
- **State:** [Zustand](https://github.com/pmndrs/zustand) for client-side context (Current Mode, Timer, UI toggles).
- **Database:** Supabase (Solo Mode enabled - see `supabase/schema.sql` for current relaxed policies).
- **AI:** `/api/parse-task` using Gemini 1.5 Pro to turn raw text/audio into structured data.

## 2. Key Modules & Logic

### Urgency Engine (`src/lib/engine.ts`)
The `calculateUrgencyScore` function drives the Dashboard. It uses a **Decay Heartbeat** logic:
- `health_percent = (days_since_touch / project.decay_threshold) * 100`
- High decay leads to higher scores, pushing tasks from that project to the top.

### Multi-KPI Implementation (Planned)
We are moving from a single `kpi_name`/`kpi_value` in `projects` to a related `project_kpis` table or a JSONB field for flexible, multiple metrics.

### AI Hub (Planned)
The AI Chat hub will involve:
- **Audio Capture**: Using the Web Media API.
- **Transcription/Parsing**: Sending raw audio or text to Gemini for classification and extraction.
- **History**: Storing past dumps in an `input_history` table for reference.

## 3. Aesthetic Guidelines
- **CSS Variable Driven**: All colors are tied to CSS variables in `globals.css`.
- **Framer Motion**: Used for page-level transitions.
- **Desktop Grid**: We use CSS Grid for layout to ensure responsiveness from 375px to 2560px.

## 4. Database Setup
Ensure you run the latest migrations from `supabase/schema.sql`.
Current requirements for recurrence and health:
```sql
ALTER TABLE tasks ADD COLUMN recurrence_interval_days integer;
ALTER TABLE tasks ADD COLUMN last_touched_at timestamp with time zone DEFAULT now();
```
