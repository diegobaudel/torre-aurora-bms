<script setup>
// HU-05 Dar/quitar acceso a zonas por credencial
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { useIluminacion } from '../lib/useIluminacion'
import { useAuth } from '../stores/auth'

const auth = useAuth()
const { zonas, porPiso, cargarZonas } = useIluminacion()
const puedeAdministrar = computed(() => ['admin', 'recepcion'].includes(auth.rol))
const puedeLeer = computed(() => ['admin', 'operador', 'recepcion'].includes(auth.rol))
const TIPOS = { empleado: 'Empleado', visitante: 'Visitante', proveedor: 'Proveedor' }

const credenciales = ref([])
const permisos = ref([])          // [{ credencial_id, zona_id }]
const accesos = ref([])
const hoy = ref({ total: 0, rechazados: 0 })
const filtro = ref('')
const seleccion = ref(null)
const nueva = ref({ titular: '', tipo: 'empleado' })
const lector = ref({ credencial: null, zona: null })
const resultado = ref(null)       // { permitido, texto }
const soloRechazados = ref(false)
const msg = ref({ txt: '', error: false })

async function cargar() {
  const inicioHoy = new Date(); inicioHoy.setHours(0, 0, 0, 0)
  const [c, p, a, t, r] = await Promise.all([
    supabase.from('credenciales').select('*').order('codigo'),
    supabase.from('credencial_zonas').select('credencial_id, zona_id'),
    supabase.from('accesos').select('id, permitido, fecha, credenciales(codigo, titular), zonas(nombre, piso)').order('fecha', { ascending: false }).limit(40),
    supabase.from('accesos').select('id', { count: 'exact', head: true }).gte('fecha', inicioHoy.toISOString()),
    supabase.from('accesos').select('id', { count: 'exact', head: true }).gte('fecha', inicioHoy.toISOString()).eq('permitido', false),
  ])
  if (c.error) msg.value = { txt: `No se pudieron leer las credenciales: ${c.error.message}`, error: true }
  credenciales.value = c.data ?? []
  permisos.value = p.data ?? []
  accesos.value = a.data ?? []
  hoy.value = { total: t.count ?? 0, rechazados: r.count ?? 0 }
}
onMounted(() => { cargarZonas(); cargar() })

const visibles = computed(() => {
  const f = filtro.value.trim().toLowerCase()
  return credenciales.value.filter((c) => !f || `${c.codigo} ${c.titular}`.toLowerCase().includes(f))
})
const cred = computed(() => credenciales.value.find((c) => c.id === seleccion.value))
const tiene = (cid, zid) => permisos.value.some((p) => p.credencial_id === cid && p.zona_id === zid)
const numZonas = (cid) => permisos.value.filter((p) => p.credencial_id === cid).length
const accesosVisibles = computed(() => (soloRechazados.value ? accesos.value.filter((a) => !a.permitido) : accesos.value))

async function alternarZona(zona) {
  const c = cred.value
  if (!c || !puedeAdministrar.value) return
  const op = tiene(c.id, zona.id)
    ? supabase.from('credencial_zonas').delete().eq('credencial_id', c.id).eq('zona_id', zona.id)
    : supabase.from('credencial_zonas').insert({ credencial_id: c.id, zona_id: zona.id })
  const { error } = await op
  msg.value = error ? { txt: error.message, error: true }
    : { txt: `${c.titular}: acceso ${tiene(c.id, zona.id) ? 'retirado de' : 'concedido a'} piso ${zona.piso}, ${zona.nombre}`, error: false }
  cargar()
}

async function alternarActiva(c) {
  const { error } = await supabase.from('credenciales').update({ activa: !c.activa }).eq('id', c.id)
  msg.value = error ? { txt: error.message, error: true } : { txt: `Credencial ${c.codigo} ${c.activa ? 'desactivada' : 'activada'}`, error: false }
  cargar()
}

async function crear() {
  const siguiente = Math.max(0, ...credenciales.value.map((c) => Number(c.codigo.replace(/\D/g, '')) || 0)) + 1
  const codigo = `TA-${String(siguiente).padStart(4, '0')}`
  const { data, error } = await supabase.from('credenciales').insert({ codigo, titular: nueva.value.titular.trim(), tipo: nueva.value.tipo }).select().single()
  if (error) { msg.value = { txt: error.message, error: true }; return }
  // Toda credencial nueva entra al lobby
  const lobby = zonas.value.find((z) => z.clave === 'p1z1')
  if (lobby) await supabase.from('credencial_zonas').insert({ credencial_id: data.id, zona_id: lobby.id })
  msg.value = { txt: `Credencial ${codigo} creada para ${data.titular}. Ya puede entrar al lobby; asígnale más zonas.`, error: false }
  nueva.value = { titular: '', tipo: 'empleado' }
  await cargar()
  seleccion.value = data.id
}

// Lector de tarjetas simulado: valida permisos y registra el intento
async function leerTarjeta() {
  const c = credenciales.value.find((x) => x.id === lector.value.credencial)
  const z = zonas.value.find((x) => x.id === lector.value.zona)
  if (!c || !z) return
  const permitido = c.activa && tiene(c.id, z.id)
  const { error } = await supabase.from('accesos').insert({ credencial_id: c.id, zona_id: z.id, permitido })
  if (error) { msg.value = { txt: error.message, error: true }; return }
  resultado.value = {
    permitido,
    texto: permitido ? `Acceso permitido: ${c.titular} entra a ${z.nombre}`
      : !c.activa ? `Acceso denegado: la credencial ${c.codigo} está desactivada` : `Acceso denegado: ${c.titular} no tiene permiso en ${z.nombre}`,
  }
  cargar()
}
watch(seleccion, (id) => { lector.value.credencial = id; resultado.value = null })
const fmt = (d) => new Date(d).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
</script>

<template>
  <div class="space-y-5">
    <p v-if="msg.txt" role="status" class="panel px-4 py-3 text-sm" :class="msg.error ? 'border-alarma text-alarma' : 'border-menta text-menta'">{{ msg.txt }}</p>

    <section class="flex flex-wrap gap-8 text-sm">
      <div><p class="text-grafito">Credenciales</p><p class="text-2xl font-semibold tabular-nums">{{ credenciales.length }}</p></div>
      <div><p class="text-grafito">Activas</p><p class="text-2xl font-semibold tabular-nums">{{ credenciales.filter((c) => c.activa).length }}</p></div>
      <div><p class="text-grafito">Accesos hoy</p><p class="text-2xl font-semibold tabular-nums">{{ hoy.total }}</p></div>
      <div><p class="text-grafito">Rechazados hoy</p><p class="text-2xl font-semibold tabular-nums" :class="hoy.rechazados ? 'text-alarma' : ''">{{ hoy.rechazados }}</p></div>
    </section>

    <section class="grid gap-5 lg:grid-cols-[minmax(320px,420px)_1fr]">
      <!-- Lista de credenciales -->
      <div class="panel flex flex-col max-h-[640px]">
        <div class="p-4 border-b border-losa space-y-3">
          <input v-model="filtro" type="search" class="input" placeholder="Buscar por código o nombre" aria-label="Buscar credencial" />
          <form v-if="puedeAdministrar" class="flex gap-2" @submit.prevent="crear">
            <input v-model="nueva.titular" required class="input py-1.5" placeholder="Nombre del titular" aria-label="Nombre del titular" />
            <select v-model="nueva.tipo" class="input py-1.5 w-32" aria-label="Tipo"><option v-for="(t, k) in TIPOS" :key="k" :value="k">{{ t }}</option></select>
            <button class="btn-primary py-1.5 whitespace-nowrap">Crear</button>
          </form>
        </div>
        <ul class="overflow-y-auto divide-y divide-losa">
          <li v-for="c in visibles" :key="c.id">
            <button type="button" class="w-full text-left px-4 py-2.5 flex items-center gap-3 transition"
              :class="seleccion === c.id ? 'bg-cian/10' : 'hover:bg-fondo'" @click="seleccion = c.id">
              <span class="font-mono text-xs px-1.5 py-0.5 rounded bg-fondo text-grafito">{{ c.codigo }}</span>
              <span class="min-w-0 flex-1">
                <span class="block font-medium truncate" :class="c.activa ? '' : 'line-through text-grafito'">{{ c.titular }}</span>
                <span class="block text-xs text-grafito">{{ TIPOS[c.tipo] }}, {{ numZonas(c.id) }} zona(s)</span>
              </span>
              <span v-if="!c.activa" class="text-xs text-alarma">Inactiva</span>
            </button>
          </li>
        </ul>
      </div>

      <div class="grid gap-5 content-start">
        <!-- Permisos de la credencial -->
        <div class="panel p-5">
          <template v-if="cred">
            <div class="flex flex-wrap items-center gap-3 mb-4">
              <h2 class="font-semibold text-lg">{{ cred.titular }}</h2>
              <span class="font-mono text-xs px-1.5 py-0.5 rounded bg-fondo text-grafito">{{ cred.codigo }}</span>
              <span class="text-sm text-grafito">{{ TIPOS[cred.tipo] }}</span>
              <button v-if="puedeAdministrar" class="ml-auto btn-ghost" @click="alternarActiva(cred)">{{ cred.activa ? 'Desactivar credencial' : 'Activar credencial' }}</button>
            </div>
            <p class="text-sm text-grafito mb-3">Marca las zonas donde esta credencial puede entrar.</p>
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <fieldset v-for="(lista, pi) in porPiso" :key="pi" class="rounded-md border border-losa p-3">
                <legend class="px-1 text-sm font-medium">Piso {{ pi }}</legend>
                <label v-for="z in lista" :key="z.id" class="flex items-center gap-2 py-1 text-sm cursor-pointer">
                  <input type="checkbox" class="h-4 w-4 accent-cian" :checked="tiene(cred.id, z.id)" :disabled="!puedeAdministrar" @change="alternarZona(z)" />
                  {{ z.nombre }}
                </label>
              </fieldset>
            </div>
          </template>
          <p v-else class="text-sm text-grafito">Elige una credencial de la lista para ver y cambiar sus zonas.</p>
        </div>

        <!-- Lector simulado -->
        <div class="panel p-5">
          <h2 class="font-semibold mb-3">Probar lector de tarjeta</h2>
          <form class="flex flex-wrap gap-3 items-end" @submit.prevent="leerTarjeta">
            <label class="flex-1 min-w-48"><span class="text-xs text-grafito">Credencial</span>
              <select v-model="lector.credencial" required class="input mt-1 py-1.5">
                <option v-for="c in credenciales" :key="c.id" :value="c.id">{{ c.codigo }}, {{ c.titular }}</option>
              </select>
            </label>
            <label class="flex-1 min-w-48"><span class="text-xs text-grafito">Puerta</span>
              <select v-model="lector.zona" required class="input mt-1 py-1.5">
                <option v-for="z in zonas" :key="z.id" :value="z.id">Piso {{ z.piso }}, {{ z.nombre }}</option>
              </select>
            </label>
            <button class="btn-primary" :disabled="!puedeLeer">Pasar tarjeta</button>
          </form>
          <p v-if="resultado" role="status" class="mt-3 rounded-md px-4 py-3 text-sm font-medium"
            :class="resultado.permitido ? 'bg-menta/15 text-menta' : 'bg-alarma/10 text-alarma'">{{ resultado.texto }}</p>
        </div>
      </div>
    </section>

    <!-- Bitácora de accesos -->
    <section class="panel overflow-x-auto">
      <div class="flex items-center gap-3 px-4 pt-4 pb-3">
        <h2 class="font-semibold mr-auto">Últimos accesos</h2>
        <label class="flex items-center gap-2 text-sm"><input v-model="soloRechazados" type="checkbox" class="h-4 w-4 accent-cian" /> Solo rechazados</label>
      </div>
      <table class="w-full text-sm">
        <thead class="text-left text-grafito border-y border-losa bg-fondo/60">
          <tr><th class="px-4 py-2 font-medium">Fecha</th><th class="px-4 py-2 font-medium">Credencial</th><th class="px-4 py-2 font-medium">Puerta</th><th class="px-4 py-2 font-medium">Resultado</th></tr>
        </thead>
        <tbody class="divide-y divide-losa">
          <tr v-for="a in accesosVisibles" :key="a.id">
            <td class="px-4 py-2 tabular-nums whitespace-nowrap">{{ fmt(a.fecha) }}</td>
            <td class="px-4 py-2">{{ a.credenciales?.codigo }} <span class="text-grafito">{{ a.credenciales?.titular }}</span></td>
            <td class="px-4 py-2 whitespace-nowrap">Piso {{ a.zonas?.piso }}, {{ a.zonas?.nombre }}</td>
            <td class="px-4 py-2"><span class="inline-flex items-center gap-1.5 font-medium" :class="a.permitido ? 'text-menta' : 'text-alarma'">
              <span class="h-2 w-2 rounded-full" :class="a.permitido ? 'bg-menta' : 'bg-alarma'" />{{ a.permitido ? 'Permitido' : 'Rechazado' }}</span></td>
          </tr>
          <tr v-if="!accesosVisibles.length"><td colspan="4" class="px-4 py-6 text-grafito">No hay accesos registrados.</td></tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
