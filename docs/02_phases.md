# Entropy v2.0: Implementation Phases

Execution is divided into 5 testable phases. **USER MUST TEST AFTER EACH PHASE.**

---

## Phase 1: Memory (The Hippocampus) ✅
**Goal:** Prophet gains long-term memory and structured project context.

### Tasks
- [x] **1.1 Database:** Enable `pgvector` in Supabase.
- [x] **1.2 Migrations:**
    - Create `memories` table (id, content, embedding, type: 'general'|'directive', source).
    - Create `context_cards` table (project_id, content: markdown).
    - Extend `notes` table (type: 'thought'|'note'|'research', is_read, enrichment_status, anchors: jsonb).
- [x] **1.3 Logic:** Implement `/api/embed` route for generating vector embeddings.
- [x] **1.4 Prophet:** Update `chat/route.ts` to query memories and inject them into the system prompt.
- [x] **1.5 UI:** Build "Context Card" view in the Project Detail page (with Edit mode).
- [x] **1.6 Memory Management:** `save_memory` (auto-dedupe), `update_memory`, `delete_memory`, `list_memories`.

**TESTED ✅:** Prophet recalls preferences across sessions. Context Card UI working.

---

## Phase 2: Unstructured Dumps (The Feed)
**Goal:** "Fire and forget" thought dumps and the "Catch Up" loop.

### Tasks
- [ ] **2.1 UI:** Upgrade Quick Capture Drawer with a "Thought Mode" (Silent Dump).
- [ ] **2.2 Logic:** Thought Mode inserts directly into `notes` with `is_read = false`.
- [ ] **2.3 UI:** Add "Sparkle" icon to the main Navigation header. It pulses if unread notes exist.
- [ ] **2.4 UI:** Build the "Catch Up" Overlay to list unread thoughts/insights.

**TEST:** Send a voice message in Thought Mode. Ensure Sparkle pulses and note appears in Catch Up.

---

## Phase 3: Background Intelligence (The Subconscious)
**Goal:** Subagents and web research.

### Tasks
- [ ] **3.1 Database:** Create `background_jobs` and `job_logs` tables.
- [ ] **3.2 Logic:** Create Supabase Edge Function `subagent-executor` with full tool access.
- [ ] **3.3 Prophet:** Implement `spawn_subagent` and `search_web` tools.
- [ ] **3.4 UI:** Build real-time "Background Tasks" panel in the chat view.

**TEST:** Say "Research feasibility of Pursuing Brass Keyboards". Verify job starts and logs progress.

---

## Phase 4: Smart Notes (Temporal Anchors)
**Goal:** Line-level intelligence and interactive notes.

### Tasks
- [ ] **4.1 Logic:** Implement Regex parser for `@date` anchors in note content.
- [ ] **4.2 UI:** Customize Markdown renderer to Highlight anchors and render clickable checkboxes `[ ]`.
- [ ] **4.3 Feature:** Clicking an anchor allows spawning a Task with that date.

**TEST:** Write "Register for summit @March 15" in a note. Verify date is highlighted and clickable.

---

## Phase 5: Polish & Integration
**Goal:** Final refinement and seamless navigation.

### Tasks
- [ ] **5.1 Integration:** Deep link Catch Up cards to their respective notes/projects.
- [ ] **5.2 Polish:** Refine Sparkle pulse animations and job log UI.
- [ ] **5.3 Context:** Enable "Contextual Prophet" - button in notes to chat specifically about that note.
- [ ] **5.4 Final Docs:** Update README and project specs to reflect v2.0 stable.

**TEST:** Full walkthrough of the Second Brain loop.
