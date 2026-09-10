<template>
  <div class="main" style="display:contents">

    <div class="topbar">
      <div>
        <div class="topbar-title">{{ greeting }}, {{ username }}</div>
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

      <!-- ── Stat cards ─────────────────────────────────────────────────── -->
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
          <div class="stat-icon blue"><i class="ti ti-camera" /></div>
          <div class="stat-label">cameras online</div>
          <div class="stat-value">{{ stats.camerasOnline }}</div>
          <div class="stat-sub">of {{ cameras.length }} configured</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red"><i class="ti ti-alert-circle" /></div>
          <div class="stat-label">active alerts</div>
          <div class="stat-value">{{ stats.activeAlerts }}</div>
          <router-link to="/alerts" class="stat-link" style="text-decoration:none;">
            click for more details <i class="ti ti-arrow-right" style="font-size:12px" />
          </router-link>
        </div>
      </div>

      <!-- ── Live room status ───────────────────────────────────────────── -->
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
              <div class="room-name">{{ room.room_name }}</div>
              <span class="room-badge" :class="statusFor(room).badge">
                {{ statusFor(room).label }}
              </span>
            </div>
            <div class="room-loc">capacity limit: {{ room.capacity_limit }}</div>
            <div class="room-count">
              {{ room.occupancy_count ?? 0 }}
              <span>/ {{ room.capacity_limit }} max</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill"
                   :class="statusFor(room).fill"
                   :style="{ width: pct(room) + '%' }">
              </div>
            </div>
            <div class="room-meta">
              {{ room.camera_id ? 'cam ' + room.camera_id : 'no camera' }}
              &nbsp;·&nbsp; {{ timeAgo(room.recorded_at) }}
            </div>
          </div>
        </div>
      </div>

      <!-- ── Bottom grid: live alerts + camera status ───────────────────── -->
      <div class="bottom-grid">

        <!-- Live alerts (real data from /api/alerts) -->
        <div class="panel">
          <div class="panel-header">
            <span class="section-title">live alerts</span>
            <router-link to="/alerts" class="section-link" style="text-decoration:none;">
              view all <i class="ti ti-arrow-right" style="font-size:12px" />
            </router-link>
          </div>

          <div v-if="activeAlerts.length === 0"
               style="padding:16px 0; font-size:13px; color:var(--color-text-muted); text-align:center;">
            <i class="ti ti-circle-check" style="font-size:24px; display:block; margin-bottom:6px;" />
            no active alerts
          </div>

          <div class="feed-item" v-for="alert in activeAlerts" :key="alert.alert_id">
            <div class="feed-dot" :style="{ background: alertColor(alert.alert_type) }"></div>
            <div>
              <div class="feed-text">{{ alert.message }}</div>
              <div class="feed-time">{{ typeLabel(alert.alert_type) }} · {{ formatTime(alert.created_at) }}</div>
            </div>
          </div>
        </div>

        <!-- Camera status (real data from /api/cameras) -->
        <div class="panel">
          <div class="panel-header">
            <span class="section-title">camera status</span>
            <router-link to="/cameras" class="section-link" style="text-decoration:none;">
              manage <i class="ti ti-arrow-right" style="font-size:12px" />
            </router-link>
          </div>

          <div v-if="cameras.length === 0"
               style="padding:16px 0; font-size:13px; color:var(--color-text-muted); text-align:center;">
            no cameras configured
          </div>

          <div class="camera-item" v-for="cam in cameras" :key="cam.camera_id">
            <div class="cam-icon"><i class="ti ti-camera" /></div>
            <div>
              <div class="cam-name">{{ cam.camera_name }}</div>
              <div class="cam-loc">{{ roomName(cam.assigned_room_id) }}</div>
            </div>
            <span v-if="cam.status === 'online'" class="cam-live">live</span>
            <span v-else class="cam-live"
                  style="color:var(--color-danger); background:var(--color-danger-bg);">
              offline
            </span>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { fetchLatestOccupancy, fetchAlerts, fetchCameras, fetchRooms } from '../api.js'
import { usePolling } from '../other/usePolling.js'
import { getUser } from '../auth.js'

// ── User / clock ──────────────────────────────────────────────────────────
const storedUser = getUser()
const username = computed(() =>
  storedUser?.username || storedUser?.name || 'admin'
)

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

// ── Data ──────────────────────────────────────────────────────────────────
const rooms   = ref([])   // from /api/occupancy/latest — has room_name, occupancy_count
const roomList = ref([])  // from /api/rooms — used for camera room name lookup
const cameras = ref([])   // from /api/cameras — has status, camera_name, assigned_room_id
const alerts  = ref([])   // from /api/alerts
const apiOnline = ref(true)

// ── Computed ──────────────────────────────────────────────────────────────
const activeAlerts = computed(() =>
  alerts.value
    .filter(a => !a.is_resolved)
    .slice(0, 6) // cap at 6 so the panel doesn't overflow
)

const stats = computed(() => ({
  totalRooms:     rooms.value.length,
  occupiedRooms:  rooms.value.filter(r => (r.occupancy_count ?? 0) > 0).length,
  totalOccupants: rooms.value.reduce((s, r) => s + (r.occupancy_count ?? 0), 0),
  camerasOnline:  cameras.value.filter(c => c.status === 'online').length,
  activeAlerts:   activeAlerts.value.length,
}))

const statusText = computed(() =>
  apiOnline.value
    ? `system online · ${cameras.value.filter(c => c.status === 'online').length} cameras live`
    : 'system offline · check backend'
)

// ── Helpers ───────────────────────────────────────────────────────────────
function roomName(roomId) {
  if (!roomId) return 'unassigned'
  return roomList.value.find(r => r.room_id === roomId)?.room_name ?? `room ${roomId}`
}

function statusFor(room) {
  const p = pct(room)
  if (p >= 100) return { label: 'over capacity', badge: 'badge-danger',  fill: 'fill-danger' }
  if (p >= 85)  return { label: 'near capacity', badge: 'badge-warning', fill: 'fill-warning' }
  return              { label: 'normal',         badge: 'badge-success', fill: 'fill-success' }
}

function pct(room) {
  const cap = room.capacity_limit ?? 40
  return Math.min(100, Math.round(((room.occupancy_count ?? 0) / cap) * 100))
}

function timeAgo(ts) {
  if (!ts) return 'no data yet'
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000)
  if (mins < 1)   return 'just now'
  if (mins === 1) return '1 min ago'
  return `${mins} min ago`
}

function alertColor(type) {
  if (type === 'overcrowding')       return 'var(--color-danger)'
  if (type === 'near_capacity')      return 'var(--color-warning)'
  if (type === 'system_malfunction') return 'var(--color-accent)'
  return 'var(--color-text-muted)'
}

function typeLabel(type) {
  if (type === 'overcrowding')       return 'overcrowding'
  if (type === 'near_capacity')      return 'near capacity'
  if (type === 'system_malfunction') return 'system'
  return type ?? 'alert'
}

function formatTime(ts) {
  if (!ts) return '--'
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Refresh ───────────────────────────────────────────────────────────────
async function refresh() {
  try {
    const [occupancy, alertList, cameraList, allRooms] = await Promise.all([
      fetchLatestOccupancy().catch(() => []),
      fetchAlerts().catch(() => []),
      fetchCameras().catch(() => []),
      fetchRooms().catch(() => []),
    ])

    rooms.value    = occupancy
    roomList.value = allRooms
    cameras.value  = cameraList
    alerts.value   = alertList.map(a => ({
      ...a,
      is_resolved: Boolean(a.is_resolved),
      alert_type:  (a.alert_type ?? '').toLowerCase().trim(),
    }))

    apiOnline.value = true
  } catch {
    apiOnline.value = false
  }
}

usePolling(refresh, 5000)
</script>