import { createRouter, createWebHistory } from 'vue-router'
import Home      from './pages/Home.vue'
import Analytics from './pages/Analytics.vue'
import Rooms     from './pages/Rooms.vue'
import Alerts    from './pages/Alerts.vue'
import Login     from './pages/Login.vue'
import Register  from './pages/Register.vue'
import { isAuthenticated } from './auth.js'

const routes = [
  { path: '/login',    component: Login,    meta: { public: true } },
  { path: '/register', component: Register, meta: { public: true } },
  { path: '/',          component: Home },
  { path: '/analytics', component: Analytics },
  { path: '/rooms',     component: Rooms },
  { path: '/alerts',    component: Alerts },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  if (to.meta.public) {
    if (isAuthenticated()) return next('/')  
    return next()
  }
  if (!isAuthenticated()) return next('/login')
  next()
})

export default router