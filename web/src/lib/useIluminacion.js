// Lógica compartida de iluminación (HU-10): zonas, cambio de estado y bitácora
import { ref, computed } from 'vue'
import { supabase } from './supabase'
import { edificio, publicar } from './mqtt'
import { useAuth } from '../stores/auth'

const zonas = ref([])
const bitacora = ref([])
const pendientes = ref({})
let cargadas = false

export function useIluminacion() {
  const auth = useAuth()
  const puedeControlar = computed(() => ['admin', 'operador'].includes(auth.rol))
  const porPiso = computed(() => {
    const g = {}
    for (const z of zonas.value) (g[z.piso] ??= []).push(z)
    return g
  })

  async function cargarZonas(forzar = false) {
    if (cargadas && !forzar) return
    const { data } = await supabase.from('zonas').select('*').order('piso').order('id')
    zonas.value = data ?? []
    cargadas = true
  }

  async function cargarBitacora(limite = 10) {
    const { data } = await supabase
      .from('bitacora_iluminacion')
      .select('id, estado, fecha, zonas(nombre, piso), perfiles(nombre)')
      .order('fecha', { ascending: false })
      .limit(limite)
    bitacora.value = data ?? []
  }

  async function cambiar(zona) {
    if (!puedeControlar.value || pendientes.value[zona.clave] === true) return
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

  return { zonas, porPiso, bitacora, pendientes, puedeControlar, cargarZonas, cargarBitacora, cambiar }
}
