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
          <div class="stat-label">RTSP online</div>
          <div class="stat-value">{{ onlineCount }}</div>
          <div class="stat-sub">RTSP / YOLO data in last 5 min</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red"><i class="ti ti-wifi-off" /></div>
          <div class="stat-label">RTSP offline</div>
          <div class="stat-value">{{ offlineCount }}</div>
          <div class="stat-sub">no RTSP data in 5+ min</div>
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
            <span class="room-badge" :class="sourceBadge(cam)">{{ sourceLabel(cam) }}</span>
          </div>
          <div class="camera-connection-state">
            requested: <strong>{{ desiredStateLabel(cam) }}</strong>
            <span v-if="isDahua(cam)"> · sync: {{ synchronizationLabel(cam) }}</span>
            <span v-else> · data: {{ cam.status }}</span>
          </div>
          <div class="room-loc">
            {{ roomName(cam.assigned_room_id) || 'unassigned' }}
          </div>
          <div class="cam-ip-row">
            <i class="ti ti-cast" style="font-size:13px; color:var(--color-text-muted);" />
            <span class="cam-ip">{{ cameraMappingLabel(cam) }}</span>
          </div>
          <div v-if="isDahua(cam)" class="camera-external-state">
            <strong>{{ externalOccupancyLabel(cam) }}</strong>
            <span v-if="cam.synchronization_error_code" class="camera-connection-error">
              sync error: {{ cam.synchronization_error_code }}
            </span>
          </div>
          <div class="room-card-footer">
            <span v-if="isDahua(cam)">last sync: {{ lastSeen(cam.last_successful_sync_at) }}</span>
            <span v-else>last data: {{ lastSeen(cam.last_communication) }}</span>
            <div class="room-card-actions">
              <i class="ti ti-edit" title="edit camera" @click="openEditModal(cam)" />
              <i class="ti ti-trash" title="delete camera" @click="confirmDelete(cam)" />
            </div>
          </div>
          <div class="camera-connection-actions">
            <button
              class="camera-connection-button"
              :disabled="connectionPending[cam.camera_id]"
              @click="toggleConnection(cam)"
            >
              {{ connectionPending[cam.camera_id] ? 'please wait…' : (isDesiredConnected(cam) ? 'disconnect' : 'connect') }}
            </button>
            <p v-if="connectionErrors[cam.camera_id]" class="camera-connection-error">
              {{ connectionErrors[cam.camera_id] }}
            </p>
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
              <th>source / mapping</th>
              <th>assigned room</th>
              <th>occupancy / sync</th>
              <th>requested</th>
              <th>last data / sync</th>
              <th>connection</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="cameras.length === 0">
              <td colspan="8" style="padding:16px 0; color:var(--color-text-muted); font-size:13px;">
                no cameras configured yet
              </td>
            </tr>
            <tr v-for="cam in cameras" :key="'tr-' + cam.camera_id">
              <td>{{ cam.camera_name }}</td>
              <td class="muted">{{ cameraMappingLabel(cam) }}</td>
              <td class="muted">{{ roomName(cam.assigned_room_id) || 'unassigned' }}</td>
              <td>
                <template v-if="isDahua(cam)">
                  {{ externalOccupancyLabel(cam) }}<br />
                  <span class="muted">sync {{ synchronizationLabel(cam) }}</span>
                  <span v-if="cam.synchronization_error_code" class="camera-connection-error">
                    {{ cam.synchronization_error_code }}
                  </span>
                </template>
                <span v-else class="room-badge" :class="statusBadge(cam)">RTSP {{ cam.status }}</span>
              </td>
              <td>{{ desiredStateLabel(cam) }}</td>
              <td class="muted">
                {{ lastSeen(isDahua(cam) ? cam.last_successful_sync_at : cam.last_communication) }}
              </td>
              <td>
                <button
                  class="camera-connection-button"
                  :disabled="connectionPending[cam.camera_id]"
                  @click="toggleConnection(cam)"
                >
                  {{ connectionPending[cam.camera_id] ? 'please wait…' : (isDesiredConnected(cam) ? 'disconnect' : 'connect') }}
                </button>
                <div v-if="connectionErrors[cam.camera_id]" class="camera-connection-error">
                  {{ connectionErrors[cam.camera_id] }}
                </div>
              </td>
              <td class="row-actions">
                <i class="ti ti-edit" title="edit" @click="openEditModal(cam)" style="margin-right:10px; cursor:pointer;" />
                <i class="ti ti-trash" title="delete" @click="confirmDelete(cam)" style="cursor:pointer;" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>

    <!-- add / edit modal HERE HERE HERE HERE -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-box">
        <div class="modal-header">
          <span>{{ editingCamera ? 'edit camera' : 'add camera' }}</span>
          <i class="ti ti-x" @click="closeModal" style="cursor:pointer; color:var(--color-text-muted);" />
        </div>

        <!-- ── add new inputs here HERE HERE HERE HERE── -->
        <div class="modal-fields">
          <div class="modal-field">
            <label>camera name</label>
            <input
              v-model="form.camera_name"
              placeholder="e.g. CAM-301"
            />
          </div>
          <div class="modal-field">
            <label>assign to room</label>
            <select v-model.number="form.assigned_room_id" class="modal-select">
              <option :value="null">— unassigned —</option>

              <option
                v-for="room in rooms"
                :key="room.room_id"
                :value="room.room_id"
              >
                {{ room.room_name }}
              </option>
            </select>
          </div>
           <div class="modal-field">
            <label>connection type</label>

            <div class="connection-toggle">

              <button
                type="button"
                class="connection-option"
                :class="{ active: form.source_type === 'rtsp_yolo' }"
                @click="form.source_type = 'rtsp_yolo'"
              >
                RTSP
              </button>

              <button
                type="button"
                class="connection-option"
                :class="{ active: form.source_type === 'dahua_external' }"
                @click="form.source_type = 'dahua_external'"
              >
                Dahua
              </button>

            </div>
          </div>
          <template v-if="form.source_type === 'rtsp_yolo'">

            <div class="modal-field">
              <label>rtsp url</label>

              <input
                v-model="form.rtsp_url"
                :placeholder="editingCamera ? 'leave blank to keep the current RTSP URL' : 'rtsp://192.168.1.101:554/stream'"
                autocomplete="off"
                spellcheck="false"
              />
              <small v-if="editingCamera" class="rtsp-edit-hint">
                The saved URL is hidden to protect credentials. Enter a new URL only to replace it.
              </small>
            </div>

          </template>
          <template v-else>

            <div class="modal-field">
              <label>XAMPP camera ID</label>
              <input
                v-model="form.external_camera_id"
                maxlength="64"
                placeholder="exact camera_id from the XAMPP API"
              />
            </div>

            <div class="modal-field">
              <label>XAMPP area ID</label>
              <input
                v-model="form.external_area_id"
                maxlength="128"
                placeholder="exact area_id from the XAMPP API"
              />
            </div>
            <small class="rtsp-edit-hint">
              Assign a room above. These IDs must match the registration returned by the XAMPP API. The XAMPP server URL and API key are configured in the backend, not here.
            </small>
            <small v-if="editingCamera && isDahua(editingCamera)" class="rtsp-edit-hint">
              Saving a changed mapping or room disconnects synchronization; reconnect the camera after saving.
            </small>

          </template>
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
import { fetchCameras, addCamera, updateCamera, setCameraConnection, deleteCamera, fetchRooms } from '../api.js'
import { useToast } from '../other/useToast.js'
import { usePolling } from '../other/usePolling.js'

const cameras       = ref([])
const rooms         = ref([])
const activeFilter  = ref('all')
const showModal     = ref(false)
const editingCamera = ref(null)
const modalError    = ref('')
const connectionPending = ref({})
const connectionErrors = ref({})
const { toast }     = useToast()

const form = ref({
  camera_name: '',
  assigned_room_id: null,
  source_type: 'rtsp_yolo',
  rtsp_url: '',
  external_camera_id: '',
  external_area_id: '',
})

const filters = [
  { key: 'all',        label: 'all cameras' },
  { key: 'online',     label: 'RTSP online' },
  { key: 'offline',    label: 'RTSP offline' },
  { key: 'dahua',      label: 'Dahua' },
  { key: 'sync-error', label: 'sync errors' },
  { key: 'unassigned', label: 'unassigned' },
]

const onlineCount     = computed(() => cameras.value.filter(c => !isDahua(c) && c.status === 'online').length)
const offlineCount    = computed(() => cameras.value.filter(c => !isDahua(c) && c.status === 'offline').length)
const unassignedCount = computed(() => cameras.value.filter(c => !c.assigned_room_id).length)
const healthyDahuaCount = computed(() => cameras.value.filter(c =>
  isDahua(c) && c.synchronization_health === 'healthy'
).length)

const subtitle = computed(() =>
  `${cameras.value.length} camera${cameras.value.length !== 1 ? 's' : ''} configured · ${onlineCount.value} RTSP online · ${healthyDahuaCount.value} Dahua sync healthy`
)

const filteredCameras = computed(() => {
  if (activeFilter.value === 'all')        return cameras.value
  if (activeFilter.value === 'unassigned') return cameras.value.filter(c => !c.assigned_room_id)
  if (activeFilter.value === 'dahua') return cameras.value.filter(isDahua)
  if (activeFilter.value === 'sync-error') {
    return cameras.value.filter(c => isDahua(c) && c.synchronization_health === 'error')
  }
  return cameras.value.filter(c => !isDahua(c) && c.status === activeFilter.value)
})

function statusBadge(cam) {
  return cam.status === 'online' ? 'badge-success' : 'badge-danger'
}

function isDahua(cam) {
  return cam.source_type === 'dahua_external'
}

function sourceLabel(cam) {
  return isDahua(cam) ? 'Dahua External' : 'RTSP / YOLO'
}

function sourceBadge(cam) {
  if (!isDahua(cam)) return statusBadge(cam)
  if (cam.synchronization_health === 'healthy') return 'badge-success'
  return cam.synchronization_health === 'error' ? 'badge-danger' : 'badge-warning'
}

function cameraMappingLabel(cam) {
  if (isDahua(cam)) {
    return `camera ${cam.external_camera_id || '—'} · area ${cam.external_area_id || '—'}`
  }
  return cam.rtsp_url || 'no RTSP URL'
}

function synchronizationLabel(cam) {
  return cam.synchronization_health || (isDesiredConnected(cam) ? 'pending' : 'disabled')
}

function externalOccupancyLabel(cam) {
  const status = cam.external_occupancy_status
  const count = cam.external_occupancy_count
  if (status === 'measured') return `measured: ${count} people`
  if (status === 'inferred_zero') return 'inferred zero (not a measurement)'
  if (status === 'stale') return `stale; last measured: ${count ?? '—'} people`
  if (status === 'unknown') return 'awaiting first measurement'
  return 'no current occupancy state'
}

function isDesiredConnected(cam) {
  return cam.desired_connection_state === 'connected'
}

function desiredStateLabel(cam) {
  return isDesiredConnected(cam) ? 'connected' : 'disconnected'
}

function accentFor(cam) {
  if (isDahua(cam)) {
    if (cam.synchronization_health === 'healthy') return 'accent-success'
    if (cam.synchronization_health === 'error') return 'accent-danger'
    return 'accent-warning'
  }
  return cam.status === 'online' ? 'accent-success' : 'accent-danger'
}

function roomName(roomId) {
  if (!roomId) return null
  return rooms.value.find(r => r.room_id === roomId)?.room_name ?? `room ${roomId}`
}

function lastSeen(ts) {
  if (!ts) return 'never'
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000)
  if (mins < 1)   return 'just now'
  if (mins === 1) return '1 min ago'
  if (mins < 60)  return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
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
  form.value = {
    camera_name: '',
    rtsp_url: '',
    assigned_room_id: null,
    source_type: 'rtsp_yolo',
    external_camera_id: '',
    external_area_id: '',
  }
  modalError.value = ''
  showModal.value = true
}

function openEditModal(cam) {
  editingCamera.value = cam
  form.value = {
    camera_name:      cam.camera_name      || '',
    rtsp_url:         '',
    assigned_room_id: cam.assigned_room_id ?? null,
    source_type:      cam.source_type || 'rtsp_yolo',
    external_camera_id: cam.external_camera_id || '',
    external_area_id: cam.external_area_id || '',
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
  if (form.value.source_type === 'dahua_external') {
    if (!form.value.assigned_room_id) {
      modalError.value = 'assign this Dahua camera to a room before saving'
      return
    }
    if (!form.value.external_camera_id.trim() || !form.value.external_area_id.trim()) {
      modalError.value = 'XAMPP camera ID and area ID are required'
      return
    }
  }
  try {
    const payload = {
      camera_name:      form.value.camera_name,
      assigned_room_id: form.value.assigned_room_id,
      source_type:      form.value.source_type,
    }
    if (form.value.source_type === 'dahua_external') {
      payload.external_camera_id = form.value.external_camera_id.trim()
      payload.external_area_id = form.value.external_area_id.trim()
    } else {
      const newRtspUrl = form.value.rtsp_url.trim()
      const changingToRtsp = editingCamera.value?.source_type !== 'rtsp_yolo'
      if (newRtspUrl || !editingCamera.value || changingToRtsp) {
        payload.rtsp_url = newRtspUrl || null
      }
    }
    if (editingCamera.value) {
      await updateCamera(editingCamera.value.camera_id, payload)
    } else {
      await addCamera(payload)
    }
    const action = editingCamera.value ? 'updated' : 'added'
    closeModal()
    await refresh()
    toast.success(`camera ${action} successfully`)
  } catch (err) {
    modalError.value = `error: ${err.message}`
  }
}

async function toggleConnection(cam) {
  const cameraId = cam.camera_id
  if (connectionPending.value[cameraId]) return

  const desiredState = isDesiredConnected(cam) ? 'disconnected' : 'connected'
  connectionPending.value[cameraId] = true
  delete connectionErrors.value[cameraId]
  try {
    const result = await setCameraConnection(cameraId, desiredState)
    cam.desired_connection_state = result.desired_connection_state
    await refresh()
    toast.success(`camera ${desiredState} request accepted`)
  } catch (err) {
    connectionErrors.value[cameraId] = err.message
  } finally {
    connectionPending.value[cameraId] = false
  }
}

async function confirmDelete(cam) {
  if (!confirm(`delete "${cam.camera_name}"?`)) return
  try { await deleteCamera(cam.camera_id); await refresh(); toast.success('camera deleted') }
  catch (err) { alert(`could not delete camera: ${err.message}`) }
}

</script>

<style>
@import '../assets/cameras.css';
</style>