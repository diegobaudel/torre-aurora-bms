<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from './stores/auth'
import { conectarMqtt, desconectarMqtt, cargarHistorial } from './lib/mqtt'
import Sidebar from './components/Sidebar.vue'
import TopBar from './components/TopBar.vue'

const auth = useAuth()
const router = useRouter()
const menu = ref(false)

// Conecta MQTT solo con sesión; si la sesión se cierra, vuelve al login
watch(() => auth.usuario, (u) => {
  if (u) { conectarMqtt(); cargarHistorial() }
  else { desconectarMqtt(); router.push('/login') }
}, { immediate: true })
</script>

<template>
  <template v-if="auth.usuario">
    <Sidebar :abierto="menu" @cerrar="menu = false" />
    <div class="lg:pl-64 min-h-screen flex flex-col">
      <TopBar @menu="menu = true" />
      <main class="flex-1 p-4 lg:p-6">
        <RouterView />
      </main>
    </div>
  </template>
  <RouterView v-else />
</template>
