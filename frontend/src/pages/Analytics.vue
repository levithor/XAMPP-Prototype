<template>
  <div style="display:contents">

    <div class="topbar">
      <div>
        <div class="topbar-title">analytics &amp; reports</div>
        <div class="topbar-sub">chiang mai university | college of arts, media &amp; technology</div>
      </div>
      <div class="topbar-filters">
        <div class="filter-pill"><i class="ti ti-door" /> room 301</div>
        <div class="filter-pill"><i class="ti ti-calendar" /> today</div>
      </div>
    </div>

    <div class="content">

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">total rooms monitored</div>
          <div class="stat-value">{{ stats.totalRooms }}</div>
          <div class="stat-trend trend-up"><i class="ti ti-arrow-up" style="font-size:12px" /> 1 since last month</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">currently occupied</div>
          <div class="stat-value">{{ stats.occupiedRooms }}</div>
          <div class="stat-trend trend-neutral">of {{ stats.totalRooms }} rooms active</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">avg occupancy rate</div>
          <div class="stat-value">{{ stats.avgPct }}%</div>
          <div class="stat-trend trend-up"><i class="ti ti-arrow-up" style="font-size:12px" /> 8% vs last week</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">alerts today</div>
          <div class="stat-value">{{ stats.overCapacity }}</div>
          <div class="stat-trend trend-up">
            <i class="ti ti-arrow-up" style="font-size:12px" />
            {{ stats.overCapacity }} overcrowding event{{ stats.overCapacity !== 1 ? 's' : '' }}
          </div>
        </div>
      </div>

      <div class="analytics-grid">

        <div class="panel">
          <div class="panel-header">
            <span class="section-title">hourly occupancy trend</span>
          </div>
          <div class="chart-legend">
            <div class="legend-item"><span class="legend-swatch"></span> avg occupancy</div>
            <div class="legend-item"><span class="legend-swatch dashed"></span> capacity limit</div>
          </div>

          <svg viewBox="0 0 700 280" style="width:100%; height:260px;">
            <g stroke="var(--color-border)" stroke-width="1">
              <line x1="40" y1="20" x2="40" y2="230" />
              <line x1="40" y1="230" x2="690" y2="230" />
            </g>
            <g font-size="10" fill="var(--color-text-muted)" font-family="-apple-system,sans-serif">
              <text x="32" y="24" text-anchor="end">100%</text>
              <text x="32" y="66" text-anchor="end">80%</text>
              <text x="32" y="108" text-anchor="end">60%</text>
              <text x="32" y="150" text-anchor="end">40%</text>
              <text x="32" y="192" text-anchor="end">20%</text>
              <text x="32" y="234" text-anchor="end">0%</text>
            </g>
            <g font-size="10" fill="var(--color-text-muted)" font-family="-apple-system,sans-serif" text-anchor="middle">
              <text v-for="(lbl, i) in xLabels" :key="lbl" :x="60 + i*59" y="250">{{ lbl }}</text>
            </g>
            <line x1="40" y1="66" x2="690" y2="66"
                  stroke="var(--color-danger)" stroke-width="1.5" stroke-dasharray="6 5" />
            <!-- area + line — computed from real API data -->
            <path v-if="chartPoints.length > 1" :d="areaPath"
                  fill="var(--color-accent)" opacity="0.08" />
            <path v-if="chartPoints.length > 1" :d="linePath"
                  fill="none" stroke="var(--color-accent)" stroke-width="2.5" stroke-linecap="round" />
            <circle v-for="p in chartPoints" :key="p.x"
                    :cx="p.x" :cy="p.y" r="4" fill="var(--color-accent)" />
          </svg>
        </div>

        <!-- LIVE ALERTS -->
        <div class="panel">
          <div class="panel-header">
            <span class="section-title">live alerts</span>
          </div>
          <div v-if="alertRooms.length === 0" class="alert-meta" style="padding:8px 0;">
            no active alerts
          </div>
          <div v-for="room in alertRooms" :key="room.room_id"
               class="alert-card" :class="room.occupancy_count >= room.capacity ? 'danger' : 'warning'">
            <div class="alert-dot" :class="room.occupancy_count >= room.capacity ? 'danger' : 'warning'"></div>
            <div>
              <div class="alert-title">
                {{ room.name }} {{ room.occupancy_count >= room.capacity ? 'overcrowded' : 'near capacity' }}
              </div>
              <div class="alert-meta">
                {{ formatTime(room.timestamp) }} | {{ room.occupancy_count }}/{{ room.capacity }} capacity
              </div>
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
              <tr>
                <th>room</th><th>current</th><th>capacity</th><th>utilization</th><th>status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="room in utilization" :key="room.room_id">
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
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { fetchHourlyTrend, fetchWeeklyHeatmap, fetchRoomUtilization } from '../api.js'
import { usePolling } from '../other/usePolling.js'

const hourlyTrend  = ref([])
const heatmapData  = ref([])
const utilization  = ref([])

const stats = computed(() => ({
  totalRooms:   utilization.value.length,
  occupiedRooms: utilization.value.filter(r => (r.occupancy_count ?? 0) > 0).length,
  avgPct: utilization.value.length
    ? Math.round(utilization.value.reduce((s, r) => s + ((r.occupancy_count ?? 0) / (r.capacity ?? 40)) * 100, 0) / utilization.value.length)
    : 0,
  overCapacity: utilization.value.filter(r => (r.occupancy_count ?? 0) >= (r.capacity ?? 40)).length,
}))

const alertRooms = computed(() =>
  utilization.value.filter(r => ((r.occupancy_count ?? 0) / (r.capacity ?? 40)) * 100 >= 85)
)

const xLabels = ['8am','9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm','6pm']
const CHART_HOURS = [8,9,10,11,12,13,14,15,16,17,18]

const chartPoints = computed(() => {
  const byHour = {}
  hourlyTrend.value.forEach(d => { byHour[d.hour] = d.avg_pct })
  return CHART_HOURS
    .map((h, i) => byHour[h] !== undefined
      ? { x: 60 + i * 59, y: 230 - Math.min(100, Math.max(0, byHour[h])) * 2.1 }
      : null)
    .filter(Boolean)
})

const linePath = computed(() =>
  chartPoints.value.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ')
)

const areaPath = computed(() => {
  const pts = chartPoints.value
  if (pts.length < 2) return ''
  return `${linePath.value} L${pts[pts.length-1].x},230 L${pts[0].x},230 Z`
})

const HEATMAP_HOURS = [8,10,12,14,16,18,20,22]
const heatmapHourLabels = ['8am','10am','12pm','2pm','4pm','6pm','8pm','10pm']
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

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

async function refresh() {
  try {
    const [trend, heatmap, util] = await Promise.all([
      fetchHourlyTrend().catch(() => []),
      fetchWeeklyHeatmap().catch(() => []),
      fetchRoomUtilization()
    ])
    hourlyTrend.value = trend
    heatmapData.value = heatmap
    utilization.value = util
  } catch (err) {
    console.warn('Analytics refresh failed:', err.message)
  }
}

usePolling(refresh, 15000)
</script>

<style>
@import '../assets/analytics.css';
</style>
