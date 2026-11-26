<script setup>
// HU-02 Crear, editar y desactivar usuarios; asignar roles (solo admin)
import { ref, computed, onMounted, nextTick } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuth } from '../stores/auth'

const auth = useAuth()
const ROLES = [
  { id: 'admin', txt: 'Administrador' },
  { id: 'operador', txt: 'Operador' },
  { id: 'tecnico', txt: 'Técnico' },
  { id: 'recepcion', txt: 'Recepción' },
  { id: 'inquilino', txt: 'Inquilino' },
]
const nombreRol = (id) => ROLES.find((r) => r.id === id)?.txt ?? id

const usuarios = ref([])
const filtro = ref('')
const nuevo = ref({ nombre: '', correo: '', password: '', rol: 'operador' })
const formAbierto = ref(false)
const msg = ref({ txt: '', error: false })
const guardando = ref(false)
const editando = ref(null)     // id del usuario cuyo nombre se edita
const nombreEdit = ref('')
const inputEdit = ref(null)

const visibles = computed(() => {
  const f = filtro.value.trim().toLowerCase()
  return f ? usuarios.value.filter((u) => `${u.nombre} ${u.correo}`.toLowerCase().includes(f)) : usuarios.value
})
const resumen = computed(() => ({
  total: usuarios.value.length,
  activos: usuarios.value.filter((u) => u.activo).length,
  admins: usuarios.value.filter((u) => u.rol === 'admin').length,
}))

async function cargar() {
  const { data } = await supabase.from('perfiles').select('*').order('creado_en')
  usuarios.value = data ?? []
}
onMounted(cargar)

const aviso = (txt, error = false) => { msg.value = { txt, error } }

async function crear() {
  guardando.value = true
  aviso('')
  const { data, error } = await supabase.functions.invoke('crear-usuario', { body: nuevo.value })
  guardando.value = false
  if (error || data?.error) {
    let txt = data?.error
    if (!txt && error?.context) txt = (await error.context.json().catch(() => ({}))).error
    aviso(txt ?? 'No se pudo crear el usuario', true)
    return
  }
  aviso(`Usuario ${nuevo.value.correo} creado`)
  nuevo.value = { nombre: '', correo: '', password: '', rol: 'operador' }
  formAbierto.value = false
  cargar()
}

async function actualizar(u, campos, exito) {
  const { error } = await supabase.from('perfiles').update(campos).eq('id', u.id)
  if (error) aviso(error.message, true)
  else if (exito) aviso(exito)
  await cargar()
}

async function editar(u) {
  editando.value = u.id
  nombreEdit.value = u.nombre
  await nextTick()
  inputEdit.value?.[0]?.focus()
}

async function guardarNombre(u) {
  const nombre = nombreEdit.value.trim()
  if (!nombre) return aviso('El nombre no puede quedar vacío', true)
  editando.value = null
  if (nombre !== u.nombre) await actualizar(u, { nombre }, `Nombre actualizado a ${nombre}`)
}
</script>

<template>
  <div class="space-y-4 lg:space-y-5">
    <div class="flex flex-wrap items-center gap-4">
      <dl class="flex gap-8 text-sm">
        <div><dt class="text-grafito">Usuarios</dt><dd class="text-2xl font-semibold tabular-nums">{{ resumen.total }}</dd></div>
        <div><dt class="text-grafito">Activos</dt><dd class="text-2xl font-semibold tabular-nums">{{ resumen.activos }}</dd></div>
        <div><dt class="text-grafito">Administradores</dt><dd class="text-2xl font-semibold tabular-nums">{{ resumen.admins }}</dd></div>
      </dl>
      <div class="ml-auto flex gap-3 w-full sm:w-auto">
        <input v-model="filtro" type="search" placeholder="Buscar por nombre o correo" class="input sm:w-64" aria-label="Buscar usuarios" />
        <button class="btn-primary whitespace-nowrap" @click="formAbierto = !formAbierto" :aria-expanded="formAbierto">
          {{ formAbierto ? 'Cancelar' : 'Nuevo usuario' }}
        </button>
      </div>
    </div>

    <p v-if="msg.txt" role="status" class="panel px-4 py-3 text-sm"
      :class="msg.error ? 'border-alarma text-alarma' : 'border-cian text-cian'">{{ msg.txt }}</p>

    <form v-if="formAbierto" class="panel p-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5 items-end" @submit.prevent="crear">
      <label class="block"><span class="text-sm text-grafito">Nombre completo</span><input v-model="nuevo.nombre" required class="input mt-1" /></label>
      <label class="block"><span class="text-sm text-grafito">Correo</span><input v-model="nuevo.correo" type="email" required class="input mt-1" /></label>
      <label class="block"><span class="text-sm text-grafito">Contraseña inicial</span><input v-model="nuevo.password" type="password" minlength="6" required class="input mt-1" autocomplete="new-password" /></label>
      <label class="block"><span class="text-sm text-grafito">Rol</span>
        <select v-model="nuevo.rol" class="input mt-1"><option v-for="r in ROLES" :key="r.id" :value="r.id">{{ r.txt }}</option></select>
      </label>
      <button class="btn-primary" :disabled="guardando">{{ guardando ? 'Creando…' : 'Crear usuario' }}</button>
    </form>

    <div class="panel overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="text-left text-grafito border-b border-losa bg-fondo/60">
          <tr>
            <th class="px-4 py-2.5 font-medium">Usuario</th>
            <th class="px-4 py-2.5 font-medium">Rol</th>
            <th class="px-4 py-2.5 font-medium">Estado</th>
            <th class="px-4 py-2.5 font-medium">Alta</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-losa">
          <tr v-for="u in visibles" :key="u.id" :class="u.activo ? '' : 'bg-fondo/40'">
            <td class="px-4 py-3">
              <div class="flex items-center gap-3">
                <span class="h-9 w-9 rounded-full grid place-items-center text-xs font-semibold shrink-0"
                  :class="u.activo ? 'bg-cian/15 text-cian' : 'bg-losa text-grafito'">
                  {{ u.nombre.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() }}
                </span>
                <div class="min-w-0">
                  <form v-if="editando === u.id" class="flex gap-2" @submit.prevent="guardarNombre(u)">
                    <input ref="inputEdit" v-model="nombreEdit" class="input py-1" aria-label="Nombre" @keydown.esc="editando = null" />
                    <button class="text-cian font-medium">Guardar</button>
                    <button type="button" class="text-grafito" @click="editando = null">Cancelar</button>
                  </form>
                  <p v-else class="font-medium flex items-center gap-2">
                    {{ u.nombre }}
                    <span v-if="u.id === auth.usuario.id" class="text-xs text-grafito font-normal">(tú)</span>
                    <button class="text-grafito hover:text-cian" :aria-label="`Editar nombre de ${u.nombre}`" title="Editar nombre" @click="editar(u)">
                      <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
                        aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                    </button>
                  </p>
                  <p class="text-grafito truncate">{{ u.correo }}</p>
                </div>
              </div>
            </td>
            <td class="px-4 py-3">
              <select :value="u.rol" class="input py-1.5 w-40" :disabled="u.id === auth.usuario.id" :aria-label="`Rol de ${u.nombre}`"
                @change="actualizar(u, { rol: $event.target.value }, `${u.nombre} ahora es ${nombreRol($event.target.value)}`)">
                <option v-for="r in ROLES" :key="r.id" :value="r.id">{{ r.txt }}</option>
              </select>
            </td>
            <td class="px-4 py-3">
              <button class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium disabled:cursor-not-allowed"
                :class="u.activo ? 'bg-cian/10 text-cian' : 'bg-losa text-grafito'"
                :disabled="u.id === auth.usuario.id"
                :title="u.id === auth.usuario.id ? 'No puedes desactivarte a ti mismo' : u.activo ? 'Desactivar' : 'Activar'"
                @click="actualizar(u, { activo: !u.activo }, `${u.nombre} ${u.activo ? 'desactivado' : 'activado'}`)">
                <span class="h-1.5 w-1.5 rounded-full" :class="u.activo ? 'bg-cian' : 'bg-grafito'" />
                {{ u.activo ? 'Activo' : 'Desactivado' }}
              </button>
            </td>
            <td class="px-4 py-3 text-grafito tabular-nums whitespace-nowrap">{{ new Date(u.creado_en).toLocaleDateString('es-MX') }}</td>
          </tr>
          <tr v-if="!visibles.length"><td colspan="4" class="px-4 py-6 text-grafito">Ningún usuario coincide con "{{ filtro }}".</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
