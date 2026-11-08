-- À exécuter si le schéma est déjà en place (ajoute la photo des idées)
set search_path = app_cadeaux;

alter table items add column if not exists image_url text
  check (image_url ~* '^https?://' and length(image_url) <= 2000);

create or replace function get_shared_list(code text, token text default null) returns json
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
        'claimed', (not is_own and c.item_id is not null),
        'claimed_by', case when is_own then null else c.guest_name end,
        'mine', coalesce(not is_own and token is not null and c.guest_token = token, false)
      ) order by i.created_at)
      from items i left join claims c on c.item_id = i.id
      where i.list_id = l.id), '[]'::json)
  ) into res;
  return res;
end $$;

