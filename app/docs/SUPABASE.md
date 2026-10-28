# Activer les comptes réels (Supabase)

Sans cette configuration, l'application reste en **mode local** (données dans le navigateur, sans sécurité).

## Étapes (à faire par l'équipe, avec son propre compte)

1. Créer un projet sur supabase.com (offre gratuite suffisante pour un prototype). Choisir une région en Europe.
2. Dans **SQL Editor**, exécuter le contenu de `supabase/migrations/0001_init.sql`.
3. Dans **Project Settings → API**, copier l'URL du projet et la clé **anon public**.
4. Créer `app/.env.local` (non versionné) à partir de `.env.example` :
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=...
   ```
5. Relancer `npm run dev`.

**Ne jamais** mettre la clé `service_role` dans `.env.local`, dans le code ou dans Git : elle contourne toutes les règles de sécurité.

## Activer une collectivité

Aucun utilisateur ne peut activer lui-même un espace municipal. Après vérification administrative ou contractuelle, un membre de l'équipe exécute dans le SQL Editor :

```sql
update public.activations
set status = 'active', activated_by = 'nom de la personne', activated_at = now(), note = 'référence du contrat ou de la vérification'
where org_id = '<identifiant de l’organisation>';
```

## À vérifier après mise en place (non testé à ce jour)

- Inscription, confirmation par e-mail, connexion.
- Deux collectivités : chacune ne voit que ses données (tester avec deux comptes).
- Un lecteur ne peut ni ajouter ni supprimer (refus du serveur).
- Une collectivité « en attente » ne peut pas écrire de données.
