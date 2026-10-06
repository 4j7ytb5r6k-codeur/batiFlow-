-- ÉTAT : déjà appliqué sur le projet Supabase yvdkrrkrxiizyelivtlv (pas besoin de le relancer).
-- Si l'exécution d'un seul bloc expire, lancez les instructions une par une.
-- batiFlow : espace client créé automatiquement à l'inscription.
-- À coller dans Supabase > SQL Editor > New query, puis « Run ».

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text,
  company       text,
  trade         text,
  phone         text,
  plan          text not null default 'trial',
  trial_ends_at timestamptz not null default (now() + interval '7 days'),
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Chaque client lit uniquement son propre espace.
-- Aucune policy d'écriture : le client ne peut pas modifier son plan ni la fin de son essai.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using ((select auth.uid()) = id);

-- À chaque création de compte, l'espace client (profil + essai de 7 jours) est créé.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, company, trade, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'company',
    new.raw_user_meta_data ->> 'trade',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

-- La fonction n'est appelée que par le déclencheur, jamais directement par un client.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
