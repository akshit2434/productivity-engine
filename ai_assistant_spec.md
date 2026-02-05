# AI Companion & Voice Interface Specification

## 1. Overview
The goal is to elevate the "Productivity Engine" from a static tool to an active **Intelligence Partner**. This involves three distinct interaction modes:
1.  **Fast Voice Capture**: A sleek, transactional voice interface for quick brain dumps.
2.  **Task Enrichment (Notes & Subtasks)**: Deepening the context of tasks with voice notes, descriptions, and checklists, fully accessible by the AI.
3.  **AI Assistant (Deep Assistant)**: A full-featured, persistent chat interface acting as a "General Manager."

---

## 2. Feature 1: Quick Capture Voice Mode [COMPLETED]
**Design Philosophy:** "Record, Confirm, Done." Minimal friction.

### UI/UX
*   **Trigger:** A prominent "Microphone" icon in the Quick Capture drawer.
*   **Recording State:**
    *   Replaces the text area with a **Sleek Waveform Visualization**.
    *   Animation scales with audio amplitude.
    *   Stop button (Red Square) or "Tap to Finish".
*   **Processing:**
    *   Audio is transcribed using Gemini 2.0 Flash (Multimodal).
    *   Transcribed text is fed into the existing `parse-task` logic.
    *   Standard confirmation UI appears with the inferred Project, Duration, **Energy Tag (Deep/Normal/Shallow)**, and **Deadline**.
    *   Manual overrides available via shorthand chips (EOD, Tmrw, +1h).

---

## 3. Feature 2: Task Enrichment (Notes & Subtasks) [COMPLETED]
**Design Philosophy:** Tasks are containers for "Knowledge." The user should be able to dump messy info into a task, and the AI keeps it organized.

### Core Capabilities
*   **Rich Notes:**
    *   Multiple text notes per task.
    *   **Voice Notes:** Directly attached to a task.
    *   **AI Transcription:** Audio sent to Gemini for "Clean Transcription."
*   **Subtasks/Checklists:**
    *   Toggle-able checklist items nested within a parent task.
*   **AI Integration:**
    *   The Assistant can read all notes/subtasks via `get_task_details`.

---

## 4. Feature 3: AI Assistant [COMPLETED - VERSION 1.0]
**Design Philosophy:** A semi-autonomous agent that understands "Entropy." It has "God Mode" access to the app's data.

### System Prompt & Personality (The "God Prompt")
*   **Identity:** AI Assistant, a non-chalant, stoic intelligence.
*   **Core Concepts:** Understands Projects and "Decay" (Entropy).
*   **Persistence:** Conversation history, tool calls, and results are persisted in `chat_messages`.

### Tool Registry (Current Capabilities)
*   **`create_task` / `update_task` / `delete_task`**: Full task lifecycle management.
*   **`create_project` / `delete_project`**: Manage project containers.
*   **`list_tasks` / `get_projects`**: Real-time data retrieval.
*   **`get_analytics` / `generate_chart`**: Visualizing productivity trends and entropy.
*   **`add_note` / `add_subtask` / `toggle_subtask`**: Deepening task context.

---

## 5. Next Steps: Phase 3 (Cognitive Resonance)

### 1. Proactive Health Checks
- AI Assistant should proactively message the user if a project is decaying.

### 2. Multi-Task Batching
- AI should suggest batching "Shallow" tasks into 30m sprints.
