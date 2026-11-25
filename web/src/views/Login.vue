<script setup>
// HU-01 Login de administrador
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../stores/auth'

const auth = useAuth()
const router = useRouter()
const correo = ref('')
const password = ref('')
const error = ref('')
const cargando = ref(false)

async function entrar() {
  error.value = ''
  cargando.value = true
  try {
    await auth.login(correo.value, password.value)
    router.push('/')
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-900 p-4">
    <form class="card w-full max-w-sm space-y-4" @submit.prevent="entrar">
      <div>
        <h1 class="text-2xl font-bold">Torre Aurora BMS</h1>
        <p class="text-slate-500 text-sm">Sistema de gestión del edificio</p>
      </div>
      <label class="block">
        <span class="text-sm">Correo</span>
        <input v-model="correo" type="email" required class="input" autocomplete="username" />
      </label>
      <label class="block">
        <span class="text-sm">Contraseña</span>
        <input v-model="password" type="password" required class="input" autocomplete="current-password" />
      </label>
      <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
      <button class="btn-primary w-full" :disabled="cargando">{{ cargando ? 'Entrando…' : 'Iniciar sesión' }}</button>
    </form>
  </div>
</template>
