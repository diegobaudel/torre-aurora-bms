import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuth } from './stores/auth'
import './style.css'

const app = createApp(App)
app.use(createPinia())

// Carga la sesión antes de montar para que el guard de rutas ya la conozca
await useAuth().iniciar()

app.use(router)
app.mount('#app')
