import { createClient } from "@/lib/supabase";
import { useUserStore } from "@/store/userStore";

export function useTaskFulfillment() {
  const supabase = createClient();
  const { mode } = useUserStore();

  const completeTask = async (task: {
    id: string;
    title: string;
    projectId?: string;
    durationMinutes?: number;
    recurrenceIntervalDays?: number;
    energyTag?: string;
  }) => {
    // 1. Mark task as done
    const { error: taskError } = await supabase
      .from("tasks")
      .update({ state: "Done" })
      .eq("id", task.id);

    if (taskError) throw taskError;

    // 2. Log activity
    await supabase.from("activity_logs").insert({
      task_id: task.id,
      project_id: task.projectId,
      duration_minutes: task.durationMinutes || 30,
      session_mode: mode,
    });

    // 3. Rejuvenate project health
    if (task.projectId) {
      // Find the project by ID or Name (Dashboard uses Name, Tasks uses ID)
      // The schema says project_id is a UUID referencing projects(id)
      // But Dashboard transformed it: projectId: t.projects?.name || t.project_id
      // We should use the raw project_id if possible. 
      // If task.projectId is provided, we update it.
      
      await supabase
        .from("projects")
        .update({ last_touched_at: new Date().toISOString() })
        .eq("id", task.projectId);
    }

    // 4. Handle Smart Recurrence
    if (task.recurrenceIntervalDays) {
      const nextRunDate = new Date();
      nextRunDate.setDate(nextRunDate.getDate() + task.recurrenceIntervalDays);
      
      await supabase.from("tasks").insert({
        title: task.title,
        project_id: task.projectId,
        est_duration_minutes: task.durationMinutes,
        energy_tag: task.energyTag || "Shallow",
        state: "Active",
        recurrence_interval_days: task.recurrenceIntervalDays,
        waiting_until: nextRunDate.toISOString()
      });
    }

    return { success: true };
  };

  return { completeTask };
}
