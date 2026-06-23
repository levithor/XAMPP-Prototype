import { createRouter, createWebHistory } from 'vue-router'
import Home      from './pages/Home.vue'
import Analytics from './pages/Analytics.vue'
import Rooms     from './pages/Rooms.vue'

const routes = [
  { path: '/',          component: Home },
  { path: '/analytics', component: Analytics },
  { path: '/rooms',     component: Rooms },
]

export default createRouter({
  history: createWebHistory(),
  routes
})