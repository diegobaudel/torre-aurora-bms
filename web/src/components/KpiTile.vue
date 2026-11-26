<script setup>
// Indicador vivo: número animado, variación y mini gráfica de tendencia
import { computed } from 'vue'
import { useTween } from '../lib/formato'

const props = defineProps({
  titulo: String,
  valor: { type: Number, default: null },
  decimales: { type: Number, default: 1 },
  sufijo: String,         // texto pegado al número, ej. "/10"
  unidad: String,
  nota: String,
  delta: { type: Number, default: null },   // cambio respecto al inicio de la ventana
  deltaUnidad: String,
  invertirDelta: Boolean,                    // true si subir es malo (consumo)
  serie: { type: Array, default: () => [] },
  color: { type: String, default: '#0099cc' },
  alerta: Boolean,
})

const animado = useTween(() => props.valor)
const texto = computed(() => (animado.value === null ? '—' : animado.value.toFixed(props.decimales)))

const puntos = computed(() => {
  const s = props.serie.filter((v) => v !== null && !Number.isNaN(v))
  if (s.length < 2) return ''
  const min = Math.min(...s), max = Math.max(...s), rango = max - min || 1
  return s.map((v, i) => `${(i / (s.length - 1)) * 100},${28 - ((v - min) / rango) * 24}`).join(' ')
})
const area = computed(() => (puntos.value ? `0,30 ${puntos.value} 100,30` : ''))

const deltaInfo = computed(() => {
  if (props.delta === null || Math.abs(props.delta) < 0.05) return { txt: 'Sin cambio', clase: 'text-grafito', flecha: '' }
  const sube = props.delta > 0
  const malo = props.invertirDelta ? sube : false
  return {
    txt: `${Math.abs(props.delta).toFixed(1)} ${props.deltaUnidad ?? props.unidad ?? ''}`,
    clase: malo ? 'text-alarma' : 'text-cian',
    flecha: sube ? '▲' : '▼',
  }
})
const idGrad = `g${Math.random().toString(36).slice(2, 8)}`
</script>

<template>
  <div class="panel p-4 flex flex-col relative overflow-hidden" :class="alerta ? 'border-alarma ring-1 ring-alarma/30' : ''">
    <span class="absolute inset-x-0 top-0 h-0.5" :style="{ background: alerta ? '#e5484d' : color }" aria-hidden="true" />
    <div class="flex items-start justify-between gap-2">
      <p class="text-sm text-grafito">{{ titulo }}</p>
      <span v-if="delta !== null" class="text-xs font-medium tabular-nums whitespace-nowrap" :class="deltaInfo.clase">
        {{ deltaInfo.flecha }} {{ deltaInfo.txt }}
      </span>
    </div>
    <p class="mt-1 flex items-baseline gap-1">
      <span class="text-3xl font-semibold tracking-tight tabular-nums [font-stretch:85%]" :class="alerta ? 'text-alarma' : ''">
        {{ texto }}<span v-if="sufijo && valor !== null" class="text-grafito text-xl">{{ sufijo }}</span>
      </span>
      <span v-if="unidad && valor !== null" class="text-grafito">{{ unidad }}</span>
    </p>
    <slot name="visual">
      <svg v-if="puntos" viewBox="0 0 100 30" preserveAspectRatio="none" class="mt-3 h-9 w-full" aria-hidden="true">
        <defs>
          <linearGradient :id="idGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" :stop-color="color" stop-opacity=".25" /><stop offset="100%" :stop-color="color" stop-opacity="0" />
          </linearGradient>
        </defs>
        <polygon :points="area" :fill="`url(#${idGrad})`" />
        <polyline :points="puntos" fill="none" :stroke="color" stroke-width="1.8" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
      </svg>
      <p v-else class="mt-3 h-9 text-xs text-grafito/70 flex items-end">Esperando lecturas…</p>
    </slot>
    <p v-if="nota" class="mt-2 text-xs text-grafito">{{ nota }}</p>
  </div>
</template>
