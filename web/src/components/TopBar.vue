<script setup>
// Barra de eventos: siempre visible, como el "event bar" de los BMS comerciales
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { edificio, etiquetaZona, atenderHumo } from '../lib/mqtt'
import { oscuro, alternarTema } from '../lib/tema'

defineEmits(['menu'])
const route = useRoute()
const ahora = ref(new Date())
let t
onMounted(() => { t = setInterval(() => (ahora.value = new Date()), 1000) })
onUnmounted(() => clearInterval(t))

const titulos = { '/': 'Vista general', '/iluminacion': 'Iluminación', '/usuarios': 'Usuarios y roles' }
const titulo = computed(() => titulos[route.path] ?? '')
const alarmas = computed(() => Object.keys(edificio.humo))
</script>

<template>
  <header class="sticky top-0 z-20 bg-superficie/90 backdrop-blur border-b border-losa">
    <!-- Franja de alarma activa -->
    <div v-for="z in alarmas" :key="z" role="alert"
      class="bg-alarma text-white text-sm px-4 lg:px-6 py-2 flex items-center gap-3">
      <span class="h-2 w-2 rounded-full bg-superficie pulso" aria-hidden="true" />
      <span class="font-medium">Humo detectado en {{ etiquetaZona(z) }}.</span>
      <span class="hidden sm:inline text-white/80">Verifica la zona y activa el protocolo de evacuación si se confirma.</span>
      <button class="ml-auto bg-superficie/15 hover:bg-superficie/25 rounded px-3 py-1 font-medium" @click="atenderHumo(z)">Marcar como atendida</button>
    </div>

    <div class="h-16 px-4 lg:px-6 flex items-center gap-4">
      <button class="lg:hidden p-2 -ml-2" aria-label="Abrir menú" @click="$emit('menu')">
        <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
          aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      <h1 class="text-lg font-semibold tracking-tight">{{ titulo }}</h1>

      <div class="ml-auto flex items-center gap-5 text-sm">
        <span class="hidden md:flex items-center gap-2" :title="edificio.conectado ? 'Conectado al broker MQTT' : 'Sin conexión al broker'">
          <span class="h-2 w-2 rounded-full" :class="edificio.conectado ? 'bg-menta' : 'bg-alarma'" />
          <span class="text-grafito">Broker</span>
        </span>
        <span class="hidden md:flex items-center gap-2">
          <span class="h-2 w-2 rounded-full" :class="edificio.simuladorOnline ? 'bg-menta latido' : 'bg-alarma'" />
          <span class="text-grafito">{{ edificio.simuladorOnline ? 'Sensores en línea' : 'Sensores sin señal' }}</span>
        </span>
        <span class="flex items-center gap-2 font-medium" :class="alarmas.length ? 'text-alarma' : 'text-grafito'">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
            aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
          {{ alarmas.length }} <span class="hidden sm:inline">{{ alarmas.length === 1 ? 'alarma' : 'alarmas' }}</span>
        </span>
        <button class="btn-ghost !px-2" :aria-label="oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'" :title="oscuro ? 'Modo claro' : 'Modo oscuro'" @click="alternarTema">
          <svg v-if="oscuro" viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
          <svg v-else viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
        </button>
        <time class="hidden sm:block tabular-nums text-grafito w-20 text-right">{{ ahora.toLocaleTimeString('es-MX', { hour12: false }) }}</time>
      </div>
    </div>
  </header>
</template>
