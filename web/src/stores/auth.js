import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase'

// Traduce los errores de Supabase a mensajes claros (HU-01)
function mensajeError(error) {
  const m = error?.message ?? ''
  if (m === 'Invalid login credentials') return 'Correo o contraseña incorrectos'
  if (m.includes('Email not confirmed')) return 'El usuario no está confirmado; pide al administrador que lo active'
  if (m.includes('Invalid API key') || m.includes('apikey')) return 'La llave de Supabase no es válida; revisa VITE_SUPABASE_ANON_KEY en el .env'
  if (m.includes('Failed to fetch')) return 'No hay conexión con Supabase; revisa la URL en el .env o tu internet'
  return `No se pudo iniciar sesión: ${m}`
}

export const useAuth = defineStore('auth', {
  state: () => ({ usuario: null, perfil: null, listo: false }),
  getters: {
    rol: (s) => s.perfil?.rol,
    esAdmin: (s) => s.perfil?.rol === 'admin',
    iniciales: (s) => (s.perfil?.nombre ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase(),
  },
  actions: {
    async iniciar() {
      const { data } = await supabase.auth.getSession()
      await this.cargar(data.session?.user ?? null)
      supabase.auth.onAuthStateChange((_e, session) => this.cargar(session?.user ?? null))
      this.listo = true
    },
    async cargar(usuario) {
      this.usuario = usuario
      if (!usuario) { this.perfil = null; return }
      const { data } = await supabase.from('perfiles').select('*').eq('id', usuario.id).single()
      this.perfil = data
    },
    async login(correo, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: correo, password })
      if (error) throw new Error(mensajeError(error))
      await this.cargar(data.user)
      if (!this.perfil?.activo) {
        await this.logout()
        throw new Error('Tu usuario está desactivado')
      }
    },
    async logout() {
      await supabase.auth.signOut()
      this.usuario = null
      this.perfil = null
    },
  },
})
