-- Chat Sessions Table
create table if not exists chat_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid, -- For potential future auth
  title text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Chat Messages Table
create table if not exists chat_messages (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  parts jsonb, -- Store the structured parts for AI SDK v6 compatibility
  created_at timestamp with time zone default now()
);

-- Disable RLS for Solo Mode
alter table chat_sessions disable row level security;
alter table chat_messages disable row level security;

-- Add search index
create index if not exists idx_chat_messages_content on chat_messages using gin(to_tsvector('english', content));
create index if not exists idx_chat_sessions_title on chat_sessions using gin(to_tsvector('english', coalesce(title, '')));

-- Update session updated_at on new message
create or replace function update_session_timestamp()
returns trigger as $$
begin
  update chat_sessions set updated_at = now() where id = new.session_id;
  return new;
end;
$$ language plpgsql;

create trigger tr_update_session_timestamp
after insert on chat_messages
for each row execute function update_session_timestamp();
