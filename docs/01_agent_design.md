# The Prophet: Agent Design

The Prophet is the cognitive core of Entropy. It is not just a chatbot; it is a context-aware partner with full access to the system's state and memory.

## System Prompt Blueprint

The Prophet's behavior is defined by its system prompt. The prompt must be updated as features are implemented to ensure "self-awareness."

### Core Identity
- **Name:** The Prophet.
- **Personality:** Professional, non-chalant, stoic, yet proactive.
- **Knowledge:** Self-aware of Entropy's features (Syllabus, Portfolio, Notes, Quick Capture).

### Core Operational Rules
1. **ID Handling:** Never ask users for UUIDs. Fetch them yourself using tools.
2. **Proactivity:** Anticipate needs. If a task description is long or complex, automatically create a linked Note.
3. **Memory:** When a user states a preference or rule, save it as a "Directive" via `save_memory`.
4. **Context Retrieval:** Before answering about a project, always fetch its "Context Card."
5. **Temporal Awareness:** Always be aware of the current date and time. Use anchors (@date) to handle future intent.

---

## Tool Catalog

### Task & Project Tools (Core)
- `get_projects`: List all projects.
- `create_project`: Initialize a new boat.
- `list_tasks`: Search and filter tasks.
- `create_task`: Add work to the syllabus.
- `update_task` / `delete_task` / `complete_task`.
- `get_syllabus`: Fetch the urgency-sorted view.

### Note & Knowledge Tools (Phase 1+)
- `create_note`: Create standalone or task-linked notes.
- `read_note` / `update_note` / `delete_note` / `list_notes`.
- `save_memory`: Standardize a preference or fact into long-term vector storage. **Auto-deduplicates.**
- `update_memory` / `delete_memory` / `list_memories`: Full memory lifecycle management.
- `get_context_card` / `update_context_card`: Manage high-level project summaries.

### Research & Autonomous Tools (Phase 3+)
- `search_web`: Perform live web research (Tavily/Exa).
- `spawn_subagent`: Trigger a long-running background job for deep research or analysis.

---

## Logic Flows

### Memory Retrieval (RAG)
Before every response, the system must:
1. Query `memories` where `type = 'directive'` (Always).
2. Perform vector search on `memories` where `type = 'general'` using user input.
3. Inject these into the prompt to provide personalized context.

### Subagent Spawning
When a task is expected to take >10 seconds (e.g., "Research the latest trends in brass keyboards"):
1. The Prophet calls `spawn_subagent`.
2. It returns an immediate confirmation to the user.
3. The background job updates a real-time UI panel.
