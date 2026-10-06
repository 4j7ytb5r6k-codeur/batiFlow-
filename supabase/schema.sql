-- batiFlow : schéma complet de la base Supabase (déjà appliqué sur le projet yvdkrrkrxiizyelivtlv).
-- Pour un nouveau projet : SQL Editor > New query, puis « Run ». Si l'exécution d'un seul bloc expire, lancez les instructions une par une.

-- ============ Profils (espace client créé à l'inscription) ============
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  full_name     text,
  company       text,
  trade         text,
  phone         text,
  plan          text not null default 'trial' check (plan in ('trial','essentiel','pro','annule')),
  billing       text not null default 'month' check (billing in ('month','year')),
  trial_ends_at timestamptz not null default (now() + interval '7 days'),
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Droits : lecture seule pour les clients ; un administrateur peut modifier plan, facturation et fin d'essai.
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
grant update (plan, billing, trial_ends_at) on public.profiles to authenticated;

-- Administrateur (SECURITY DEFINER pour éviter la récursion RLS)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select is_admin from public.profiles where id = (select auth.uid())), false) $$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create policy "profiles_select_own"   on public.profiles for select using ((select auth.uid()) = id);
create policy "profiles_select_admin" on public.profiles for select using (public.is_admin());
create policy "profiles_update_admin" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

-- Création automatique de l'espace client à l'inscription.
-- L'adresse administrateur n'obtient le rôle qu'une fois son email confirmé.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, company, trade, phone, is_admin)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'company',
          new.raw_user_meta_data ->> 'trade', new.raw_user_meta_data ->> 'phone',
          (new.email_confirmed_at is not null and lower(new.email) = 'batiflow23@gmail.com'));
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.grant_admin_on_confirm() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.email_confirmed_at is not null and lower(new.email) = 'batiflow23@gmail.com' then
    update public.profiles set is_admin = true where id = new.id;
  end if;
  return new;
end;
$$;
revoke execute on function public.grant_admin_on_confirm() from public, anon, authenticated;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users for each row execute function public.grant_admin_on_confirm();

-- ============ Données métier : chaque client ne voit que les siennes ============
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null, email text, phone text, address text,
  created_at timestamptz not null default now());
create table public.chantiers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  title text not null, address text,
  status text not null default 'a_venir' check (status in ('a_venir','en_cours','termine')),
  progress int not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now());
create table public.devis (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  chantier_id uuid references public.chantiers (id) on delete set null,
  title text not null,
  amount_ttc numeric(12,2) not null default 0 check (amount_ttc >= 0),
  status text not null default 'brouillon' check (status in ('brouillon','envoye','accepte','refuse')),
  sent_at timestamptz,
  relances_envoyees int not null default 0 check (relances_envoyees between 0 and 3),
  created_at timestamptz not null default now());
create table public.comptes_rendus (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  chantier_id uuid references public.chantiers (id) on delete set null,
  content text not null,
  created_at timestamptz not null default now());

alter table public.clients enable row level security;
alter table public.chantiers enable row level security;
alter table public.devis enable row level security;
alter table public.comptes_rendus enable row level security;
create policy "clients_own"        on public.clients        for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "chantiers_own"      on public.chantiers      for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "devis_own"          on public.devis          for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "comptes_rendus_own" on public.comptes_rendus for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
revoke all on public.clients, public.chantiers, public.devis, public.comptes_rendus from anon;

create index clients_owner_idx on public.clients (owner_id);
create index chantiers_owner_idx on public.chantiers (owner_id);
create index chantiers_client_idx on public.chantiers (client_id);
create index devis_owner_idx on public.devis (owner_id);
create index devis_client_idx on public.devis (client_id);
create index devis_chantier_idx on public.devis (chantier_id);
create index comptes_rendus_owner_idx on public.comptes_rendus (owner_id);
create index comptes_rendus_chantier_idx on public.comptes_rendus (chantier_id);

-- ============ Messages de contact (formulaire du site) ============
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 200 and email like '%_@_%._%'),
  message text not null check (char_length(message) between 5 and 4000),
  handled boolean not null default false,
  created_at timestamptz not null default now());
alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from anon, authenticated;
grant insert on public.contact_messages to anon, authenticated;
grant select on public.contact_messages to authenticated;
grant update (handled) on public.contact_messages to authenticated;
create policy "contact_insert_public" on public.contact_messages for insert to anon, authenticated with check (handled = false);
create policy "contact_select_admin"  on public.contact_messages for select to authenticated using (public.is_admin());
create policy "contact_update_admin"  on public.contact_messages for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============ Suppression de compte (droit à l'effacement) ============
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public
as $$ begin delete from auth.users where id = (select auth.uid()); end; $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
