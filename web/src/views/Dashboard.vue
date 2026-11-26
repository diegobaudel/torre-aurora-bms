<script setup>
// HU-03 Vista general viva: filtros, resumen dinámico, indicadores, torre, tendencias y ranking
import { ref, computed, onMounted } from 'vue'
import { edificio, PISOS, etiquetaZona } from '../lib/mqtt'
import { useIluminacion } from '../lib/useIluminacion'
import { promedio, hora, colorTemp } from '../lib/formato'
import TowerSection from '../components/TowerSection.vue'
import KpiTile from '../components/KpiTile.vue'
import TrendChart from '../components/TrendChart.vue'

const { zonas, porPiso, pendientes, puedeControlar, cargarZonas, cambiar } = useIluminacion()
onMounted(() => cargarZonas())

// ---------- Filtros ----------
const piso = ref(null)          // null = todos los pisos
const ventana = ref(5)          // minutos
const pestana = ref('temp')
const VENTANAS = [1, 5, 10]
const COLORES = { 5: '#1f2a30', 4: '#7b61d1', 3: '#f0a030', 2: '#0099cc', 1: '#00c99c' }
const pisosVista = computed(() => (piso.value ? [piso.value] : PISOS))
const puntosVentana = computed(() => ventana.value * 12)   // lecturas cada 5 s
const recorte = (arr = []) => arr.slice(-puntosVentana.value)

// ---------- Series ----------
const serieTemp = computed(() => {
  const series = pisosVista.value.map((p) => recorte(edificio.historia.temp[p]))
  const n = Math.min(...series.map((s) => s.length))
  return Array.from({ length: n }, (_, i) => promedio(series.map((s) => s[s.length - n + i])))
})
const serieConsumo = computed(() => {
  const series = pisosVista.value.map((p) => recorte(edificio.historia.energia[p]))
  const n = Math.min(...series.map((s) => s.length))
  return Array.from({ length: n }, (_, i) => series.reduce((a, s) => a + s[s.length - n + i], 0))
})
const delta = (s) => (s.length > 1 ? s.at(-1) - s[0] : null)

// ---------- Indicadores ----------
const tempActual = computed(() => promedio(pisosVista.value.map((p) => edificio.temp[p]).filter(Boolean)))
const consumoActual = computed(() => {
  const v = pisosVista.value.map((p) => edificio.energia[p]).filter(Boolean).map(Number)
  return v.length ? v.reduce((a, b) => a + b, 0) : null
})
const zonasVista = computed(() => zonas.value.filter((z) => !piso.value || z.piso === piso.value))
const lucesOn = computed(() => zonasVista.value.filter((z) => edificio.luces[z.clave] === 'on').length)
const alarmas = computed(() => Object.keys(edificio.humo))
const alarmasVista = computed(() => alarmas.value.filter((z) => !piso.value || z.startsWith(`p${piso.value}z`)))

// ---------- Resumen en texto (se recalcula con cada lectura) ----------
const resumen = computed(() => {
  if (tempActual.value === null) return null
  const temps = PISOS.map((p) => ({ p, t: Number(edificio.temp[p]) })).filter((x) => !Number.isNaN(x.t))
  const caliente = temps.reduce((a, b) => (b.t > a.t ? b : a), temps[0])
  const ranking = [...PISOS].sort((a, b) => Number(edificio.energia[b] ?? 0) - Number(edificio.energia[a] ?? 0))
  const totalE = PISOS.reduce((a, p) => a + Number(edificio.energia[p] ?? 0), 0)
  const partes = totalE ? Math.round((Number(edificio.energia[ranking[0]] ?? 0) / totalE) * 100) : 0
  return {
    donde: piso.value ? `el piso ${piso.value}` : 'la torre',
    temp: tempActual.value.toFixed(1),
    consumo: consumoActual.value?.toFixed(1),
    luces: `${lucesOn.value} de ${zonasVista.value.length}`,
    caliente: piso.value ? null : caliente,
    mayor: piso.value ? null : { p: ranking[0], partes },
    alarmas: alarmasVista.value.length,
  }
})

// ---------- Ranking de consumo ----------
const ranking = computed(() => {
  const filas = PISOS.map((p) => ({ p, v: Number(edificio.energia[p] ?? 0), t: edificio.temp[p] }))
  const max = Math.max(...filas.map((f) => f.v), 1)
  return filas.sort((a, b) => b.v - a.v).map((f) => ({ ...f, pct: (f.v / max) * 100 }))
})

// ---------- Gráfica ----------
const etiquetas = computed(() => recorte(edificio.historia.horas))
const seriesGrafica = computed(() => {
  if (pestana.value === 'temp') {
    return pisosVista.value.slice().reverse().map((p) => ({ nombre: `Piso ${p}`, datos: recorte(edificio.historia.temp[p]), color: COLORES[p] }))
  }
  return [{ nombre: piso.value ? `Piso ${piso.value}` : 'Edificio completo', datos: serieConsumo.value, color: '#0099cc', relleno: true }]
})

// ---------- Detalle del piso ----------
const zonasPiso = computed(() => (piso.value ? porPiso.value[piso.value] ?? [] : []))

// ---------- Exportar CSV ----------
function exportarCSV() {
  const horas = edificio.historia.horas
  const filas = [['hora', ...PISOS.flatMap((p) => [`temp_p${p}_c`, `energia_p${p}_kwh`])]]
  horas.forEach((h, i) => {
    const off = (s = []) => s[s.length - horas.length + i] ?? ''
    filas.push([h, ...PISOS.flatMap((p) => [off(edificio.historia.temp[p]), off(edificio.historia.energia[p])])])
  })
  const blob = new Blob([filas.map((f) => f.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `torre-aurora-lecturas-${Date.now()}.csv` })
  a.click()
  URL.revokeObjectURL(a.href)
}

const subsistemas = computed(() => [
  { nombre: 'Iluminación', estado: `${lucesOn.value} de ${zonasVista.value.length} zonas encendidas`, ok: true },
  { nombre: 'Climatización', estado: tempActual.value !== null ? `${tempActual.value.toFixed(1)} °C promedio` : 'Sin datos', ok: tempActual.value === null || (tempActual.value >= 18 && tempActual.value <= 28) },
  { nombre: 'Energía', estado: consumoActual.value !== null ? `${consumoActual.value.toFixed(1)} kWh ahora` : 'Sin datos', ok: true },
  { nombre: 'Seguridad', estado: alarmasVista.value.length ? `${alarmasVista.value.length} alarma(s) de humo` : 'Sin alarmas', ok: !alarmasVista.value.length },
  { nombre: 'Accesos', estado: 'Se integra en el Sprint 2', ok: null },
])
</script>

<template>
  <div class="space-y-5">
    <!-- Barra de control -->
    <section class="panel p-3 sm:p-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-l-4 !border-l-cian" aria-label="Filtros">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-sm text-grafito mr-1">Piso</span>
        <button v-for="op in [null, ...PISOS]" :key="op ?? 'todos'" type="button" @click="piso = op"
          :aria-pressed="piso === op"
          class="px-3 py-1 rounded-full text-sm border transition"
          :class="piso === op ? 'bg-cian border-cian text-white' : 'border-losa hover:border-cian hover:text-cian'">
          {{ op ? `P${op}` : 'Todos' }}
        </button>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm text-grafito mr-1">Ventana</span>
        <div class="flex rounded-md border border-losa overflow-hidden" role="group" aria-label="Ventana de tiempo">
          <button v-for="v in VENTANAS" :key="v" type="button" @click="ventana = v" :aria-pressed="ventana === v"
            class="px-3 py-1 text-sm transition" :class="ventana === v ? 'bg-cian/10 text-cian font-medium' : 'hover:bg-fondo'">{{ v }} min</button>
        </div>
      </div>
      <div class="flex items-center gap-2 sm:ml-auto">
        <button type="button" class="btn-ghost" @click="edificio.pausado = !edificio.pausado" :aria-pressed="edificio.pausado">
          <span class="h-2 w-2 rounded-full" :class="edificio.pausado ? 'bg-calor' : 'bg-menta latido'" />
          {{ edificio.pausado ? 'Gráficas en pausa' : 'En vivo' }}
        </button>
        <button type="button" class="btn-ghost" :disabled="!edificio.historia.horas.length" @click="exportarCSV">
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3" /></svg>
          Exportar CSV
        </button>
      </div>
    </section>

    <!-- Resumen en texto -->
    <p v-if="resumen" class="panel px-5 py-4 text-[15px] leading-relaxed border-l-4 !border-l-menta" aria-live="polite">
      Ahora mismo {{ resumen.donde }} está a <strong class="tabular-nums" :style="{ color: colorTemp(resumen.temp) }">{{ resumen.temp }} °C</strong>
      en promedio, consume <strong class="tabular-nums">{{ resumen.consumo }} kWh</strong> y tiene <strong>{{ resumen.luces }}</strong> zonas iluminadas.
      <template v-if="resumen.caliente">El piso más cálido es el <strong>{{ resumen.caliente.p }}</strong> ({{ resumen.caliente.t.toFixed(1) }} °C)
        y el <strong>{{ resumen.mayor.p }}</strong> concentra el <strong>{{ resumen.mayor.partes }} %</strong> del consumo.</template>
      <strong v-if="resumen.alarmas" class="text-alarma"> Hay {{ resumen.alarmas }} alarma(s) de humo sin atender.</strong>
      <template v-else> Sin alarmas activas.</template>
    </p>
    <p v-else class="panel px-5 py-4 text-sm border-l-4 !border-l-calor">
      No llegan lecturas de los sensores. Inicia el simulador con <code class="px-1 rounded bg-fondo">npm start</code> en la carpeta <code class="px-1 rounded bg-fondo">simulador</code>.
    </p>

    <!-- Indicadores -->
    <section class="grid gap-4 grid-cols-2 xl:grid-cols-4" aria-label="Indicadores">
      <KpiTile titulo="Temperatura promedio" :valor="tempActual" unidad="°C" :serie="serieTemp" :delta="delta(serieTemp)"
        :color="colorTemp(tempActual)" :nota="`Cambio en los últimos ${ventana} min`" />
      <KpiTile titulo="Consumo eléctrico" :valor="consumoActual" unidad="kWh" :serie="serieConsumo" :delta="delta(serieConsumo)"
        invertir-delta color="#0099cc" :nota="piso ? `Piso ${piso}` : 'Suma de los 5 pisos'" />
      <KpiTile titulo="Zonas iluminadas" :valor="zonasVista.length ? lucesOn : null" :decimales="0" :sufijo="`/${zonasVista.length}`"
        color="#00c99c" nota="Toca un piso de la torre para controlarlo">
        <template #visual>
          <div class="mt-3 h-9 flex items-end gap-1" aria-hidden="true">
            <span v-for="z in zonasVista" :key="z.clave" class="flex-1 rounded-[2px] transition-all duration-500"
              :class="edificio.luces[z.clave] === 'on' ? 'bg-menta h-9' : 'bg-losa h-3'" />
          </div>
        </template>
      </KpiTile>
      <KpiTile titulo="Alarmas activas" :valor="alarmasVista.length" :decimales="0" :alerta="alarmasVista.length > 0" color="#00c99c"
        :nota="alarmasVista.length ? alarmasVista.map(etiquetaZona).join(', ') : 'Todos los detectores en estado normal'">
        <template #visual>
          <div class="mt-3 h-9 flex items-end gap-1" aria-hidden="true">
            <span v-for="z in zonasVista" :key="z.clave" class="flex-1 h-3 rounded-[2px]"
              :class="edificio.humo[z.clave] ? 'bg-alarma pulso h-9' : 'bg-menta/30'" />
          </div>
        </template>
      </KpiTile>
    </section>

    <!-- Torre + detalle/tendencias -->
    <section class="grid gap-5 lg:grid-cols-[minmax(320px,440px)_1fr]">
      <div class="panel p-5">
        <div class="flex items-baseline justify-between mb-4">
          <h2 class="font-semibold">La torre ahora</h2>
          <span class="text-xs text-grafito tabular-nums">{{ edificio.ultimaLectura ? `Lectura ${edificio.ultimaLectura.toLocaleTimeString('es-MX', { hour12: false })}` : 'Sin lecturas' }}</span>
        </div>
        <TowerSection :zonas="zonas" :seleccionado="piso" @seleccionar="piso = piso === $event ? null : $event" />
      </div>

      <div class="grid gap-5 content-start">
        <!-- Control del piso seleccionado -->
        <div v-if="piso" class="panel p-5">
          <div class="flex flex-wrap items-baseline gap-x-5 gap-y-1 mb-4">
            <h2 class="font-semibold text-lg">Piso {{ piso }}</h2>
            <span class="text-sm tabular-nums font-medium" :style="{ color: colorTemp(edificio.temp[piso]) }">{{ edificio.temp[piso] ?? '—' }} °C</span>
            <span class="text-sm text-grafito tabular-nums">{{ edificio.energia[piso] ? `${Number(edificio.energia[piso]).toFixed(2)} kWh` : '' }}</span>
            <button class="ml-auto text-sm text-grafito hover:text-cian" @click="piso = null">Ver todos los pisos</button>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div v-for="z in zonasPiso" :key="z.id" class="rounded-md border p-3 flex items-center justify-between gap-3"
              :class="edificio.humo[z.clave] ? 'border-alarma bg-alarma/5' : 'border-losa'">
              <div class="min-w-0">
                <p class="font-medium truncate">{{ z.nombre }}</p>
                <p class="text-xs" :class="pendientes[z.clave] === 'sin respuesta' || edificio.humo[z.clave] ? 'text-alarma' : 'text-grafito'">
                  {{ edificio.humo[z.clave] ? 'Humo detectado' : pendientes[z.clave] === 'sin respuesta' ? 'El dispositivo no respondió'
                    : pendientes[z.clave] ? 'Enviando orden…' : edificio.luces[z.clave] === 'on' ? 'Luz encendida' : 'Luz apagada' }}
                </p>
              </div>
              <button type="button" role="switch" :aria-checked="edificio.luces[z.clave] === 'on'" :aria-label="`Luz de ${z.nombre}`"
                :disabled="!puedeControlar || pendientes[z.clave] === true" @click="cambiar(z)"
                class="relative w-12 h-7 shrink-0 rounded-full transition-colors disabled:opacity-40"
                :class="edificio.luces[z.clave] === 'on' ? 'bg-menta' : 'bg-losa'">
                <span class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-all" :class="edificio.luces[z.clave] === 'on' ? 'left-[22px]' : 'left-0.5'" />
              </button>
            </div>
          </div>
          <p v-if="!puedeControlar" class="mt-3 text-xs text-grafito">Tu rol solo permite consultar. El control de luces es para administradores y operadores.</p>
        </div>

        <!-- Tendencias con pestañas -->
        <div class="panel p-5">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div class="flex gap-1 p-1 rounded-md bg-fondo" role="tablist" aria-label="Variable">
              <button v-for="t in [{ id: 'temp', txt: 'Temperatura' }, { id: 'energia', txt: 'Consumo' }]" :key="t.id"
                role="tab" :aria-selected="pestana === t.id" @click="pestana = t.id"
                class="px-3 py-1 rounded text-sm transition" :class="pestana === t.id ? 'bg-superficie shadow-sm font-medium' : 'text-grafito'">{{ t.txt }}</button>
            </div>
            <span class="text-xs text-grafito">{{ piso ? `Piso ${piso}` : 'Todos los pisos' }}, últimos {{ ventana }} min</span>
          </div>
          <TrendChart v-if="etiquetas.length > 1" :etiquetas="etiquetas" :series="seriesGrafica"
            :unidad="pestana === 'temp' ? '°C' : 'kWh'" :alto="piso ? 220 : 300" />
          <p v-else class="h-[260px] grid place-items-center text-sm text-grafito">La gráfica aparece con las primeras lecturas.</p>
        </div>
      </div>
    </section>

    <!-- Ranking, subsistemas, eventos -->
    <section class="grid gap-5 lg:grid-cols-3">
      <div class="panel p-5">
        <h2 class="font-semibold mb-4">¿Qué piso consume más?</h2>
        <ol class="space-y-3">
          <li v-for="(f, i) in ranking" :key="f.p">
            <button type="button" class="w-full text-left group" @click="piso = f.p">
              <div class="flex items-center gap-3 text-sm mb-1">
                <span class="h-5 w-5 rounded-full grid place-items-center text-[11px] font-semibold"
                  :class="i === 0 ? 'bg-cian text-white' : 'bg-fondo text-grafito'">{{ i + 1 }}</span>
                <span class="font-medium group-hover:text-cian">Piso {{ f.p }}</span>
                <span class="ml-auto tabular-nums">{{ f.v.toFixed(2) }} kWh</span>
              </div>
              <div class="h-2 rounded-full bg-fondo overflow-hidden">
                <div class="h-full rounded-full transition-all duration-700" :style="{ width: `${f.pct}%`, background: piso === f.p ? '#00c99c' : '#0099cc' }" />
              </div>
            </button>
          </li>
        </ol>
      </div>

      <div class="panel p-5">
        <h2 class="font-semibold mb-3">Estado de los subsistemas</h2>
        <ul class="divide-y divide-losa">
          <li v-for="s in subsistemas" :key="s.nombre" class="py-2.5 flex items-center gap-3">
            <span class="h-2.5 w-2.5 rounded-full shrink-0" :class="s.ok === null ? 'bg-losa' : s.ok ? 'bg-menta' : 'bg-alarma pulso'" aria-hidden="true" />
            <span class="font-medium w-28 shrink-0">{{ s.nombre }}</span>
            <span class="text-sm text-grafito truncate">{{ s.estado }}</span>
          </li>
        </ul>
      </div>

      <div class="panel p-5">
        <h2 class="font-semibold mb-3">Eventos recientes</h2>
        <TransitionGroup v-if="edificio.eventos.length" tag="ol" name="evento" class="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
          <li v-for="e in edificio.eventos" :key="e.fecha.getTime() + e.texto" class="flex gap-3 text-sm">
            <time class="text-grafito tabular-nums w-11 shrink-0">{{ hora(e.fecha) }}</time>
            <span class="h-2 w-2 mt-1.5 rounded-full shrink-0" :class="e.tipo === 'alarma' ? 'bg-alarma' : e.tipo === 'luz' ? 'bg-menta' : 'bg-cian'" aria-hidden="true" />
            <span>{{ e.texto }}</span>
          </li>
        </TransitionGroup>
        <p v-else class="text-sm text-grafito">Aquí aparecen los cambios de luces y las alarmas de esta sesión.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.evento-enter-active { transition: all .4s ease; }
.evento-enter-from { opacity: 0; transform: translateY(-6px); background: rgb(0 153 204 / .08); }
@media (prefers-reduced-motion: reduce) { .evento-enter-active { transition: none; } }
</style>
