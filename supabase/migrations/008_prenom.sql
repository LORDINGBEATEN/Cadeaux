-- À exécuter si le schéma est déjà en place : prénom plus propre par défaut, et modifiable.
set search_path = app_cadeaux;

create or replace function ensure_profile() returns void
  language plpgsql security definer set search_path = app_cadeaux as $$
declare u record;
begin
  select email, raw_user_meta_data from auth.users where id = auth.uid() into u;
  insert into profiles(id, name)
  values (auth.uid(), coalesce(nullif(u.raw_user_meta_data->>'name',''), initcap(regexp_replace(split_part(u.email,'@',1), '[._+-].*$', ''))))
  on conflict (id) do nothing;
end $$;

-- Le prénom affiché (« Bonjour … », « Liste de … ») est modifiable par l'utilisateur.
create or replace function set_profile_name(p_name text) returns void
  language plpgsql security definer set search_path = app_cadeaux as $$
begin
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Indiquez un prénom'; end if;
  insert into profiles(id, name) values (auth.uid(), left(trim(p_name), 60))
  on conflict (id) do update set name = excluded.name;
end $$;

-- Corrige les prénoms créés automatiquement à partir de l'e-mail (« benoit.legrand » devient « Benoit »)
update profiles p set name = initcap(regexp_replace(split_part(u.email,'@',1), '[._+-].*$', ''))
from auth.users u where u.id = p.id and p.name = split_part(u.email, '@', 1);

grant execute on function set_profile_name(text) to authenticated;
