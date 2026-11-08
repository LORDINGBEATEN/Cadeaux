# 🎁 Liste cadeaux

Application 100 % gratuite pour partager des listes de cadeaux (anniversaire, Noël…) en famille et entre amis.
Le propriétaire d'une liste **ne voit pas qui a réservé quoi** : la surprise est préservée.

## Mise en route (gratuit)

1. Créez un projet sur [supabase.com](https://supabase.com) (offre gratuite).
2. Dans **SQL Editor**, collez et exécutez `supabase/schema.sql` : tout est créé dans le schéma dédié `app_cadeaux` (seuls les comptes `auth.users` sont partagés avec les autres applis).
   Puis dans **Project Settings > API > Exposed schemas**, ajoutez `app_cadeaux` (sans cela l'API renvoie une erreur).
3. Dans **Authentication > URL Configuration**, ajoutez l'adresse de votre site (et `http://localhost:5173` pour tester) dans *Site URL / Redirect URLs*.
4. Copiez `.env.example` en `.env.local` et renseignez l'URL et la clé *anon* (Project Settings > API).
5. `npm install && npm run dev`

## Mise en ligne sur Vercel (gratuit)

1. Poussez le projet sur GitHub, puis sur [vercel.com](https://vercel.com) : **Add New > Project** et importez le dépôt (Vite est détecté automatiquement).
2. Dans **Settings > Environment Variables**, ajoutez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (mêmes valeurs que dans `.env.local`), puis déployez.
3. Dans Supabase, **Authentication > URL Configuration** : ajoutez l'adresse Vercel (ex. `https://votre-app.vercel.app`) aux *Redirect URLs*, en gardant celles des autres applis.

La redirection SPA est gérée par `vercel.json`. Les variables `VITE_*` sont intégrées au moment du build : après les avoir modifiées, il faut redéployer.

## Notes

- Les e-mails de connexion de l'offre gratuite Supabase sont limités en nombre : la connexion par mot de passe évite cette limite.
- Fonctionnalités : groupes avec lien d'invitation, listes par occasion, cadeaux (lien, prix, note), réservation cachée au propriétaire.
