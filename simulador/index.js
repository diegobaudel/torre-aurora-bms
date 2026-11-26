// T-01 Simulador de sensores de la Torre Aurora (sin hardware real)
// Publica lecturas por MQTT y responde a los comandos de iluminación.
import 'dotenv/config'
import mqtt from 'mqtt'
import { createClient } from '@supabase/supabase-js'

const BROKER = process.env.MQTT_URL ?? 'mqtt://broker.hivemq.com:1883'
const P = process.env.MQTT_PREFIX ?? 'torre-aurora-e5'
const INTERVALO = Number(process.env.INTERVALO_MS ?? 5000)
const PISOS = 5
const ZONAS_POR_PISO = 2

// Estado simulado del edificio
const luces = {}       // { p1z1: 'off', ... }
const temp = {}        // { 1: 23.4, ... }
const objetivo = {}    // temperatura objetivo por piso (HU-08, Sprint 2)
for (let p = 1; p <= PISOS; p++) {
  temp[p] = 22 + Math.random() * 3
  objetivo[p] = 23
  for (let z = 1; z <= ZONAS_POR_PISO; z++) luces[`p${p}z${z}`] = Math.random() > 0.5 ? 'on' : 'off'
}

// Guardado opcional en Supabase (necesita la service role key, nunca la pongas en el front)
const db = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null
const acumulado = {}   // { piso: { temps: [], kwh: 0, luz: 0 } }

const cliente = mqtt.connect(BROKER, {
  clientId: `sim-${P}-${Math.random().toString(16).slice(2, 8)}`,
  // Si el proceso muere sin avisar (se cierra la terminal), el broker publica que quedó fuera de línea
  will: { topic: `${P}/sim/estado`, payload: JSON.stringify({ online: false }), retain: true, qos: 1 },
})

const pub = (topico, valor, retain = false) =>
  cliente.publish(`${P}/${topico}`, typeof valor === 'string' ? valor : JSON.stringify(valor), { retain })

cliente.on('connect', () => {
  console.log(`Conectado a ${BROKER} | prefijo "${P}"`)
  // Comandos desde la web
  cliente.subscribe(`${P}/+/luz/set`)
  cliente.subscribe(`${P}/+/hvac/set`)
  // Estado inicial (retained: la web lo recibe al conectarse)
  for (const [zona, estado] of Object.entries(luces)) pub(`${zona}/luz/estado`, estado, true)
  pub('sim/estado', { online: true, desde: new Date().toISOString() }, true)
})

cliente.on('message', (topico, buf) => {
  const partes = topico.split('/')       // [prefijo, zona|piso, subsistema, accion]
  const id = partes[1]
  const valor = buf.toString().trim()

  if (partes[2] === 'luz' && luces[id] !== undefined && ['on', 'off'].includes(valor)) {
    // Pequeño retardo para que parezca un equipo real
    setTimeout(() => {
      luces[id] = valor
      pub(`${id}/luz/estado`, valor, true)
      console.log(`Luz ${id} -> ${valor}`)
    }, 300)
  }

  if (partes[2] === 'hvac') {
    const piso = Number(id.replace('p', ''))
    const t = Number(valor)
    if (objetivo[piso] !== undefined && t >= 18 && t <= 28) {
      objetivo[piso] = t
      pub(`p${piso}/hvac/objetivo`, String(t), true)
      console.log(`HVAC piso ${piso} objetivo -> ${t} °C`)
    }
  }
})

// Lecturas periódicas
setInterval(() => {
  for (let p = 1; p <= PISOS; p++) {
    // La temperatura tiende al objetivo con algo de ruido
    temp[p] += (objetivo[p] - temp[p]) * 0.1 + (Math.random() - 0.5) * 0.4
    pub(`p${p}/temp`, temp[p].toFixed(1))

    // Consumo: base + luces encendidas del piso
    const lucesOn = Object.entries(luces).filter(([k, v]) => k.startsWith(`p${p}z`) && v === 'on').length
    const kwh = 2 + lucesOn * 0.8 + Math.random()
    pub(`p${p}/energia`, kwh.toFixed(2))

    const a = (acumulado[p] ??= { temps: [], kwh: 0, luz: 0 })
    a.temps.push(temp[p]); a.kwh += kwh; a.luz += lucesOn * 0.8
  }
}, INTERVALO)

// Cada minuto guarda un resumen por piso en la tabla lecturas
if (db) {
  console.log('Guardando lecturas en Supabase cada minuto')
  setInterval(async () => {
    const filas = Object.entries(acumulado).map(([piso, a]) => {
      const resto = Math.max(a.kwh - a.luz, 0)
      return {
        piso: Number(piso),
        temp: Number((a.temps.reduce((x, y) => x + y, 0) / a.temps.length).toFixed(1)),
        energia_total: Number(a.kwh.toFixed(2)),
        energia_iluminacion: Number(a.luz.toFixed(2)),
        energia_hvac: Number((resto * 0.6).toFixed(2)),
        energia_otros: Number((resto * 0.4).toFixed(2)),
      }
    })
    for (const k of Object.keys(acumulado)) delete acumulado[k]
    if (!filas.length) return
    const { error } = await db.from('lecturas').insert(filas)
    if (error) console.error('No se pudieron guardar las lecturas:', error.message)
  }, 60000)
}

// Prueba de alarma de humo (HU-15, Sprint 2): node index.js --humo p3z2
const iHumo = process.argv.indexOf('--humo')
if (iHumo > -1) {
  const zona = process.argv[iHumo + 1] ?? 'p1z1'
  setTimeout(() => { pub(`${zona}/humo`, 'alarma'); console.log(`¡Humo simulado en ${zona}!`) }, 3000)
}

process.on('SIGINT', () => { pub('sim/estado', { online: false }, true); cliente.end(false, () => process.exit(0)) })
