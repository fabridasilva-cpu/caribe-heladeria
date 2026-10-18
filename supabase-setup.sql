-- Ejecutar en Supabase > SQL Editor después de crear el proyecto.
-- Antes de ejecutar, crear un usuario del local en Authentication > Users.
-- Reemplazar ADMIN_EMAIL al final por el correo exacto de ese usuario.

create table if not exists public.inventory (
  type text not null check (type in ('products', 'sauces')),
  name text not null,
  available boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (type, name)
);

create table if not exists public.stock_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.inventory enable row level security;
alter table public.stock_admins enable row level security;

revoke all on table public.inventory from anon, authenticated;
revoke all on table public.stock_admins from anon, authenticated;
grant select on table public.inventory to anon, authenticated;
grant insert, update on table public.inventory to authenticated;
grant select on table public.stock_admins to authenticated;

drop policy if exists "Anyone can read inventory" on public.inventory;
drop policy if exists "Approved admins can add inventory" on public.inventory;
drop policy if exists "Approved admins can update inventory" on public.inventory;
drop policy if exists "Admins can read their own access" on public.stock_admins;

create policy "Anyone can read inventory"
  on public.inventory for select
  to anon, authenticated
  using (true);

create policy "Admins can read their own access"
  on public.stock_admins for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Approved admins can add inventory"
  on public.inventory for insert
  to authenticated
  with check (exists (
    select 1 from public.stock_admins
    where user_id = (select auth.uid())
  ));

create policy "Approved admins can update inventory"
  on public.inventory for update
  to authenticated
  using (exists (
    select 1 from public.stock_admins
    where user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.stock_admins
    where user_id = (select auth.uid())
  ));

-- Activar las notificaciones de cambios que reciben las páginas abiertas.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inventory'
  ) then
    alter publication supabase_realtime add table public.inventory;
  end if;
end;
$$;

-- Autorizar el usuario del local. Cambiar el correo antes de ejecutar esta línea.
insert into public.stock_admins (user_id)
select id from auth.users where email = 'ADMIN_EMAIL'
on conflict (user_id) do nothing;
