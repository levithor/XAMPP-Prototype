import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import Cameras from '../src/pages/Cameras.vue'

const api = vi.hoisted(() => ({
  fetchCameras: vi.fn(),
  fetchRooms: vi.fn(),
  addCamera: vi.fn(),
  updateCamera: vi.fn(),
  deleteCamera: vi.fn()
}))

vi.mock('../src/api.js', () => api)
vi.mock('../src/other/usePolling.js', () => ({
  usePolling: callback => callback()
}))
vi.mock('../src/other/useToast.js', () => ({
  useToast: () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } })
}))

describe('Camera Management frontend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.fetchCameras.mockResolvedValue([])
    api.fetchRooms.mockResolvedValue([])
    api.addCamera.mockResolvedValue({ camera_id: 9 })
    api.updateCamera.mockResolvedValue({})
    api.deleteCamera.mockResolvedValue({})
  })

  it('renders camera status, assigned room, and empty-list feedback', async () => {
    api.fetchCameras.mockResolvedValue([{
      camera_id: 4,
      camera_name: 'North entrance',
      rtsp_url: 'rtsp://camera.local/live',
      assigned_room_id: 2,
      status: 'online',
      last_communication: null
    }])
    api.fetchRooms.mockResolvedValue([{ room_id: 2, room_name: 'Lobby' }])

    const wrapper = mount(Cameras)
    await flushPromises()

    expect(wrapper.text()).toContain('North entrance')
    expect(wrapper.text()).toContain('Lobby')
    expect(wrapper.text()).toContain('online')
    expect(wrapper.text()).toContain('rtsp://camera.local/live')

    api.fetchCameras.mockResolvedValueOnce([])
    const emptyWrapper = mount(Cameras)
    await flushPromises()
    expect(emptyWrapper.text()).toContain('no cameras configured yet')
  })

  it('requires a camera name and submits RTSP URL with its room assignment', async () => {
    api.fetchRooms.mockResolvedValue([{ room_id: 5, room_name: 'Lab 5' }])
    const wrapper = mount(Cameras)
    await flushPromises()

    await wrapper.get('button.btn-primary').trigger('click')
    await wrapper.get('.modal-actions button.btn-primary').trigger('click')
    expect(wrapper.text()).toContain('camera name is required')
    expect(api.addCamera).not.toHaveBeenCalled()

    await wrapper.findAll('button.connection-option').find(button => button.text().trim() === 'RTSP').trigger('click')
    await wrapper.get('input[placeholder="e.g. CAM-301"]').setValue('West entrance')
    await wrapper.get('select').setValue('5')
    await wrapper.get('input[placeholder="rtsp://192.168.1.101:554/stream"]').setValue('rtsp://west.local/live')
    await wrapper.get('.modal-actions button.btn-primary').trigger('click')
    await flushPromises()

    expect(api.addCamera).toHaveBeenCalledWith({
      camera_name: 'West entrance',
      rtsp_url: 'rtsp://west.local/live',
      assigned_room_id: 5
    })
  })

  it('exposes Dahua connection fields when that input mode is selected', async () => {
    const wrapper = mount(Cameras)
    await flushPromises()

    await wrapper.get('button.btn-primary').trigger('click')
    await wrapper.get('button.connection-option:nth-of-type(2)').trigger('click')

    expect(wrapper.text()).toContain('ip / domain name')
    expect(wrapper.text()).toContain('event type')
    expect(wrapper.find('input[placeholder="e.g. 192.168.1.108"]').exists()).toBe(true)
  })
})
