import { db } from "@/lib/db";
import { useUserStore } from "@/store/userStore";
import { processOutbox } from "@/lib/sync";

export function useTaskFulfillment() {
  const { mode } = useUserStore();

  const completeTask = async (task: {
    id: string;
    title: string;
    projectId?: string;
    durationMinutes?: number;
    recurrenceIntervalDays?: number;
    energyTag?: string;
  }) => {
    // 1. Mark task as done in local DB
    await db.tasks.update(task.id, { state: "Done", updated_at: new Date().toISOString() });
    await db.recordAction("tasks", "update", { id: task.id, state: "Done" });

    // 2. Log activity in local DB
    const activityLog = {
      id: crypto.randomUUID(),
      task_id: task.id,
      project_id: task.projectId,
      duration_minutes: task.durationMinutes || 30,
      session_mode: mode,
      completed_at: new Date().toISOString()
    };
    await db.activity_logs.add(activityLog);
    await db.recordAction("activity_logs", "insert", activityLog);

    // 3. Rejuvenate project health in local DB
    if (task.projectId) {
      const update = { last_touched_at: new Date().toISOString() };
      await db.projects.update(task.projectId, update);
      await db.recordAction("projects", "update", { id: task.projectId, ...update });
    }

    // 4. Handle Smart Recurrence
    if (task.recurrenceIntervalDays) {
      const nextRunDate = new Date();
      nextRunDate.setDate(nextRunDate.getDate() + task.recurrenceIntervalDays);
      
      const newTask = {
        id: crypto.randomUUID(),
        title: task.title,
        project_id: task.projectId,
        est_duration_minutes: task.durationMinutes || 30,
        energy_tag: (task.energyTag as any) || "Shallow",
        state: "Active" as const,
        recurrence_interval_days: task.recurrenceIntervalDays,
        waiting_until: nextRunDate.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_touched_at: new Date().toISOString()
      };
      
      await db.tasks.add(newTask);
      await db.recordAction("tasks", "insert", newTask);
    }

    // Trigger background sync (non-blocking)
    processOutbox().catch(err => console.error('[Sync] Background process failed:', err));

    return { success: true };
  };

  return { completeTask };
}
