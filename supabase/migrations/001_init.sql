-- Torre Aurora BMS - esquema inicial (Sprint 1)
-- Ejecutar completo en Supabase > SQL Editor

-- ========== Tablas ==========
create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  correo text not null unique,
  rol text not null default 'operador'
    check (rol in ('admin','operador','tecnico','recepcion','inquilino')),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table if not exists public.zonas (
  id serial primary key,
  piso int not null,
  nombre text not null,
  clave text not null unique          -- se usa en los tópicos MQTT, ej. p1z1
);

create table if not exists public.dispositivos (
  id serial primary key,
  zona_id int references public.zonas(id) on delete cascade,
  subsistema text not null check (subsistema in ('acceso','hvac','iluminacion','energia','seguridad')),
  tipo text not null check (tipo in ('sensor','actuador')),
  nombre text not null
);

create table if not exists public.bitacora_iluminacion (
  id bigserial primary key,
  zona_id int not null references public.zonas(id),
  estado text not null check (estado in ('on','off')),
  usuario_id uuid not null references public.perfiles(id),
  fecha timestamptz not null default now()
);

-- ========== Perfil automático al crear un usuario ==========
create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre, correo, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'rol', 'operador')
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- ========== Helpers de rol ==========
create or replace function public.mi_rol()
returns text language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid() and activo
$$;

-- ========== RLS ==========
alter table public.perfiles enable row level security;
alter table public.zonas enable row level security;
alter table public.dispositivos enable row level security;
alter table public.bitacora_iluminacion enable row level security;

create policy "perfiles: leer autenticados" on public.perfiles
  for select to authenticated using (true);
create policy "perfiles: admin actualiza" on public.perfiles
  for update to authenticated using (public.mi_rol() = 'admin');

create policy "zonas: leer autenticados" on public.zonas
  for select to authenticated using (true);
create policy "zonas: admin escribe" on public.zonas
  for all to authenticated using (public.mi_rol() = 'admin') with check (public.mi_rol() = 'admin');

create policy "dispositivos: leer autenticados" on public.dispositivos
  for select to authenticated using (true);
create policy "dispositivos: admin escribe" on public.dispositivos
  for all to authenticated using (public.mi_rol() = 'admin') with check (public.mi_rol() = 'admin');

create policy "bitacora: leer autenticados" on public.bitacora_iluminacion
  for select to authenticated using (true);
create policy "bitacora: registra admin u operador" on public.bitacora_iluminacion
  for insert to authenticated
  with check (usuario_id = auth.uid() and public.mi_rol() in ('admin','operador'));

-- ========== Datos de prueba: 5 pisos x 2 zonas ==========
insert into public.zonas (piso, nombre, clave) values
  (1,'Lobby','p1z1'),(1,'Recepción','p1z2'),
  (2,'Oficinas norte','p2z1'),(2,'Oficinas sur','p2z2'),
  (3,'Oficinas norte','p3z1'),(3,'Sala de juntas','p3z2'),
  (4,'Oficinas norte','p4z1'),(4,'Oficinas sur','p4z2'),
  (5,'Dirección','p5z1'),(5,'Terraza','p5z2')
on conflict (clave) do nothing;

insert into public.dispositivos (zona_id, subsistema, tipo, nombre)
select id, 'iluminacion', 'actuador', 'Luminarias ' || nombre from public.zonas
on conflict do nothing;
