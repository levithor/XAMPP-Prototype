<template>
  <div style="display:contents">

    <div class="topbar">
      <div>
        <div class="topbar-title">alerts</div>
        <div class="topbar-sub">camt building · {{ unacknowledgedCount }} unacknowledged</div>
      </div>
    </div>

    <div class="content">

      <!-- ── Stat cards ───────────────────────────────────────────────────── -->
      <div class="stat-grid" style="grid-template-columns: repeat(5, 1fr);">
        <div class="stat-card">
          <div class="stat-icon red"><i class="ti ti-alert-circle" /></div>
          <div class="stat-label">active alerts</div>
          <div class="stat-value">{{ unacknowledgedCount }}</div>
          <div class="stat-sub">unacknowledged</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red"><i class="ti ti-users" /></div>
          <div class="stat-label">overcrowding</div>
          <div class="stat-value">{{ overcrowdingCount }}</div>
          <div class="stat-sub">active right now</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber"><i class="ti ti-alert-triangle" /></div>
          <div class="stat-label">near capacity</div>
          <div class="stat-value">{{ nearCapacityCount }}</div>
          <div class="stat-sub">active right now</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue"><i class="ti ti-camera-off" /></div>
          <div class="stat-label">system alerts</div>
          <div class="stat-value">{{ systemCount }}</div>
          <div class="stat-sub">camera / system issues</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="ti ti-circle-check" /></div>
          <div class="stat-label">acknowledged</div>
          <div class="stat-value">{{ acknowledgedCount }}</div>
          <div class="stat-sub">resolved alerts</div>
        </div>
      </div>

      <!-- ── Active alerts (full width now breakdown is gone) ─────────────── -->
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
             style="padding:20px 0; font-size:13px; color:var(--color-text-muted); text-align:center;">
          <i class="ti ti-circle-check" style="font-size:28px; display:block; margin-bottom:8px;" />
          no active alerts
        </div>

        <div v-for="alert in activeAlerts" :key="alert.alert_id" class="alert-row">
          <div class="alert-row-left">
            <div class="alert-dot-large" :class="dotClass(alert.alert_type)"></div>
            <div>
              <div class="alert-row-title">{{ alert.message }}</div>
              <div class="alert-row-meta">
                <span class="room-badge" :class="typeBadge(alert.alert_type)" style="font-size:10px; margin-right:6px;">
                  {{ typeLabel(alert.alert_type) }}
                </span>
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

      <!-- ── Alert history ─────────────────────────────────────────────────── -->
      <div class="panel">
        <div class="panel-header">
          <span class="section-title">alert history</span>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
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
                   class="ti ti-rotate" title="unacknowledge"
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

const alerts      = ref([])
const activeFilter = ref('all')

const filters = [
  { key: 'all',                label: 'all' },
  { key: 'active',             label: 'active' },
  { key: 'acknowledged',       label: 'acknowledged' },
  { key: 'overcrowding',       label: 'overcrowding' },
  { key: 'near_capacity',      label: 'near capacity' },
  { key: 'system_malfunction', label: 'system' },
]

// ── Computed lists ─────────────────────────────────────────────────────────

const activeAlerts = computed(() =>
  alerts.value.filter(a => !a.is_resolved)
)

const filteredAlerts = computed(() => {
  const key = activeFilter.value
  if (key === 'all')          return alerts.value
  if (key === 'active')       return alerts.value.filter(a => !a.is_resolved)
  if (key === 'acknowledged') return alerts.value.filter(a =>  a.is_resolved)
  // Type filters — match exactly against the normalised alert_type
  return alerts.value.filter(a => a.alert_type === key)
})

// ── Stat counts ────────────────────────────────────────────────────────────

const unacknowledgedCount = computed(() => alerts.value.filter(a => !a.is_resolved).length)
const acknowledgedCount   = computed(() => alerts.value.filter(a =>  a.is_resolved).length)
const overcrowdingCount   = computed(() => alerts.value.filter(a => a.alert_type === 'overcrowding'       && !a.is_resolved).length)
const nearCapacityCount   = computed(() => alerts.value.filter(a => a.alert_type === 'near_capacity'      && !a.is_resolved).length)
const systemCount         = computed(() => alerts.value.filter(a => a.alert_type === 'system_malfunction' && !a.is_resolved).length)

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(ts) {
  if (!ts) return '--'
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function dotClass(type) {
  if (type === 'overcrowding')       return 'dot-danger'
  if (type === 'near_capacity')      return 'dot-warning'
  if (type === 'system_malfunction') return 'dot-info'
  return 'dot-info'
}

function typeBadge(type) {
  if (type === 'overcrowding')       return 'badge-danger'
  if (type === 'near_capacity')      return 'badge-warning'
  if (type === 'system_malfunction') return 'badge-success'
  return 'badge-success'
}

function typeLabel(type) {
  if (type === 'overcrowding')       return 'overcrowding'
  if (type === 'near_capacity')      return 'near capacity'
  if (type === 'system_malfunction') return 'system'
  return type ?? 'unknown'
}

// ── Actions ────────────────────────────────────────────────────────────────

async function ackAlert(id) {
  try { await acknowledgeAlert(id); await refresh() }
  catch (err) { console.warn(err) }
}

async function unackAlert(id) {
  try { await unacknowledgeAlert(id); await refresh() }
  catch (err) { console.warn(err) }
}

async function delAlert(id) {
  if (!confirm('delete this alert from history?')) return
  try { await deleteAlert(id); await refresh() }
  catch (err) { console.warn(err) }
}

async function acknowledgeAll() {
  try {
    await Promise.all(activeAlerts.value.map(a => acknowledgeAlert(a.alert_id)))
    await refresh()
  } catch (err) { console.warn(err) }
}

// ── Data fetch ─────────────────────────────────────────────────────────────
// Normalise alert_type to lowercase + trimmed so filter comparisons
// always work regardless of how the DB stores the value.

async function refresh() {
  try {
    const data = await fetchAlerts()
    alerts.value = data.map(a => ({
      ...a,
      is_resolved: Boolean(a.is_resolved),
      alert_type:  (a.alert_type ?? '').toLowerCase().trim(),
    }))
  } catch (err) {
    console.warn('Alerts refresh failed:', err.message)
  }
}

usePolling(refresh, 10000)
</script>

<style>
@import '../assets/alerts.css';
</style>