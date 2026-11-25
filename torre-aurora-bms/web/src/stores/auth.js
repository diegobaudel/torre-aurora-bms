import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase'

export const useAuth = defineStore('auth', {
  state: () => ({ usuario: null, perfil: null, listo: false }),
  getters: {
    rol: (s) => s.perfil?.rol,
    esAdmin: (s) => s.perfil?.rol === 'admin',
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
      if (error) throw new Error('Correo o contraseña incorrectos')
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
