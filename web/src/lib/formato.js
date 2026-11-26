import { ref, watch, onUnmounted } from 'vue'

// Escala de color para temperatura: frío → confort → calor
export function colorTemp(t) {
  if (t === null || t === undefined || Number.isNaN(Number(t))) return '#b7c3ca'
  const v = Number(t)
  if (v < 20) return '#3d7bd6'
  if (v < 21.5) return '#0099cc'
  if (v <= 24.5) return '#00c99c'
  if (v <= 26) return '#f0a030'
  return '#e5484d'
}

export const promedio = (arr) => {
  const v = arr.map(Number).filter((n) => !Number.isNaN(n))
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

export const hora = (d) => new Date(d).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })

// Número que se anima suavemente hacia su nuevo valor
export function useTween(fuente, duracion = 600) {
  const valor = ref(fuente())
  const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  let raf
  watch(fuente, (nuevo) => {
    cancelAnimationFrame(raf)
    if (nuevo === null || valor.value === null || reducido) { valor.value = nuevo; return }
    const desde = valor.value, inicio = performance.now()
    const paso = (t) => {
      const k = Math.min(1, (t - inicio) / duracion)
      valor.value = desde + (nuevo - desde) * (1 - Math.pow(1 - k, 3))
      if (k < 1) raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
  })
  onUnmounted(() => cancelAnimationFrame(raf))
  return valor
}
