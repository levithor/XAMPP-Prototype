<template>
  <div style="display:contents">

    <div class="topbar">
      <div>
        <div class="topbar-title">alerts</div>
        <div class="topbar-sub">camt building · {{ unacknowledgedCount }} unacknowledged</div>
      </div>
    </div>

    <div class="content">

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-icon red"><i class="ti ti-alert-circle" /></div>
          <div class="stat-label">active alerts</div>
          <div class="stat-value">{{ unacknowledgedCount }}</div>
          <div class="stat-sub">unacknowledged</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber"><i class="ti ti-alert-triangle" /></div>
          <div class="stat-label">overcrowding events</div>
          <div class="stat-value">{{ overcrowdingCount }}</div>
          <div class="stat-sub">total today</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber"><i class="ti ti-clock" /></div>
          <div class="stat-label">unusual activity</div>
          <div class="stat-value">{{ unusualCount }}</div>
          <div class="stat-sub">outside normal hours</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="ti ti-circle-check" /></div>
          <div class="stat-label">acknowledged</div>
          <div class="stat-value">{{ acknowledgedCount }}</div>
          <div class="stat-sub">resolved alerts</div>
        </div>
      </div>

      <div class="alerts-grid">

        <div class="panel">
          <div class="panel-header">
            <span class="section-title">active alerts</span>
            <span v-if="unacknowledgedCount > 0"
                  class="section-link" style="cursor:pointer;"
                  @click="acknowledgeAll">
              acknowledge all <i class="ti ti-check" style="font-size:12px" />
            </span>
          </div>

          <div v-if="activeAlerts.length === 0"
               style="padding: 20px 0; font-size:13px; color:var(--color-text-muted); text-align:center;">
            <i class="ti ti-circle-check" style="font-size:28px; display:block; margin-bottom:8px;" />
            no active alerts
          </div>

          <div v-for="alert in activeAlerts" :key="alert.alert_id" class="alert-row">
            <div class="alert-row-left">
              <div class="alert-dot-large" :class="dotClass(alert.alert_type)"></div>
              <div>
                <div class="alert-row-title">{{ alert.message }}</div>
                <div class="alert-row-meta">
                  room {{ alert.room_id }} &nbsp;·&nbsp; {{ formatTime(alert.created_at) }}
                </div>
              </div>
            </div>
            <div class="alert-row-actions">
              <button class="alert-btn-ack" @click="ackAlert(alert.alert_id)">
                <i class="ti ti-check" /> acknowledge
              </button>
              <button class="alert-btn-del" @click="delAlert(alert.alert_id)">
                <i class="ti ti-trash" />
              </button>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <span class="section-title">breakdown</span>
          </div>

          <div class="breakdown-item" v-for="item in breakdown" :key="item.label">
            <div class="breakdown-left">
              <div class="feed-dot" :style="{ background: item.color }"></div>
              <span class="breakdown-label">{{ item.label }}</span>
            </div>
            <div class="breakdown-right">
              <div class="util-bar-wrap" style="width:80px;">
                <div class="util-bar-fill"
                     :style="{ width: item.pct + '%', background: item.color }"></div>
              </div>
              <span class="breakdown-count">{{ item.count }}</span>
            </div>
          </div>
        </div>

      </div>

      <div class="panel">
        <div class="panel-header">
          <span class="section-title">alert history</span>
          <div style="display:flex; gap:8px;">
            <div v-for="f in filters" :key="f.key"
                 class="filter-chip" :class="{ active: activeFilter === f.key }"
                 @click="activeFilter = f.key"
                 style="font-size:11px; padding:4px 10px;">
              {{ f.label }}
            </div>
          </div>
        </div>

        <table class="rooms-table">
          <thead>
            <tr>
              <th>message</th>
              <th>room</th>
              <th>type</th>
              <th>time</th>
              <th>status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredAlerts.length === 0">
              <td colspan="6" style="padding:16px 0; color:var(--color-text-muted); font-size:13px;">
                no alerts found
              </td>
            </tr>
            <tr v-for="alert in filteredAlerts" :key="'h-' + alert.alert_id">
              <td>{{ alert.message }}</td>
              <td class="muted">room {{ alert.room_id }}</td>
              <td>
                <span class="room-badge" :class="typeBadge(alert.alert_type)">
                  {{ typeLabel(alert.alert_type) }}
                </span>
              </td>
              <td class="muted">{{ formatTime(alert.created_at) }}</td>
              <td>
                <span class="room-badge" :class="alert.is_resolved ? 'badge-success' : 'badge-danger'">
                  {{ alert.is_resolved ? 'acknowledged' : 'active' }}
                </span>
              </td>
              <td class="row-actions">
                <i v-if="!alert.is_resolved"
                   class="ti ti-check" title="acknowledge"
                   @click="ackAlert(alert.alert_id)"
                   style="margin-right:10px; cursor:pointer;" />
                <i v-else
                   class="ti ti-x" title="unacknowledge"
                   @click="unackAlert(alert.alert_id)"
                   style="margin-right:10px; cursor:pointer;" />
                <i class="ti ti-trash" title="delete"
                   @click="delAlert(alert.alert_id)"
                   style="cursor:pointer;" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { fetchAlerts, acknowledgeAlert, unacknowledgeAlert, deleteAlert } from '../api.js'
import { usePolling } from '../other/usePolling.js'

const alerts = ref([])
const activeFilter = ref('all')

const filters = [
  { key: 'all',            label: 'all' },
  { key: 'active',         label: 'active' },
  { key: 'acknowledged',   label: 'acknowledged' },
  { key: 'overcrowding',   label: 'overcrowding' },
  { key: 'unusual_activity', label: 'unusual activity' },
]

const activeAlerts = computed(() =>
  alerts.value.filter(a => !a.is_resolved)
)

const filteredAlerts = computed(() => {
  if (activeFilter.value === 'all')          return alerts.value
  if (activeFilter.value === 'active')       return alerts.value.filter(a => !a.is_resolved)
  if (activeFilter.value === 'acknowledged') return alerts.value.filter(a => a.is_resolved)
  return alerts.value.filter(a => a.alert_type === activeFilter.value)
})

const unacknowledgedCount = computed(() => alerts.value.filter(a => !a.is_resolved).length)
const acknowledgedCount   = computed(() => alerts.value.filter(a => a.is_resolved).length)
const overcrowdingCount   = computed(() => alerts.value.filter(a => a.alert_type === 'overcrowding').length)
const unusualCount        = computed(() => alerts.value.filter(a => a.alert_type === 'unusual_activity').length)

const breakdown = computed(() => {
  const activeOvercrowding = activeAlerts.value.filter(a => a.alert_type === 'overcrowding').length
  const activeUnusual      = activeAlerts.value.filter(a => a.alert_type === 'unusual_activity').length
  const activeSystem       = activeAlerts.value.filter(a => a.alert_type === 'system').length
  const total = activeAlerts.value.length || 1
  return [
    { label: 'overcrowding',     count: activeOvercrowding, color: 'var(--color-danger)',  pct: Math.round(activeOvercrowding / total * 100) },
    { label: 'unusual activity', count: activeUnusual,      color: 'var(--color-warning)', pct: Math.round(activeUnusual / total * 100) },
    { label: 'system',           count: activeSystem,       color: 'var(--color-accent)',  pct: Math.round(activeSystem / total * 100) },
  ]
})

function formatTime(ts) {
  if (!ts) return '--'
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function dotClass(type) {
  if (type === 'overcrowding')    return 'dot-danger'
  if (type === 'unusual_activity') return 'dot-warning'
  return 'dot-info'
}

function typeBadge(type) {
  if (type === 'overcrowding')    return 'badge-danger'
  if (type === 'unusual_activity') return 'badge-warning'
  return 'badge-success'
}

function typeLabel(type) {
  if (type === 'overcrowding')    return 'overcrowding'
  if (type === 'unusual_activity') return 'unusual activity'
  return 'system'
}

async function ackAlert(id) {
  try {
    await acknowledgeAlert(id);
    await refresh()
  } catch (err) { console.warn(err) }
}

async function unackAlert(id) {
  try {
    await unacknowledgeAlert(id);
    await refresh()
  } catch (err) { console.warn(err) }
}

async function delAlert(id) {
  if (!confirm('delete this alert from history?')) return
  try {
    await deleteAlert(id);
    await refresh()
  } catch (err) { console.warn(err) }
}

async function acknowledgeAll() {
  try {
    await Promise.all(activeAlerts.value.map(a => acknowledgeAlert(a.alert_id)))
    await refresh()
  } catch (err) { console.warn(err) }
}

async function refresh() {
  try {
    const data = await fetchAlerts()
    alerts.value = data.map(a => ({ ...a, is_resolved: Boolean(a.is_resolved) }))
  } catch (err) { console.warn('Alerts refresh failed:', err.message) }
}

usePolling(refresh, 10000)
</script>

<style>
@import '../assets/alerts.css';
</style>