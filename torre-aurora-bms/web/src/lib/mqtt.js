// Conexión MQTT compartida y estado en vivo del edificio
import mqtt from 'mqtt'
import { reactive } from 'vue'

export const PREFIJO = import.meta.env.VITE_MQTT_PREFIX ?? 'torre-aurora-e5'

// Estado reactivo que alimenta todas las vistas
export const edificio = reactive({
  conectado: false,
  simuladorOnline: false,
  luces: {},     // { p1z1: 'on' }
  temp: {},      // { 1: '23.1' }
  energia: {},   // { 1: '3.40' }
  humo: {},      // { p3z2: 'alarma' }
})

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
  cliente.on('message', (topico, buf) => {
    const [, id, sub, accion] = topico.split('/')
    const v = buf.toString()
    if (id === 'sim' && sub === 'estado') edificio.simuladorOnline = JSON.parse(v).online
    else if (sub === 'luz' && accion === 'estado') edificio.luces[id] = v
    else if (sub === 'temp') edificio.temp[id.slice(1)] = v
    else if (sub === 'energia') edificio.energia[id.slice(1)] = v
    else if (sub === 'humo') edificio.humo[id] = v
  })
  return cliente
}

export function publicar(topico, valor) {
  conectarMqtt().publish(`${PREFIJO}/${topico}`, String(valor))
}

export function desconectarMqtt() {
  cliente?.end()
  cliente = null
  edificio.conectado = false
}
