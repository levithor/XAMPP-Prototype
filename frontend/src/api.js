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


export async function loginAdmin(email, password) {
  const res = await fetch('/api/admins/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (res.status === 401) throw new Error('invalid email or password.')
  if (!res.ok) throw new Error('server error. please try again.')
  return res.json() // { token, admin }
}

export async function registerAdmin({ username, email, password }) {
  const res = await fetch('/api/admins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })
  if (res.status === 409) throw new Error('an account with that email already exists.')
  if (!res.ok) throw new Error('registration failed. please try again.')
  return res.json() // { admin_id }
}


export async function fetchLatestOccupancy() {
  return apiFetch('/api/occupancy/latest')
}


export async function fetchHourlyTrend() {
  return apiFetch('/api/analytics/hourly-trend')
}

export async function fetchWeeklyHeatmap() {
  return apiFetch('/api/analytics/weekly-heatmap')
}

export async function fetchRoomUtilization() {
  return apiFetch('/api/analytics/room-utilization')
}


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