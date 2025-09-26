-- ArenaForge Initial Schema
-- Version: 001
-- Description: Sets up the initial tables, RLS policies, and core database objects.

-- ==== Extensions ====
-- Enable pgcrypto for gen_random_uuid() if not already enabled.
create extension if not exists "pgcrypto" with schema "public";
create extension if not exists "pgjwt" with schema "public";


-- ==== Helper Functions ====

-- Function to get the ff_uid of the currently authenticated user
create or replace function public.current_player_ff_uid()
returns text as $$
declare
  auth_id uuid;
  player_ff_uid text;
begin
  select auth.uid() into auth_id;
  select ff_uid into player_ff_uid from public.players where players.auth_id = auth_id;
  return player_ff_uid;
end;
$$ language plpgsql security definer;

-- Function to automatically update 'updated_at' columns
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;


-- ==== Tables ====

-- Players Table
create table public.players (
  ff_uid text primary key,
  auth_id uuid references auth.users(id) on delete set null,
  name text not null,
  mobile text not null unique,
  whatsapp boolean default true,
  role text check (role in ('rusher', 'sniper', 'igl', 'grenader')) not null,
  ff_level int default 1 check (ff_level > 0),
  years_experience int default 0 check (years_experience >= 0),
  upi_vpa text,
  upi_qr_path text,
  profile_photo_path text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Admins Table
create table public.admins (
  admin_id uuid primary key default gen_random_uuid(),
  auth_id uuid references auth.users(id) on delete set null,
  mobile text unique,
  created_at timestamptz default now()
);

-- Tournaments Table
create table public.tournaments (
  tournament_id uuid primary key default gen_random_uuid(),
  title text not null,
  thumbnail_path text,
  mode text check (mode in ('BR', 'CS')) not null,
  type text not null,
  max_players int not null check (max_players > 0),
  entry_fee numeric not null check (entry_fee >= 0),
  start_at timestamptz not null,
  rules text,
  prize_distribution jsonb,
  room_id text,
  room_pass_encrypted text,
  published boolean default false,
  created_by uuid references public.admins(admin_id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tournament Entries Table
create table public.tournament_entries (
  entry_id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(tournament_id) on delete cascade not null,
  player_ff_uid text references public.players(ff_uid) not null,
  joined_at timestamptz default now(),
  payment_status text check (payment_status in ('pending', 'paid', 'failed', 'refunded')) default 'pending',
  ticket_id text unique,
  seat_number int,
  player_snapshot jsonb,
  payment_tx_ref text,
  unique (tournament_id, player_ff_uid)
);

-- Winnings Table
create table public.winnings (
  win_id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(tournament_id) not null,
  player_ff_uid text references public.players(ff_uid) not null,
  amount numeric not null check (amount > 0),
  position int,
  payout_status text check (payout_status in ('pending', 'paid', 'rejected')) default 'pending',
  payout_tx_ref text,
  created_at timestamptz default now()
);

-- Match Results Table
create table public.matches_results (
  result_id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(tournament_id) not null,
  player_ff_uid text references public.players(ff_uid) not null,
  kills int default 0,
  damage numeric default 0,
  play_time interval,
  notes text,
  created_at timestamptz default now()
);

-- Chat Rooms Table
create table public.chat_rooms (
  room_id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(tournament_id) on delete cascade, -- NULL = global room
  name text not null,
  is_private boolean default false,
  created_at timestamptz default now()
);

-- Messages Table
create table public.messages (
  message_id uuid primary key default gen_random_uuid(),
  room_id uuid references public.chat_rooms(room_id) on delete cascade not null,
  sender_ff_uid text references public.players(ff_uid), -- Can be null for system messages
  message_text text,
  attachments jsonb,
  created_at timestamptz default now()
);

-- ==== Triggers for updated_at ====
create trigger handle_players_updated_at before update on public.players
  for each row execute procedure public.handle_updated_at();

create trigger handle_tournaments_updated_at before update on public.tournaments
  for each row execute procedure public.handle_updated_at();


-- ==== Indexes ====
create index on public.players (auth_id);
create index on public.tournament_entries (tournament_id);
create index on public.tournament_entries (player_ff_uid);
create index on public.messages (room_id);
create index on public.messages (sender_ff_uid);


-- ==== RLS Policies ====
-- Helper function to check for admin role
create or replace function public.is_admin()
returns boolean as $$
begin
  return (select auth.uid() in (select auth_id from public.admins));
end;
$$ language plpgsql security definer;

-- Players Table RLS
alter table public.players enable row level security;
create policy "Players can view their own data" on public.players
  for select using (auth.uid() = auth_id);
create policy "Admins can view all players" on public.players
  for select using (public.is_admin());
create policy "Players can update their own data" on public.players
  for update using (auth.uid() = auth_id) with check (auth.uid() = auth_id);
-- INSERT is handled by a server-side function (`create_user` edge function).

-- Admins Table RLS
alter table public.admins enable row level security;
-- No one can see admin data except via security definer functions
create policy "Admins are protected" on public.admins
  for all using (false);

-- Tournaments Table RLS
alter table public.tournaments enable row level security;
create policy "Published tournaments are publicly visible" on public.tournaments
  for select using (published = true);
create policy "Admins can view all tournaments" on public.tournaments
  for select using (public.is_admin());
create policy "Admins can manage tournaments" on public.tournaments
  for all using (public.is_admin()) with check (public.is_admin());

-- Tournament Entries Table RLS
alter table public.tournament_entries enable row level security;
create policy "Players can see their own entries" on public.tournament_entries
  for select using (player_ff_uid = public.current_player_ff_uid());
create policy "Admins can see all entries" on public.tournament_entries
  for select using (public.is_admin());
-- INSERT/UPDATE is handled by server-side edge functions.

-- Winnings Table RLS
alter table public.winnings enable row level security;
create policy "Players can see their own winnings" on public.winnings
  for select using (player_ff_uid = public.current_player_ff_uid());
create policy "Admins can see all winnings" on public.winnings
  for select using (public.is_admin());
-- INSERT/UPDATE is handled by server-side edge functions.

-- Matches Results Table RLS
alter table public.matches_results enable row level security;
create policy "Players can see their own results" on public.matches_results
  for select using (player_ff_uid = public.current_player_ff_uid());
create policy "Admins can see all results" on public.matches_results
  for select using (public.is_admin());
-- INSERT/UPDATE is handled by server-side edge functions.

-- Chat Rooms Table RLS
alter table public.chat_rooms enable row level security;
create policy "Public chat rooms are visible to all authenticated users" on public.chat_rooms
  for select using (is_private = false and auth.role() = 'authenticated');
create policy "Users can see private rooms they are part of" on public.chat_rooms
  for select using (is_private = true and auth.role() = 'authenticated' and exists (
    select 1 from public.tournament_entries
    where tournament_entries.tournament_id = chat_rooms.tournament_id
    and tournament_entries.player_ff_uid = public.current_player_ff_uid()
    and tournament_entries.payment_status = 'paid'
  ));
create policy "Admins can see all chat rooms" on public.chat_rooms
  for select using (public.is_admin());
-- INSERT/UPDATE is handled by server-side edge functions.

-- Messages Table RLS
alter table public.messages enable row level security;
create policy "Users can see messages in rooms they can access" on public.messages
  for select using (auth.role() = 'authenticated' and exists (
    select 1 from public.chat_rooms
    where chat_rooms.room_id = messages.room_id
  ));
create policy "Users can send messages in rooms they can access" on public.messages
  for insert with check (
    auth.role() = 'authenticated' and
    sender_ff_uid = public.current_player_ff_uid() and
    exists (
      select 1 from public.chat_rooms
      where chat_rooms.room_id = messages.room_id
    )
  );
create policy "Admins can do anything with messages" on public.messages
  for all using (public.is_admin());


-- ==== Seed Data ====

-- Create a global chat room
insert into public.chat_rooms (name, is_private) values ('Global Chat', false);

-- Note: Admin user needs to be created manually or via a secure server-side process.
-- The following is a placeholder for the server-side logic that would create an admin.
-- 1. Create a user in `auth.users`.
-- 2. Take the `id` from that user.
-- 3. Insert into `public.admins`.
-- Example (DO NOT run this directly without a corresponding auth user):
-- with new_user as (
--   insert into auth.users (email, password, ...) values ('admin@arenaforge.com', '...', ...) returning id
-- )
-- insert into public.admins (auth_id, mobile) values ((select id from new_user), '9142218328');

-- Example rows for testing
-- insert into public.players (ff_uid, name, mobile, role) values ('123456789', 'Test Player', '+919876543210', 'rusher');
-- insert into public.tournaments (title, mode, type, max_players, entry_fee, start_at, published, prize_distribution)
-- values ('Morning Mayhem', 'BR', 'Solo', 100, 10, now() + interval '1 day', true, '[{"position": 1, "amount": 500}, {"position": 2, "amount": 250}]');

-- Grant usage on schema to anon and authenticated roles
grant usage on schema public to anon, authenticated;

-- Grant select on all tables to anon and authenticated roles (RLS will handle access)
grant select on all tables in schema public to anon, authenticated;
grant insert on public.messages to authenticated;
grant select on all sequences in schema public to anon, authenticated;

-- Grant necessary permissions to the service_role for server-side functions
grant all on all tables in schema public to service_role;
grant all on all functions in schema public to service_role;
grant all on all sequences in schema public to service_role;