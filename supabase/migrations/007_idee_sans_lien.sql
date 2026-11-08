-- À exécuter si le schéma est déjà en place : une idée peut n'avoir qu'un nom, sans lien.
alter table app_cadeaux.items alter column url drop not null;
alter table app_cadeaux.items add constraint items_url_or_title
  check (url is not null or length(trim(coalesce(title, ''))) > 0);
