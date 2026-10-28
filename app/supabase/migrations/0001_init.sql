-- Le Bon Moment : schéma initial et règles d'isolation (Row Level Security).
-- À exécuter dans le SQL Editor du projet Supabase (voir docs/SUPABASE.md).
-- Principe : chaque donnée appartient à un propriétaire (owner_id) = un utilisateur
-- (particulier) ou une organisation (entreprise, collectivité). Les règles RLS
-- empêchent tout accès hors de ce périmètre, quel que soit le code du navigateur.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  profile text check (profile in ('particulier', 'entreprise', 'collectivite')),
  org_id uuid,
  created_at timestamptz default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('entreprise', 'collectivite')),
  name text not null check (char_length(name) between 2 and 160),
  territory jsonb,
  created_by uuid not null references auth.users default auth.uid(),
  created_at timestamptz default now()
);

create table public.memberships (
  org_id uuid references public.organizations on delete cascade,
  account_id uuid references auth.users on delete cascade,
  role text not null check (role in ('admin', 'gestionnaire', 'lecteur')),
  primary key (org_id, account_id)
);

-- Activation administrative ou contractuelle d'une collectivité.
-- AUCUNE règle d'écriture pour les utilisateurs : seule l'équipe Le Bon Moment
-- (clé service_role, côté serveur uniquement) peut activer un espace municipal.
create table public.activations (
  org_id uuid primary key references public.organizations on delete cascade,
  status text not null default 'en_attente' check (status in ('en_attente', 'active')),
  activated_by text,
  activated_at timestamptz,
  note text
);

-- Données métier (appareils, bâtiments, relevés, plannings…) stockées en JSON,
-- pour accepter de nouvelles catégories sans migration.
create table public.records (
  owner_id uuid not null,
  collection text not null check (collection in ('devices','categories','sites','zones','buildings','readings','plans','audit')),
  id text not null,
  origin text,
  data jsonb not null,
  updated_at timestamptz default now(),
  primary key (owner_id, collection, id)
);
create index records_owner_collection on public.records (owner_id, collection);

create table public.settings (owner_id uuid primary key, data jsonb not null);

-- Fonctions d'autorisation (security definer : lisent memberships sans boucle RLS).
create or replace function public.is_member(o uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where org_id = o and account_id = auth.uid());
$$;
create or replace function public.can_read(owner uuid) returns boolean language sql stable security definer set search_path = public as $$
  select owner = auth.uid() or public.is_member(owner);
$$;
create or replace function public.can_write(owner uuid) returns boolean language sql stable security definer set search_path = public as $$
  select owner = auth.uid()
    or exists (
      select 1 from memberships m join organizations o on o.id = m.org_id
      where m.org_id = owner and m.account_id = auth.uid() and m.role in ('admin', 'gestionnaire')
        and (o.kind <> 'collectivite' or exists (select 1 from activations a where a.org_id = o.id and a.status = 'active'))
    );
$$;
create or replace function public.is_admin(o uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where org_id = o and account_id = auth.uid() and role = 'admin');
$$;

-- Le créateur d'une organisation en devient administrateur ; une collectivité démarre « en attente ».
create or replace function public.on_org_created() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into memberships (org_id, account_id, role) values (new.id, new.created_by, 'admin');
  if new.kind = 'collectivite' then insert into activations (org_id) values (new.id); end if;
  return new;
end $$;
create trigger org_created after insert on public.organizations for each row execute function public.on_org_created();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.activations enable row level security;
alter table public.records enable row level security;
alter table public.settings enable row level security;

create policy "profil : lecture" on public.profiles for select using (id = auth.uid() or exists (select 1 from memberships m where m.account_id = profiles.id and public.is_member(m.org_id)));
create policy "profil : création" on public.profiles for insert with check (id = auth.uid());
create policy "profil : modification" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "organisation : lecture" on public.organizations for select using (public.is_member(id) or created_by = auth.uid());
create policy "organisation : création" on public.organizations for insert with check (created_by = auth.uid());
create policy "organisation : modification" on public.organizations for update using (public.is_admin(id)) with check (public.is_admin(id));

create policy "membres : lecture" on public.memberships for select using (public.is_member(org_id));
create policy "membres : ajout" on public.memberships for insert with check (public.is_admin(org_id));
create policy "membres : modification" on public.memberships for update using (public.is_admin(org_id));
create policy "membres : retrait" on public.memberships for delete using (public.is_admin(org_id));

create policy "activation : lecture" on public.activations for select using (public.is_member(org_id));

create policy "données : lecture" on public.records for select using (public.can_read(owner_id));
create policy "données : ajout" on public.records for insert with check (public.can_write(owner_id));
create policy "données : modification" on public.records for update using (public.can_write(owner_id)) with check (public.can_write(owner_id));
create policy "données : suppression" on public.records for delete using (public.can_write(owner_id));

create policy "réglages : lecture" on public.settings for select using (public.can_read(owner_id));
create policy "réglages : écriture" on public.settings for insert with check (public.can_write(owner_id));
create policy "réglages : modification" on public.settings for update using (public.can_write(owner_id));
