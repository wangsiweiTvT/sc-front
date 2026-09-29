import type { DeviceId, ParamKey, RealtimeSnapshot, Reading } from './types'
import { request } from './http'
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
      return {
        now,
        readings,
        forcedOffline: DEVICE_IDS.filter((id) => simulator.isManuallyOffline(id)),
      }
    }
    return request<RealtimeSnapshot>('/readings/latest')
  },

  async getHistory(deviceId: DeviceId, paramKey: ParamKey): Promise<Reading[]> {
    if (useMock) {
      return simulator.history(deviceId).filter((r) => r.params[paramKey] !== undefined)
    }
    return request<Reading[]>(`/readings/history?deviceId=${deviceId}&paramKey=${paramKey}`)
  },

  async setDeviceOffline(deviceId: DeviceId, offline: boolean): Promise<void> {
    if (useMock) {
      simulator.setManualOffline(deviceId, offline)
      return
    }
    return request<void>(`/devices/${deviceId}/simulate-offline`)
  },
}
