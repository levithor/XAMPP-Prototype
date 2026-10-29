import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import Home from '../src/pages/Home.vue'
import { clearAuth, saveAuth } from '../src/auth.js'

const api = vi.hoisted(() => ({
  fetchLatestOccupancy: vi.fn(),
  fetchAlerts: vi.fn(),
  fetchCameras: vi.fn(),
  fetchRooms: vi.fn()
}))

vi.mock('../src/api.js', () => api)
vi.mock('../src/other/usePolling.js', () => ({
  usePolling: callback => callback()
}))

describe('Occupancy Monitoring frontend', () => {
  beforeEach(() => {
    clearAuth()
    saveAuth('test-token', { username: 'test-admin' })
    vi.clearAllMocks()
    api.fetchLatestOccupancy.mockResolvedValue([])
    api.fetchAlerts.mockResolvedValue([])
    api.fetchCameras.mockResolvedValue([])
    api.fetchRooms.mockResolvedValue([])
  })

  it('combines rooms, occupancy, online cameras, and active alerts into dashboard summaries', async () => {
    api.fetchRooms.mockResolvedValue([
      { room_id: 1, room_name: 'Studio A', capacity_limit: 20 },
      { room_id: 2, room_name: 'Studio B', capacity_limit: 30 }
    ])
    api.fetchLatestOccupancy.mockResolvedValue([
      { room_id: 1, occupancy_count: 18, camera_id: 5, recorded_at: '2026-03-10T10:00:00Z' },
      { room_id: 2, occupancy_count: 0, camera_id: null, recorded_at: null }
    ])
    api.fetchCameras.mockResolvedValue([
      { camera_id: 5, camera_name: 'Entry camera', assigned_room_id: 1, status: ' ONLINE ' },
      { camera_id: 6, camera_name: 'Store camera', assigned_room_id: 2, status: 'offline' }
    ])
    api.fetchAlerts.mockResolvedValue([
      { alert_id: 1, message: 'Room nearing capacity', room_id: 1, alert_type: 'NEAR_CAPACITY', is_resolved: 0 },
      { alert_id: 2, message: 'Resolved alert', room_id: 2, is_resolved: 1 }
    ])

    const wrapper = mount(Home, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } }
    })
    await flushPromises()

    expect(wrapper.text()).toContain('good')
    expect(wrapper.text()).toContain('test-admin')
    expect(wrapper.text()).toContain('1 currently occupied')
    expect(wrapper.text()).toContain('18')
    expect(wrapper.text()).toContain('near capacity')
    expect(wrapper.text()).toContain('1 cameras live')
    expect(wrapper.text()).toContain('Room nearing capacity')
    expect(wrapper.text()).not.toContain('Resolved alert')
  })

  it('shows clear empty states when the dashboard has no rooms, cameras, or active alerts', async () => {
    const wrapper = mount(Home, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } }
    })
    await flushPromises()

    expect(wrapper.findAll('.stat-card')[0].text()).toContain('rooms monitored')
    expect(wrapper.findAll('.stat-card')[0].text()).toContain('0')
    expect(wrapper.text()).toContain('no cameras configured')
    expect(wrapper.text()).toContain('no active alerts')
  })

  it('continues displaying available data when an individual dashboard request fails', async () => {
    api.fetchRooms.mockResolvedValue([{ room_id: 9, room_name: 'Available room', capacity_limit: 10 }])
    api.fetchLatestOccupancy.mockRejectedValue(new Error('occupancy endpoint down'))

    const wrapper = mount(Home, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } }
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Available room')
    expect(wrapper.text()).toContain('system online')
    expect(wrapper.text()).toContain('0 / 10 max')
  })
})
