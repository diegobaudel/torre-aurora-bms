<script setup>
// HU-15 Alerta por sensor de humo: alerta visible, se mantiene hasta atenderla y queda registrada
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { edificio, etiquetaZona } from '../lib/mqtt'
import { useAlarmas } from '../lib/useAlarmas'
import { useIluminacion } from '../lib/useIluminacion'
import { useAuth } from '../stores/auth'
import KpiTile from '../components/KpiTile.vue'

const auth = useAuth()
const { atender, simularHumo } = useAlarmas()
const { zonas, cargarZonas } = useIluminacion()
const puedeAtender = computed(() => ['admin', 'operador', 'tecnico'].includes(auth.rol))

const historial = ref([])
const dias = ref(7)
const tipo = ref('todas')
const notas = ref({})
const zonaPrueba = ref('p3z2')
const msg = ref({ txt: '', error: false })

async function cargar() {
  const desde = new Date(Date.now() - dias.value * 864e5).toISOString()
  let q = supabase.from('alarmas')
    .select('id, tipo, inicio, atendida_en, nota, zonas(nombre, piso, clave), perfiles(nombre)')
    .gte('inicio', desde).order('inicio', { ascending: false }).limit(200)
  if (tipo.value !== 'todas') q = q.eq('tipo', tipo.value)
  const { data, error } = await q
  if (error) msg.value = { txt: `No se pudo leer el historial: ${error.message}`, error: true }
  historial.value = data ?? []
}
onMounted(() => { cargarZonas(); cargar() })
watch([dias, tipo], cargar)

const activas = computed(() => Object.entries(edificio.humo).map(([clave, inicio]) => ({
  clave, inicio, zona: zonas.value.find((z) => z.clave === clave),
})))

async function marcar(clave) {
  const err = await atender(clave, notas.value[clave])
  msg.value = err ? { txt: err, error: true } : { txt: `Alarma de ${etiquetaZona(clave)} atendida y registrada`, error: false }
  delete notas.value[clave]
  cargar()
}

const minutos = (a, b) => (new Date(b) - new Date(a)) / 60000
const atendidas = computed(() => historial.value.filter((h) => h.atendida_en))
const tiempoMedio = computed(() => (atendidas.value.length
  ? atendidas.value.reduce((s, h) => s + minutos(h.inicio, h.atendida_en), 0) / atendidas.value.length : null))
const porPiso = computed(() => {
  const c = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const h of historial.value) if (h.zonas) c[h.zonas.piso]++
  return c
})
const maxPiso = computed(() => Math.max(...Object.values(porPiso.value), 1))
const fmt = (d) => new Date(d).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
</script>

<template>
  <div class="space-y-5">
    <p v-if="msg.txt" role="status" class="panel px-4 py-3 text-sm" :class="msg.error ? 'border-alarma text-alarma' : 'border-menta text-menta'">{{ msg.txt }}</p>

    <!-- Alarmas activas -->
    <section class="panel p-5" :class="activas.length ? 'border-alarma ring-1 ring-alarma/30' : ''">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 class="font-semibold flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full" :class="activas.length ? 'bg-alarma pulso' : 'bg-menta'" />
          {{ activas.length ? `${activas.length} alarma(s) activa(s)` : 'Sin alarmas activas' }}
        </h2>
        <div v-if="auth.esAdmin" class="flex items-center gap-2 text-sm">
          <label for="zp" class="text-grafito">Probar detector</label>
          <select id="zp" v-model="zonaPrueba" class="input py-1.5 w-48">
            <option v-for="z in zonas" :key="z.clave" :value="z.clave">Piso {{ z.piso }}, {{ z.nombre }}</option>
          </select>
          <button class="btn-ghost" @click="simularHumo(zonaPrueba)">Simular humo</button>
        </div>
      </div>
      <ul v-if="activas.length" class="grid gap-3 md:grid-cols-2">
        <li v-for="a in activas" :key="a.clave" class="rounded-md border border-alarma bg-alarma/5 p-4">
          <p class="font-semibold text-alarma">Humo en piso {{ a.zona?.piso }}, {{ a.zona?.nombre ?? a.clave }}</p>
          <p class="text-sm text-grafito">Detectado a las {{ new Date(a.inicio).toLocaleTimeString('es-MX', { hour12: false }) }}</p>
          <div class="mt-3 flex gap-2">
            <input v-model="notas[a.clave]" class="input py-1.5" placeholder="Nota (opcional): qué se encontró" :aria-label="`Nota para ${a.clave}`" />
            <button class="btn-primary !bg-alarma whitespace-nowrap py-1.5" :disabled="!puedeAtender" @click="marcar(a.clave)">Marcar atendida</button>
          </div>
        </li>
      </ul>
      <p v-else class="text-sm text-grafito">Los 10 detectores reportan estado normal. Si uno detecta humo, aparece aquí y en la franja roja de arriba hasta que alguien la atienda.</p>
    </section>

    <!-- Indicadores -->
    <section class="grid gap-4 grid-cols-2 xl:grid-cols-4">
      <KpiTile :titulo="`Alarmas en ${dias} días`" :valor="historial.length" :decimales="0" color="#e5484d" :nota="`${historial.filter((h) => h.tipo === 'humo').length} de humo, ${historial.filter((h) => h.tipo === 'intrusion').length} de intrusión`">
        <template #visual><div class="mt-3 h-9" /></template>
      </KpiTile>
      <KpiTile titulo="Tiempo medio de atención" :valor="tiempoMedio" :decimales="1" unidad="min" color="#0099cc" nota="Desde la detección hasta marcarla atendida">
        <template #visual><div class="mt-3 h-9" /></template>
      </KpiTile>
      <KpiTile titulo="Sin atender" :valor="historial.length - atendidas.length" :decimales="0" :alerta="historial.length - atendidas.length > 0" color="#00c99c" nota="Registradas sin hora de atención">
        <template #visual><div class="mt-3 h-9" /></template>
      </KpiTile>
      <KpiTile titulo="Alarmas por piso" sin-valor color="#0099cc" nota="En el periodo seleccionado">
        <template #visual>
          <div class="mt-1 h-16 flex items-end gap-2">
            <div v-for="(n, pi) in porPiso" :key="pi" class="flex-1 flex flex-col items-center gap-1">
              <span class="text-[11px] tabular-nums text-grafito">{{ n }}</span>
              <span class="w-full rounded-t-sm bg-alarma/70 transition-all duration-700" :style="{ height: `${(n / maxPiso) * 36}px` }" />
              <span class="text-[11px] text-grafito">P{{ pi }}</span>
            </div>
          </div>
        </template>
      </KpiTile>
    </section>

    <!-- Historial -->
    <section class="panel overflow-x-auto">
      <div class="flex flex-wrap items-center gap-3 px-4 pt-4 pb-3">
        <h2 class="font-semibold mr-auto">Historial de alarmas</h2>
        <select v-model="tipo" class="input py-1.5 w-40" aria-label="Tipo de alarma">
          <option value="todas">Todos los tipos</option><option value="humo">Humo</option><option value="intrusion">Intrusión</option>
        </select>
        <div class="flex rounded-md border border-losa overflow-hidden" role="group" aria-label="Periodo">
          <button v-for="d in [1, 7, 30]" :key="d" @click="dias = d" :aria-pressed="dias === d" class="px-3 py-1.5 text-sm"
            :class="dias === d ? 'bg-cian text-white' : 'hover:bg-fondo'">{{ d === 1 ? 'Hoy' : `${d} días` }}</button>
        </div>
      </div>
      <table class="w-full text-sm">
        <thead class="text-left text-grafito border-y border-losa bg-fondo/60">
          <tr><th class="px-4 py-2 font-medium">Detección</th><th class="px-4 py-2 font-medium">Tipo</th><th class="px-4 py-2 font-medium">Zona</th><th class="px-4 py-2 font-medium">Atendida</th><th class="px-4 py-2 font-medium">Por</th><th class="px-4 py-2 font-medium">Nota</th></tr>
        </thead>
        <tbody class="divide-y divide-losa">
          <tr v-for="h in historial.slice(0, 50)" :key="h.id">
            <td class="px-4 py-2 tabular-nums whitespace-nowrap">{{ fmt(h.inicio) }}</td>
            <td class="px-4 py-2"><span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full" :class="h.tipo === 'humo' ? 'bg-alarma' : 'bg-calor'" />{{ h.tipo === 'humo' ? 'Humo' : 'Intrusión' }}</span></td>
            <td class="px-4 py-2 whitespace-nowrap">Piso {{ h.zonas?.piso }}, {{ h.zonas?.nombre }}</td>
            <td class="px-4 py-2 tabular-nums whitespace-nowrap">{{ h.atendida_en ? `${minutos(h.inicio, h.atendida_en).toFixed(0)} min después` : 'Pendiente' }}</td>
            <td class="px-4 py-2">{{ h.perfiles?.nombre ?? '—' }}</td>
            <td class="px-4 py-2 text-grafito">{{ h.nota ?? '' }}</td>
          </tr>
          <tr v-if="!historial.length"><td colspan="6" class="px-4 py-6 text-grafito">No hay alarmas en este periodo.</td></tr>
        </tbody>
      </table>
      <p v-if="historial.length > 50" class="px-4 py-3 text-xs text-grafito">Mostrando 50 de {{ historial.length }}.</p>
    </section>
  </div>
</template>
