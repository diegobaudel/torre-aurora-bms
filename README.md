# Torre Aurora BMS

Sistema de gestión del edificio (BMS) de la Torre Corporativa Aurora. Proyecto del Equipo 5, Métodos de Desarrollo de Software, Universidad del Caribe.

- Jira: proyecto **Torre Aurora BMS** (clave `TAB`)
- Confluence: espacio **Torre Aurora BMS**

## Stack

| Parte | Tecnología |
|---|---|
| Frontend | Vue 3 + Vite, Vue Router, Pinia, Tailwind CSS, Chart.js |
| Login, base de datos y roles | Supabase (Auth, PostgreSQL con RLS, Edge Functions) |
| Tiempo real / IoT | MQTT con HiveMQ público (`wss` desde el navegador) |
| Sensores | Simulador en Node.js (no hay hardware real) |

## Estructura

```
web/        Front en Vue
simulador/  Publica lecturas por MQTT y responde comandos
supabase/   migrations/ (SQL) y functions/ (Edge Functions)
docs/       Diagramas y capturas
```

## Puesta en marcha

### 1. Supabase (una sola vez, lo hace una persona)
1. Crear proyecto en https://supabase.com.
2. **SQL Editor** → pegar y ejecutar `supabase/migrations/001_init.sql` y luego `supabase/migrations/002_sprint2.sql` (tablas del Sprint 2 y ~11 mil registros de prueba; se puede volver a correr para regenerar los datos).
3. **Authentication → Providers → Email**: desactivar "Allow new users to sign up" (los usuarios los crea el admin desde la app).
4. **Authentication → Users → Add user**: crear el primer usuario (marcar "Auto confirm"). Luego en SQL Editor:
   ```sql
   update perfiles set rol = 'admin', nombre = 'Diego López' where correo = 'TU_CORREO';
   ```
5. Desplegar la Edge Function (necesita la CLI de Supabase):
   ```bash
   npx supabase login
   npx supabase link --project-ref TU_PROJECT_REF
   npx supabase functions deploy crear-usuario
   ```
6. Compartir con el equipo la **URL** y la **anon key** (Project Settings → API). La *service role key* nunca va en el front ni en el repo.

### 2. Simulador
```bash
cd simulador
cp .env.example .env
npm install
npm start            # lecturas cada 5 s
npm run humo         # además dispara una alarma de humo en p3z2
```
Opcional: con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en `simulador/.env`, el simulador guarda una lectura por minuto en la tabla `lecturas` y las gráficas de Energía crecen con datos reales. Esa llave es secreta: solo va en el `.env` del simulador, nunca en el front ni en el repo.

### 3. Web
```bash
cd web
cp .env.example .env   # poner URL y anon key de Supabase
npm install
npm run dev            # http://localhost:5173
```

`MQTT_PREFIX` (simulador) y `VITE_MQTT_PREFIX` (web) deben ser iguales. El broker es público: el prefijo evita mezclarse con otros equipos.

## Tópicos MQTT

| Tópico | Quién publica | Valor |
|---|---|---|
| `{prefijo}/p{n}z{m}/luz/estado` | simulador | `on` / `off` (retained) |
| `{prefijo}/p{n}z{m}/luz/set` | web | `on` / `off` |
| `{prefijo}/p{n}/temp` | simulador | °C |
| `{prefijo}/p{n}/hvac/set` | web | temperatura objetivo 18 a 28 |
| `{prefijo}/p{n}/energia` | simulador | kWh |
| `{prefijo}/p{n}z{m}/humo` | simulador | `alarma` |
| `{prefijo}/sim/estado` | simulador | `{ "online": true }` |

## Base de datos

| Tabla | Uso |
|---|---|
| `perfiles` | nombre, correo, rol (`admin`, `operador`, `tecnico`, `recepcion`, `inquilino`), activo |
| `zonas` | 5 pisos × 2 zonas; `clave` se usa en los tópicos (`p3z2`) |
| `dispositivos` | sensores y actuadores por zona y subsistema |
| `bitacora_iluminacion` | quién encendió/apagó qué zona y cuándo (HU-10) |
| `lecturas` | temperatura y consumo por piso y subsistema (HU-07, HU-13) |
| `hvac_config`, `bitacora_hvac` | temperatura objetivo por piso y quién la cambió (HU-08) |
| `alarmas` | humo e intrusión: detección, atención, quién y nota (HU-15) |
| `credenciales`, `credencial_zonas`, `accesos` | tarjetas, zonas permitidas e intentos de acceso (HU-05) |

## Historias del Sprint 1 y dónde están

| Historia | Archivos |
|---|---|
| TAB-19 HU-01 Login | `web/src/views/Login.vue`, `web/src/stores/auth.js`, `web/src/router.js` (guard) |
| TAB-20 HU-02 Usuarios y roles | `web/src/views/Usuarios.vue`, `supabase/functions/crear-usuario/` |
| TAB-21 HU-03 Dashboard | `web/src/views/Dashboard.vue` |
| TAB-22 HU-10 Iluminación | `web/src/views/Iluminacion.vue` |
| TAB-6 T-01 Simulador | `simulador/index.js` |

## Historias del Sprint 2

| Historia | Archivos |
|---|---|
| TAB-24 HU-07 Temperatura por piso | `web/src/views/Climatizacion.vue` |
| TAB-25 HU-08 Temperatura objetivo | `web/src/views/Climatizacion.vue` |
| TAB-26 HU-13 Consumo eléctrico | `web/src/views/Energia.vue`, funciones `consumo_serie` y `consumo_resumen` |
| TAB-27 HU-15 Alerta de humo | `web/src/views/Seguridad.vue`, `web/src/lib/useAlarmas.js` |
| TAB-23 HU-05 Acceso por credencial | `web/src/views/Accesos.vue` |

## Forma de trabajo

- Rama por historia: `feature/TAB-19-login`.
- La clave va en cada commit para que se ligue con Jira: `TAB-22 agrega bitácora de iluminación`.
- Pull request a `main`; lo revisa alguien distinto a quien lo hizo (columna **En revisión**).
