<template>
  <div class="main" style="display:contents">

    <div class="topbar">
      <div>
        <div class="topbar-title">{{ greeting }}, mario</div>
        <div class="topbar-sub">{{ datetime }}</div>
      </div>
      <div class="topbar-status">
        <div class="status-dot">
          <span class="dot" :style="{ background: apiOnline ? 'var(--color-success)' : 'var(--color-danger)' }"></span>
          {{ statusText }}
        </div>
        <i class="ti ti-bell" style="font-size:18px; color:var(--color-text-muted); cursor:pointer;" />
      </div>
    </div>

    <div class="content">

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-icon blue"><i class="ti ti-layout-grid" /></div>
          <div class="stat-label">rooms monitored</div>
          <div class="stat-value">{{ stats.totalRooms }}</div>
          <div class="stat-sub">{{ stats.occupiedRooms }} currently occupied</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="ti ti-user" /></div>
          <div class="stat-label">total occupants now</div>
          <div class="stat-value">{{ stats.totalOccupants }}</div>
          <div class="stat-sub">across all active rooms</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber"><i class="ti ti-clock" /></div>
          <div class="stat-label">peak hour today</div>
          <div class="stat-value">10am</div>
          <div class="stat-sub">avg 84% utilization</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red"><i class="ti ti-alert-circle" /></div>
          <div class="stat-label">active alerts</div>
          <div class="stat-value">{{ stats.activeAlerts }}</div>
          <router-link to="/analytics" class="stat-link" style="text-decoration:none;">
            click for more details <i class="ti ti-arrow-right" style="font-size:12px" />
          </router-link>
        </div>
      </div>

      <div>
        <div class="section-header">
          <span class="section-title">live room status</span>
          <router-link to="/rooms" class="section-link" style="text-decoration:none;">
            see all rooms <i class="ti ti-arrow-right" style="font-size:12px" />
          </router-link>
        </div>
        <div class="room-grid">
          <div v-for="room in rooms" :key="room.room_id" class="room-card">
            <div class="room-card-header">
              <div class="room-name">{{ room.name }}</div>
              <span class="room-badge" :class="statusFor(room).badge">
                {{ statusFor(room).label }}
              </span>
            </div>
            <div class="room-loc">{{ [room.building, room.floor].filter(Boolean).join(' | ') }}</div>
            <div class="room-count">
              {{ room.occupancy_count ?? 0 }} <span>/ {{ room.capacity }} max</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :class="statusFor(room).fill"
                   :style="{ width: pct(room) + '%' }"></div>
            </div>
            <div class="room-meta">
              {{ room.camera_id || 'no camera' }} &nbsp;·&nbsp; {{ timeAgo(room.timestamp) }}
            </div>
          </div>
        </div>
      </div>

      <div class="bottom-grid">

        <div class="panel">
          <div class="panel-header">
            <span class="section-title">activity feed</span>
            <span class="section-link">view all <i class="ti ti-arrow-right" style="font-size:12px" /></span>
          </div>
          <div class="feed-item" v-for="item in feed" :key="item.text">
            <div class="feed-dot" :style="{ background: item.color }"></div>
            <div>
              <div class="feed-text">{{ item.text }}</div>
              <div class="feed-time">{{ item.time }}</div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <span class="section-title">camera status</span>
            <router-link to="/rooms" class="section-link" style="text-decoration:none;">
              manage <i class="ti ti-arrow-right" style="font-size:12px" />
            </router-link>
          </div>
          <div class="camera-item" v-for="room in rooms" :key="'cam-' + room.room_id">
            <div class="cam-icon"><i class="ti ti-camera" /></div>
            <div>
              <div class="cam-name">{{ room.camera_id || 'no camera' }}</div>
              <div class="cam-loc">{{ room.name }} | {{ room.floor }}</div>
            </div>
            <span class="cam-live">live</span>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { fetchLatestOccupancy, fetchAlerts } from '../api.js'
import { usePolling } from '../other/usePolling.js'

const datetime = ref('')
const greeting = ref('good morning')

function updateDateTime() {
  const now = new Date()
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const h = now.getHours()
  const m = String(now.getMinutes()).padStart(2,'0')
  const h12 = h % 12 || 12
  const ampm = h >= 12 ? 'PM' : 'AM'
  datetime.value = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} · ${String(h12).padStart(2,'0')}:${m}${ampm}`
  greeting.value = h < 12 ? 'good morning' : h < 17 ? 'good afternoon' : 'good evening'
}

let clockTimer
onMounted(() => { updateDateTime(); clockTimer = setInterval(updateDateTime, 60000) })
onUnmounted(() => clearInterval(clockTimer))

const rooms = ref([])
const apiOnline = ref(true)
const activeAlertCount = ref(0)

const statusText = computed(() =>
  apiOnline.value
    ? `system online · ${rooms.value.length} cameras configured`
    : 'system offline · check backend'
)

const stats = computed(() => ({
  totalRooms:    rooms.value.length,
  occupiedRooms: rooms.value.filter(r => (r.occupancy_count ?? 0) > 0).length,
  totalOccupants: rooms.value.reduce((s, r) => s + (r.occupancy_count ?? 0), 0),
  activeAlerts:  activeAlertCount.value,
}))

async function refresh() {
  try {
    rooms.value = await fetchLatestOccupancy()
    apiOnline.value = true
  } catch {
    apiOnline.value = false
  }
  try {
    const alerts = await fetchAlerts()
    activeAlertCount.value = alerts.filter(a => !Boolean(a.is_resolved)).length
  } catch {}
}

usePolling(refresh, 5000)

function statusFor(room) {
  const pct = ((room.occupancy_count ?? 0) / (room.capacity ?? 40)) * 100
  if (pct >= 100) return { label: 'over capacity', badge: 'badge-danger', fill: 'fill-danger' }
  if (pct >= 85)  return { label: 'near capacity', badge: 'badge-warning', fill: 'fill-warning' }
  return { label: 'normal', badge: 'badge-success', fill: 'fill-success' }
}

function pct(room) {
  return Math.min(100, Math.round(((room.occupancy_count ?? 0) / (room.capacity ?? 40)) * 100))
}

function timeAgo(ts) {
  if (!ts) return 'no data yet'
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins === 1) return '1 min ago'
  return `${mins} min ago`
}

const feed = [
  { text: 'room 301 exceeded capacity — 48 of 40', time: '02:46 today', color: 'var(--color-danger)' },
  { text: 'room 205 approaching capacity threshold',  time: '02:45 today', color: 'var(--color-warning)' },
  { text: 'room 205 — unusual activity outside normal hours', time: '12:55 today', color: 'var(--color-warning)' },
  { text: 'room 301 returned to normal occupancy', time: '08:30 today', color: 'var(--color-success)' },
  { text: 'system started — all cameras connected', time: '07:00 today', color: 'var(--color-accent)' },
]
</script>