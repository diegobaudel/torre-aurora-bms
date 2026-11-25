<script setup>
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from './stores/auth'
import { conectarMqtt, desconectarMqtt } from './lib/mqtt'
import NavBar from './components/NavBar.vue'

const auth = useAuth()
const router = useRouter()

// Conecta MQTT solo con sesión; si la sesión se cierra, vuelve al login
watch(() => auth.usuario, (u) => {
  if (u) conectarMqtt()
  else { desconectarMqtt(); router.push('/login') }
}, { immediate: true })
</script>

<template>
  <NavBar v-if="auth.usuario" />
  <main :class="auth.usuario ? 'max-w-6xl mx-auto p-4 md:p-6' : ''">
    <RouterView />
  </main>
</template>
