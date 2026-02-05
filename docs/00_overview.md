# Entropy Platform Overview

## What is Entropy?

**Entropy** is a high-performance productivity engine designed for power users managing multiple complex projects ("boats") simultaneously. Named after the physics concept, it treats potential work as living entities that decay when neglected—ensuring nothing critical slips through the cracks while hiding the clutter that doesn't matter *now*.

### Core Philosophy
- **High-Performance Minimalism:** Speed, clarity, and visual elegance. The interface should feel like a premium tool, not just a web app.
- **Probabilistic Scheduling:** Work is modeled as entropy (decay). If you ignore a project, its tasks rise in urgency automatically.
- **Cognitive Partnership:** The AI assistant ("The Prophet") is moving from a simple tool to a "Second Brain" that remembers, anticipates, and acts in the background.

### Current Features (v1.0)
- **Syllabus (Dashboard):** A dynamic, urgency-sorted task list using the entropy decay algorithm.
- **Portfolio (Boats):** High-level tracking of active projects with tier-based weights and health monitoring.
- **The Prophet (Chat):** A "God Mode" AI assistant capable of managing tasks and projects via tool calls.
- **Strategy Logs (Notes):** AI-enhanced knowledge base for unstructured thoughts.
- **Quick Capture:** Rapid mobile-first entry for tasks via text or voice.

### v2.0 Vision: The Second Brain
The next evolution focus on three pillars:
1. **Memory:** Establishing a transparent, human-inspired memory system.
2. **Subconscious:** Background processing for "fire and forget" thought dumps and research.
3. **Temporal Anchors:** Intelligent handling of time-sensitive information within notes.

---

# Developer Guidelines

> **CRITICAL: Read before implementing any code.**

## Environment & Tooling
- **Package Manager:** Use `pnpm` exclusively. Never use `npm` or `yarn`.
- **Primary Stack:** Next.js 15 (App Router), Supabase (PostgreSQL + Realtime + pgvector), Vercel AI SDK (Gemini-2.0-flash).
- **Styling:** **Vanilla CSS only.** Avoid Tailwind CSS unless specifically requested. Maintain a "High-Performance Minimalism" aesthetic.

## Development Flow
1. **Phase-based Execution:** Follow the implementation phases in [doc/02_phases.md](file:///Users/akshit2434/github/productivity-engine/docs/02_phases.md).
2. **Build Verification:** Always run `pnpm build` to ensure type safety and error-free builds before testing.
3. **Testing Protocol:**
    - **NO browser automation.** Do not use browser subagents or automated testing tools for UI verification.
    - **User-Led Verification:** After completing a phase, the USER will manually test the feature in the browser and report back.
    - Only proceed to the next phase after user confirmation.

## Code Integrity
- **Engine Logic:** `src/lib/engine.ts` is the single source of truth for urgency math.
- **Supabase Security:** Use the service role key for system-level operations in server environments.
- **AI Integration:** Use Vercel AI SDK for all Prophet interactions. Ensure multi-step tool calls are enabled.
