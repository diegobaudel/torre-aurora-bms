<script setup>
import { ref } from 'vue'
import { useAuth } from '../stores/auth'
import { edificio } from '../lib/mqtt'

const auth = useAuth()
const abierto = ref(false)
const links = [
  { to: '/', txt: 'Dashboard' },
  { to: '/iluminacion', txt: 'Iluminación' },
  { to: '/usuarios', txt: 'Usuarios', soloAdmin: true },
]
</script>

<template>
  <header class="bg-slate-900 text-white">
    <div class="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
      <span class="font-bold">Torre Aurora BMS</span>
      <button class="md:hidden ml-auto" @click="abierto = !abierto">☰</button>
      <nav :class="[abierto ? 'flex' : 'hidden', 'md:flex flex-col md:flex-row gap-4 absolute md:static top-14 left-0 right-0 bg-slate-900 p-4 md:p-0 z-10']">
        <template v-for="l in links" :key="l.to">
          <RouterLink v-if="!l.soloAdmin || auth.esAdmin" :to="l.to" class="hover:text-indigo-300"
            active-class="text-indigo-300" @click="abierto = false">{{ l.txt }}</RouterLink>
        </template>
      </nav>
      <div class="hidden md:flex items-center gap-3 ml-auto text-sm">
        <span :class="edificio.conectado ? 'text-emerald-400' : 'text-red-400'">● MQTT</span>
        <span>{{ auth.perfil?.nombre }} <span class="text-slate-400">({{ auth.rol }})</span></span>
        <button class="underline" @click="auth.logout()">Cerrar sesión</button>
      </div>
    </div>
    <div v-if="abierto" class="md:hidden px-4 pb-3 text-sm flex justify-between">
      <span>{{ auth.perfil?.nombre }}</span>
      <button class="underline" @click="auth.logout()">Cerrar sesión</button>
    </div>
  </header>
</template>
