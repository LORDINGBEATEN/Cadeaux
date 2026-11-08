-- « À plusieurs » est proposé d'office sur toute idée qui a un prix. Le propriétaire peut le désactiver idée par idée.
-- À exécuter dans Supabase > SQL Editor (après la 011).
alter table app_cadeaux.items add column if not exists no_group boolean not null default false;
alter table app_cadeaux.items drop constraint if exists items_group_needs_price;
alter table app_cadeaux.items drop column if exists group_gift;

create or replace function app_cadeaux.contribute(code text, item uuid, guest text, token text, p_amount numeric, buyer boolean default null) returns void
  language plpgsql security definer set search_path = app_cadeaux as $$
declare l lists%rowtype; it items%rowtype; others numeric; amt numeric := round(p_amount, 2);
begin
  if length(coalesce(token,'')) < 16 then raise exception 'Jeton invalide'; end if;
  if length(trim(coalesce(guest,''))) = 0 then raise exception 'Indiquez votre prénom'; end if;
  if amt is null or amt <= 0 then raise exception 'Indiquez un montant'; end if;
  select l2.* into l from lists l2 join items i on i.list_id = l2.id where l2.share_code = code and i.id = item;
  if not found then raise exception 'Idée introuvable'; end if;
  if auth.uid() = l.owner_id then raise exception 'Vous ne pouvez pas participer à vos propres idées'; end if;
  select * into it from items where id = item;
  if it.price is null or it.no_group then raise exception 'Ce cadeau n''est pas ouvert aux participations'; end if;
  if exists (select 1 from claims where item_id = item) then raise exception 'Ce cadeau est déjà réservé'; end if;
  select coalesce(sum(amount), 0) into others from contributions where item_id = item and guest_token <> token;
  if others + amt > it.price then
    raise exception 'Il ne manque que % €', greatest(it.price - others, 0);
  end if;
  insert into contributions(item_id, guest_name, guest_token, amount, is_buyer)
  values (item, left(trim(guest), 60), token, amt, coalesce(buyer, false))
  on conflict (item_id, guest_token) do update
    set guest_name = excluded.guest_name, amount = excluded.amount,
        is_buyer = case when buyer is null then contributions.is_buyer else buyer end;
  if coalesce(buyer, false) then
    update contributions set is_buyer = false where item_id = item and guest_token <> token;
  end if;
end $$;

create or replace function app_cadeaux.get_shared_list(code text, token text default null) returns json
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
        'mine', coalesce(not is_own and token is not null and c.guest_token = token, false),
        'group_gift', (i.price is not null and not i.no_group),
        'contrib_total', coalesce((select sum(k.amount) from contributions k where k.item_id = i.id), 0),
        'contrib_count', (select count(*) from contributions k where k.item_id = i.id),
        'participant', coalesce(not is_own and token is not null
                           and exists (select 1 from contributions k where k.item_id = i.id and k.guest_token = token), false),
        'contributors', case when is_own or (token is not null
                           and exists (select 1 from contributions k where k.item_id = i.id and k.guest_token = token))
                        then coalesce((select json_agg(json_build_object(
                               'name', k.guest_name, 'amount', k.amount, 'buyer', k.is_buyer,
                               'mine', (token is not null and k.guest_token = token)) order by k.created_at)
                             from contributions k where k.item_id = i.id), '[]'::json)
                        else null end
      ) order by i.created_at)
      from items i left join claims c on c.item_id = i.id
      where i.list_id = l.id), '[]'::json)
  ) into res;
  return res;
end $$;
