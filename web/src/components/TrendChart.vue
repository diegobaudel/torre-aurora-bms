<script setup>
// Visor de tendencias (Chart.js); se adapta al modo claro/oscuro
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler } from 'chart.js'
import { oscuro, colorTema } from '../lib/tema'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler)
Chart.defaults.font.family = 'Archivo, system-ui, sans-serif'

const props = defineProps({
  etiquetas: { type: Array, default: () => [] },
  series: { type: Array, default: () => [] },   // [{ nombre, datos, color, relleno }]
  unidad: { type: String, default: '' },
  alto: { type: Number, default: 240 },
})

const canvas = ref(null)
let chart

const datasets = () => props.series.map((s) => ({
  label: s.nombre,
  data: [...s.datos],
  borderColor: s.color,
  backgroundColor: s.relleno ? `${s.color}22` : s.color,
  fill: !!s.relleno,
  borderWidth: s.punteado ? 1.5 : 2,
  borderDash: s.punteado ? [6, 4] : [],
  pointRadius: 0,
  pointHoverRadius: 4,
  tension: 0.35,
}))

function crear() {
  chart?.destroy()
  const rejilla = colorTema('losa'), texto = colorTema('grafito')
  chart = new Chart(canvas.value, {
    type: 'line',
    data: { labels: [...props.etiquetas], datasets: datasets() },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: props.series.length > 1, position: 'bottom', labels: { color: texto, boxWidth: 8, boxHeight: 8, usePointStyle: true } },
        tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${Number(c.raw).toFixed(1)} ${props.unidad}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: texto, maxTicksLimit: 6 }, border: { color: rejilla } },
        y: { grid: { color: rejilla }, ticks: { color: texto, maxTicksLimit: 5 }, border: { display: false } },
      },
    },
  })
}

onMounted(crear)
watch(oscuro, () => setTimeout(crear, 0))
watch(() => props.series.map((s) => s.nombre).join(), () => crear())
watch(() => [props.etiquetas.length, props.etiquetas.at(-1), props.series.map((s) => s.datos.length + ':' + s.datos.at(-1)).join('|')], () => {
  if (!chart) return
  chart.data.labels = [...props.etiquetas]
  datasets().forEach((d, i) => { if (chart.data.datasets[i]) Object.assign(chart.data.datasets[i], d) })
  chart.update('none')
})
onUnmounted(() => chart?.destroy())
</script>

<template>
  <div :style="{ height: `${alto}px` }"><canvas ref="canvas" /></div>
</template>
