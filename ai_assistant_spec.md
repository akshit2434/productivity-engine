# AI Companion & Voice Interface Specification

## 1. Overview
The goal is to elevate the "Productivity Engine" from a static tool to an active **Intelligence Partner**. This involves three distinct interaction modes:
1.  **Fast Voice Capture**: A sleek, transactional voice interface for quick brain dumps.
2.  **Task Enrichment (Notes & Subtasks)**: Deepening the context of tasks with voice notes, descriptions, and checklists, fully accessible by the AI.
3.  **"The Prophet" (Deep Assistant)**: A full-featured, persistent chat interface acting as a "General Manager."

---

## 2. Feature 1: Quick Capture Voice Mode
**Design Philosophy:** "Record, Confirm, Done." Minimal friction.

### UI/UX
*   **Trigger:** A prominent "Microphone" icon in the Quick Capture drawer.
*   **Recording State:**
    *   Replaces the text area with a **Sleek Waveform Visualization** (using Canvas/Web Audio API).
    *   Animation scales with audio amplitude (giving a "living" feel).
    *   Stop button (Red Square) or "Tap to Finish".
*   **Processing:**
    *   Audio is transcribed (using OpenAI Whisper or Gemini Multimodal).
    *   Transcribed text is fed into the existing `parse-task` logic.
    *   Standard confirmation UI appears with the inferred Project, Duration, and Recurrence.

### Technical Stack
*   **Audio Capture:** Native Browser `MediaRecorder` API.
*   **Visualization:** Custom Canvas implementation or lightweight library (e.g., `react-audio-visualize`).
*   **Transcription:** Server Action calling Gemini 2.0 Flash (Multimodal) or Whisper.

---

## 3. Feature 2: Task Enrichment (Notes & Subtasks)
**Design Philosophy:** Tasks are containers for "Knowledge." The user should be able to dump messy info into a task, and the AI keeps it organized.

### Core Capabilities
*   **Rich Notes:**
    *   Users can add multiple text notes to a task.
    *   **Voice Notes:** Users can record a voice note directly attached to a task.
    *   **AI Transcription:** Audio is sent to Gemini for "Clean Transcription" (removing filler words, fixing grammar, ensuring English output unless specified).
*   **Subtasks/Checklists:**
    *   Simple toggle-able items nested within a parent task.
    *   Not full tasks (no decay/entropy), just a completion list.
*   **AI Integration:**
    *   The Prophet can read all notes/subtasks to understand context.
    *   The Prophet can edit search/summarize these notes.

---

## 4. Feature 3: "The Prophet" (Full AI Assistant)
**Design Philosophy:** A semi-autonomous agent that understands the user's "Entropy" and "Orbit." It has "God Mode" access to the app's data.

### System Prompt & Personality (The "God Prompt")
Every request is injected with a powerful system prompt:
*   **Identity:** "You are the Prophet, the supreme intelligence of this Productivity Engine."
*   **Context:** Knows the definition of "Boats" (Projects) and "Decay" (Entropy).
*   **General Intelligence:** Explicitly instructed to handle general queries (e.g., research, coding help) using its own knowledge, falling back to app tools only when necessary.
*   **Voice/Tone:** Optimistic, Stoic, Concise.

### Tool Registry ("God Mode" Access)
The AI has comprehensive access via **Function Calling**:
*   **Task Management:**
    *   `createTask`, `updateTask` (status, dates, decay), `deleteTask`.
    *   `listTasks` (powerful filtering by project, tag, urgency).
*   **Task Enrichment:**
    *   `addNote(taskId, content)`: Append info.
    *   `getTaskDetails(taskId)`: Retrieve notes and subtasks.
    *   `addSubtask(taskId, content)`, `toggleSubtask`.
*   **Project Management:**
    *   `getProjects`, `createProject`, `updateProject`.
*   **Data/Analytics:**
    *   `getAnalytics`, `searchNotes` (Semantic search in future).

### UI Structure
*   **Chat Interface:**
    *   Glassmorphic, premium message bubbles.
    *   Optimistic "Thinking..." states for tool calls.
*   **History Management:**
    *   Sidebar with recent chats (stored in `chats` table).
    *   Optimistic creation, renaming (AI generated titles), and deletion.

---

## 5. Implementation Phase Plan

### Phase 1: data Model & Enrichment (Notes/Subtasks)
1.  **Schema Updates:**
    *   Create `task_notes` table (id, task_id, content, type).
    *   Create `subtasks` table (id, task_id, title, is_completed).
2.  **Task Detail View:**
    *   Build UI to view/add notes and subtasks.
    *   Implement `AudioRecorder` for notes with "Clean Transcription" API.

### Phase 2: Quick Capture Voice (MVP)
1.  Implement Global Quick Capture with Audio.
2.  Integrate Gemini Multimodal for "Audio -> JSON Task" parsing.

### Phase 3: The Prophet (Backend & Logic)
1.  Create `chats` and `messages` tables.
2.  Implement `src/app/api/chat/route.ts` with Vercel AI SDK.
3.  Define all Zod schemas for the Tool Registry.

### Phase 4: The Prophet (Frontend UI)
1.  Build the Chat Interface and History Sidebar.
2.  Connect to `/api/chat` with optimistic updates.
