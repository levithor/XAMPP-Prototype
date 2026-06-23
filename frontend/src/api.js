export async function fetchLatestOccupancy() {
  const res = await fetch('/api/occupancy/latest')
  if (!res.ok) throw new Error(`fetchLatestOccupancy: ${res.status}`)
  return res.json()
}

export async function fetchHourlyTrend() {
  const res = await fetch('/api/analytics/hourly-trend')
  if (!res.ok) throw new Error(`fetchHourlyTrend: ${res.status}`)
  return res.json()
}

export async function fetchWeeklyHeatmap() {
  const res = await fetch('/api/analytics/weekly-heatmap')
  if (!res.ok) throw new Error(`fetchWeeklyHeatmap: ${res.status}`)
  return res.json()
}

export async function fetchRoomUtilization() {
  const res = await fetch('/api/analytics/room-utilization')
  if (!res.ok) throw new Error(`fetchRoomUtilization: ${res.status}`)
  return res.json()
}

export async function fetchRooms() {
  const res = await fetch('/api/rooms')
  if (!res.ok) throw new Error(`fetchRooms: ${res.status}`)
  return res.json()
}

export async function addRoom(data) {
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error(`addRoom: ${res.status}`)
  return res.json()
}

export async function updateRoom(roomId, data) {
  const res = await fetch(`/api/rooms/${roomId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error(`updateRoom: ${res.status}`)
  return res.json()
}

export async function deleteRoom(roomId) {
  const res = await fetch(`/api/rooms/${roomId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`deleteRoom: ${res.status}`)
  return res.json()
}

export async function fetchAlerts() {
  const res = await fetch('/api/alerts')
  if (!res.ok) throw new Error(`fetchAlerts: ${res.status}`)
  return res.json()
}

export async function acknowledgeAlert(id) {
  const res = await fetch(`/api/alerts/${id}/resolve`, { method: 'PATCH' })
  if (!res.ok) throw new Error(`acknowledgeAlert: ${res.status}`)
  return res.json()
}

export async function deleteAlert(id) {
  const res = await fetch(`/api/alerts/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`deleteAlert: ${res.status}`)
  return res.json()
}
