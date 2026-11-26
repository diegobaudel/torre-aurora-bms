// Alarmas (HU-15): atender una alarma la guarda en la base con quién y cuándo
import { supabase } from './supabase'
import { atenderHumo, edificio, publicar } from './mqtt'
import { useIluminacion } from './useIluminacion'
import { useAuth } from '../stores/auth'

export function useAlarmas() {
  const auth = useAuth()
  const { zonas, cargarZonas } = useIluminacion()

  async function atender(clave, nota = '') {
    await cargarZonas()
    const zona = zonas.value.find((z) => z.clave === clave)
    const inicio = edificio.humo[clave] ?? new Date().toISOString()
    if (zona) {
      const { error } = await supabase.from('alarmas').insert({
        zona_id: zona.id, tipo: 'humo', inicio, atendida_en: new Date().toISOString(),
        atendida_por: auth.usuario.id, nota: nota || null,
      })
      if (error) return error.message
    }
    atenderHumo(clave)
    return null
  }

  // Para demostrar la alerta sin esperar al simulador
  const simularHumo = (clave) => publicar(`${clave}/humo`, 'alarma')

  return { atender, simularHumo }
}
