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
      <router-link class="nav-item" to="/cameras"><i class="ti ti-camera" />cameras</router-link>
      <a class="nav-item" href="#"><i class="ti ti-user" />admin</a>
      <a class="nav-item" href="#"><i class="ti ti-settings" />settings</a>
    </div>

    <div class="sidebar-footer">
      <div class="avatar">{{ initials }}</div>
      <div class="footer-text" style="flex:1; min-width:0;">
        <div class="name">{{ displayName }}</div>
        <div class="role">{{ displayRole }}</div>
      </div>
      <button class="logout-btn" title="sign out" @click="$emit('logout')">
        <i class="ti ti-logout" />
      </button>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { fetchAlerts } from '../api.js'

const props = defineProps({
  user: { type: Object, default: null }
})
defineEmits(['logout'])

const displayName = computed(() =>
  props.user?.username || props.user?.name || 'admin'
)

const displayRole = computed(() =>
  props.user?.role || 'facility manager'
)

const initials = computed(() => {
  const name = displayName.value
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toLowerCase() || 'ad'
})

const alertCount = ref(0)

async function refreshBadge() {
  try {
    const alerts = await fetchAlerts()
    alertCount.value = alerts.filter(a => !Boolean(a.is_resolved)).length
  } catch {}
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

.logout-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: 17px;
  display: flex;
  align-items: center;
  padding: 4px;
  border-radius: 6px;
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s;
}

.logout-btn:hover {
  color: var(--color-danger);
  background: var(--color-danger-bg);
}
</style>