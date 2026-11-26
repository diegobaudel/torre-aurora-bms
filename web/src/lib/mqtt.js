// Conexión MQTT compartida y estado en vivo del edificio
import mqtt from 'mqtt'
import { reactive } from 'vue'
import { supabase } from './supabase'

export const PREFIJO = import.meta.env.VITE_MQTT_PREFIX ?? 'torre-aurora-e5'
export const PISOS = [5, 4, 3, 2, 1]
const MAX_HISTORIA = 120  // ~10 min con lecturas cada 5 s
const MAX_EVENTOS = 30

// Estado reactivo que alimenta todas las vistas
export const edificio = reactive({
  conectado: false,
  simuladorOnline: false,
  ultimaLectura: null,
  luces: {},      // { p1z1: 'on' }
  temp: {},       // { 1: '23.1' }
  objetivo: {},   // { 1: '23' }
  energia: {},    // { 1: '3.40' }
  humo: {},       // { p3z2: '2026-11-25T20:00:00Z' } hora de detección
  historia: { temp: {}, energia: {}, horas: [] }, // series para las gráficas
  pausado: false, // congela las gráficas sin cortar la conexión
  ultimaViva: null,   // última lectura recibida por MQTT
  historial24: { horas: [], temp: {}, energia: {}, cargado: false, ultima: null }, // guardado en la base
  eventos: [],    // [{ tipo, texto, fecha }]
})

const agregarEvento = (tipo, texto) => {
  edificio.eventos.unshift({ tipo, texto, fecha: new Date() })
  if (edificio.eventos.length > MAX_EVENTOS) edificio.eventos.pop()
}

const empujar = (serie, id, valor) => {
  const arr = (serie[id] ??= [])
  arr.push(Number(valor))
  if (arr.length > MAX_HISTORIA) arr.shift()
}

let cliente = null

export function conectarMqtt() {
  if (cliente) return cliente
  cliente = mqtt.connect(import.meta.env.VITE_MQTT_URL ?? 'wss://broker.hivemq.com:8884/mqtt', {
    clientId: `web-${Math.random().toString(16).slice(2, 10)}`,
    reconnectPeriod: 3000,
  })
  cliente.on('connect', () => {
    edificio.conectado = true
    cliente.subscribe(`${PREFIJO}/#`)
  })
  cliente.on('close', () => { edificio.conectado = false })
  cliente.on('message', (topico, buf) => procesar(topico, buf.toString()))
  return cliente
}

export function procesar(topico, v) {
  const [, id, sub, accion] = topico.split('/')
  if (id === 'sim' && sub === 'estado') {
    // Un 'en línea' retenido sin lecturas recientes no cuenta
    edificio.simuladorOnline = JSON.parse(v).online && !!edificio.ultimaViva && Date.now() - edificio.ultimaViva < 15000
  } else if (sub === 'luz' && accion === 'estado') {
    const antes = edificio.luces[id]
    edificio.luces[id] = v
    if (antes && antes !== v) agregarEvento('luz', `Luz ${etiquetaZona(id)} ${v === 'on' ? 'encendida' : 'apagada'}`)
  } else if (sub === 'temp') {
    const piso = id.slice(1)
    edificio.temp[piso] = v
    if (!edificio.pausado) empujar(edificio.historia.temp, piso, v)
    if (piso === '1' && !edificio.pausado) {
      edificio.historia.horas.push(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
      if (edificio.historia.horas.length > MAX_HISTORIA) edificio.historia.horas.shift()
    }
    edificio.ultimaLectura = new Date()
    edificio.ultimaViva = Date.now()
    edificio.simuladorOnline = true
  } else if (sub === 'hvac' && accion === 'objetivo') {
    edificio.objetivo[id.slice(1)] = v
  } else if (sub === 'energia') {
    const piso = id.slice(1)
    edificio.energia[piso] = v
    if (!edificio.pausado) empujar(edificio.historia.energia, piso, v)
  } else if (sub === 'humo' && !accion) {
    if (!edificio.humo[id]) {
      agregarEvento('alarma', `Humo detectado en ${etiquetaZona(id)}`)
      edificio.humo[id] = new Date().toISOString()
    }
  }
}

// Historial de las últimas 24 h desde la tabla lecturas (datos guardados o de prueba)
export async function cargarHistorial() {
  const desde = new Date(Date.now() - 24 * 3600e3).toISOString()
  const { data, error } = await supabase.from('lecturas')
    .select('piso, fecha, temp, energia_total').gte('fecha', desde).order('fecha').limit(5000)
  if (error || !data?.length) return
  const h = { horas: [], temp: {}, energia: {}, cargado: true, ultima: null }
  const porFecha = new Map()
  for (const r of data) {
    const k = r.fecha.slice(0, 16)
    if (!porFecha.has(k)) porFecha.set(k, {})
    porFecha.get(k)[r.piso] = r
  }
  for (const [k, fila] of porFecha) {
    if (Object.keys(fila).length < PISOS.length) continue
    h.horas.push(new Date(k + 'Z').toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }))
    for (const p of PISOS) {
      (h.temp[p] ??= []).push(Number(fila[p].temp))
      ;(h.energia[p] ??= []).push(Number(fila[p].energia_total))
    }
    h.ultima = new Date(k + 'Z')
  }
  edificio.historial24 = h
  // Si no hay lecturas en vivo, muestra la última guardada
  for (const p of PISOS) {
    if (edificio.temp[p] === undefined && h.temp[p]?.length) edificio.temp[p] = String(h.temp[p].at(-1))
    if (edificio.energia[p] === undefined && h.energia[p]?.length) edificio.energia[p] = String(h.energia[p].at(-1))
  }
}

// Si el simulador deja de mandar lecturas, se marca sin señal aunque el broker diga lo contrario
setInterval(() => {
  if (edificio.simuladorOnline && (!edificio.ultimaViva || Date.now() - edificio.ultimaViva > 15000)) edificio.simuladorOnline = false
}, 5000)

export function etiquetaZona(clave) {
  const m = /^p(\d+)z(\d+)$/.exec(clave)
  return m ? `piso ${m[1]}, zona ${m[2]}` : clave
}

export function publicar(topico, valor) {
  conectarMqtt().publish(`${PREFIJO}/${topico}`, String(valor))
}

export function atenderHumo(zona) {
  delete edificio.humo[zona]
  agregarEvento('ok', `Alarma de ${etiquetaZona(zona)} marcada como atendida`)
}

export function desconectarMqtt() {
  cliente?.end()
  cliente = null
  edificio.conectado = false
}
