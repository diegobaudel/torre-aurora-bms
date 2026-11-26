-- Torre Aurora BMS - Sprint 2: climatización, energía, alarmas y accesos
-- Incluye datos de prueba (~11 mil registros). Ejecutar completo en Supabase > SQL Editor.
-- Se puede volver a correr: borra y regenera solo los datos de prueba.

-- ==================== Tablas ====================
create table if not exists public.lecturas (
  id bigserial primary key,
  piso int not null check (piso between 1 and 5),
  fecha timestamptz not null default now(),
  temp numeric(4,1) not null,
  energia_total numeric(7,2) not null,      -- kWh en el intervalo
  energia_hvac numeric(7,2) not null,
  energia_iluminacion numeric(7,2) not null,
  energia_otros numeric(7,2) not null
);
create index if not exists lecturas_fecha_idx on public.lecturas (fecha desc, piso);

create table if not exists public.hvac_config (
  piso int primary key check (piso between 1 and 5),
  objetivo numeric(3,1) not null default 23 check (objetivo between 18 and 28),
  actualizado_por uuid references public.perfiles(id),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.bitacora_hvac (
  id bigserial primary key,
  piso int not null,
  objetivo numeric(3,1) not null,
  usuario_id uuid not null references public.perfiles(id),
  fecha timestamptz not null default now()
);

create table if not exists public.alarmas (
  id bigserial primary key,
  zona_id int not null references public.zonas(id),
  tipo text not null default 'humo' check (tipo in ('humo','intrusion')),
  inicio timestamptz not null default now(),
  atendida_en timestamptz,
  atendida_por uuid references public.perfiles(id),
  nota text
);
create index if not exists alarmas_inicio_idx on public.alarmas (inicio desc);

create table if not exists public.credenciales (
  id serial primary key,
  codigo text not null unique,
  titular text not null,
  tipo text not null default 'empleado' check (tipo in ('empleado','visitante','proveedor')),
  activa boolean not null default true,
  creada_en timestamptz not null default now()
);

create table if not exists public.credencial_zonas (
  credencial_id int references public.credenciales(id) on delete cascade,
  zona_id int references public.zonas(id) on delete cascade,
  primary key (credencial_id, zona_id)
);

create table if not exists public.accesos (
  id bigserial primary key,
  credencial_id int references public.credenciales(id) on delete set null,
  zona_id int not null references public.zonas(id),
  permitido boolean not null,
  fecha timestamptz not null default now()
);
create index if not exists accesos_fecha_idx on public.accesos (fecha desc);

-- ==================== Funciones de consulta ====================
-- Serie de consumo agrupada por hora o día (HU-13)
create or replace function public.consumo_serie(desde timestamptz, intervalo text default 'hour')
returns table (bucket timestamptz, piso int, kwh numeric)
language sql stable as $$
  select date_trunc(intervalo, fecha) as bucket, piso, round(sum(energia_total), 2)
  from public.lecturas
  where fecha >= desde
  group by 1, 2
  order by 1, 2
$$;

-- Totales por piso y subsistema (HU-13)
create or replace function public.consumo_resumen(desde timestamptz)
returns table (piso int, total numeric, hvac numeric, iluminacion numeric, otros numeric)
language sql stable as $$
  select piso, round(sum(energia_total), 1), round(sum(energia_hvac), 1),
         round(sum(energia_iluminacion), 1), round(sum(energia_otros), 1)
  from public.lecturas
  where fecha >= desde
  group by piso
  order by piso
$$;

grant execute on function public.consumo_serie(timestamptz, text) to authenticated;
grant execute on function public.consumo_resumen(timestamptz) to authenticated;

-- ==================== RLS ====================
alter table public.lecturas enable row level security;
alter table public.hvac_config enable row level security;
alter table public.bitacora_hvac enable row level security;
alter table public.alarmas enable row level security;
alter table public.credenciales enable row level security;
alter table public.credencial_zonas enable row level security;
alter table public.accesos enable row level security;

do $$
declare t text;
begin
  -- Lectura para cualquier usuario autenticado
  foreach t in array array['lecturas','hvac_config','bitacora_hvac','alarmas','credenciales','credencial_zonas','accesos'] loop
    execute format('drop policy if exists "%1$s: leer" on public.%1$s', t);
    execute format('create policy "%1$s: leer" on public.%1$s for select to authenticated using (true)', t);
  end loop;
end $$;

drop policy if exists "hvac_config: operar" on public.hvac_config;
create policy "hvac_config: operar" on public.hvac_config for all to authenticated
  using (public.mi_rol() in ('admin','operador')) with check (public.mi_rol() in ('admin','operador'));

drop policy if exists "bitacora_hvac: registrar" on public.bitacora_hvac;
create policy "bitacora_hvac: registrar" on public.bitacora_hvac for insert to authenticated
  with check (usuario_id = auth.uid() and public.mi_rol() in ('admin','operador'));

drop policy if exists "alarmas: atender" on public.alarmas;
create policy "alarmas: atender" on public.alarmas for all to authenticated
  using (public.mi_rol() in ('admin','operador','tecnico')) with check (public.mi_rol() in ('admin','operador','tecnico'));

drop policy if exists "credenciales: administrar" on public.credenciales;
create policy "credenciales: administrar" on public.credenciales for all to authenticated
  using (public.mi_rol() in ('admin','recepcion')) with check (public.mi_rol() in ('admin','recepcion'));

drop policy if exists "credencial_zonas: administrar" on public.credencial_zonas;
create policy "credencial_zonas: administrar" on public.credencial_zonas for all to authenticated
  using (public.mi_rol() in ('admin','recepcion')) with check (public.mi_rol() in ('admin','recepcion'));

drop policy if exists "accesos: registrar" on public.accesos;
create policy "accesos: registrar" on public.accesos for insert to authenticated
  with check (public.mi_rol() in ('admin','operador','recepcion'));

-- ==================== Datos de prueba ====================
truncate public.accesos, public.credencial_zonas, public.credenciales, public.alarmas, public.lecturas restart identity cascade;

insert into public.hvac_config (piso, objetivo) select g, 23 from generate_series(1, 5) g
on conflict (piso) do nothing;

-- Lecturas: cada hora durante 30 días + cada 5 min las últimas 24 h (~5,000 filas)
with tiempos as (
  select generate_series(now() - interval '30 days', now() - interval '24 hours', interval '1 hour') as f, 1.0 as escala
  union all
  select generate_series(now() - interval '24 hours', now(), interval '5 minutes'), 1.0 / 12
),
base as (
  select t.f, t.escala, p as piso,
         extract(hour from t.f at time zone 'America/Cancun') as h,
         extract(isodow from t.f at time zone 'America/Cancun') as dow
  from tiempos t cross join generate_series(1, 5) p
),
calc as (
  select *,
    (h between 8 and 19 and dow <= 5) as laboral,
    random() as r
  from base
)
insert into public.lecturas (piso, fecha, temp, energia_total, energia_hvac, energia_iluminacion, energia_otros)
select piso, f,
  round((21.2 + piso * 0.35 + 1.6 * sin((h - 9) / 24.0 * 2 * pi()) + (r - 0.5) * 0.8)::numeric, 1),
  round(((case when laboral then 9 else 3 end) * (0.85 + piso * 0.06) * (0.9 + r * 0.2) * escala)::numeric, 2),
  round(((case when laboral then 4.6 else 1.2 end) * (0.85 + piso * 0.06) * escala)::numeric, 2),
  round(((case when laboral then 2.4 else 0.6 end) * escala)::numeric, 2),
  round(((case when laboral then 2.0 else 1.2 end) * (0.9 + r * 0.2) * escala)::numeric, 2)
from calc;

-- Alarmas históricas: 120 eventos en 30 días, casi todas atendidas
insert into public.alarmas (zona_id, tipo, inicio, atendida_en, atendida_por, nota)
select z.id,
  case when random() < 0.7 then 'humo' else 'intrusion' end,
  i.inicio,
  case when random() < 0.95 then i.inicio + (interval '1 minute' * (2 + floor(random() * 25))) end,
  (select id from public.perfiles where rol = 'admin' order by creado_en limit 1),
  (array['Falsa alarma por vapor de cocina','Revisión de detector','Simulacro programado','Polvo en el sensor','Puerta forzada, se verificó con seguridad'])[1 + floor(random() * 5)::int]
from (select now() - (random() * interval '30 days') as inicio from generate_series(1, 120)) i
cross join lateral (select id from public.zonas where i.inicio is not null order by random() limit 1) z;

-- Credenciales: 40 personas
insert into public.credenciales (codigo, titular, tipo, activa)
select 'TA-' || lpad(g::text, 4, '0'),
  (array['Ana','Luis','María','Jorge','Sofía','Carlos','Fernanda','Ricardo','Valeria','Miguel','Daniela','Héctor','Paola','Andrés','Lucía','Raúl','Camila','Óscar','Gabriela','Iván'])[1 + (g * 7) % 20]
  || ' ' ||
  (array['Pérez','Chan','Gómez','May','Hernández','Canul','López','Pech','Martínez','Ek','Ramírez','Uc','Torres','Cocom','Flores'])[1 + (g * 11) % 15],
  case when g <= 30 then 'empleado' when g <= 36 then 'visitante' else 'proveedor' end,
  g not in (12, 27, 38)
from generate_series(1, 40) g;

-- Permisos: todos entran al lobby; empleados a su piso; dirección solo a algunos
insert into public.credencial_zonas (credencial_id, zona_id)
select c.id, z.id
from public.credenciales c
join public.zonas z on
  z.clave = 'p1z1'
  or (c.tipo = 'empleado' and z.piso = 2 + (c.id % 3))
  or (c.tipo = 'empleado' and c.id % 5 = 0 and z.clave = 'p5z1')
  or (c.tipo = 'proveedor' and z.clave in ('p1z2', 'p5z2'))
on conflict do nothing;

-- Accesos: 6,000 intentos en 30 días, en horario de oficina
insert into public.accesos (credencial_id, zona_id, permitido, fecha)
select c.id, z.id,
  c.activa and exists (select 1 from public.credencial_zonas cz where cz.credencial_id = c.id and cz.zona_id = z.id),
  (date_trunc('day', (now() - (floor(random() * 30) * interval '1 day')) at time zone 'America/Cancun') + interval '7 hours' + random() * interval '12 hours') at time zone 'America/Cancun'
from generate_series(1, 6000) g
cross join lateral (select id, activa from public.credenciales where g > 0 order by random() limit 1) c
cross join lateral (
  select id from public.zonas
  where random() < 0.85 and id in (select zona_id from public.credencial_zonas where credencial_id = c.id)
     or random() < 0.15
  order by random() limit 1
) z;

delete from public.accesos where fecha > now();  -- quita accesos 'del futuro' si se corre temprano

-- Resumen de lo cargado
select 'lecturas' as tabla, count(*) from public.lecturas
union all select 'alarmas', count(*) from public.alarmas
union all select 'credenciales', count(*) from public.credenciales
union all select 'credencial_zonas', count(*) from public.credencial_zonas
union all select 'accesos', count(*) from public.accesos;
