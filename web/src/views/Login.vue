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

// Ventanas decorativas de la fachada (algunas encendidas)
const ventanas = Array.from({ length: 60 }, (_, i) => [3, 8, 11, 17, 22, 26, 31, 38, 41, 47, 52, 55].includes(i))
</script>

<template>
  <div class="min-h-screen grid lg:grid-cols-[1fr_minmax(420px,520px)]">
    <!-- Fachada -->
    <div class="hidden lg:flex relative bg-estructura overflow-hidden items-end justify-center" aria-hidden="true">
      <div class="absolute top-10 left-12 text-white">
        <p class="text-3xl font-semibold tracking-tight [font-stretch:85%]">Torre Corporativa Aurora</p>
        <p class="text-white/55 mt-1">Sistema de gestión del edificio</p>
      </div>
      <div class="w-[46%] max-w-sm">
        <div class="mx-auto w-1/3 h-16 bg-[#4f606b] [clip-path:polygon(0_100%,50%_0,100%_100%)]" />
        <div class="grid grid-cols-5 gap-1.5 bg-[#4f606b] p-3 pb-0">
          <span v-for="(on, i) in ventanas" :key="i" class="h-7 rounded-[2px]" :class="on ? 'bg-menta' : 'bg-vidrio/70'" />
        </div>
        <div class="h-14 bg-[#4f606b] flex justify-center items-end"><span class="w-14 h-10 bg-vidrio/70" /></div>
      </div>
      <div class="absolute bottom-0 inset-x-0 h-px bg-superficie/15" />
    </div>

    <!-- Formulario -->
    <div class="flex items-center justify-center p-6 sm:p-12 bg-superficie">
      <form class="w-full max-w-sm space-y-5" @submit.prevent="entrar">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Inicia sesión</h1>
          <p class="text-grafito mt-1">Usa la cuenta que te dio el administrador del edificio.</p>
        </div>
        <label class="block">
          <span class="text-sm font-medium">Correo</span>
          <input v-model="correo" type="email" required class="input mt-1" autocomplete="username" />
        </label>
        <label class="block">
          <span class="text-sm font-medium">Contraseña</span>
          <input v-model="password" type="password" required class="input mt-1" autocomplete="current-password" />
        </label>
        <p v-if="error" role="alert" class="text-sm text-alarma bg-alarma/5 border border-alarma/30 rounded-md px-3 py-2">{{ error }}</p>
        <button class="btn-primary w-full py-2.5" :disabled="cargando">{{ cargando ? 'Entrando…' : 'Iniciar sesión' }}</button>
        <p class="text-xs text-grafito">¿No tienes cuenta? Pídela al administrador; el registro abierto está desactivado.</p>
      </form>
    </div>
  </div>
</template>
