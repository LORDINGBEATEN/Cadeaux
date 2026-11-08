-- À exécuter si le schéma est déjà en place (archivage des listes)
alter table app_cadeaux.lists add column if not exists archived_at timestamptz;
