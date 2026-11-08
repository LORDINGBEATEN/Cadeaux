# 🎁 Le p'tit Canif

Application gratuite de listes de cadeaux :

1. Vous créez un compte et des listes (anniversaire, Noël…).
2. Vous y collez des **liens vers des pages web** qui montrent vos idées de cadeaux.
3. Vous partagez le **lien de la liste** : vos proches (sans compte) réservent une idée en indiquant leur prénom.
4. Vous ne voyez **pas** qui a réservé quoi : la surprise reste entière.

## Mise en route

1. Dans Supabase, **SQL Editor** : exécutez `supabase/schema.sql` (schéma dédié `app_cadeaux`).
   Pour repartir de zéro : `drop schema app_cadeaux cascade;` puis ré-exécutez le script.
2. Exposez le schéma dans l'API (ajoutez `app_cadeaux` à la liste existante, sans retirer les autres) :
   ```sql
   alter role authenticator set pgrst.db_schemas = 'public, graphql_public, app_jeusais, app_garden, app_cadeaux';
   notify pgrst, 'reload config';
   ```
3. Copiez `.env.example` en `.env.local` (URL du projet + clé publishable/anon), puis `npm install && npm run dev`.

## Vercel

Importez le dépôt, ajoutez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (Settings > Environment Variables), déployez.
Dans Supabase > Authentication > URL Configuration, ajoutez l'adresse Vercel aux *Redirect URLs*.
`vercel.json` gère la redirection SPA (les liens `/s/...` fonctionnent).

## Sécurité

Les invités n'ont accès (clé publique) qu'à trois fonctions : voir une liste via son code secret, réserver, annuler *leur* réservation (identifiée par un jeton stocké dans leur navigateur). Les tables ne sont accessibles qu'au propriétaire connecté.
