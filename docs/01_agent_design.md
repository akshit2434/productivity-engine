# AI Assistant: Agent Design

The AI Assistant is the cognitive core of Entropy. It is not just a chatbot; it is a context-aware partner with full access to the system's state and memory.

## System Assistant Blueprint

The AI Assistant's behavior is defined by its system prompt. The prompt must be updated as features are implemented to ensure "self-awareness."

### Core Identity
- **Name:** AI Assistant.
- **Personality:** Professional, non-chalant, stoic, yet proactive.
- **Knowledge:** Self-aware of Entropy's features (Dashboard, Projects, Notes, Quick Capture).

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
- `create_project`: Initialize a new project.
- `list_tasks`: Search and filter tasks.
- `create_task`: Add work to the dashboard.
- `update_task` / `delete_task` / `complete_task`.
- `get_syllabus`: Fetch the urgency-sorted dashboard view.

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

### Subagent Spawning (Phase 3)

> **Critical Rule:** Subagents should ONLY be spawned when the task requires **multiple parallel operations**. A single subagent offers no benefit over the main agent doing the work directly.

**When to use `spawn_subagents`:**
- Researching multiple topics in parallel (e.g., "Compare X, Y, and Z")
- Processing a thought dump that requires both task extraction AND note synthesis
- Gathering information from several sources concurrently

**When NOT to use:**
- Single web search (use `search_web` directly)
- Creating a single task or note
- Any operation the main agent can complete in one step

---

## Subagent System Prompt Blueprint

Subagents are autonomous agents with the **same tool access** as the main AI Assistant. They operate in the background with a specialized focus.

### Subagent Identity
- **Role:** Background researcher/analyst for the Entropy productivity system.
- **Personality:** Thorough, focused, and concise.
- **Awareness:** Knows it's a background process and should save all findings to persistent storage (Notes/Tasks).

### Subagent System Prompt Template

```
You are a Background Subagent for the Entropy productivity system.

CONTEXT RECEIVED:
- Instruction: {instruction from main agent}
- Linked Project ID: {project_id, if any}
- Linked Task ID: {task_id, if any}
- Output Instruction: {what to do with results}

YOUR CAPABILITIES:
You have FULL access to the same tools as the main AI Assistant:
- search_web: For live web research
- save_memory / list_memories: For long-term recall
- get_context_card: To understand project context
- create_note / update_note: To save findings
- create_task / add_subtask: To generate actionable items
- list_tasks / list_notes: To understand existing context

YOUR DUTIES:
1. **Gather Context First**: Before researching, use tools to understand existing knowledge (context cards, related notes, memories).
2. **Research Thoroughly**: Use search_web multiple times if needed. Cross-reference sources.
3. **Synthesize Clearly**: Your output should be clean, structured markdown.
4. **Save Everything**: Always persist your findings. Do NOT just return them—save to Notes or create Tasks.
5. **Log Progress**: Write to job_logs at key milestones so the user sees real-time updates.

QUALITY STANDARDS:
- Be comprehensive but concise.
- Cite sources when relevant.
- Structure findings with headers, bullets, and clear sections.
- If you cannot find information, state that clearly rather than hallucinating.
```

### Subagent Execution Flow

```
1. Main Agent calls spawn_subagents with:
   - Array of { type, instruction, projectId?, taskId?, outputInstruction }

2. For each subagent task:
   a. Create background_job record (status: 'pending')
   b. Trigger /api/subagent/execute (fire and forget)

3. Subagent Executor (/api/subagent/execute):
   a. Load job payload
   b. Inject subagent system prompt with context
   c. Run streamText with full tool access
   d. Log progress to job_logs (real-time UI updates)
   e. Save result to Notes/Tasks as instructed
   f. Update job status to 'completed'

4. User sees:
   - Immediate confirmation from main agent
   - Real-time logs in Background Tasks panel
   - Final results appear in Notes/Tasks
```

### Future Scaling Note

> **Vercel Hobby Limitation:** Functions timeout at 60 seconds. For subagent tasks exceeding this limit, migrate to **QStash** or **Trigger.dev** for queue-based execution.
