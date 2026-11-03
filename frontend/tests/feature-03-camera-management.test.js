import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import Cameras from '../src/pages/Cameras.vue'

const api = vi.hoisted(() => ({
  fetchCameras: vi.fn(),
  fetchRooms: vi.fn(),
  addCamera: vi.fn(),
  updateCamera: vi.fn(),
  deleteCamera: vi.fn()
}))
const toast = vi.hoisted(() => ({
  success: vi.fn(),
  info: vi.fn(),
  error: vi.fn()
}))

vi.mock('../src/api.js', () => api)
vi.mock('../src/other/usePolling.js', () => ({
  usePolling: callback => callback()
}))
vi.mock('../src/other/useToast.js', () => ({
  useToast: () => ({ toast })
}))

describe('Camera Management frontend', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    api.fetchCameras.mockResolvedValue([])
    api.fetchRooms.mockResolvedValue([])
    api.addCamera.mockResolvedValue({ camera_id: 9 })
    api.updateCamera.mockResolvedValue({})
    api.deleteCamera.mockResolvedValue({})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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

  it('prefills and submits edited camera details, then refreshes the list', async () => {
    const originalCamera = {
      camera_id: 4,
      camera_name: 'North entrance',
      rtsp_url: 'rtsp://north.local/live',
      assigned_room_id: 2,
      status: 'online'
    }
    const updatedCamera = {
      ...originalCamera,
      camera_name: 'West entrance',
      rtsp_url: 'rtsp://west.local/live',
      assigned_room_id: 5
    }
    api.fetchCameras
      .mockResolvedValueOnce([originalCamera])
      .mockResolvedValueOnce([updatedCamera])
    api.fetchRooms.mockResolvedValue([
      { room_id: 2, room_name: 'North hall' },
      { room_id: 5, room_name: 'West hall' }
    ])
    const wrapper = mount(Cameras)
    await flushPromises()

    await wrapper.get('i[title="edit camera"]').trigger('click')
    expect(wrapper.get('input[placeholder="e.g. CAM-301"]').element.value).toBe('North entrance')
    await wrapper.findAll('button.connection-option')
      .find(button => button.text().trim() === 'RTSP')
      .trigger('click')
    expect(wrapper.get('input[placeholder="rtsp://192.168.1.101:554/stream"]').element.value)
      .toBe('rtsp://north.local/live')

    await wrapper.get('input[placeholder="e.g. CAM-301"]').setValue('West entrance')
    await wrapper.get('select').setValue('5')
    await wrapper.get('input[placeholder="rtsp://192.168.1.101:554/stream"]')
      .setValue('rtsp://west.local/live')
    await wrapper.get('.modal-actions button.btn-primary').trigger('click')
    await flushPromises()

    expect(api.updateCamera).toHaveBeenCalledWith(4, {
      camera_name: 'West entrance',
      rtsp_url: 'rtsp://west.local/live',
      assigned_room_id: 5
    })
    expect(wrapper.text()).toContain('West entrance')
    expect(wrapper.text()).toContain('West hall')
  })

  it('deletes a camera only after confirmation', async () => {
    api.fetchCameras.mockResolvedValue([{
      camera_id: 10,
      camera_name: 'Storage camera',
      rtsp_url: 'rtsp://storage.local/live',
      assigned_room_id: null,
      status: 'offline'
    }])
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true)
    vi.stubGlobal('confirm', confirm)
    const wrapper = mount(Cameras)
    await flushPromises()

    await wrapper.get('i[title="delete camera"]').trigger('click')
    expect(api.deleteCamera).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Storage camera')

    await wrapper.get('i[title="delete camera"]').trigger('click')
    await flushPromises()
    expect(api.deleteCamera).toHaveBeenCalledWith(10)
  })

  it('shows success and failure feedback for camera add, update, and delete actions', async () => {
    const camera = {
      camera_id: 4,
      camera_name: 'North entrance',
      rtsp_url: 'rtsp://north.local/live',
      assigned_room_id: 2,
      status: 'online'
    }
    const updatedCamera = { ...camera, camera_name: 'West entrance' }

    api.fetchCameras.mockResolvedValue([])
    let wrapper = mount(Cameras)
    await flushPromises()
    await wrapper.get('.topbar .btn-primary').trigger('click')
    await wrapper.get('input[placeholder="e.g. CAM-301"]').setValue('New camera')
    await wrapper.get('.modal-actions button.btn-primary').trigger('click')
    await flushPromises()
    expect(toast.success).toHaveBeenCalledWith('camera added successfully')
    wrapper.unmount()

    api.addCamera.mockRejectedValueOnce(new Error('add failed'))
    wrapper = mount(Cameras)
    await flushPromises()
    await wrapper.get('.topbar .btn-primary').trigger('click')
    await wrapper.get('input[placeholder="e.g. CAM-301"]').setValue('Failed camera')
    await wrapper.get('.modal-actions button.btn-primary').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('error: add failed')
    wrapper.unmount()

    api.fetchCameras.mockResolvedValue([camera])
    wrapper = mount(Cameras)
    await flushPromises()
    await wrapper.get('i[title="edit camera"]').trigger('click')
    await wrapper.get('input[placeholder="e.g. CAM-301"]').setValue('West entrance')
    await wrapper.get('.modal-actions button.btn-primary').trigger('click')
    await flushPromises()
    expect(api.updateCamera).toHaveBeenCalledWith(4, expect.any(Object))
    expect(toast.success).toHaveBeenCalledWith('camera updated successfully')
    wrapper.unmount()

    api.updateCamera.mockRejectedValueOnce(new Error('update failed'))
    wrapper = mount(Cameras)
    await flushPromises()
    await wrapper.get('i[title="edit camera"]').trigger('click')
    await wrapper.get('.modal-actions button.btn-primary').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('error: update failed')
    wrapper.unmount()

    const alert = vi.fn()
    vi.stubGlobal('confirm', vi.fn(() => true))
    vi.stubGlobal('alert', alert)
    api.fetchCameras.mockResolvedValue([updatedCamera])
    wrapper = mount(Cameras)
    await flushPromises()
    await wrapper.get('i[title="delete camera"]').trigger('click')
    await flushPromises()
    expect(toast.success).toHaveBeenCalledWith('camera deleted')
    wrapper.unmount()

    api.deleteCamera.mockRejectedValueOnce(new Error('delete failed'))
    wrapper = mount(Cameras)
    await flushPromises()
    await wrapper.get('i[title="delete camera"]').trigger('click')
    await flushPromises()
    expect(alert).toHaveBeenCalledWith('could not delete camera: delete failed')
  })
})
