import { createRouter, createWebHistory } from 'vue-router'
import Home      from './pages/Home.vue'
import Analytics from './pages/Analytics.vue'
import Rooms     from './pages/Rooms.vue'
import Alerts    from './pages/Alerts.vue'

const routes = [
  { path: '/',          component: Home },
  { path: '/analytics', component: Analytics },
  { path: '/rooms',     component: Rooms },
  { path: '/alerts',    component: Alerts },
]

export default createRouter({
  history: createWebHistory(),
  routes
})