import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'
import './styles/themes.css'
import './styles/legacy-theme.css'

// Import views
import UpcomingReleases from './views/UpcomingReleases.vue'
import Analytics from './views/Analytics.vue'
import Authors from './views/Authors.vue'

// Setup router
const routes = [
  { path: '/', name: 'Home', component: UpcomingReleases },
  { path: '/analytics', name: 'Analytics', component: Analytics },
  { path: '/authors', name: 'Authors', component: Authors },
  // Redirect old routes for compatibility
  { path: '/config', redirect: '/authors' },
  { path: '/search', redirect: '/' },
  { path: '/wishlist', redirect: '/authors' }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Setup Pinia for state management
const pinia = createPinia()

// Create and mount the app
const app = createApp(App)
app.use(pinia)
app.use(router)
app.mount('#app')
