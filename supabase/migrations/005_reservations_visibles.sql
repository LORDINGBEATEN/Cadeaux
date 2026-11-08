-- À exécuter si le schéma est déjà en place : le propriétaire voit qui a réservé quoi.
set search_path = app_cadeaux;

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
        'claimed', (c.item_id is not null),
        'claimed_by', c.guest_name,
        'mine', coalesce(not is_own and token is not null and c.guest_token = token, false)
      ) order by i.created_at)
      from items i left join claims c on c.item_id = i.id
      where i.list_id = l.id), '[]'::json)
  ) into res;
  return res;
end $$;

-- Réservations d'une liste, pour son propriétaire uniquement (prénoms, sans le jeton secret).
create or replace function list_claims(p_list uuid) returns table(item_id uuid, guest_name text)
  language sql security definer stable set search_path = app_cadeaux as $$
  select c.item_id, c.guest_name
  from claims c join items i on i.id = c.item_id join lists l on l.id = i.list_id
  where l.id = p_list and l.owner_id = auth.uid()
$$;

grant execute on function list_claims(uuid) to authenticated;
