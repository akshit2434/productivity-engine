-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Projects Table
create table projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid, -- Made nullable for Solo Mode
  name text not null,
  tier integer check (tier between 1 and 4) default 3,
  decay_threshold_days integer default 15,
  last_touched_at timestamp with time zone default now(),
  kpi_name text,
  kpi_value numeric default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Tasks Table
create table tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid, -- Made nullable for Solo Mode
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  description text,
  state text check (state in ('Active', 'Waiting', 'Blocked', 'Done')) default 'Active',
  due_date timestamp with time zone,
  waiting_until timestamp with time zone,
  est_duration_minutes integer default 30,
  energy_tag text check (energy_tag in ('Deep', 'Normal', 'Shallow')) default 'Shallow',
  blocked_by_id uuid references tasks(id),
  recurrence_interval_days integer,
  last_touched_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Activity Logs
create table activity_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid, -- Made nullable for Solo Mode
  task_id uuid references tasks(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  completed_at timestamp with time zone default now(),
  duration_minutes integer,
  session_mode text
);

-- Project KPIs (Multi-metric support)
create table project_kpis (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  value numeric default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Disable Row Level Security (RLS) for Solo Mode
alter table projects disable row level security;
alter table tasks disable row level security;
alter table activity_logs disable row level security;
alter table project_kpis disable row level security;

-- Task Notes (Enrichment)
create table task_notes (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references tasks(id) on delete cascade,
  content text not null,
  is_voice_transcript boolean default false,
  created_at timestamp with time zone default now()
);

-- Subtasks (Checklists)
create table subtasks (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references tasks(id) on delete cascade,
  title text not null,
  is_completed boolean default false,
  created_at timestamp with time zone default now()
);

alter table task_notes disable row level security;
alter table subtasks disable row level security;
