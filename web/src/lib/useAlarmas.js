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
      const atencion = { atendida_en: new Date().toISOString(), atendida_por: auth.usuario.id, nota: nota || null }
      // Si el simulador ya la registró al detectarla, se actualiza ese registro; si no, se crea
      const { data: abierta } = await supabase.from('alarmas').select('id')
        .eq('zona_id', zona.id).is('atendida_en', null).order('inicio', { ascending: false }).limit(1).maybeSingle()
      const { error } = abierta
        ? await supabase.from('alarmas').update(atencion).eq('id', abierta.id)
        : await supabase.from('alarmas').insert({ zona_id: zona.id, tipo: 'humo', inicio, ...atencion })
      if (error) return error.message
    }
    atenderHumo(clave)
    return null
  }

  // Prueba de detector: lo dispara el simulador (que además la registra);
  // si el simulador no está corriendo, la web publica la alarma directamente
  const simularHumo = (clave) => {
    publicar(`${clave}/humo/simular`, '1')
    setTimeout(() => { if (!edificio.humo[clave]) publicar(`${clave}/humo`, 'alarma') }, 2000)
  }

  return { atender, simularHumo }
}
