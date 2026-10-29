import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import Rooms from '../src/pages/Rooms.vue'

const api = vi.hoisted(() => ({
  fetchRooms: vi.fn(),
  fetchLatestOccupancy: vi.fn(),
  fetchCameras: vi.fn(),
  addRoom: vi.fn(),
  updateRoom: vi.fn(),
  deleteRoom: vi.fn()
}))

vi.mock('../src/api.js', () => api)
vi.mock('../src/other/usePolling.js', () => ({
  usePolling: callback => callback()
}))
vi.mock('../src/other/useToast.js', () => ({
  useToast: () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } })
}))

describe('Room Management frontend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.fetchRooms.mockResolvedValue([])
    api.fetchLatestOccupancy.mockResolvedValue([])
    api.fetchCameras.mockResolvedValue([])
    api.addRoom.mockResolvedValue({ room_id: 12 })
    api.updateRoom.mockResolvedValue({})
    api.deleteRoom.mockResolvedValue({})
  })

  it('renders room data joined with occupancy and camera status', async () => {
    api.fetchRooms.mockResolvedValue([{
      room_id: 3,
      room_name: 'Lab 3',
      capacity_limit: 20,
      occupancy_threshold: 16
    }])
    api.fetchLatestOccupancy.mockResolvedValue([{
      room_id: 3,
      occupancy_count: 18,
      recorded_at: '2026-01-10T10:00:00Z'
    }])
    api.fetchCameras.mockResolvedValue([{
      camera_id: 7,
      assigned_room_id: 3,
      status: ' ONLINE '
    }])

    const wrapper = mount(Rooms)
    await flushPromises()

    expect(wrapper.text()).toContain('Lab 3')
    expect(wrapper.text()).toContain('18')
    expect(wrapper.text()).toContain('cam 7 online')
    expect(wrapper.text()).toContain('near capacity')
  })

  it('shows the empty-room state and validates a required name', async () => {
    const wrapper = mount(Rooms)
    await flushPromises()

    expect(wrapper.text()).toContain('no rooms configured yet')
    await wrapper.get('button.btn-primary').trigger('click')
    await wrapper.get('.modal-actions button.btn-primary').trigger('click')

    expect(wrapper.text()).toContain('room name is required')
    expect(api.addRoom).not.toHaveBeenCalled()
  })

  it('submits new room values and refreshes the displayed list', async () => {
    const savedRoom = {
      room_id: 12,
      room_name: 'Studio',
      capacity_limit: 24,
      occupancy_threshold: 20
    }
    api.fetchRooms
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([savedRoom])
    const wrapper = mount(Rooms)
    await flushPromises()

    await wrapper.get('button.btn-primary').trigger('click')
    await wrapper.get('input[placeholder="e.g. Room 301"]').setValue('Studio')
    await wrapper.get('input[placeholder="e.g. 40"]').setValue('24')
    await wrapper.get('input[placeholder="e.g. 35"]').setValue('20')
    await wrapper.get('.modal-actions button.btn-primary').trigger('click')
    await flushPromises()

    expect(api.addRoom).toHaveBeenCalledWith({
      room_name: 'Studio',
      capacity_limit: 24,
      occupancy_threshold: 20
    })
    expect(wrapper.text()).toContain('Studio')
    expect(wrapper.text()).toContain('24 people')
  })
})
