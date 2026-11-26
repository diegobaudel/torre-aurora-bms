// Modo claro / oscuro (se recuerda en este navegador)
import { ref } from 'vue'

export const oscuro = ref(document.documentElement.classList.contains('dark'))

export function alternarTema() {
  oscuro.value = !oscuro.value
  document.documentElement.classList.toggle('dark', oscuro.value)
  try { localStorage.setItem('tema', oscuro.value ? 'oscuro' : 'claro') } catch (e) { /* almacenamiento no disponible */ }
}

// Lee un color del tema actual (para Chart.js)
export const colorTema = (nombre) =>
  getComputedStyle(document.documentElement).getPropertyValue(`--color-${nombre}`).trim()
