<script setup>
// Corte de la torre de vidrio: cada piso muestra sus zonas, luces, temperatura y alarmas en vivo
import { computed, ref } from 'vue'
import { edificio, PISOS } from '../lib/mqtt'
import { colorTemp } from '../lib/formato'

const props = defineProps({
  zonas: { type: Array, default: () => [] },
  seleccionado: { type: Number, default: null },
})
const emit = defineEmits(['seleccionar'])
const hover = ref(null)

const pisos = computed(() => PISOS.map((n) => {
  const zs = props.zonas.filter((z) => z.piso === n)
  const lista = zs.length ? zs : [{ clave: `p${n}z1`, nombre: 'Zona 1' }, { clave: `p${n}z2`, nombre: 'Zona 2' }]
  return {
    n,
    zonas: lista,
    temp: edificio.temp[n],
    energia: edificio.energia[n],
    alarma: lista.some((z) => edificio.humo[z.clave]),
    encendidas: lista.filter((z) => edificio.luces[z.clave] === 'on').length,
  }
}))
</script>

<template>
  <div class="relative select-none">
    <!-- Azotea con equipos -->
    <div class="mx-auto w-full sm:w-[84%] h-5 flex items-end gap-2 px-6" aria-hidden="true">
      <span class="h-3 w-8 bg-estructura rounded-t-sm" /><span class="h-4 w-5 bg-estructura rounded-t-sm" />
      <span class="ml-auto h-2.5 w-10 bg-estructura rounded-t-sm" />
    </div>

    <ul class="mx-auto w-full sm:w-[84%] bg-estructura p-1.5 space-y-1.5 rounded-t-sm" role="list" aria-label="Pisos de la torre">
      <li v-for="p in pisos" :key="p.n" class="relative" @mouseenter="hover = p.n" @mouseleave="hover = null">
        <button type="button" @click="emit('seleccionar', p.n)"
          :aria-pressed="seleccionado === p.n"
          :aria-label="`Piso ${p.n}: ${p.temp ?? 'sin dato'} grados, ${p.encendidas} zonas con luz${p.alarma ? ', alarma activa' : ''}`"
          class="w-full grid grid-cols-[2.25rem_1fr_auto] items-stretch gap-2 p-1.5 rounded-[3px] text-left transition outline-offset-0"
          :class="seleccionado === p.n ? 'bg-white/15 ring-2 ring-cian' : 'hover:bg-white/8'">
          <span class="self-center text-white font-semibold text-sm tabular-nums">P{{ p.n }}</span>

          <!-- Ventanales por zona -->
          <span class="grid gap-1.5" :style="{ gridTemplateColumns: `repeat(${p.zonas.length}, minmax(0,1fr))` }">
            <span v-for="z in p.zonas" :key="z.clave"
              class="relative h-11 rounded-[2px] overflow-hidden transition-colors duration-700"
              :class="edificio.humo[z.clave] ? 'bg-alarma pulso' : edificio.luces[z.clave] === 'on' ? 'bg-menta' : 'bg-vidrio'"
              :title="z.nombre">
              <!-- Reflejo del vidrio -->
              <span class="absolute inset-0 bg-[linear-gradient(115deg,transparent_40%,rgb(255_255_255/.28)_48%,transparent_56%)]" aria-hidden="true" />
              <span class="absolute inset-0 grid grid-cols-4" aria-hidden="true">
                <span v-for="i in 4" :key="i" class="border-r border-estructura/40 last:border-0" />
              </span>
              <span class="absolute left-1.5 bottom-1 text-[11px] leading-none truncate max-w-[90%] text-estructura font-medium">{{ z.nombre }}</span>
            </span>
          </span>

          <span class="self-center w-20 sm:w-24 text-right leading-tight">
            <span class="block text-white text-base font-semibold tabular-nums">{{ p.temp ? `${Number(p.temp).toFixed(1)}°` : '—' }}</span>
            <span class="flex items-center justify-end gap-1.5 mt-1">
              <span class="h-1.5 w-5 sm:w-8 rounded-full transition-colors duration-700" :style="{ background: colorTemp(p.temp) }" aria-hidden="true" />
              <span class="text-[11px] text-white/60 tabular-nums whitespace-nowrap">{{ p.energia ? `${Number(p.energia).toFixed(1)} kWh` : '' }}</span>
            </span>
          </span>
        </button>

        <!-- Ficha al pasar el cursor -->
        <div v-if="hover === p.n" role="tooltip"
          class="hidden lg:block absolute left-full top-1/2 -translate-y-1/2 ml-3 z-10 w-48 panel shadow-lg p-3 text-sm pointer-events-none">
          <p class="font-semibold">Piso {{ p.n }}</p>
          <p class="text-grafito">{{ p.encendidas }} de {{ p.zonas.length }} zonas con luz</p>
          <p class="text-grafito">{{ p.temp ? `${Number(p.temp).toFixed(1)} °C` : 'Sin temperatura' }}{{ p.energia ? `, ${Number(p.energia).toFixed(2)} kWh` : '' }}</p>
          <p v-if="p.alarma" class="text-alarma font-medium mt-1">Alarma de humo activa</p>
        </div>
      </li>
    </ul>

    <div class="h-2 bg-estructura mx-[-4px] rounded-sm" aria-hidden="true" />
    <div class="flex justify-between gap-2 text-xs text-grafito mt-2 px-1">
      <span class="hidden sm:inline">Acceso principal</span>
      <span class="flex items-center gap-3">
        <span class="flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-sm bg-menta" />Luz encendida</span>
        <span class="flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-sm bg-vidrio" />Apagada</span>
        <span class="flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-sm bg-alarma" />Alarma</span>
      </span>
    </div>
  </div>
</template>
