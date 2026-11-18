create table public.heavy13_rooms_v1 (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  revision integer not null default 1,
  payload jsonb not null,
  expires_at timestamptz not null
);
alter table public.heavy13_rooms_v1 enable row level security;
revoke all on public.heavy13_rooms_v1 from public, anon, authenticated;
grant select, insert, update, delete on public.heavy13_rooms_v1 to service_role;
create index heavy13_rooms_expiry on public.heavy13_rooms_v1(expires_at);