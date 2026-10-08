import type { DeviceId, ParamKey, RealtimeSnapshot, Reading } from './types'
import { request } from './http'
import { readingFromRow, snapshotFromPayload, type SensorRow, type SnapshotPayload } from './adapters'
import { simulator } from '@/mock/simulator'
import { DEVICE_IDS } from '@/config/params'

const useMock = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'

let started = false

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
      return { now, readings }
    }
    return snapshotFromPayload(await request<SnapshotPayload>('/api/readings/latest'))
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
}
