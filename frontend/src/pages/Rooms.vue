<template>
  <div style="display:contents">

    <div class="topbar">
      <div>
        <div class="topbar-title">rooms</div>
        <div class="topbar-sub">{{ subtitle }}</div>
      </div>
      <button class="btn-primary" @click="openAddModal">
        <i class="ti ti-plus" /> add room
      </button>
    </div>

    <div class="content">

      <div class="room-filters">
        <div v-for="f in filters" :key="f.key"
             class="filter-chip" :class="{ active: activeFilter === f.key }"
             @click="activeFilter = f.key">
          {{ f.label }}
        </div>
      </div>

      <div class="rooms-card-grid">
        <div v-for="room in filteredRooms" :key="room.room_id"
             class="room-card" :class="accentFor(room)">
          <div class="room-card-header">
            <div class="room-name">{{ room.name }}</div>
            <span class="room-badge" :class="statusFor(room).badge">{{ statusFor(room).label }}</span>
          </div>
          <div class="room-loc">{{ location(room) }}</div>
          <div class="room-count">{{ room.occupancy_count ?? 0 }} <span>/ {{ room.capacity }} max</span></div>
          <div class="progress-bar">
            <div class="progress-fill" :class="statusFor(room).fill" :style="{ width: pct(room) + '%' }"></div>
          </div>
          <div class="room-card-footer">
            <span><i class="ti ti-camera" style="font-size:13px;vertical-align:-2px" /> {{ room.camera_id || 'no camera' }}</span>
            <div class="room-card-actions">
              <i class="ti ti-edit" title="edit room" @click="openEditModal(room)" />
              <i class="ti ti-trash" title="delete room" @click="confirmDelete(room)" />
            </div>
          </div>
        </div>

        <div class="add-room-card" @click="openAddModal">
          <div class="inner">
            <i class="ti ti-plus" />
            <p>add a new room</p>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <span class="section-title">all rooms</span>
        </div>
        <table class="rooms-table">
          <thead>
            <tr>
              <th>room</th><th>floor</th><th>camera</th><th>threshold</th><th>status</th><th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="rooms.length === 0">
              <td colspan="6" style="padding:16px 0; color:var(--color-text-muted); font-size:13px;">
                no rooms configured yet
              </td>
            </tr>
            <tr v-for="room in rooms" :key="'tr-' + room.room_id">
              <td>{{ room.name }}</td>
              <td class="muted">{{ room.floor || '--' }}</td>
              <td class="muted">{{ room.camera_id || '--' }}</td>
              <td class="muted">{{ room.capacity }} people</td>
              <td><span class="room-badge" :class="statusFor(room).badge">{{ statusFor(room).label }}</span></td>
              <td class="row-actions">
                <i class="ti ti-edit" title="edit" @click="openEditModal(room)" style="margin-right:10px; cursor:pointer;" />
                <i class="ti ti-trash" title="delete" @click="confirmDelete(room)" style="cursor:pointer;" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-box">
        <div class="modal-header">
          <span>{{ editingRoom ? 'edit room' : 'add room' }}</span>
          <i class="ti ti-x" @click="closeModal" style="cursor:pointer; color:var(--color-text-muted);" />
        </div>

        <div class="modal-fields">
          <div class="modal-field">
            <label>room id</label>
            <input v-model="form.room_id" :disabled="!!editingRoom" placeholder="e.g. 301" />
          </div>
          <div class="modal-field">
            <label>room name</label>
            <input v-model="form.name" placeholder="e.g. Room 301" />
          </div>
          <div class="modal-field">
            <label>building</label>
            <input v-model="form.building" placeholder="e.g. CAMT Building" />
          </div>
          <div class="modal-field">
            <label>floor</label>
            <input v-model="form.floor" placeholder="e.g. Floor 3" />
          </div>
          <div class="modal-field">
            <label>capacity threshold</label>
            <input v-model.number="form.capacity" type="number" min="1" placeholder="e.g. 40" />
          </div>
          <div class="modal-field">
            <label>camera id</label>
            <input v-model="form.camera_id" placeholder="e.g. CAM-301" />
          </div>
        </div>

        <p v-if="modalError" style="font-size:12px; color:var(--color-danger); margin-top:10px;">{{ modalError }}</p>

        <div class="modal-actions">
          <button class="btn-cancel" @click="closeModal">cancel</button>
          <button class="btn-primary" @click="submitModal">
            {{ editingRoom ? 'save changes' : 'add room' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { fetchRooms, addRoom, updateRoom, deleteRoom } from '../api.js'
import { usePolling } from '../other/usePolling.js'

const rooms = ref([])
const activeFilter = ref('all')
const showModal = ref(false)
const editingRoom = ref(null)
const modalError = ref('')

const form = ref({ room_id: '', name: '', building: '', floor: '', capacity: 40, camera_id: '' })

const filters = [
  { key: 'all',    label: 'all rooms' },
  { key: 'over',   label: 'over capacity' },
  { key: 'near',   label: 'near capacity' },
  { key: 'normal', label: 'normal' },
]

const subtitle = computed(() => {
  const buildings = [...new Set(rooms.value.map(r => r.building).filter(Boolean))]
  const b = buildings.length ? buildings.join(', ') : 'camt building'
  return `${b} · ${rooms.value.length} room${rooms.value.length !== 1 ? 's' : ''} configured`
})

const filteredRooms = computed(() => {
  if (activeFilter.value === 'all') return rooms.value
  return rooms.value.filter(r => statusFor(r).key === activeFilter.value)
})

function statusFor(room) {
  const p = pct(room)
  if (p >= 100) return { label: 'over capacity', badge: 'badge-danger', fill: 'fill-danger', key: 'over' }
  if (p >= 85)  return { label: 'near capacity', badge: 'badge-warning', fill: 'fill-warning', key: 'near' }
  return { label: 'normal', badge: 'badge-success', fill: 'fill-success', key: 'normal' }
}

function accentFor(room) {
  const k = statusFor(room).key
  if (k === 'over') return 'accent-danger'
  if (k === 'near') return 'accent-warning'
  return 'accent-success'
}

function pct(room) {
  return Math.min(100, Math.round(((room.occupancy_count ?? 0) / (room.capacity ?? 40)) * 100))
}

function location(room) {
  return [room.building, room.floor].filter(Boolean).join(' | ') || 'no location set'
}

async function refresh() {
  try { rooms.value = await fetchRooms() }
  catch (err) { console.warn('Rooms refresh failed:', err.message) }
}

usePolling(refresh, 5000)

function openAddModal() {
  editingRoom.value = null
  form.value = { room_id: '', name: '', building: '', floor: '', capacity: 40, camera_id: '' }
  modalError.value = ''
  showModal.value = true
}

function openEditModal(room) {
  editingRoom.value = room
  form.value = {
    room_id:   room.room_id,
    name:      room.name      || '',
    building:  room.building  || '',
    floor:     room.floor     || '',
    capacity:  room.capacity  ?? 40,
    camera_id: room.camera_id || '',
  }
  modalError.value = ''
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingRoom.value = null
}

async function submitModal() {
  modalError.value = ''
  if (!form.value.name) { modalError.value = 'room name is required'; return }
  if (!editingRoom.value && !form.value.room_id) { modalError.value = 'room id is required'; return }
  try {
    if (editingRoom.value) {
      await updateRoom(editingRoom.value.room_id, {
        name: form.value.name, building: form.value.building,
        floor: form.value.floor, capacity: form.value.capacity,
        camera_id: form.value.camera_id || null
      })
    } else {
      await addRoom({ ...form.value, camera_id: form.value.camera_id || null })
    }
    closeModal()
    await refresh()
  } catch (err) {
    modalError.value = `error: ${err.message}`
  }
}

async function confirmDelete(room) {
  if (!confirm(`delete "${room.name}"? this will also remove all its occupancy history.`)) return
  try { await deleteRoom(room.room_id); await refresh() }
  catch (err) { alert(`could not delete room: ${err.message}`) }
}
</script>

<style>
@import '../assets/rooms.css';

.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.3);
  z-index: 100;
  display: flex; align-items: center; justify-content: center;
}
.modal-box {
  background: #fff; border-radius: 16px;
  padding: 28px 32px; width: 440px; max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 16px; font-weight: 500; margin-bottom: 20px;
}
.modal-fields { display: flex; flex-direction: column; gap: 14px; }
.modal-field label {
  display: block; font-size: 11px; color: var(--color-text-muted);
  text-transform: uppercase; letter-spacing: .06em; margin-bottom: 5px;
}
.modal-field input {
  width: 100%; padding: 9px 12px;
  border: 0.5px solid var(--color-border); border-radius: 8px;
  font-size: 13px; outline: none;
}
.modal-actions { display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end; }
.btn-cancel {
  padding: 9px 18px; border: 0.5px solid var(--color-border);
  border-radius: 8px; background: #fff; font-size: 13px; cursor: pointer;
}
</style>
