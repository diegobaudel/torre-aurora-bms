<script setup>
// HU-03 Dashboard con estado de todos los subsistemas
import { computed } from 'vue'
import { edificio } from '../lib/mqtt'

const prom = (obj) => {
  const v = Object.values(obj).map(Number)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

const tarjetas = computed(() => {
  const luces = Object.values(edificio.luces)
  const encendidas = luces.filter((v) => v === 'on').length
  const t = prom(edificio.temp)
  const kwh = Object.values(edificio.energia).map(Number).reduce((a, b) => a + b, 0)
  const alarmas = Object.keys(edificio.humo).length

  return [
    { nombre: 'Iluminación', icono: '💡', ruta: '/iluminacion',
      valor: luces.length ? `${encendidas} de ${luces.length} zonas encendidas` : null },
    { nombre: 'Climatización', icono: '🌡️',
      valor: t !== null ? `${t.toFixed(1)} °C promedio` : null,
      alerta: t !== null && (t < 18 || t > 28) },
    { nombre: 'Energía', icono: '⚡',
      valor: kwh ? `${kwh.toFixed(1)} kWh en el edificio` : null },
    { nombre: 'Seguridad', icono: '🚨',
      valor: alarmas ? `${alarmas} alarma(s) de humo activas` : 'Sin alarmas',
      alerta: alarmas > 0 },
    { nombre: 'Accesos', icono: '🔑', valor: null },
  ]
})
</script>

<template>
  <div class="flex items-center justify-between mb-4">
    <h1 class="text-2xl font-bold">Estado del edificio</h1>
    <span class="text-sm" :class="edificio.simuladorOnline ? 'text-emerald-600' : 'text-red-600'">
      {{ edificio.simuladorOnline ? 'Datos en vivo' : 'Simulador desconectado' }}
    </span>
  </div>

  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <component :is="t.ruta ? 'RouterLink' : 'div'" v-for="t in tarjetas" :key="t.nombre" :to="t.ruta"
      class="card block transition"
      :class="[t.alerta ? 'border-red-400 bg-red-50' : '', t.ruta ? 'hover:shadow-md' : '']">
      <div class="text-3xl">{{ t.icono }}</div>
      <h2 class="font-semibold mt-2">{{ t.nombre }}</h2>
      <p :class="t.valor ? 'text-slate-700' : 'text-slate-400 italic'">{{ t.valor ?? 'Sin datos' }}</p>
    </component>
  </div>

  <div class="card mt-6" v-if="Object.keys(edificio.temp).length">
    <h2 class="font-semibold mb-3">Por piso</h2>
    <table class="w-full text-sm">
      <thead class="text-left text-slate-500"><tr><th>Piso</th><th>Temperatura</th><th>Consumo</th></tr></thead>
      <tbody>
        <tr v-for="p in Object.keys(edificio.temp).sort()" :key="p" class="border-t">
          <td class="py-1">Piso {{ p }}</td>
          <td>{{ edificio.temp[p] }} °C</td>
          <td>{{ edificio.energia[p] ?? '—' }} kWh</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
