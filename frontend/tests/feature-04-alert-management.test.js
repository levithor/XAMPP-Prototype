import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import Alerts from '../src/pages/Alerts.vue'

const api = vi.hoisted(() => ({
  fetchAlerts: vi.fn(),
  acknowledgeAlert: vi.fn(),
  unacknowledgeAlert: vi.fn(),
  deleteAlert: vi.fn()
}))

vi.mock('../src/api.js', () => api)
vi.mock('../src/other/usePolling.js', () => ({
  usePolling: callback => callback()
}))
vi.mock('../src/other/useToast.js', () => ({
  useToast: () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } })
}))

describe('Alert Management frontend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.fetchAlerts.mockResolvedValue([])
    api.acknowledgeAlert.mockResolvedValue({})
    api.unacknowledgeAlert.mockResolvedValue({})
    api.deleteAlert.mockResolvedValue({})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders empty state and keeps active and acknowledged statuses distinct', async () => {
    const emptyWrapper = mount(Alerts)
    await flushPromises()
    expect(emptyWrapper.text()).toContain('no active alerts')
    expect(emptyWrapper.text()).toContain('no alerts found')

    api.fetchAlerts.mockResolvedValue([
      { alert_id: 1, message: 'Capacity reached', room_id: 2, alert_type: ' OVERCROWDING ', is_resolved: 0 },
      { alert_id: 2, message: 'Camera restored', room_id: 4, alert_type: 'system_malfunction', is_resolved: 1 }
    ])
    const wrapper = mount(Alerts)
    await flushPromises()

    expect(wrapper.text()).toContain('overcrowding')
    expect(wrapper.text()).toContain('acknowledged')
    expect(wrapper.get('.topbar-sub').text()).toContain('1 unacknowledged')
    await wrapper.findAll('.filter-chip').find(chip => chip.text().trim() === 'acknowledged').trigger('click')
    expect(wrapper.get('tbody').text()).toContain('Camera restored')
    expect(wrapper.get('tbody').text()).not.toContain('Capacity reached')
  })

  it('calls acknowledge and unacknowledge actions for their displayed alerts', async () => {
    api.fetchAlerts.mockResolvedValue([
      { alert_id: 11, message: 'Active alert', room_id: 1, alert_type: 'near_capacity', is_resolved: false },
      { alert_id: 12, message: 'Resolved alert', room_id: 1, alert_type: 'near_capacity', is_resolved: true }
    ])
    const wrapper = mount(Alerts)
    await flushPromises()

    await wrapper.get('.alert-btn-ack').trigger('click')
    await flushPromises()
    await wrapper.get('i[title="unacknowledge"]').trigger('click')
    await flushPromises()

    expect(api.acknowledgeAlert).toHaveBeenCalledWith(11)
    expect(api.unacknowledgeAlert).toHaveBeenCalledWith(12)
    expect(api.fetchAlerts).toHaveBeenCalledTimes(3)
  })

  it('deletes only after confirmation and preserves the list when confirmation is cancelled', async () => {
    api.fetchAlerts.mockResolvedValue([
      { alert_id: 14, message: 'Historical alert', room_id: 2, alert_type: 'system_malfunction', is_resolved: true }
    ])
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true)
    vi.stubGlobal('confirm', confirm)
    const wrapper = mount(Alerts)
    await flushPromises()

    await wrapper.get('i[title="delete"]').trigger('click')
    expect(api.deleteAlert).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Historical alert')

    await wrapper.get('i[title="delete"]').trigger('click')
    await flushPromises()
    expect(api.deleteAlert).toHaveBeenCalledWith(14)
  })

  it('shows the empty alert state after a retrieval failure', async () => {
    api.fetchAlerts.mockRejectedValue(new Error('backend unavailable'))
    const wrapper = mount(Alerts)
    await flushPromises()

    expect(wrapper.text()).toContain('no active alerts')
    expect(console.warn).toHaveBeenCalled()
  })
})
