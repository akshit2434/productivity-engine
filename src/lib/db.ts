import Dexie, { Table } from 'dexie';

export interface SyncOutbox {
  id?: number;
  tableName: string;
  action: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: number;
}

export interface Project {
  id: string;
  user_id?: string;
  name: string;
  tier: number;
  decay_threshold_days: number;
  last_touched_at: string;
  kpi_name?: string;
  kpi_value: number;
  color?: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id?: string;
  project_id?: string;
  title: string;
  description?: string;
  state: 'Active' | 'Waiting' | 'Blocked' | 'Done';
  due_date?: string;
  waiting_until?: string;
  est_duration_minutes: number;
  energy_tag: 'Deep' | 'Normal' | 'Shallow';
  blocked_by_id?: string;
  recurrence_interval_days?: number;
  last_touched_at: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id?: string;
  task_id?: string;
  project_id?: string;
  completed_at: string;
  duration_minutes: number;
  session_mode: string;
}

export interface Note {
  id: string;
  user_id?: string;
  project_id?: string;
  task_id?: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Documentation {
  id: string;
  title: string;
  content: string;
  path: string;
  last_indexed_at: string;
}

export class EntropyDatabase extends Dexie {
  projects!: Table<Project>;
  tasks!: Table<Task>;
  activity_logs!: Table<ActivityLog>;
  notes!: Table<Note>;
  documentation!: Table<Documentation>;
  sync_outbox!: Table<SyncOutbox>;

  constructor() {
    super('EntropyDatabase');
    this.version(1).stores({
      projects: 'id, name, last_touched_at',
      tasks: 'id, project_id, state, due_date',
      activity_logs: 'id, task_id, project_id',
      notes: 'id, project_id, task_id',
      documentation: 'id, title, path',
      sync_outbox: '++id, timestamp'
    });
  }

  // Helper to record an action in the outbox
  async recordAction(tableName: string, action: 'insert' | 'update' | 'delete', data: any) {
    await this.sync_outbox.add({
      tableName,
      action,
      data,
      timestamp: Date.now()
    });
  }
}

export const db = new EntropyDatabase();
