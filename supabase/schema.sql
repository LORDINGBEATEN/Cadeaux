-- Ma P'tite Liste — à coller dans Supabase > SQL Editor > Run
-- Schéma dédié : n'interfère pas avec les autres applis (seul auth.users est partagé).
-- Pour repartir de zéro : drop schema app_cadeaux cascade;

create schema if not exists app_cadeaux;
set search_path = app_cadeaux;

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default 'Sans nom'
);

create table lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  occasion text not null default 'Anniversaire',
  event_date date,
  archived_at timestamptz,
  -- code secret du lien de partage donné aux invités
  share_code text not null unique
    default substr(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 1, 16)
);

create table items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references lists on delete cascade,
  title text,
  url text check (url ~* '^https?://'),
  note text,
  price numeric,
  currency text,
  image_url text check (image_url ~* '^https?://' and length(image_url) <= 2000),
  created_at timestamptz default now(),
  -- une idée a un lien, un nom, ou les deux
  constraint items_url_or_title check (url is not null or length(trim(coalesce(title, ''))) > 0)
);

-- Réservations faites par les invités (sans compte). Aucune politique RLS : seules les fonctions
-- ci-dessous y accèdent (le jeton secret de l'invité n'est jamais exposé, même au propriétaire).
create table claims (
  item_id uuid primary key references items on delete cascade,
  guest_name text not null check (length(trim(guest_name)) between 1 and 60),
  guest_token text not null,
  anonymous boolean not null default false,
  created_at timestamptz default now()
);

create function list_owner(l uuid) returns uuid
  language sql security definer stable set search_path = app_cadeaux as
  $$ select owner_id from lists where id = l $$;

-- Profil créé à la première connexion à cette appli (pas de trigger sur auth.users)
create function ensure_profile() returns void
  language plpgsql security definer set search_path = app_cadeaux as $$
declare u record;
begin
  select email, raw_user_meta_data from auth.users where id = auth.uid() into u;
  insert into profiles(id, name)
  values (auth.uid(), coalesce(nullif(u.raw_user_meta_data->>'name',''), initcap(regexp_replace(split_part(u.email,'@',1), '[._+-].*$', ''))))
  on conflict (id) do nothing;
end $$;

-- Le prénom affiché (« Bonjour … », « Liste de … ») est modifiable par l'utilisateur.
create function set_profile_name(p_name text) returns void
  language plpgsql security definer set search_path = app_cadeaux as $$
begin
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Indiquez un prénom'; end if;
  insert into profiles(id, name) values (auth.uid(), left(trim(p_name), 60))
  on conflict (id) do update set name = excluded.name;
end $$;

-- Page invité : la liste, ses idées et l'état des réservations.
create function get_shared_list(code text, token text default null) returns json
  language plpgsql security definer stable set search_path = app_cadeaux as $$
declare l lists%rowtype; is_own boolean; res json;
begin
  select * into l from lists where share_code = code;
  if not found then return null; end if;
  is_own := (auth.uid() is not null and auth.uid() = l.owner_id);
  select json_build_object(
    'title', l.title,
    'occasion', l.occasion,
    'event_date', l.event_date,
    'owner_name', (select name from profiles where id = l.owner_id),
    'is_owner', is_own,
    'items', coalesce((
      select json_agg(json_build_object(
        'id', i.id, 'title', i.title, 'url', i.url, 'note', i.note,
        'price', i.price, 'currency', i.currency, 'image_url', i.image_url,
        'claimed', (c.item_id is not null),
        'claimed_by', case when c.item_id is null then null
                           when is_own or not c.anonymous or (token is not null and c.guest_token = token) then c.guest_name
                           else null end,
        'anonymous', coalesce(c.anonymous, false),
        'mine', coalesce(not is_own and token is not null and c.guest_token = token, false)
      ) order by i.created_at)
      from items i left join claims c on c.item_id = i.id
      where i.list_id = l.id), '[]'::json)
  ) into res;
  return res;
end $$;

-- Réservations d'une liste, pour son propriétaire uniquement (prénoms, sans le jeton secret).
create function list_claims(p_list uuid) returns table(item_id uuid, guest_name text)
  language sql security definer stable set search_path = app_cadeaux as $$
  select c.item_id, c.guest_name
  from claims c join items i on i.id = c.item_id join lists l on l.id = i.list_id
  where l.id = p_list and l.owner_id = auth.uid()
$$;

-- Le propriétaire peut réserver au nom de quelqu'un (le jeton est aléatoire : personne ne peut l'annuler côté invité)
create function owner_claim_item(p_item uuid, guest text) returns void
  language plpgsql security definer set search_path = app_cadeaux as $$
begin
  if length(trim(coalesce(guest, ''))) = 0 then raise exception 'Indiquez un prénom'; end if;
  if not exists (select 1 from items i join lists l on l.id = i.list_id where i.id = p_item and l.owner_id = auth.uid()) then
    raise exception 'Idée introuvable';
  end if;
  begin
    insert into claims(item_id, guest_name, guest_token)
    values (p_item, left(trim(guest), 60), replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''));
  exception when unique_violation then
    raise exception 'Cette idée est déjà réservée';
  end;
end $$;

-- Le propriétaire peut retirer n'importe quelle réservation de ses listes
create function owner_unclaim_item(p_item uuid) returns void
  language sql security definer set search_path = app_cadeaux as $$
  delete from claims where item_id = p_item and exists (
    select 1 from items i join lists l on l.id = i.list_id where i.id = p_item and l.owner_id = auth.uid())
$$;

create function claim_item(code text, item uuid, guest text, token text, anon boolean default false) returns void
  language plpgsql security definer set search_path = app_cadeaux as $$
declare l lists%rowtype;
begin
  if length(coalesce(token,'')) < 16 then raise exception 'Jeton invalide'; end if;
  if length(trim(coalesce(guest,''))) = 0 then raise exception 'Indiquez votre prénom'; end if;
  select l2.* into l from lists l2 join items i on i.list_id = l2.id
   where l2.share_code = code and i.id = item;
  if not found then raise exception 'Idée introuvable'; end if;
  if auth.uid() = l.owner_id then raise exception 'Vous ne pouvez pas réserver vos propres idées'; end if;
  begin
    insert into claims(item_id, guest_name, guest_token, anonymous) values (item, trim(guest), token, coalesce(anon, false));
  exception when unique_violation then
    raise exception 'Cette idée est déjà réservée';
  end;
end $$;

create function unclaim_item(item uuid, token text) returns void
  language sql security definer set search_path = app_cadeaux as
  $$ delete from claims where item_id = item and guest_token = token $$;

-- Row Level Security (propriétaire uniquement)
alter table profiles enable row level security;
alter table lists enable row level security;
alter table items enable row level security;
alter table claims enable row level security;

create policy "voir son profil" on profiles for select using (id = auth.uid());
create policy "modifier son profil" on profiles for update using (id = auth.uid());

create policy "gérer ses listes" on lists for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "gérer ses idées" on items for all
  using (list_owner(list_id) = auth.uid()) with check (list_owner(list_id) = auth.uid());

-- Droits API
revoke all on all tables in schema app_cadeaux from anon, public;
revoke all on all functions in schema app_cadeaux from anon, public;
grant usage on schema app_cadeaux to anon, authenticated;
grant select, insert, update, delete on all tables in schema app_cadeaux to authenticated;
grant execute on all functions in schema app_cadeaux to authenticated;
-- Les invités (non connectés) n'ont accès qu'à ces 3 fonctions :
grant execute on function get_shared_list(text, text), claim_item(text, uuid, text, text, boolean),
  unclaim_item(uuid, text) to anon;
