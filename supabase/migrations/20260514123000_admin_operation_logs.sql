create table if not exists public.admin_operation_logs (
  id uuid primary key default gen_random_uuid(),
  operation_type text not null,
  actor_id text null,
  actor_email text null,
  paths text[] not null default '{}'::text[],
  tags text[] not null default '{}'::text[],
  reason text not null,
  success boolean not null,
  response_status integer null,
  duration_ms integer not null check (duration_ms >= 0),
  metadata jsonb null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists admin_operation_logs_created_at_idx
on public.admin_operation_logs (created_at desc);

create index if not exists admin_operation_logs_operation_type_created_at_idx
on public.admin_operation_logs (operation_type, created_at desc);

alter table public.admin_operation_logs enable row level security;

drop policy if exists "admin_operation_logs_service_role_all"
on public.admin_operation_logs;
create policy "admin_operation_logs_service_role_all"
on public.admin_operation_logs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

comment on table public.admin_operation_logs is
'Operational admin action audit log. Do not store secrets or raw upstream stack traces.';
