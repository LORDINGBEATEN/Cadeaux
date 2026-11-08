-- Un invité peut cacher son nom aux autres invités (le propriétaire de la liste le voit toujours).
-- À exécuter dans Supabase > SQL Editor.
alter table app_cadeaux.claims add column if not exists anonymous boolean not null default false;

drop function if exists app_cadeaux.claim_item(text, uuid, text, text);
create function app_cadeaux.claim_item(code text, item uuid, guest text, token text, anon boolean default false) returns void
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
        'mine', coalesce(not is_own and token is not null and c.guest_token = token, false)
      ) order by i.created_at)
      from items i left join claims c on c.item_id = i.id
      where i.list_id = l.id), '[]'::json)
  ) into res;
  return res;
end $$;

grant execute on function app_cadeaux.claim_item(text, uuid, text, text, boolean) to anon, authenticated;
