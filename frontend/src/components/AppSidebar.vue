<template>
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div class="logo-icon"><i class="ti ti-grid-dots" /></div>
      <div class="logo-text">
        <div class="name">occuvision</div>
        <div class="sub">cmu | camt</div>
      </div>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-section-label">main</div>
      <router-link class="nav-item" to="/"><i class="ti ti-home" />home</router-link>
      <router-link class="nav-item" to="/rooms"><i class="ti ti-door" />rooms</router-link>
      <router-link class="nav-item" to="/analytics"><i class="ti ti-chart-bar" />analytics</router-link>
      <router-link class="nav-item" to="/alerts">
        <i class="ti ti-bell" />alerts
        <span v-if="alertCount > 0" class="nav-badge">{{ alertCount }}</span>
      </router-link>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-section-label">manage</div>
      <a class="nav-item" href="#">
        <i class="ti ti-camera" />cameras
        <span class="nav-badge">2</span>
      </a>
      <a class="nav-item" href="#"><i class="ti ti-user" />admin</a>
      <a class="nav-item" href="#"><i class="ti ti-settings" />settings</a>
    </div>

    <div class="sidebar-footer">
      <div class="avatar">mm</div>
      <div class="footer-text">
        <div class="name">manager mario</div>
        <div class="role">facility manager</div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { fetchAlerts } from '../api.js'

const alertCount = ref(0)

async function refreshBadge() {
  try {
    const alerts = await fetchAlerts()
    alertCount.value = alerts.filter(a => !a.acknowledged).length
  } catch {
    // backend not running yet — keep showing 0
  }
}

let timer
onMounted(() => { refreshBadge(); timer = setInterval(refreshBadge, 10000) })
onUnmounted(() => clearInterval(timer))
</script>

<style>
.nav-item.router-link-active {
  background: #f0f0ee;
  color: var(--color-text-primary);
  font-weight: 500;
}
</style>
