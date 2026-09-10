<template>
  <div style="display:contents">

    <div class="topbar">
      <div>
        <div class="topbar-title">analytics &amp; reports</div>
        <div class="topbar-sub">chiang mai university | college of arts, media &amp; technology</div>
      </div>
      <div class="topbar-filters">

        <div class="filter-pill room-pill" @click.stop="roomPickerOpen = !roomPickerOpen">
          <i class="ti ti-door" />
          {{ selectedRoomLabel }}
          <i class="ti ti-chevron-down" style="font-size:12px; margin-left:2px;" />
        </div>

        <!-- Room dropdown -->
        <div v-if="roomPickerOpen" class="room-dropdown" @click.stop>
          <div class="room-option"
               :class="{ active: selectedRoomId === null }"
               @click="selectRoom(null)">
            <i class="ti ti-layout-grid" /> all rooms
          </div>
          <div class="picker-divider" />
          <div v-for="room in rooms" :key="room.room_id"
               class="room-option"
               :class="{ active: selectedRoomId === room.room_id }"
               @click="selectRoom(room.room_id)">
            <i class="ti ti-door" /> {{ room.room_name }}
          </div>
        </div>

        <!-- Date picker pill -->
        <div class="filter-pill date-pill" @click.stop="togglePicker">
          <i class="ti ti-calendar" />
          {{ selectedLabel }}
          <i class="ti ti-chevron-down" style="font-size:12px; margin-left:2px;" />
        </div>

        <!-- Date dropdown -->
        <div v-if="pickerOpen" class="date-dropdown" @click.stop>
          <div class="preset-row">
            <button v-for="p in presets" :key="p.key"
                    class="preset-btn" :class="{ active: activePreset === p.key }"
                    @click="applyPreset(p)">{{ p.label }}</button>
          </div>
          <div class="picker-divider" />
          <div class="cal-header">
            <button class="cal-nav" @click="prevMonth"><i class="ti ti-chevron-left" /></button>
            <span class="cal-month-label">{{ calMonthLabel }}</span>
            <button class="cal-nav" @click="nextMonth"><i class="ti ti-chevron-right" /></button>
          </div>
          <div class="cal-grid">
            <div v-for="d in ['Mo','Tu','We','Th','Fr','Sa','Su']" :key="d" class="cal-dow">{{ d }}</div>
            <div v-for="cell in calCells" :key="cell.key"
                 class="cal-cell"
                 :class="{
                   'cal-empty':    cell.empty,
                   'cal-today':    cell.isToday,
                   'cal-selected': cell.isSelected,
                   'cal-future':   cell.isFuture,
                 }"
                 @click="cell.empty || cell.isFuture ? null : selectDate(cell.date)">
              {{ cell.empty ? '' : cell.d }}
            </div>
          </div>
          <div class="picker-divider" />
          <div class="time-section">
            <div class="time-label"><i class="ti ti-clock" /> hour range</div>
            <div class="time-row">
              <div class="time-field">
                <span class="time-field-label">from</span>
                <select v-model="hourFrom" class="time-select">
                  <option v-for="h in hourOptions" :key="h.v" :value="h.v">{{ h.l }}</option>
                </select>
              </div>
              <span class="time-dash">–</span>
              <div class="time-field">
                <span class="time-field-label">to</span>
                <select v-model="hourTo" class="time-select">
                  <option v-for="h in hourOptions" :key="h.v" :value="h.v" :disabled="h.v <= hourFrom">{{ h.l }}</option>
                </select>
              </div>
            </div>
          </div>
          <button class="apply-btn" @click="applyAndClose">
            <i class="ti ti-check" /> apply
          </button>
        </div>

      </div>
    </div>

    <div class="content">

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">{{ selectedRoomId ? 'room' : 'total rooms monitored' }}</div>
          <div class="stat-value">{{ selectedRoomId ? selectedRoomLabel : stats.totalRooms }}</div>
          <div class="stat-trend trend-neutral">{{ selectedRoomId ? 'selected room' : 'across all floors' }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">{{ selectedRoomId ? 'peak occupancy' : 'rooms with activity' }}</div>
          <div class="stat-value">{{ selectedRoomId ? stats.peakCount : stats.occupiedRooms }}</div>
          <div class="stat-trend trend-neutral">on {{ selectedLabel }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">avg occupancy rate</div>
          <div class="stat-value">{{ stats.avgPct }}%</div>
          <div class="stat-trend" :class="stats.avgPct > 80 ? 'trend-down' : 'trend-up'">
            <i class="ti ti-arrow-up" style="font-size:12px" /> for selected period
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">over-capacity events</div>
          <div class="stat-value">{{ stats.overCapacity }}</div>
          <div class="stat-trend" :class="stats.overCapacity > 0 ? 'trend-down' : 'trend-neutral'">
            {{ stats.overCapacity }} overcrowding event{{ stats.overCapacity !== 1 ? 's' : '' }}
          </div>
        </div>
      </div>

      <div class="analytics-grid">

        <div class="panel">
          <!-- TAB SWITCHER -->
          <div class="panel-header" style="margin-bottom:0;">
            <div class="chart-tabs">
              <button class="chart-tab" :class="{ active: chartTab === 'trend' }"
                      @click="chartTab = 'trend'">
                <i class="ti ti-chart-line" /> trend
              </button>
              <button class="chart-tab" :class="{ active: chartTab === 'forecast' }"
                      @click="chartTab = 'forecast'">
                <i class="ti ti-brain" /> forecast
              </button>
            </div>
            <!-- date badge only shown on trend tab -->
            <span v-if="chartTab === 'trend'" class="date-badge">
              {{ selectedLabel }}{{ selectedRoomId ? ' · ' + selectedRoomLabel : '' }}
            </span>
          </div>

          <!-- ── TREND TAB ── -->
          <template v-if="chartTab === 'trend'">
            <div class="chart-legend" style="margin-top:14px;">
              <div class="legend-item"><span class="legend-swatch"></span> avg occupancy</div>
              <div class="legend-item"><span class="legend-swatch dashed"></span> capacity limit (80%)</div>
            </div>
            <div v-if="loading" class="chart-placeholder">loading…</div>
            <svg v-else viewBox="0 0 700 280" style="width:100%; height:260px;">
              <g stroke="var(--color-border)" stroke-width="0.5">
                <line v-for="(pct,i) in [100,80,60,40,20,0]" :key="pct"
                      x1="40" :y1="20 + i*42" x2="690" :y2="20 + i*42" />
              </g>
              <g stroke="var(--color-border)" stroke-width="1">
                <line x1="40" y1="20" x2="40" y2="230" />
                <line x1="40" y1="230" x2="690" y2="230" />
              </g>
              <g font-size="10" fill="var(--color-text-muted)" font-family="-apple-system,sans-serif">
                <text x="32" y="24"  text-anchor="end">100%</text>
                <text x="32" y="66"  text-anchor="end">80%</text>
                <text x="32" y="108" text-anchor="end">60%</text>
                <text x="32" y="150" text-anchor="end">40%</text>
                <text x="32" y="192" text-anchor="end">20%</text>
                <text x="32" y="234" text-anchor="end">0%</text>
              </g>
              <g font-size="10" fill="var(--color-text-muted)" font-family="-apple-system,sans-serif" text-anchor="middle">
                <text v-for="(lbl, i) in visibleXLabels" :key="lbl" :x="xPos(i)" y="250">{{ lbl }}</text>
              </g>
              <line x1="40" y1="66" x2="690" y2="66"
                    stroke="var(--color-danger)" stroke-width="1.5" stroke-dasharray="6 5" />
              <path v-if="chartPoints.length > 1" :d="areaPath"
                    fill="var(--color-accent)" opacity="0.08" />
              <path v-if="chartPoints.length > 1" :d="linePath"
                    fill="none" stroke="var(--color-accent)" stroke-width="2.5"
                    stroke-linecap="round" stroke-linejoin="round" />
              <circle v-for="p in chartPoints" :key="p.x"
                      :cx="p.x" :cy="p.y" r="4" fill="var(--color-accent)" />
              <text v-if="chartPoints.length === 0" x="365" y="130"
                    text-anchor="middle" font-size="13" fill="var(--color-text-muted)"
                    font-family="-apple-system,sans-serif">no data for this period</text>
            </svg>
          </template>

          <!-- ── FORECAST TAB ── -->
          <template v-else>
            <div style="display:flex; align-items:center; gap:16px; margin-top:14px; margin-bottom:12px; flex-wrap:wrap;">
              <!-- Forecast date picker -->
              <div style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--color-text-secondary);">
                <i class="ti ti-calendar" style="font-size:14px;" />
                <span>forecast date:</span>
                <input type="date" v-model="forecastDate" :min="tomorrowStr"
                       class="forecast-date-input" />
              </div>
              <!-- Hour range -->
              <div style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--color-text-secondary);">
                <i class="ti ti-clock" style="font-size:14px;" />
                <span>hours:</span>
                <select v-model="forecastHourFrom" class="time-select forecast-select">
                  <option v-for="h in hourOptions" :key="h.v" :value="h.v">{{ h.l }}</option>
                </select>
                <span>–</span>
                <select v-model="forecastHourTo" class="time-select forecast-select">
                  <option v-for="h in hourOptions" :key="h.v" :value="h.v" :disabled="h.v <= forecastHourFrom">{{ h.l }}</option>
                </select>
                <button @click="runForecast" class="forecast-predict-btn">
                  <i class="ti ti-refresh" /> predict
                </button>
              </div>
            </div>

            <!-- Legend -->
            <div class="chart-legend">
              <div class="legend-item">
                <span style="display:inline-block;width:14px;height:3px;background:var(--color-accent);border-radius:2px;"></span>
                predicted occupancy
              </div>
              <div class="legend-item">
                <span style="display:inline-block;width:14px;height:3px;background:#bfdbfe;border-radius:2px;"></span>
                confidence band (±1 SD)
              </div>
              <div class="legend-item"><span class="legend-swatch dashed"></span> capacity limit (80%)</div>
            </div>

            <div v-if="forecastLoading" class="chart-placeholder">
              <i class="ti ti-loader" style="font-size:20px; margin-bottom:8px; display:block;" />
              running forecast…
            </div>
            <div v-else-if="forecastPoints.length === 0" class="chart-placeholder">
              <i class="ti ti-chart-dots" style="font-size:28px; margin-bottom:8px; display:block; color:var(--color-text-muted);" />
              <span>not enough historical data to forecast.</span><br>
              <span style="font-size:11px; margin-top:4px; display:block;">at least a few days of occupancy logs are needed.</span>
            </div>
            <svg v-else viewBox="0 0 700 280" style="width:100%; height:260px;">
              <!-- gridlines -->
              <g stroke="var(--color-border)" stroke-width="0.5">
                <line v-for="(pct,i) in [100,80,60,40,20,0]" :key="pct"
                      x1="40" :y1="20 + i*42" x2="690" :y2="20 + i*42" />
              </g>
              <g stroke="var(--color-border)" stroke-width="1">
                <line x1="40" y1="20" x2="40" y2="230" />
                <line x1="40" y1="230" x2="690" y2="230" />
              </g>
              <!-- y labels -->
              <g font-size="10" fill="var(--color-text-muted)" font-family="-apple-system,sans-serif">
                <text x="32" y="24"  text-anchor="end">100%</text>
                <text x="32" y="66"  text-anchor="end">80%</text>
                <text x="32" y="108" text-anchor="end">60%</text>
                <text x="32" y="150" text-anchor="end">40%</text>
                <text x="32" y="192" text-anchor="end">20%</text>
                <text x="32" y="234" text-anchor="end">0%</text>
              </g>
              <!-- x labels -->
              <g font-size="10" fill="var(--color-text-muted)" font-family="-apple-system,sans-serif" text-anchor="middle">
                <text v-for="(lbl, i) in forecastXLabels" :key="lbl" :x="forecastXPos(i)" y="250">{{ lbl }}</text>
              </g>
              <!-- 80% capacity dashed line -->
              <line x1="40" y1="66" x2="690" y2="66"
                    stroke="var(--color-danger)" stroke-width="1.5" stroke-dasharray="6 5" />
              <!-- confidence band (filled area between lower and upper) -->
              <path v-if="forecastBandPath" :d="forecastBandPath"
                    fill="#bfdbfe" opacity="0.35" />
              <!-- predicted line -->
              <path v-if="forecastLinePath" :d="forecastLinePath"
                    fill="none" stroke="var(--color-accent)" stroke-width="2.5"
                    stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="6 3" />
              <!-- data points with tooltip title -->
              <circle v-for="p in forecastPoints" :key="p.x"
                      :cx="p.x" :cy="p.y" r="4" fill="var(--color-accent)">
                <title>{{ forecastHourLabel(p.hour) }}: {{ p.pct }}%</title>
              </circle>
            </svg>

            <!-- Summary row -->
            <div v-if="forecastPoints.length > 0" class="forecast-summary">
              <div class="forecast-summary-item">
                <span class="forecast-summary-value">peak: {{ forecastPeak.pct }}%</span>
                <span class="forecast-summary-label"> at {{ forecastHourLabel(forecastPeak.hour) }}</span>
              </div>
              <div class="forecast-summary-item">
                <span class="forecast-summary-value">avg: {{ forecastAvg }}%</span>
                <span class="forecast-summary-label"> over selected window</span>
              </div>
              <div v-if="forecastOverCapacity.length > 0" class="forecast-summary-warning">
                <i class="ti ti-alert-triangle" style="font-size:12px;" />
                over-capacity predicted at {{ forecastOverCapacity.map(p => forecastHourLabel(p.hour)).join(', ') }}
              </div>
            </div>
          </template>
        </div>

        <div class="panel">
          <div class="panel-header">
            <span class="section-title">{{ isToday ? 'live alerts' : 'alerts that day' }}</span>
          </div>
          <div v-if="alertRooms.length === 0" class="alert-meta" style="padding:8px 0;">
            no active alerts
          </div>
          <div v-for="alert in alertRooms" :key="alert.alert_id"
               class="alert-card" :class="alert.alert_type === 'overcrowding' ? 'danger' : 'warning'">
            <div class="alert-dot" :class="alert.alert_type === 'overcrowding' ? 'danger' : 'warning'"></div>
            <div>
              <div class="alert-title">{{ alert.message }}</div>
              <div class="alert-meta">{{ formatTime(alert.created_at) }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="analytics-grid" style="grid-template-columns: 0.85fr 1fr;">

        <div class="panel">
          <div class="panel-header">
            <span class="section-title">room utilization overview</span>
          </div>
          <table class="data-table">
            <thead>
              <tr><th>room</th><th>count</th><th>capacity</th><th>utilization</th><th>status</th></tr>
            </thead>
            <tbody>
              <tr v-if="filteredUtilization.length === 0">
                <td colspan="5" style="text-align:center; color:var(--color-text-muted); padding:20px 0;">
                  no data for this period
                </td>
              </tr>
              <tr v-for="room in filteredUtilization" :key="room.room_id">
                <td>{{ room.name }}</td>
                <td>{{ room.occupancy_count ?? 0 }}</td>
                <td>{{ room.capacity }}</td>
                <td>
                  <div class="util-bar-wrap">
                    <div class="util-bar-fill"
                         :style="{ width: utilPct(room) + '%', background: utilColor(room) }"></div>
                  </div>
                </td>
                <td>
                  <span class="status-pill" :class="utilStatus(room).pill">
                    {{ utilStatus(room).label }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="panel">
          <div class="panel-header">
            <span class="section-title">weekly peak hours heatmap</span>
            <span class="date-badge">4-week window{{ selectedRoomId ? ' · ' + selectedRoomLabel : '' }}</span>
          </div>
          <table class="heatmap-table">
            <thead>
              <tr>
                <th></th>
                <th v-for="h in heatmapHourLabels" :key="h">{{ h }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in heatmapRows" :key="row.day">
                <td class="day-label">{{ row.day }}</td>
                <td v-for="(v, i) in row.values" :key="i">
                  <div class="heat-cell" :class="'heat-' + heatLevel(v)">{{ v }}%</div>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="heatmap-legend">
            <div class="legend-item"><span class="legend-swatch heat-0"></span> 0%</div>
            <div class="legend-item"><span class="legend-swatch heat-1"></span> 50%</div>
            <div class="legend-item"><span class="legend-swatch heat-2"></span> 80%</div>
            <div class="legend-item"><span class="legend-swatch heat-4"></span> 100%+</div>
          </div>
        </div>

      </div>
    </div>

    <div v-if="pickerOpen"     class="picker-overlay" @click="pickerOpen = false" />
    <div v-if="roomPickerOpen" class="picker-overlay" @click="roomPickerOpen = false" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { fetchHourlyTrend, fetchWeeklyHeatmap, fetchRoomUtilization, fetchRooms, fetchAlerts, fetchForecast } from '../api.js'

const rooms          = ref([])
const selectedRoomId = ref(null)   
const roomPickerOpen = ref(false)

const selectedRoomLabel = computed(() => {
  if (!selectedRoomId.value) return 'all rooms'
  const r = rooms.value.find(r => r.room_id === selectedRoomId.value)
  return r ? r.room_name : 'all rooms'
})

function selectRoom(id) {
  selectedRoomId.value = id
  roomPickerOpen.value = false
  refresh()
}

async function loadRooms() {
  try { rooms.value = await fetchRooms() } catch {}
}

const today      = new Date()
const toDateStr  = d => d.toISOString().slice(0, 10)

const selectedDate = ref(toDateStr(today))
const hourFrom     = ref(0)
const hourTo       = ref(23)
const pickerOpen   = ref(false)
const activePreset = ref('today')

const presets = [
  { key: 'today',     label: 'today',       date: toDateStr(today) },
  { key: 'yesterday', label: 'yesterday',   date: toDateStr(new Date(Date.now() - 864e5)) },
  { key: '7d',        label: 'last 7 days', date: toDateStr(new Date(Date.now() - 6*864e5)) },
]

const isToday = computed(() => selectedDate.value === toDateStr(today))

const selectedLabel = computed(() => {
  if (activePreset.value === 'today')     return 'today'
  if (activePreset.value === 'yesterday') return 'yesterday'
  if (activePreset.value === '7d')        return 'last 7 days'
  return selectedDate.value
})

const calYear  = ref(today.getFullYear())
const calMonth = ref(today.getMonth())

const calMonthLabel = computed(() =>
  new Date(calYear.value, calMonth.value, 1)
    .toLocaleString('default', { month: 'long', year: 'numeric' })
)

function prevMonth() {
  if (calMonth.value === 0) { calMonth.value = 11; calYear.value-- }
  else calMonth.value--
}
function nextMonth() {
  if (calMonth.value === 11) { calMonth.value = 0; calYear.value++ }
  else calMonth.value++
}

const calCells = computed(() => {
  const first    = new Date(calYear.value, calMonth.value, 1)
  const dowFirst = (first.getDay() + 6) % 7
  const daysInMonth = new Date(calYear.value, calMonth.value + 1, 0).getDate()
  const todayStr = toDateStr(today)
  const cells = []
  for (let i = 0; i < dowFirst; i++) cells.push({ empty: true, key: `e${i}` })
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${calYear.value}-${String(calMonth.value+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    cells.push({
      empty: false, d, date, key: date,
      isToday:    date === todayStr,
      isSelected: date === selectedDate.value,
      isFuture:   date > todayStr,
    })
  }
  return cells
})

function selectDate(date) { selectedDate.value = date; activePreset.value = '' }
function applyPreset(p)   { activePreset.value = p.key; selectedDate.value = p.date }
function togglePicker()   { pickerOpen.value = !pickerOpen.value }
function applyAndClose()  { pickerOpen.value = false; refresh() }

const hourOptions = Array.from({ length: 24 }, (_, h) => ({
  v: h, l: `${String(h).padStart(2,'0')}:00`
}))

const hourlyTrend = ref([])
const heatmapData = ref([])
const utilization = ref([])
const loading     = ref(false)
const alerts      = ref([])

async function refresh() {
  loading.value = true
  try {
    const p = new URLSearchParams({
      date:      selectedDate.value,
      hour_from: hourFrom.value,
      hour_to:   hourTo.value,
    })
    if (selectedRoomId.value) p.set('room_id', selectedRoomId.value)

    const [trend, heatmap, util, alertList] = await Promise.all([
      fetchHourlyTrend(p.toString()).catch(() => []),
      fetchWeeklyHeatmap(p.toString()).catch(() => []),
      fetchRoomUtilization(p.toString()).catch(() => []),
      fetchAlerts().catch(() => []),
    ])
    hourlyTrend.value = trend
    heatmapData.value = heatmap
    utilization.value = util
    alerts.value      = alertList
  } catch (err) {
    console.warn('Analytics refresh failed:', err.message)
  } finally {
    loading.value = false
  }
}

let timer = null
onMounted(() => { loadRooms(); refresh(); timer = setInterval(() => { if (isToday.value) refresh() }, 30000) })
onUnmounted(() => clearInterval(timer))
watch(selectedDate, refresh)

const filteredUtilization = computed(() =>
  selectedRoomId.value
    ? utilization.value.filter(r => r.room_id === selectedRoomId.value)
    : utilization.value
)

const stats = computed(() => {
  const data = filteredUtilization.value
  return {
    totalRooms:    utilization.value.length,
    occupiedRooms: data.filter(r => (r.occupancy_count ?? 0) > 0).length,
    peakCount:     data.length ? Math.max(...data.map(r => r.occupancy_count ?? 0)) : 0,
    avgPct: data.length
      ? Math.round(data.reduce((s, r) =>
          s + ((r.occupancy_count ?? 0) / (r.capacity ?? 40)) * 100, 0) / data.length)
      : 0,
    overCapacity: data.filter(r => (r.occupancy_count ?? 0) >= (r.capacity ?? 40)).length,
  }
})

const alertRooms = computed(() =>
  alerts.value
    .filter(a => !a.is_resolved)
    .filter(a => !selectedRoomId.value || a.room_id === selectedRoomId.value)
)

const visibleHours = computed(() => {
  const hrs = []
  for (let h = hourFrom.value; h <= hourTo.value; h++) hrs.push(h)
  return hrs
})

const visibleXLabels = computed(() =>
  visibleHours.value.map(h => {
    if (h === 0)  return '12am'
    if (h === 12) return '12pm'
    return h < 12 ? `${h}am` : `${h-12}pm`
  })
)

function xPos(i) {
  const n = visibleHours.value.length
  if (n <= 1) return 365
  return 60 + i * (630 / (n - 1))
}

const chartPoints = computed(() => {
  const byHour = {}
  hourlyTrend.value.forEach(d => { byHour[d.hour] = d.avg_pct })
  return visibleHours.value
    .map((h, i) => byHour[h] !== undefined
      ? { x: xPos(i), y: 230 - Math.min(100, Math.max(0, byHour[h])) * 2.1 }
      : null)
    .filter(Boolean)
})

const linePath = computed(() =>
  chartPoints.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
)
const areaPath = computed(() => {
  const pts = chartPoints.value
  if (pts.length < 2) return ''
  return `${linePath.value} L${pts[pts.length-1].x},230 L${pts[0].x},230 Z`
})

const HEATMAP_HOURS     = [8,10,12,14,16,18,20,22]
const heatmapHourLabels = ['8am','10am','12pm','2pm','4pm','6pm','8pm','10pm']
const DAY_LABELS        = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const fallbackHeatmap = [
  { day: 'Mon', values: [10,40,75,80,70,30,5,0] },
  { day: 'Tue', values: [15,55,85,90,80,45,10,0] },
  { day: 'Wed', values: [20,60,100,95,88,50,15,0] },
  { day: 'Thu', values: [12,45,70,75,65,35,8,0] },
  { day: 'Fri', values: [18,50,80,85,72,20,5,0] },
]

const heatmapRows = computed(() => {
  if (!heatmapData.value.length) return fallbackHeatmap
  const lookup = {}
  heatmapData.value.forEach(r => {
    lookup[r.day_of_week] = lookup[r.day_of_week] || {}
    lookup[r.day_of_week][r.hour] = Math.round(r.avg_pct)
  })
  const days = Object.keys(lookup).map(Number).sort((a,b) => a-b)
  return days.map(dow => ({
    day: DAY_LABELS[dow - 1],
    values: HEATMAP_HOURS.map(h => lookup[dow][h] ?? 0)
  }))
})

function heatLevel(v) {
  if (v >= 100) return 4
  if (v >= 80)  return 3
  if (v >= 50)  return 2
  if (v > 0)    return 1
  return 0
}

function utilPct(room) {
  return Math.min(100, Math.round(((room.occupancy_count ?? 0) / (room.capacity ?? 40)) * 100))
}
function utilColor(room) {
  const p = utilPct(room)
  if (p >= 100) return 'var(--color-danger)'
  if (p >= 85)  return 'var(--color-warning)'
  return 'var(--color-success)'
}
function utilStatus(room) {
  const p = utilPct(room)
  if (p >= 100) return { label: 'over cap.',  pill: 'badge-danger' }
  if (p >= 85)  return { label: 'near full',  pill: 'badge-warning' }
  return { label: 'normal', pill: 'badge-success' }
}
function formatTime(ts) {
  if (!ts) return '--:--'
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const chartTab       = ref('trend')   
const forecastLoading = ref(false)
const forecastData   = ref([])        

const tomorrowStr = computed(() => {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
})
const forecastDate     = ref(tomorrowStr.value)
const forecastHourFrom = ref(8)
const forecastHourTo   = ref(18)

async function runForecast() {
  forecastLoading.value = true
  try {
    const p = new URLSearchParams({
      date:      forecastDate.value,
      hour_from: forecastHourFrom.value,
      hour_to:   forecastHourTo.value,
    })
    if (selectedRoomId.value) p.set('room_id', selectedRoomId.value)
    forecastData.value = await fetchForecast(p.toString())
  } catch (err) {
    console.warn('Forecast failed:', err.message)
    forecastData.value = []
  } finally {
    forecastLoading.value = false
  }
}

watch(chartTab, val => { if (val === 'forecast') runForecast() })

// x-axis helpers for forecast
const forecastHours = computed(() => forecastData.value.map(d => d.hour))

const forecastXLabels = computed(() =>
  forecastHours.value.map(h => {
    if (h === 0)  return '12am'
    if (h === 12) return '12pm'
    return h < 12 ? `${h}am` : `${h - 12}pm`
  })
)

function forecastXPos(i) {
  const n = forecastHours.value.length
  if (n <= 1) return 365
  return 60 + i * (630 / (n - 1))
}

function forecastHourLabel(h) {
  if (h === 0)  return '12am'
  if (h === 12) return '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}

// SVG points and paths for forecast chart
const forecastPoints = computed(() =>
  forecastData.value.map((d, i) => ({
    x:    forecastXPos(i),
    y:    230 - Math.min(100, Math.max(0, d.predicted_pct)) * 2.1,
    pct:  d.predicted_pct,
    hour: d.hour,
  }))
)

const forecastLinePath = computed(() =>
  forecastPoints.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
)

const forecastBandPath = computed(() => {
  const data = forecastData.value
  if (data.length < 2) return ''
  const upperPts = data.map((d, i) => ({
    x: forecastXPos(i),
    y: 230 - Math.min(100, Math.max(0, d.upper_pct)) * 2.1
  }))
  const lowerPts = data.map((d, i) => ({
    x: forecastXPos(i),
    y: 230 - Math.min(100, Math.max(0, d.lower_pct)) * 2.1
  }))
  const up   = upperPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const down = [...lowerPts].reverse().map(p => `L${p.x},${p.y}`).join(' ')
  return `${up} ${down} Z`
})

// Summary stats
const forecastPeak = computed(() => {
  if (!forecastData.value.length) return { hour: 0, pct: 0 }
  return forecastData.value.reduce((best, d) =>
    d.predicted_pct > best.predicted_pct ? { hour: d.hour, pct: d.predicted_pct } : best,
    { hour: 0, pct: 0 }
  )
})

const forecastAvg = computed(() => {
  if (!forecastData.value.length) return 0
  return Math.round(forecastData.value.reduce((s, d) => s + d.predicted_pct, 0) / forecastData.value.length)
})

const forecastOverCapacity = computed(() =>
  forecastPoints.value.filter(p => p.pct >= 80)
)
</script>

<style>
@import '../assets/analytics.css';
</style>