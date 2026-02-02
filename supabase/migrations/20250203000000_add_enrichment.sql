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
