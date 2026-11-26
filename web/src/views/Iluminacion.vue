<script setup>
// HU-10 Encender/apagar iluminación por zona
import { computed, onMounted } from 'vue'
import { edificio, publicar } from '../lib/mqtt'
import { useIluminacion } from '../lib/useIluminacion'

const { zonas, porPiso, bitacora, pendientes, puedeControlar, cargarZonas, cargarBitacora, cambiar } = useIluminacion()
onMounted(() => { cargarZonas(); cargarBitacora(15) })

const encendidas = computed(() => zonas.value.filter((z) => edificio.luces[z.clave] === 'on').length)
const pisosDesc = computed(() => Object.keys(porPiso.value).map(Number).sort((a, b) => b - a))

function todoPiso(piso, estado) {
  for (const z of porPiso.value[piso] ?? []) if ((edificio.luces[z.clave] === 'on') !== (estado === 'on')) cambiar(z)
}
</script>

<template>
  <div class="space-y-4 lg:space-y-5">
    <p v-if="!edificio.simuladorOnline" class="panel px-4 py-3 text-sm border-calor ">
      <span class="inline-block h-2 w-2 mr-2 rounded-full bg-menta align-middle" />
      Los sensores no responden: las órdenes se envían pero no se confirman hasta que el simulador esté encendido.
    </p>

    <div class="flex flex-wrap items-end justify-between gap-3">
      <p class="text-grafito">
        <span class="text-2xl font-semibold text-tinta tabular-nums">{{ encendidas }}</span>
        de {{ zonas.length }} zonas encendidas
      </p>
      <p v-if="!puedeControlar" class="text-sm text-grafito">Tu rol solo permite consultar.</p>
    </div>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <section v-for="piso in pisosDesc" :key="piso" class="panel">
        <header class="flex items-center justify-between px-4 py-3 border-b border-losa">
          <h2 class="font-semibold">Piso {{ piso }}</h2>
          <div v-if="puedeControlar" class="flex gap-1 text-sm">
            <button class="px-2 py-1 rounded hover:bg-fondo" @click="todoPiso(piso, 'on')">Encender todo</button>
            <button class="px-2 py-1 rounded hover:bg-fondo" @click="todoPiso(piso, 'off')">Apagar todo</button>
          </div>
        </header>
        <ul class="divide-y divide-losa">
          <li v-for="z in porPiso[piso]" :key="z.id" class="px-4 py-3 flex items-center gap-3">
            <span class="h-9 w-9 rounded-md grid place-items-center shrink-0 transition-colors"
              :class="edificio.luces[z.clave] === 'on' ? 'bg-menta/15 text-menta' : 'bg-fondo text-grafito'" aria-hidden="true">
              <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
                <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" />
              </svg>
            </span>
            <div class="min-w-0 flex-1">
              <p class="font-medium truncate">{{ z.nombre }}</p>
              <p class="text-xs" :class="pendientes[z.clave] === 'sin respuesta' ? 'text-alarma' : 'text-grafito'">
                {{ pendientes[z.clave] === 'sin respuesta' ? 'El dispositivo no respondió en 10 s'
                  : pendientes[z.clave] ? 'Enviando orden…'
                  : edificio.luces[z.clave] === 'on' ? 'Encendida' : 'Apagada' }}
              </p>
            </div>
            <button type="button" role="switch" :aria-checked="edificio.luces[z.clave] === 'on'" :aria-label="`Luz de ${z.nombre}, piso ${piso}`"
              :disabled="!puedeControlar || pendientes[z.clave] === true" @click="cambiar(z)"
              class="relative w-12 h-7 shrink-0 rounded-full transition-colors disabled:opacity-40"
              :class="edificio.luces[z.clave] === 'on' ? 'bg-menta' : 'bg-losa'">
              <span class="absolute top-0.5 h-6 w-6 rounded-full bg-superficie shadow-sm transition-all"
                :class="edificio.luces[z.clave] === 'on' ? 'left-[22px]' : 'left-0.5'" />
            </button>
          </li>
        </ul>
      </section>
    </div>

    <section class="panel overflow-x-auto">
      <h2 class="font-semibold px-4 pt-4 pb-3">Bitácora de cambios</h2>
      <table class="w-full text-sm">
        <thead class="text-left text-grafito border-y border-losa bg-fondo/60">
          <tr><th class="px-4 py-2 font-medium">Fecha y hora</th><th class="px-4 py-2 font-medium">Zona</th><th class="px-4 py-2 font-medium">Acción</th><th class="px-4 py-2 font-medium">Usuario</th></tr>
        </thead>
        <tbody class="divide-y divide-losa">
          <tr v-for="b in bitacora" :key="b.id">
            <td class="px-4 py-2 tabular-nums whitespace-nowrap">{{ new Date(b.fecha).toLocaleString('es-MX', { hour12: false }) }}</td>
            <td class="px-4 py-2">Piso {{ b.zonas?.piso }}, {{ b.zonas?.nombre }}</td>
            <td class="px-4 py-2">
              <span class="inline-flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full" :class="b.estado === 'on' ? 'bg-menta' : 'bg-grafito/40'" />
                {{ b.estado === 'on' ? 'Encendió' : 'Apagó' }}
              </span>
            </td>
            <td class="px-4 py-2">{{ b.perfiles?.nombre }}</td>
          </tr>
          <tr v-if="!bitacora.length"><td colspan="4" class="px-4 py-4 text-grafito">Todavía no hay cambios registrados. Enciende o apaga una zona para ver el primero.</td></tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
