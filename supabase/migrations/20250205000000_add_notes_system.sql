-- Create Notes Table
create table notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid, -- Nullable for Solo Mode
  project_id uuid references projects(id) on delete set null,
  task_id uuid references tasks(id) on delete set null,
  title text not null,
  content text, -- Markdown content
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Disable Row Level Security (RLS) for Solo Mode
alter table notes disable row level security;

-- Add updated_at trigger for notes
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language 'plpgsql';

create trigger update_notes_updated_at
    before update on notes
    for each row
    execute function update_updated_at_column();
