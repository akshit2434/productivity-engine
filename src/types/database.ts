export interface Project {
  id: string;
  name: string;
  tier: number;
  decay_threshold_days: number;
  last_touched_at: string;
  kpi_name?: string;
  kpi_value: number;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  state: 'Active' | 'Waiting' | 'Blocked' | 'Done';
  due_date?: string;
  waiting_until?: string;
  est_duration_minutes: number;
  energy_tag: 'Grind' | 'Creative' | 'Shallow';
  blocked_by_id?: string;
  recurrence_interval_days?: number;
  last_touched_at: string;
  created_at: string;
  projectName?: string;
  projectTier?: number;
  decayThresholdDays?: number;
  projects?: {
    name: string;
    tier: number;
    decay_threshold_days: number;
  };
}

export interface TaskNote {
  id: string;
  task_id: string;
  content: string;
  is_voice_transcript: boolean;
  created_at: string;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  created_at: string;
}
