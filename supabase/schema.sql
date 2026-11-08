-- À coller dans Supabase > SQL Editor > Run
-- Schéma dédié : n'interfère pas avec Pousse-Pousse / Jeu-sais (seul auth.users est partagé).

create schema if not exists app_cadeaux;
set search_path = app_cadeaux;

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default 'Sans nom'
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default substr(replace(gen_random_uuid()::text,'-',''),1,10),
  created_by uuid not null default auth.uid() references auth.users
);

create table group_members (
  group_id uuid references groups on delete cascade,
  user_id uuid references auth.users on delete cascade default auth.uid(),
  primary key (group_id, user_id)
);

create table lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  group_id uuid not null references groups on delete cascade,
  title text not null,
  occasion text not null default 'Anniversaire',
  event_date date
);

create table items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references lists on delete cascade,
  title text not null,
  url text,
  price numeric,
  note text,
  created_at timestamptz default now()
);

-- Réservations : INVISIBLES pour le propriétaire de la liste (effet surprise)
create table claims (
  item_id uuid primary key references items on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz default now()
);

-- Fonctions utilitaires (security definer pour éviter la récursion RLS)
create function is_member(g uuid) returns boolean
  language sql security definer stable set search_path = app_cadeaux as
  $$ select exists(select 1 from group_members where group_id = g and user_id = auth.uid()) $$;

create function list_group(l uuid) returns uuid
  language sql security definer stable set search_path = app_cadeaux as
  $$ select group_id from lists where id = l $$;

create function list_owner(l uuid) returns uuid
  language sql security definer stable set search_path = app_cadeaux as
  $$ select owner_id from lists where id = l $$;

create function item_list(i uuid) returns uuid
  language sql security definer stable set search_path = app_cadeaux as
  $$ select list_id from items where id = i $$;

create function create_group(group_name text) returns uuid
  language plpgsql security definer set search_path = app_cadeaux as $$
declare gid uuid;
begin
  insert into groups(name) values (group_name) returning id into gid;
  insert into group_members(group_id, user_id) values (gid, auth.uid());
  return gid;
end $$;

create function join_group(code text) returns uuid
  language plpgsql security definer set search_path = app_cadeaux as $$
declare gid uuid;
begin
  select id into gid from groups where invite_code = code;
  if gid is null then raise exception 'Code invalide'; end if;
  insert into group_members(group_id, user_id) values (gid, auth.uid()) on conflict do nothing;
  return gid;
end $$;

-- Crée le profil à la première connexion à cette appli (les comptes viennent
-- peut-être d'une autre appli : pas de trigger sur auth.users).
create function ensure_profile() returns void
  language plpgsql security definer set search_path = app_cadeaux as $$
declare u record;
begin
  select email, raw_user_meta_data from auth.users where id = auth.uid() into u;
  insert into profiles(id, name)
  values (auth.uid(), coalesce(nullif(u.raw_user_meta_data->>'name',''), split_part(u.email,'@',1)))
  on conflict (id) do nothing;
end $$;

-- Row Level Security
alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table lists enable row level security;
alter table items enable row level security;
alter table claims enable row level security;

create policy "profils visibles par les membres d'un même groupe" on profiles for select using (
  id = auth.uid() or exists (
    select 1 from group_members a join group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = profiles.id));
create policy "modifier son profil" on profiles for update using (id = auth.uid());

create policy "voir ses groupes" on groups for select using (is_member(id));
create policy "voir les membres" on group_members for select using (is_member(group_id));
create policy "quitter un groupe" on group_members for delete using (user_id = auth.uid());

create policy "voir les listes du groupe" on lists for select using (is_member(group_id));
create policy "créer sa liste" on lists for insert with check (owner_id = auth.uid() and is_member(group_id));
create policy "modifier sa liste" on lists for update using (owner_id = auth.uid());
create policy "supprimer sa liste" on lists for delete using (owner_id = auth.uid());

create policy "voir les cadeaux" on items for select using (is_member(list_group(list_id)));
create policy "ajouter ses cadeaux" on items for insert with check (list_owner(list_id) = auth.uid());
create policy "modifier ses cadeaux" on items for update using (list_owner(list_id) = auth.uid());
create policy "supprimer ses cadeaux" on items for delete using (list_owner(list_id) = auth.uid());

create policy "voir les réservations (sauf les siennes)" on claims for select using (
  list_owner(item_list(item_id)) <> auth.uid() and is_member(list_group(item_list(item_id))));
create policy "réserver un cadeau" on claims for insert with check (
  user_id = auth.uid() and list_owner(item_list(item_id)) <> auth.uid()
  and is_member(list_group(item_list(item_id))));
create policy "annuler sa réservation" on claims for delete using (user_id = auth.uid());

-- Droits pour l'API (connexion requise ; la RLS protège les données)
revoke all on all tables in schema app_cadeaux from anon, public;
revoke all on all functions in schema app_cadeaux from anon, public;
grant usage on schema app_cadeaux to authenticated;
grant select, insert, update, delete on all tables in schema app_cadeaux to authenticated;
grant execute on all functions in schema app_cadeaux to authenticated;
