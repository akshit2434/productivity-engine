-- Background Jobs tracking
create table background_jobs (
  id uuid primary key default uuid_generate_v4(),
  type text not null, -- e.g., 'research', 'analysis', 'thought_dump'
  status text not null check (status in ('pending', 'running', 'completed', 'failed')) default 'pending',
  payload jsonb, -- input params
  result jsonb, -- final output
  error text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Real-time Job Logs
create table job_logs (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references background_jobs(id) on delete cascade,
  message text not null,
  level text default 'info', -- info, warn, error
  created_at timestamp with time zone default now()
);

-- Enable Realtime
alter publication supabase_realtime add table background_jobs;
alter publication supabase_realtime add table job_logs;

-- Disable RLS
alter table background_jobs disable row level security;
alter table job_logs disable row level security;

-- Add updated_at trigger for background_jobs
create trigger update_background_jobs_updated_at
    before update on background_jobs
    for each row
    execute function update_updated_at_column();
