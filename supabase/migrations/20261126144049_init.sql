-- Profiles: one row per user, created automatically on signup
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- Sessions: one row per logged drill
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  drill text not null check (char_length(drill) between 1 and 60),
  score integer not null check (score >= 0),
  created_at timestamptz not null default now()
);
create index sessions_user_id_idx on public.sessions (user_id);

-- Create a profile whenever a user signs up
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Leaderboard view (runs with the caller's permissions)
create view public.leaderboard with (security_invoker = true) as
select p.id as user_id, p.display_name,
       coalesce(sum(s.score), 0)::int as total_score,
       count(s.id)::int as sessions
from public.profiles p
left join public.sessions s on s.user_id = p.id
group by p.id, p.display_name;

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;

create policy "profiles are readable by signed-in users"
  on public.profiles for select to authenticated using (true);

create policy "users update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "sessions are readable by signed-in users"
  on public.sessions for select to authenticated using (true);

create policy "users insert their own sessions"
  on public.sessions for insert to authenticated
  with check (auth.uid() = user_id);

create policy "users delete their own sessions"
  on public.sessions for delete to authenticated
  using (auth.uid() = user_id);

-- Realtime for live leaderboard updates
alter publication supabase_realtime add table public.sessions;