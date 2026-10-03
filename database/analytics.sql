-- Run once in your Supabase project's SQL editor.
-- Only the server service_role key can read/write these aggregate counters.
create table if not exists public.mayday_analytics (
 id uuid primary key,
 since bigint not null,
 days jsonb not null default '[]'::jsonb
);
alter table public.mayday_analytics enable row level security;
revoke all on public.mayday_analytics from anon, authenticated;
grant select, insert, update on public.mayday_analytics to service_role;
