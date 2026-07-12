import { getToken } from './auth.js'

async function apiFetch(path, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }
  const res = await fetch(path, { ...options, headers })
  if (!res.ok) throw new Error(`${options.method || 'GET'} ${path}: ${res.status}`)
  return res.json()
}

// ── authentication stuff ──

export async function loginAdmin(email, password) {
  const res = await fetch('/api/admins/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (res.status === 401) throw new Error('invalid email or password.')
  if (!res.ok) throw new Error('server error. please try again.')
  return res.json()
}

export async function registerAdmin({ username, email, password }) {
  const res = await fetch('/api/admins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })
  if (res.status === 409) throw new Error('an account with that email already exists.')
  if (!res.ok) throw new Error('registration failed. please try again.')
  return res.json()
}

// ── occupancy stuff ──

export async function fetchLatestOccupancy() {
  return apiFetch('/api/occupancy/latest')
}

// ── analytics stuff ──

export async function fetchHourlyTrend(qs = '') {
  return apiFetch(`/api/analytics/hourly-trend${qs ? '?' + qs : ''}`)
}

export async function fetchWeeklyHeatmap(qs = '') {
  return apiFetch(`/api/analytics/weekly-heatmap${qs ? '?' + qs : ''}`)
}

export async function fetchRoomUtilization(qs = '') {
  return apiFetch(`/api/analytics/room-utilization${qs ? '?' + qs : ''}`)
}

// ── rooms stuff ──

export async function fetchRooms() {
  return apiFetch('/api/rooms')
}

export async function addRoom(data) {
  return apiFetch('/api/rooms', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateRoom(roomId, data) {
  return apiFetch(`/api/rooms/${roomId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteRoom(roomId) {
  return apiFetch(`/api/rooms/${roomId}`, { method: 'DELETE' })
}

// ── alerts stuff ───

export async function fetchAlerts() {
  return apiFetch('/api/alerts')
}

export async function acknowledgeAlert(id) {
  return apiFetch(`/api/alerts/${id}/resolve`, { method: 'PATCH' })
}

export async function unacknowledgeAlert(id) {
  return apiFetch(`/api/alerts/${id}/unresolve`, { method: 'PATCH' })
}

export async function deleteAlert(id) {
  return apiFetch(`/api/alerts/${id}`, { method: 'DELETE' })
}

// ── cams stuff ──

export async function fetchCameras() {
  return apiFetch('/api/cameras')
}

export async function addCamera(data) {
  return apiFetch('/api/cameras', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateCamera(cameraId, data) {
  return apiFetch(`/api/cameras/${cameraId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteCamera(cameraId) {
  return apiFetch(`/api/cameras/${cameraId}`, { method: 'DELETE' })
}