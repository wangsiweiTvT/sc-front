import type { DeviceId, ParamKey, RealtimeSnapshot, Reading } from './types'
import { request } from './http'
import { readingFromRow, snapshotFromPayload, type SensorRow, type SnapshotPayload } from './adapters'
import { simulator } from '@/mock/simulator'
import { DEVICE_IDS } from '@/config/params'

const useMock = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'

let started = false

/** 真实模式下的"手动置离线"演示状态(契约 §4.6:前端本地表现,无持久化) */
const manualOffline = new Set<DeviceId>()

export const monitorApi = {
  async getRealtimeReadings(): Promise<RealtimeSnapshot> {
    if (useMock) {
      const now = Date.now()
      if (!started) {
        simulator.backfill(now)
        started = true
      }
      simulator.tick(now)
      const latest = simulator.latest()
      const readings = Object.fromEntries(DEVICE_IDS.map((id) => [id, latest[id] ?? null])) as RealtimeSnapshot['readings']
      return {
        now,
        readings,
        forcedOffline: DEVICE_IDS.filter((id) => simulator.isManuallyOffline(id)),
      }
    }
    const snapshot = snapshotFromPayload(await request<SnapshotPayload>('/api/readings/latest'))
    for (const id of manualOffline) {
      if (!snapshot.forcedOffline.includes(id)) snapshot.forcedOffline.push(id)
    }
    return snapshot
  },

  async getHistory(deviceId: DeviceId, paramKey: ParamKey): Promise<Reading[]> {
    if (useMock) {
      return simulator.history(deviceId).filter((r) => r.params[paramKey] !== undefined)
    }
    const rows = await request<SensorRow[]>(`/api/devices/${deviceId}/data`)
    return rows
      .map(readingFromRow)
      .filter((r): r is Reading => r !== null && r.params[paramKey] !== undefined)
  },

  async setDeviceOffline(deviceId: DeviceId, offline: boolean): Promise<void> {
    if (useMock) {
      simulator.setManualOffline(deviceId, offline)
      return
    }
    if (offline) manualOffline.add(deviceId)
    else manualOffline.delete(deviceId)
  },
}
