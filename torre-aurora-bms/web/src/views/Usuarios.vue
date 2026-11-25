<script setup>
// HU-02 Crear usuarios y asignar roles (solo admin)
import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuth } from '../stores/auth'

const auth = useAuth()
const ROLES = ['admin', 'operador', 'tecnico', 'recepcion', 'inquilino']
const usuarios = ref([])
const nuevo = ref({ nombre: '', correo: '', password: '', rol: 'operador' })
const msg = ref({ txt: '', error: false })
const guardando = ref(false)

async function cargar() {
  const { data } = await supabase.from('perfiles').select('*').order('creado_en')
  usuarios.value = data ?? []
}
onMounted(cargar)

async function crear() {
  guardando.value = true
  msg.value = { txt: '' }
  const { data, error } = await supabase.functions.invoke('crear-usuario', { body: nuevo.value })
  guardando.value = false
  if (error || data?.error) {
    let txt = data?.error
    if (!txt && error?.context) txt = (await error.context.json().catch(() => ({}))).error
    msg.value = { txt: txt ?? 'No se pudo crear el usuario', error: true }
    return
  }
  msg.value = { txt: `Usuario ${nuevo.value.correo} creado`, error: false }
  nuevo.value = { nombre: '', correo: '', password: '', rol: 'operador' }
  cargar()
}

async function actualizar(u, campos) {
  const { error } = await supabase.from('perfiles').update(campos).eq('id', u.id)
  if (error) msg.value = { txt: error.message, error: true }
  cargar()
}
</script>

<template>
  <h1 class="text-2xl font-bold mb-4">Usuarios y roles</h1>

  <form class="card grid gap-3 md:grid-cols-5 items-end mb-6" @submit.prevent="crear">
    <label><span class="text-sm">Nombre</span><input v-model="nuevo.nombre" required class="input" /></label>
    <label><span class="text-sm">Correo</span><input v-model="nuevo.correo" type="email" required class="input" /></label>
    <label><span class="text-sm">Contraseña</span><input v-model="nuevo.password" type="password" minlength="6" required class="input" /></label>
    <label><span class="text-sm">Rol</span>
      <select v-model="nuevo.rol" class="input"><option v-for="r in ROLES" :key="r">{{ r }}</option></select>
    </label>
    <button class="btn-primary" :disabled="guardando">{{ guardando ? 'Creando…' : 'Crear usuario' }}</button>
    <p v-if="msg.txt" class="md:col-span-5 text-sm" :class="msg.error ? 'text-red-600' : 'text-emerald-700'">{{ msg.txt }}</p>
  </form>

  <div class="card overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="text-left text-slate-500"><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th></tr></thead>
      <tbody>
        <tr v-for="u in usuarios" :key="u.id" class="border-t">
          <td class="py-2">{{ u.nombre }}</td>
          <td>{{ u.correo }}</td>
          <td>
            <select :value="u.rol" class="border rounded px-2 py-1" :disabled="u.id === auth.usuario.id"
              @change="actualizar(u, { rol: $event.target.value })">
              <option v-for="r in ROLES" :key="r">{{ r }}</option>
            </select>
          </td>
          <td>
            <button class="text-xs px-2 py-1 rounded" :disabled="u.id === auth.usuario.id"
              :class="u.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'"
              @click="actualizar(u, { activo: !u.activo })">{{ u.activo ? 'Activo' : 'Desactivado' }}</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
