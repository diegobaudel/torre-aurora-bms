<script setup>
// HU-10 Encender/apagar iluminación por zona
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../lib/supabase'
import { edificio, publicar } from '../lib/mqtt'
import { useAuth } from '../stores/auth'

const auth = useAuth()
const zonas = ref([])
const bitacora = ref([])
const pendientes = ref({})
const puedeControlar = computed(() => ['admin', 'operador'].includes(auth.rol))

const porPiso = computed(() => {
  const g = {}
  for (const z of zonas.value) (g[z.piso] ??= []).push(z)
  return g
})

async function cargarBitacora() {
  const { data } = await supabase
    .from('bitacora_iluminacion')
    .select('id, estado, fecha, zonas(nombre, piso), perfiles(nombre)')
    .order('fecha', { ascending: false })
    .limit(10)
  bitacora.value = data ?? []
}

onMounted(async () => {
  const { data } = await supabase.from('zonas').select('*').order('piso').order('id')
  zonas.value = data ?? []
  cargarBitacora()
})

async function cambiar(zona) {
  const nuevo = edificio.luces[zona.clave] === 'on' ? 'off' : 'on'
  pendientes.value[zona.clave] = true
  publicar(`${zona.clave}/luz/set`, nuevo)
  // Registra quién hizo el cambio y a qué hora
  await supabase.from('bitacora_iluminacion').insert({ zona_id: zona.id, estado: nuevo, usuario_id: auth.usuario.id })
  cargarBitacora()
  // Se libera al confirmar el simulador; si no responde en 10 s, avisa
  const inicio = Date.now()
  const t = setInterval(() => {
    if (edificio.luces[zona.clave] === nuevo) { delete pendientes.value[zona.clave]; clearInterval(t) }
    else if (Date.now() - inicio > 10000) { pendientes.value[zona.clave] = 'sin respuesta'; clearInterval(t) }
  }, 200)
}
</script>

<template>
  <h1 class="text-2xl font-bold mb-4">Iluminación</h1>
  <p v-if="!edificio.simuladorOnline" class="mb-4 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
    El simulador no está conectado. Ejecuta <code>npm start</code> en la carpeta <code>simulador</code>.
  </p>

  <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    <div v-for="(lista, piso) in porPiso" :key="piso" class="card">
      <h2 class="font-semibold mb-3">Piso {{ piso }}</h2>
      <div v-for="z in lista" :key="z.id" class="flex items-center justify-between py-2 border-t first:border-0">
        <div>
          <p>{{ z.nombre }}</p>
          <p class="text-xs" :class="pendientes[z.clave] === 'sin respuesta' ? 'text-red-600' : 'text-slate-500'">
            {{ pendientes[z.clave] === 'sin respuesta' ? 'El dispositivo no respondió'
              : pendientes[z.clave] ? 'Enviando…' : edificio.luces[z.clave] === 'on' ? 'Encendida' : 'Apagada' }}
          </p>
        </div>
        <button :disabled="!puedeControlar || pendientes[z.clave] === true" @click="cambiar(z)"
          class="w-14 h-8 rounded-full relative transition disabled:opacity-50"
          :class="edificio.luces[z.clave] === 'on' ? 'bg-amber-400' : 'bg-slate-300'">
          <span class="absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all"
            :class="edificio.luces[z.clave] === 'on' ? 'left-7' : 'left-1'" />
        </button>
      </div>
    </div>
  </div>

  <div class="card mt-6">
    <h2 class="font-semibold mb-3">Últimos cambios</h2>
    <table class="w-full text-sm">
      <thead class="text-left text-slate-500"><tr><th>Fecha</th><th>Zona</th><th>Acción</th><th>Usuario</th></tr></thead>
      <tbody>
        <tr v-for="b in bitacora" :key="b.id" class="border-t">
          <td class="py-1">{{ new Date(b.fecha).toLocaleString('es-MX') }}</td>
          <td>P{{ b.zonas?.piso }} · {{ b.zonas?.nombre }}</td>
          <td>{{ b.estado === 'on' ? 'Encendió' : 'Apagó' }}</td>
          <td>{{ b.perfiles?.nombre }}</td>
        </tr>
        <tr v-if="!bitacora.length"><td colspan="4" class="py-2 text-slate-500">Sin cambios registrados</td></tr>
      </tbody>
    </table>
  </div>
</template>
