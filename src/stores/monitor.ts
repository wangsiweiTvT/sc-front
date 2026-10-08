import { computed, reactive } from 'vue'
import type { Device, DeviceStatusInfo, RealtimeSnapshot, Reading } from '@/api/types'
import { deviceApi } from '@/api/deviceApi'
import { monitorApi } from '@/api/monitorApi'
import { judgeDeviceStatus } from '@/core/statusRule'
import { POLL_INTERVAL_MS } from '@/config/params'
import { useAlarmsStore } from './alarms'
import { useSettingsStore } from './settings'

interface MonitorState {
  inited: boolean
  devices: Device[]
  readings: Record<string, Reading | null>
  statuses: Record<string, DeviceStatusInfo>
  timer: number | null
  lastRefreshAt: number | null
}

const state = reactive<MonitorState>({
  inited: false,
  devices: [],
  readings: {},
  statuses: {},
  timer: null,
  lastRefreshAt: null,
})

export function useMonitorStore() {
  const settings = useSettingsStore()
  const alarms = useAlarmsStore()

  /** 仅计算展示用状态角标;告警判定归后端检测器(§7),前端不再产告警 */
  async function refresh(): Promise<void> {
    if (state.devices.length === 0) return
    const snap: RealtimeSnapshot = await monitorApi.getRealtimeReadings()
    state.readings = snap.readings
    state.lastRefreshAt = snap.now
    for (const device of state.devices) {
      state.statuses[device.id] = judgeDeviceStatus({
        latestReading: snap.readings[device.id] ?? null,
        now: snap.now,
        rules: settings.rulesFor(device.id),
      })
    }
  }

  async function init(): Promise<void> {
    if (state.inited) return
    state.inited = true
    state.devices = await deviceApi.getDevices()
    await settings.init()
    await alarms.init()
    await refresh()
    state.timer = window.setInterval(() => {
      void refresh()
    }, POLL_INTERVAL_MS)
  }

  function stop(): void {
    if (state.timer !== null) {
      clearInterval(state.timer)
      state.timer = null
    }
  }

  const statusCounts = computed(() => {
    const counts = { online: 0, offline: 0, abnormal: 0 }
    for (const device of state.devices) {
      const s = state.statuses[device.id]?.status
      if (s === 'online' || s === 'offline' || s === 'abnormal') counts[s] += 1
    }
    return counts
  })

  return { state, init, refresh, stop, statusCounts }
}
