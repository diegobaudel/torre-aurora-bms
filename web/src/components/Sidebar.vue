<script setup>
import { useAuth } from '../stores/auth'
import { edificio } from '../lib/mqtt'

defineProps({ abierto: Boolean })
defineEmits(['cerrar'])
const auth = useAuth()

// Navegación por sistema, como en los BMS comerciales
const grupos = [
  { titulo: 'Operación', links: [
    { to: '/', txt: 'Vista general', icono: 'M3 12l9-8 9 8M5 10v10h14V10' },
    { to: '/iluminacion', txt: 'Iluminación', icono: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z' },
  ]},
  { titulo: 'Próximo sprint', links: [
    { txt: 'Climatización', icono: 'M14 14.8V4a2 2 0 1 0-4 0v10.8a4 4 0 1 0 4 0z' },
    { txt: 'Energía', icono: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z' },
    { txt: 'Accesos', icono: 'M15 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM3 21v-2a4 4 0 0 1 4-4h4m6 2v4m-2-2h4' },
  ]},
  { titulo: 'Administración', soloAdmin: true, links: [
    { to: '/usuarios', txt: 'Usuarios y roles', icono: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 10v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8' },
  ]},
]
</script>

<template>
  <div v-if="abierto" class="fixed inset-0 bg-tinta/40 z-30 lg:hidden" @click="$emit('cerrar')" />
  <aside :class="[abierto ? 'translate-x-0' : '-translate-x-full', 'lg:translate-x-0']"
    class="fixed inset-y-0 left-0 z-40 w-64 bg-superficie border-r border-losa flex flex-col transition-transform">
    <div class="h-16 px-5 flex items-center gap-3 border-b border-losa">
      <img src="/favicon.svg" alt="" class="h-9 w-9" />
      <div class="leading-tight">
        <p class="font-semibold tracking-tight">Torre Aurora</p>
        <p class="text-xs text-grafito">Gestión del edificio</p>
      </div>
    </div>

    <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-6" aria-label="Principal">
      <template v-for="g in grupos" :key="g.titulo">
        <div v-if="!g.soloAdmin || auth.esAdmin">
          <p class="px-3 mb-2 text-xs text-grafito">{{ g.titulo }}</p>
          <ul class="space-y-0.5">
            <li v-for="l in g.links" :key="l.txt">
              <RouterLink v-if="l.to" :to="l.to" @click="$emit('cerrar')"
                class="relative flex items-center gap-3 px-3 py-2 rounded-md text-sm text-tinta/80 hover:bg-fondo"
                exact-active-class="!bg-cian/10 !text-cian font-medium before:absolute before:left-0 before:inset-y-1.5 before:w-[3px] before:rounded-full before:bg-cian">
                <svg viewBox="0 0 24 24" class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.7"
                  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="l.icono" /></svg>
                {{ l.txt }}
              </RouterLink>
              <span v-else class="flex items-center gap-3 px-3 py-2 text-sm text-grafito/60 cursor-not-allowed"
                title="Se construye en el Sprint 2">
                <svg viewBox="0 0 24 24" class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.7"
                  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="l.icono" /></svg>
                {{ l.txt }}
              </span>
            </li>
          </ul>
        </div>
      </template>
    </nav>

    <div class="mx-3 mb-3 rounded-md bg-fondo px-3 py-2.5 text-xs text-grafito flex items-center gap-2">
      <span class="h-2 w-2 rounded-full" :class="edificio.simuladorOnline ? 'bg-menta latido' : 'bg-alarma'" />
      {{ edificio.simuladorOnline ? 'Recibiendo datos de 10 zonas' : 'Sin datos de los sensores' }}
    </div>

    <div class="p-4 border-t border-losa flex items-center gap-3">
      <span class="h-9 w-9 rounded-full bg-cian text-white grid place-items-center text-sm font-semibold">{{ auth.iniciales }}</span>
      <div class="min-w-0 flex-1 leading-tight">
        <p class="text-sm truncate">{{ auth.perfil?.nombre }}</p>
        <p class="text-xs text-grafito capitalize">{{ auth.rol }}</p>
      </div>
      <button class="text-grafito hover:text-cian p-1" title="Cerrar sesión" aria-label="Cerrar sesión" @click="auth.logout()">
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
          aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
      </button>
    </div>
  </aside>
</template>
