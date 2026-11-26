<script setup>
// HU-13 Consumo eléctrico por piso y subsistema, con filtro por día, semana y mes
import { ref, computed, watch, onMounted } from 'vue'
import { supabase } from '../lib/supabase'
import { edificio, PISOS } from '../lib/mqtt'
import KpiTile from '../components/KpiTile.vue'
import TrendChart from '../components/TrendChart.vue'

const PERIODOS = [
  { id: 'dia', txt: 'Últimas 24 h', horas: 24, intervalo: 'hour' },
  { id: 'semana', txt: 'Semana', horas: 24 * 7, intervalo: 'day' },
  { id: 'mes', txt: 'Mes', horas: 24 * 30, intervalo: 'day' },
]
const COLORES = { 5: '#9aaeb9', 4: '#7b61d1', 3: '#f0a030', 2: '#0099cc', 1: '#00c99c' }
const SUBSISTEMAS = [
  { id: 'hvac', txt: 'Climatización', color: '#0099cc' },
  { id: 'iluminacion', txt: 'Iluminación', color: '#00c99c' },
  { id: 'otros', txt: 'Contactos y equipos', color: '#8fcbe9' },
]

const periodo = ref('dia')
const vista = ref('pisos')       // pisos | total
const serie = ref([])
const resumen = ref([])
const cargando = ref(false)
const error = ref('')
const p = computed(() => PERIODOS.find((x) => x.id === periodo.value))

async function cargar() {
  cargando.value = true
  error.value = ''
  const desde = new Date(Date.now() - p.value.horas * 3600e3).toISOString()
  const [s, r] = await Promise.all([
    supabase.rpc('consumo_serie', { desde, intervalo: p.value.intervalo }),
    supabase.rpc('consumo_resumen', { desde }),
  ])
  error.value = s.error?.message ?? r.error?.message ?? ''
  serie.value = s.data ?? []
  resumen.value = (r.data ?? []).map((x) => ({ ...x, total: Number(x.total), hvac: Number(x.hvac), iluminacion: Number(x.iluminacion), otros: Number(x.otros) }))
  cargando.value = false
}
onMounted(cargar)
watch(periodo, cargar)

const buckets = computed(() => [...new Set(serie.value.map((x) => x.bucket))].sort())
const etiquetas = computed(() => buckets.value.map((b) => {
  const d = new Date(b)
  return p.value.intervalo === 'hour'
    ? d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
    : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}))
const series = computed(() => {
  const val = (b, piso) => Number(serie.value.find((x) => x.bucket === b && x.piso === piso)?.kwh ?? 0)
  if (vista.value === 'total') {
    return [{ nombre: 'Edificio', datos: buckets.value.map((b) => PISOS.reduce((a, pi) => a + val(b, pi), 0)), color: '#0099cc', relleno: true }]
  }
  return [...PISOS].reverse().map((pi) => ({ nombre: `Piso ${pi}`, datos: buckets.value.map((b) => val(b, pi)), color: COLORES[pi] }))
})

const total = computed(() => resumen.value.reduce((a, x) => a + x.total, 0))
const totales = computed(() => Object.fromEntries(SUBSISTEMAS.map((s) => [s.id, resumen.value.reduce((a, x) => a + x[s.id], 0)])))
const pctHvac = computed(() => (total.value ? (totales.value.hvac / total.value) * 100 : null))
const mayor = computed(() => resumen.value.reduce((a, x) => (!a || x.total > a.total ? x : a), null))
const promedioDia = computed(() => (total.value ? total.value / (p.value.horas / 24) : null))
const maxPiso = computed(() => Math.max(...resumen.value.map((x) => x.total), 1))
const enVivo = computed(() => {
  const v = Object.values(edificio.energia).map(Number)
  return v.length ? v.reduce((a, b) => a + b, 0) : null
})
</script>

<template>
  <div class="space-y-5">
    <section class="panel p-3 sm:p-4 flex flex-wrap items-center gap-4 border-l-4 !border-l-cian" aria-label="Filtros">
      <span class="text-sm text-grafito">Periodo</span>
      <div class="flex rounded-md border border-losa overflow-hidden" role="group">
        <button v-for="op in PERIODOS" :key="op.id" type="button" @click="periodo = op.id" :aria-pressed="periodo === op.id"
          class="px-3 py-1 text-sm transition" :class="periodo === op.id ? 'bg-cian text-white' : 'hover:bg-fondo'">{{ op.txt }}</button>
      </div>
      <span v-if="cargando" class="text-sm text-grafito">Cargando…</span>
      <span v-if="enVivo !== null" class="sm:ml-auto text-sm flex items-center gap-2">
        <span class="h-2 w-2 rounded-full bg-menta latido" /> Ahora: <strong class="tabular-nums">{{ enVivo.toFixed(1) }} kWh</strong> por intervalo de 5 s
      </span>
    </section>

    <p v-if="error" class="panel px-4 py-3 text-sm border-alarma text-alarma">
      No se pudo leer el historial: {{ error }}. Revisa que hayas corrido <code>supabase/migrations/002_sprint2.sql</code>.
    </p>

    <section class="grid gap-4 grid-cols-2 xl:grid-cols-4">
      <KpiTile titulo="Consumo del periodo" :valor="total || null" :decimales="0" unidad="kWh" :serie="series[0]?.datos ?? []" color="#0099cc" :nota="p.txt" />
      <KpiTile titulo="Promedio por día" :valor="promedioDia" :decimales="0" unidad="kWh" :serie="[]" color="#00c99c" nota="Total entre días del periodo">
        <template #visual><div class="mt-3 h-9" /></template>
      </KpiTile>
      <KpiTile titulo="Piso con más consumo" :valor="mayor?.piso ?? null" :decimales="0" :sufijo="mayor ? '' : ''" color="#f0a030"
        :nota="mayor ? `${mayor.total.toFixed(0)} kWh, ${((mayor.total / total) * 100).toFixed(0)} % del edificio` : ''">
        <template #visual><div class="mt-3 h-9" /></template>
      </KpiTile>
      <KpiTile titulo="Parte de climatización" :valor="pctHvac" :decimales="0" unidad="%" color="#0099cc" nota="El sistema que más energía usa">
        <template #visual>
          <div class="mt-3 h-9 flex items-end"><div class="h-3 w-full rounded-full bg-fondo overflow-hidden flex">
            <span v-for="s in SUBSISTEMAS" :key="s.id" class="h-full transition-all duration-700" :style="{ width: `${total ? (totales[s.id] / total) * 100 : 0}%`, background: s.color }" />
          </div></div>
        </template>
      </KpiTile>
    </section>

    <section class="panel p-5">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 class="font-semibold">Consumo en el tiempo</h2>
        <div class="flex gap-1 p-1 rounded-md bg-fondo" role="tablist">
          <button v-for="t in [{ id: 'pisos', txt: 'Por piso' }, { id: 'total', txt: 'Edificio completo' }]" :key="t.id" role="tab"
            :aria-selected="vista === t.id" @click="vista = t.id" class="px-3 py-1 rounded text-sm"
            :class="vista === t.id ? 'bg-superficie shadow-sm font-medium' : 'text-grafito'">{{ t.txt }}</button>
        </div>
      </div>
      <TrendChart v-if="buckets.length > 1" :etiquetas="etiquetas" :series="series" unidad="kWh" :alto="300" />
      <p v-else class="h-[300px] grid place-items-center text-sm text-grafito">{{ cargando ? 'Cargando historial…' : 'No hay lecturas en este periodo.' }}</p>
    </section>

    <section class="panel p-5">
      <div class="flex flex-wrap items-baseline justify-between gap-3 mb-4">
        <h2 class="font-semibold">Por piso y subsistema</h2>
        <div class="flex flex-wrap gap-4 text-xs text-grafito">
          <span v-for="s in SUBSISTEMAS" :key="s.id" class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm" :style="{ background: s.color }" />{{ s.txt }}</span>
        </div>
      </div>
      <ul class="space-y-3">
        <li v-for="r in [...resumen].reverse()" :key="r.piso" class="grid grid-cols-[4rem_1fr_6rem] items-center gap-3 text-sm">
          <span class="font-medium">Piso {{ r.piso }}</span>
          <div class="h-6 rounded bg-fondo overflow-hidden flex" :style="{ width: `${(r.total / maxPiso) * 100}%` }">
            <span v-for="s in SUBSISTEMAS" :key="s.id" class="h-full transition-all duration-700" :title="`${s.txt}: ${r[s.id].toFixed(1)} kWh`"
              :style="{ width: `${(r[s.id] / r.total) * 100}%`, background: s.color }" />
          </div>
          <span class="text-right tabular-nums">{{ r.total.toFixed(0) }} kWh</span>
        </li>
      </ul>
      <table class="w-full text-sm mt-6">
        <thead class="text-left text-grafito border-y border-losa">
          <tr><th class="py-2 font-medium">Piso</th><th v-for="s in SUBSISTEMAS" :key="s.id" class="py-2 font-medium text-right">{{ s.txt }}</th><th class="py-2 font-medium text-right">Total</th></tr>
        </thead>
        <tbody class="divide-y divide-losa tabular-nums">
          <tr v-for="r in resumen" :key="r.piso">
            <td class="py-2">Piso {{ r.piso }}</td>
            <td v-for="s in SUBSISTEMAS" :key="s.id" class="py-2 text-right">{{ r[s.id].toFixed(1) }}</td>
            <td class="py-2 text-right font-medium">{{ r.total.toFixed(1) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
