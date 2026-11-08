-- À exécuter si le schéma est déjà en place : le propriétaire gère les réservations de ses listes.
set search_path = app_cadeaux;

-- Le propriétaire peut réserver au nom de quelqu'un (le jeton est aléatoire : personne ne peut l'annuler côté invité)
create or replace function owner_claim_item(p_item uuid, guest text) returns void
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
create or replace function owner_unclaim_item(p_item uuid) returns void
  language sql security definer set search_path = app_cadeaux as $$
  delete from claims where item_id = p_item and exists (
    select 1 from items i join lists l on l.id = i.list_id where i.id = p_item and l.owner_id = auth.uid())
$$;

grant execute on function owner_claim_item(uuid, text), owner_unclaim_item(uuid) to authenticated;
