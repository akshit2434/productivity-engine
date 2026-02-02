-- AI Chat History
create table chats (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid, -- For potential future multi-user support
  title text default 'New Conversation',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table messages (
  id uuid primary key default uuid_generate_v4(),
  chat_id uuid references chats(id) on delete cascade,
  role text check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  tool_calls jsonb, -- For storing Vercel AI SDK tool call data
  created_at timestamp with time zone default now()
);

-- Disable RLS
alter table chats disable row level security;
alter table messages disable row level security;
