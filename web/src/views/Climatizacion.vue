<script setup>
// HU-07 Temperatura actual por piso · HU-08 Ajustar temperatura objetivo
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../lib/supabase'
import { edificio, PISOS, publicar } from '../lib/mqtt'
import { useAuth } from '../stores/auth'
import { colorTemp, hora } from '../lib/formato'
import TrendChart from '../components/TrendChart.vue'

const auth = useAuth()
const puedeOperar = computed(() => ['admin', 'operador'].includes(auth.rol))
const MIN = 18, MAX = 28, TOLERANCIA = 2

const config = ref({})        // { piso: objetivo guardado }
const borrador = ref({})      // { piso: objetivo en edición }
const bitacora = ref([])
const piso = ref(3)
const msg = ref({ txt: '', error: false })

async function cargar() {
  const [{ data: cfg }, { data: bit }] = await Promise.all([
    supabase.from('hvac_config').select('*').order('piso'),
    supabase.from('bitacora_hvac').select('id, piso, objetivo, fecha, perfiles(nombre)').order('fecha', { ascending: false }).limit(8),
  ])
  for (const c of cfg ?? []) { config.value[c.piso] = Number(c.objetivo); borrador.value[c.piso] ??= Number(c.objetivo) }
  bitacora.value = bit ?? []
}
onMounted(cargar)

const objetivo = (p) => Number(edificio.objetivo[p] ?? config.value[p] ?? 23)
const estado = (p) => {
  const t = Number(edificio.temp[p])
  if (Number.isNaN(t)) return { txt: 'Sin lectura', clase: 'text-grafito', fuera: false }
  const d = t - objetivo(p)
  if (Math.abs(d) <= TOLERANCIA) return { txt: 'En rango', clase: 'text-menta', fuera: false }
  return { txt: d > 0 ? `${d.toFixed(1)} °C arriba del objetivo` : `${Math.abs(d).toFixed(1)} °C abajo del objetivo`, clase: 'text-alarma', fuera: true }
}

function ajustar(p, delta) {
  const v = Math.round(((borrador.value[p] ?? objetivo(p)) + delta) * 2) / 2
  borrador.value[p] = Math.min(MAX, Math.max(MIN, v))
}

async function aplicar(p) {
  const v = Number(borrador.value[p])
  if (Number.isNaN(v) || v < MIN || v > MAX) { msg.value = { txt: `El objetivo debe estar entre ${MIN} y ${MAX} °C`, error: true }; return }
  publicar(`p${p}/hvac/set`, v)
  const [r1, r2] = await Promise.all([
    supabase.from('hvac_config').upsert({ piso: p, objetivo: v, actualizado_por: auth.usuario.id, actualizado_en: new Date().toISOString() }),
    supabase.from('bitacora_hvac').insert({ piso: p, objetivo: v, usuario_id: auth.usuario.id }),
  ])
  const err = r1.error ?? r2.error
  msg.value = err ? { txt: err.message, error: true } : { txt: `Piso ${p}: objetivo ajustado a ${v.toFixed(1)} °C`, error: false }
  config.value[p] = v
  cargar()
}

const fueraDeRango = computed(() => PISOS.filter((p) => estado(p).fuera))
const etiquetas = computed(() => edificio.historia.horas)
const series = computed(() => {
  const datos = edificio.historia.temp[piso.value] ?? []
  return [
    { nombre: `Piso ${piso.value}`, datos, color: '#0099cc', relleno: true },
    { nombre: 'Objetivo', datos: datos.map(() => objetivo(piso.value)), color: '#00c99c', punteado: true },
  ]
})
</script>

<template>
  <div class="space-y-5">
    <p v-if="msg.txt" role="status" class="panel px-4 py-3 text-sm" :class="msg.error ? 'border-alarma text-alarma' : 'border-menta text-menta'">{{ msg.txt }}</p>
    <p v-if="!edificio.simuladorOnline" class="panel px-4 py-3 text-sm border-l-4 !border-l-calor">Sin lecturas en vivo: los ajustes se guardan, pero la temperatura no se mueve hasta que el simulador esté encendido.</p>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Pisos">
      <article v-for="p in PISOS" :key="p" class="panel p-4 flex flex-col cursor-pointer transition"
        :class="[piso === p ? 'ring-2 ring-cian' : '', estado(p).fuera ? 'border-alarma' : '']" @click="piso = p">
        <h2 class="font-semibold">Piso {{ p }}</h2>
        <p class="text-xs min-h-4" :class="estado(p).clase">{{ estado(p).txt }}</p>
        <p class="mt-2 text-4xl font-semibold tabular-nums [font-stretch:85%]" :style="{ color: colorTemp(edificio.temp[p]) }">
          {{ edificio.temp[p] ? Number(edificio.temp[p]).toFixed(1) : '—' }}<span class="text-xl text-grafito">°C</span>
        </p>
        <p class="text-sm text-grafito">Objetivo actual {{ objetivo(p).toFixed(1) }} °C</p>

        <div class="mt-4 pt-3 border-t border-losa" @click.stop>
          <label :for="`obj-${p}`" class="text-xs text-grafito">Nuevo objetivo</label>
          <div class="mt-1 flex items-center gap-2">
            <button type="button" class="btn-ghost !px-2.5" :disabled="!puedeOperar" aria-label="Bajar medio grado" @click="ajustar(p, -0.5)">−</button>
            <input :id="`obj-${p}`" v-model.number="borrador[p]" type="number" :min="MIN" :max="MAX" step="0.5" :disabled="!puedeOperar"
              class="input text-center tabular-nums py-1.5" />
            <button type="button" class="btn-ghost !px-2.5" :disabled="!puedeOperar" aria-label="Subir medio grado" @click="ajustar(p, 0.5)">+</button>
          </div>
          <input type="range" :min="MIN" :max="MAX" step="0.5" v-model.number="borrador[p]" :disabled="!puedeOperar"
            class="w-full mt-2 accent-cian" :aria-label="`Objetivo del piso ${p}`" />
          <button class="btn-primary w-full mt-2 py-1.5 text-sm" :disabled="!puedeOperar || borrador[p] === objetivo(p)" @click="aplicar(p)">Aplicar</button>
        </div>
      </article>
    </section>
    <p v-if="!puedeOperar" class="text-sm text-grafito">Tu rol solo permite consultar. Ajustar temperaturas es para administradores y operadores.</p>

    <section class="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div class="panel p-5">
        <div class="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 class="font-semibold">Piso {{ piso }}: temperatura contra objetivo</h2>
          <span class="text-xs text-grafito">Lecturas cada 5 s, últimos 10 min</span>
        </div>
        <TrendChart v-if="etiquetas.length > 1" :etiquetas="etiquetas" :series="series" unidad="°C" :alto="280" />
        <p v-else class="h-[280px] grid place-items-center text-sm text-grafito">La gráfica aparece con las primeras lecturas.</p>
      </div>

      <div class="grid gap-5 content-start">
        <div class="panel p-5">
          <h2 class="font-semibold mb-2">Pisos fuera de rango</h2>
          <p v-if="!fueraDeRango.length" class="text-sm text-grafito">Todos los pisos están a ±{{ TOLERANCIA }} °C de su objetivo.</p>
          <ul v-else class="space-y-1.5 text-sm">
            <li v-for="p in fueraDeRango" :key="p" class="flex gap-2"><span class="h-2 w-2 mt-1.5 rounded-full bg-alarma pulso" /> Piso {{ p }}: {{ estado(p).txt }}</li>
          </ul>
        </div>
        <div class="panel p-5">
          <h2 class="font-semibold mb-3">Últimos ajustes</h2>
          <ol v-if="bitacora.length" class="space-y-2 text-sm">
            <li v-for="b in bitacora" :key="b.id" class="flex gap-3">
              <time class="text-grafito tabular-nums w-11 shrink-0">{{ hora(b.fecha) }}</time>
              <span>Piso {{ b.piso }} a <strong>{{ Number(b.objetivo).toFixed(1) }} °C</strong> <span class="text-grafito">por {{ b.perfiles?.nombre }}</span></span>
            </li>
          </ol>
          <p v-else class="text-sm text-grafito">Aún no hay ajustes. Cambia el objetivo de un piso para registrar el primero.</p>
        </div>
      </div>
    </section>
  </div>
</template>
