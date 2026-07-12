<template>
  <div style="display:contents">

    <div class="topbar">
      <div>
        <div class="topbar-title">cameras</div>
        <div class="topbar-sub">{{ subtitle }}</div>
      </div>
      <button class="btn-primary" @click="openAddModal">
        <i class="ti ti-plus" /> add camera
      </button>
    </div>

    <div class="content">

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-icon blue"><i class="ti ti-camera" /></div>
          <div class="stat-label">total cameras</div>
          <div class="stat-value">{{ cameras.length }}</div>
          <div class="stat-sub">registered in system</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="ti ti-wifi" /></div>
          <div class="stat-label">online</div>
          <div class="stat-value">{{ onlineCount }}</div>
          <div class="stat-sub">currently active</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red"><i class="ti ti-wifi-off" /></div>
          <div class="stat-label">offline</div>
          <div class="stat-value">{{ offlineCount }}</div>
          <div class="stat-sub">not responding</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber"><i class="ti ti-door" /></div>
          <div class="stat-label">unassigned</div>
          <div class="stat-value">{{ unassignedCount }}</div>
          <div class="stat-sub">no room assigned</div>
        </div>
      </div>

      <div class="room-filters">
        <div
          v-for="f in filters" :key="f.key"
          class="filter-chip" :class="{ active: activeFilter === f.key }"
          @click="activeFilter = f.key">
          {{ f.label }}
        </div>
      </div>

      <div class="rooms-card-grid">
        <div
          v-for="cam in filteredCameras" :key="cam.camera_id"
          class="room-card" :class="accentFor(cam)">
          <div class="room-card-header">
            <div class="room-name">{{ cam.camera_name }}</div>
            <span class="room-badge" :class="statusBadge(cam)">{{ statusLabel(cam) }}</span>
          </div>
          <div class="room-loc">
            {{ roomName(cam.assigned_room_id) || 'unassigned' }}
          </div>
          <div class="cam-ip-row">
            <i class="ti ti-network" style="font-size:13px; color:var(--color-text-muted);" />
            <span class="cam-ip">{{ cam.ip_address || 'no ip address' }}</span>
          </div>
          <div class="room-card-footer">
            <span>last seen: {{ lastSeen(cam.last_communication) }}</span>
            <div class="room-card-actions">
              <i class="ti ti-edit" title="edit camera" @click="openEditModal(cam)" />
              <i class="ti ti-trash" title="delete camera" @click="confirmDelete(cam)" />
            </div>
          </div>
        </div>

        <div class="add-room-card" @click="openAddModal">
          <div class="inner">
            <i class="ti ti-plus" />
            <p>add a new camera</p>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <span class="section-title">all cameras</span>
        </div>
        <table class="rooms-table">
          <thead>
            <tr>
              <th>camera name</th>
              <th>ip address</th>
              <th>assigned room</th>
              <th>status</th>
              <th>last communication</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="cameras.length === 0">
              <td colspan="6" style="padding:16px 0; color:var(--color-text-muted); font-size:13px;">
                no cameras configured yet
              </td>
            </tr>
            <tr v-for="cam in cameras" :key="'tr-' + cam.camera_id">
              <td>{{ cam.camera_name }}</td>
              <td class="muted">{{ cam.ip_address || '--' }}</td>
              <td class="muted">{{ roomName(cam.assigned_room_id) || 'unassigned' }}</td>
              <td>
                <span class="room-badge" :class="statusBadge(cam)">{{ statusLabel(cam) }}</span>
              </td>
              <td class="muted">{{ lastSeen(cam.last_communication) }}</td>
              <td class="row-actions">
                <i class="ti ti-edit" title="edit" @click="openEditModal(cam)" style="margin-right:10px; cursor:pointer;" />
                <i class="ti ti-trash" title="delete" @click="confirmDelete(cam)" style="cursor:pointer;" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-box">
        <div class="modal-header">
          <span>{{ editingCamera ? 'edit camera' : 'add camera' }}</span>
          <i class="ti ti-x" @click="closeModal" style="cursor:pointer; color:var(--color-text-muted);" />
        </div>

        <div class="modal-fields">
          <div class="modal-field">
            <label>camera name</label>
            <input v-model="form.camera_name" placeholder="e.g. CAM-301" />
          </div>
          <div class="modal-field">
            <label>ip address</label>
            <input v-model="form.ip_address" placeholder="e.g. 192.168.1.101" />
          </div>
          <div class="modal-field">
            <label>status</label>
            <select v-model="form.status" class="modal-select">
              <option value="online">online</option>
              <option value="offline">offline</option>
            </select>
          </div>
          <div class="modal-field">
            <label>assign to room</label>
            <select v-model="form.assigned_room_id" class="modal-select">
              <option :value="null">— unassigned —</option>
              <option v-for="room in rooms" :key="room.room_id" :value="room.room_id">
                {{ room.room_name }}
              </option>
            </select>
          </div>
        </div>

        <p v-if="modalError" style="font-size:12px; color:var(--color-danger); margin-top:10px;">{{ modalError }}</p>

        <div class="modal-actions">
          <button class="btn-cancel" @click="closeModal">cancel</button>
          <button class="btn-primary" @click="submitModal">
            {{ editingCamera ? 'save changes' : 'add camera' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { fetchCameras, addCamera, updateCamera, deleteCamera, fetchRooms } from '../api.js'
import { usePolling } from '../other/usePolling.js'

const cameras = ref([])
const rooms   = ref([])
const activeFilter = ref('all')
const showModal    = ref(false)
const editingCamera = ref(null)
const modalError   = ref('')

const form = ref({
  camera_name:      '',
  ip_address:       '',
  status:           'online',
  assigned_room_id: null,
})

const filters = [
  { key: 'all',        label: 'all cameras' },
  { key: 'online',     label: 'online' },
  { key: 'offline',    label: 'offline' },
  { key: 'unassigned', label: 'unassigned' },
]

const onlineCount    = computed(() => cameras.value.filter(c => c.status === 'online').length)
const offlineCount   = computed(() => cameras.value.filter(c => c.status === 'offline').length)
const unassignedCount = computed(() => cameras.value.filter(c => !c.assigned_room_id).length)

const subtitle = computed(() =>
  `${cameras.value.length} camera${cameras.value.length !== 1 ? 's' : ''} configured · ${onlineCount.value} online`
)

const filteredCameras = computed(() => {
  if (activeFilter.value === 'all')        return cameras.value
  if (activeFilter.value === 'unassigned') return cameras.value.filter(c => !c.assigned_room_id)
  return cameras.value.filter(c => c.status === activeFilter.value)
})

function statusLabel(cam) {
  return cam.status === 'online' ? 'online' : 'offline'
}

function statusBadge(cam) {
  return cam.status === 'online' ? 'badge-success' : 'badge-danger'
}

function accentFor(cam) {
  return cam.status === 'online' ? 'accent-success' : 'accent-danger'
}

function roomName(roomId) {
  if (!roomId) return null
  return rooms.value.find(r => r.room_id === roomId)?.room_name ?? `room ${roomId}`
}

function lastSeen(ts) {
  if (!ts) return 'never'
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000)
  if (mins < 1)  return 'just now'
  if (mins === 1) return '1 min ago'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return new Date(ts).toLocaleDateString()
}

async function refresh() {
  try {
    const [camList, roomList] = await Promise.all([
      fetchCameras(),
      fetchRooms(),
    ])
    cameras.value = camList
    rooms.value   = roomList
  } catch (err) {
    console.warn('Cameras refresh failed:', err.message)
  }
}

usePolling(refresh, 10000)

function openAddModal() {
  editingCamera.value = null
  form.value = { camera_name: '', ip_address: '', status: 'online', assigned_room_id: null }
  modalError.value = ''
  showModal.value = true
}

function openEditModal(cam) {
  editingCamera.value = cam
  form.value = {
    camera_name:      cam.camera_name      || '',
    ip_address:       cam.ip_address       || '',
    status:           cam.status           || 'online',
    assigned_room_id: cam.assigned_room_id ?? null,
  }
  modalError.value = ''
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingCamera.value = null
}

async function submitModal() {
  modalError.value = ''
  if (!form.value.camera_name.trim()) {
    modalError.value = 'camera name is required'
    return
  }
  try {
    if (editingCamera.value) {
      await updateCamera(editingCamera.value.camera_id, {
        camera_name:      form.value.camera_name,
        ip_address:       form.value.ip_address,
        status:           form.value.status,
        assigned_room_id: form.value.assigned_room_id,
      })
    } else {
      await addCamera({
        camera_name:      form.value.camera_name,
        ip_address:       form.value.ip_address,
        status:           form.value.status,
        assigned_room_id: form.value.assigned_room_id,
      })
    }
    closeModal()
    await refresh()
  } catch (err) {
    modalError.value = `error: ${err.message}`
  }
}

async function confirmDelete(cam) {
  if (!confirm(`delete "${cam.camera_name}"?`)) return
  try { await deleteCamera(cam.camera_id); await refresh() }
  catch (err) { alert(`could not delete camera: ${err.message}`) }
}
</script>

<style>
@import '../assets/cameras.css';
</style>