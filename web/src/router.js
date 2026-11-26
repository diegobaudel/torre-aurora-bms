import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from './stores/auth'

const routes = [
  { path: '/login', component: () => import('./views/Login.vue'), meta: { publica: true } },
  { path: '/', component: () => import('./views/Dashboard.vue') },
  { path: '/iluminacion', component: () => import('./views/Iluminacion.vue') },
  { path: '/climatizacion', component: () => import('./views/Climatizacion.vue') },
  { path: '/energia', component: () => import('./views/Energia.vue') },
  { path: '/seguridad', component: () => import('./views/Seguridad.vue') },
  { path: '/accesos', component: () => import('./views/Accesos.vue'), meta: { roles: ['admin', 'operador', 'recepcion'] } },
  { path: '/usuarios', component: () => import('./views/Usuarios.vue'), meta: { roles: ['admin'] } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({ history: createWebHistory(), routes })

// HU-01: nadie entra sin sesión; cada rol ve solo lo suyo (HU-02)
router.beforeEach((to) => {
  const auth = useAuth()
  if (to.meta.publica) return auth.usuario ? '/' : true
  if (!auth.usuario) return '/login'
  if (to.meta.roles && !to.meta.roles.includes(auth.rol)) return '/'
  return true
})

export default router
