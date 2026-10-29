import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import Analytics from '../src/pages/Analytics.vue'

const api = vi.hoisted(() => ({
  fetchHourlyTrend: vi.fn(),
  getTimeSeriesTrend: vi.fn(),
  fetchWeeklyHeatmap: vi.fn(),
  fetchRoomUtilization: vi.fn(),
  fetchRooms: vi.fn(),
  fetchAlerts: vi.fn(),
  fetchForecast: vi.fn(),
  fetchPeakOccupancyPeriods: vi.fn()
}))

vi.mock('../src/api.js', () => api)

describe('Occupancy Analytics frontend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.fetchHourlyTrend.mockResolvedValue([])
    api.getTimeSeriesTrend.mockResolvedValue([])
    api.fetchWeeklyHeatmap.mockResolvedValue([])
    api.fetchRoomUtilization.mockResolvedValue([])
    api.fetchRooms.mockResolvedValue([])
    api.fetchAlerts.mockResolvedValue([])
    api.fetchForecast.mockResolvedValue([])
    api.fetchPeakOccupancyPeriods.mockResolvedValue([])
  })

  it('renders utilization summaries and the empty trend state', async () => {
    api.fetchRoomUtilization.mockResolvedValue([
      { room_id: 1, name: 'Studio A', capacity: 20, occupancy_count: 18, last_updated: '2026-03-10T10:00:00Z' },
      { room_id: 2, name: 'Studio B', capacity: 40, occupancy_count: 0, last_updated: null }
    ])
    const wrapper = mount(Analytics)
    await flushPromises()

    expect(wrapper.findAll('.stat-card')[0].text()).toContain('2')
    expect(wrapper.findAll('.stat-card')[1].text()).toContain('1')
    expect(wrapper.findAll('.stat-card')[2].text()).toContain('45%')
    expect(wrapper.findAll('.stat-card')[3].text()).toContain('18')
    expect(wrapper.get('.chart-scroll-wrapper').text()).toContain('no data for this period')
    expect(wrapper.get('tbody').text()).toContain('Studio A')
    expect(wrapper.get('tbody').text()).toContain('near full')

    wrapper.unmount()
  })

  it('requests and displays peak periods and handles an empty-result response', async () => {
    api.fetchPeakOccupancyPeriods.mockResolvedValue([
      {
        log_id: 31,
        room_name: 'Studio A',
        occupancy_count: 24,
        occupancy_pct: 100,
        recorded_at: '2026-03-10T11:00:00Z'
      }
    ])
    const wrapper = mount(Analytics)
    await flushPromises()

    await wrapper.findAll('button.chart-tab').find(button => button.text().includes('peak analysis')).trigger('click')
    await flushPromises()

    expect(api.fetchPeakOccupancyPeriods).toHaveBeenCalledTimes(1)
    const peakParams = new URLSearchParams(api.fetchPeakOccupancyPeriods.mock.calls[0][0])
    expect(peakParams.get('hour_from')).toBe('0')
    expect(peakParams.get('hour_to')).toBe('23')
    expect(wrapper.text()).toContain('Studio A')
    expect(wrapper.text()).toContain('24 occupants')
    expect(wrapper.text()).toContain('100%')

    api.fetchPeakOccupancyPeriods.mockRejectedValueOnce(new Error('404 no records'))
    await wrapper.get('button.forecast-predict-btn').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('no occupancy records found for the selected filters')

    wrapper.unmount()
  })

  it('renders forecast values and summary boundaries from the mocked forecast response', async () => {
    api.fetchForecast.mockResolvedValue([
      { hour: 8, predicted_pct: 50, upper_pct: 60, lower_pct: 40 },
      { hour: 9, predicted_pct: 85, upper_pct: 95, lower_pct: 75 }
    ])
    const wrapper = mount(Analytics)
    await flushPromises()

    await wrapper.findAll('button.chart-tab').find(button => button.text().includes('forecast')).trigger('click')
    await flushPromises()

    expect(api.fetchForecast).toHaveBeenCalledTimes(1)
    const forecastParams = new URLSearchParams(api.fetchForecast.mock.calls[0][0])
    expect(forecastParams.get('hour_from')).toBe('8')
    expect(forecastParams.get('hour_to')).toBe('18')
    expect(wrapper.text()).toContain('peak: 85%')
    expect(wrapper.text()).toContain('avg: 68%')
    expect(wrapper.text()).toContain('over-capacity predicted at 9am')

    wrapper.unmount()
  })

  it('displays peak-analysis errors other than an empty result', async () => {
    api.fetchPeakOccupancyPeriods.mockRejectedValue(new Error('service unavailable'))
    const wrapper = mount(Analytics)
    await flushPromises()

    await wrapper.findAll('button.chart-tab').find(button => button.text().includes('peak analysis')).trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('error: service unavailable')
    wrapper.unmount()
  })
})
