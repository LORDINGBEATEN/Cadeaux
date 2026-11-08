-- Le propriétaire peut aussi cacher le nom quand il réserve pour quelqu'un, et voit quelles réservations ont un nom caché.
-- À exécuter dans Supabase > SQL Editor.
drop function if exists app_cadeaux.owner_claim_item(uuid, text);
create function app_cadeaux.owner_claim_item(p_item uuid, guest text, anon boolean default false) returns void
  language plpgsql security definer set search_path = app_cadeaux as $$
begin
  if length(trim(coalesce(guest, ''))) = 0 then raise exception 'Indiquez un prénom'; end if;
  if not exists (select 1 from items i join lists l on l.id = i.list_id where i.id = p_item and l.owner_id = auth.uid()) then
    raise exception 'Idée introuvable';
  end if;
  begin
    insert into claims(item_id, guest_name, guest_token, anonymous)
    values (p_item, left(trim(guest), 60), replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), coalesce(anon, false));
  exception when unique_violation then
    raise exception 'Cette idée est déjà réservée';
  end;
end $$;

drop function if exists app_cadeaux.list_claims(uuid);
create function app_cadeaux.list_claims(p_list uuid) returns table(item_id uuid, guest_name text, anonymous boolean)
  language sql security definer stable set search_path = app_cadeaux as $$
  select c.item_id, c.guest_name, c.anonymous
  from claims c join items i on i.id = c.item_id join lists l on l.id = i.list_id
  where l.id = p_list and l.owner_id = auth.uid()
$$;

revoke all on function app_cadeaux.owner_claim_item(uuid, text, boolean), app_cadeaux.list_claims(uuid) from anon, public;
grant execute on function app_cadeaux.owner_claim_item(uuid, text, boolean), app_cadeaux.list_claims(uuid) to authenticated;
