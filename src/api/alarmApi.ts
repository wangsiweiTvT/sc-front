import type { AlarmRecord } from './types'
import { request } from './http'
import { alarmFromPayload, alarmToPayload, type AlarmPayload } from './adapters'
import { loadJSON, saveJSON, STORAGE_KEYS } from '@/mock/memory'
import { ALARM_MAX_COUNT } from '@/config/params'

const useMock = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'

export const alarmApi = {
  async getAlarms(): Promise<AlarmRecord[]> {
    if (useMock) return loadJSON<AlarmRecord[]>(STORAGE_KEYS.alarms, [])
    const payloads = await request<AlarmPayload[]>('/api/alarms')
    return payloads.map(alarmFromPayload)
  },

  async appendAlarms(records: AlarmRecord[]): Promise<void> {
    if (useMock) {
      const all = [...loadJSON<AlarmRecord[]>(STORAGE_KEYS.alarms, []), ...records]
      saveJSON(STORAGE_KEYS.alarms, all.slice(-ALARM_MAX_COUNT))
      return
    }
    await request<void>('/api/alarms', { method: 'POST', body: records.map(alarmToPayload) })
  },

  async updateAlarm(record: AlarmRecord): Promise<void> {
    if (useMock) {
      const all = loadJSON<AlarmRecord[]>(STORAGE_KEYS.alarms, []).map((a) => (a.id === record.id ? record : a))
      saveJSON(STORAGE_KEYS.alarms, all)
      return
    }
    await request<void>(`/api/alarms/${record.id}`, { method: 'PUT', body: alarmToPayload(record) })
  },

  async clearAlarms(): Promise<void> {
    if (useMock) {
      saveJSON(STORAGE_KEYS.alarms, [])
      return
    }
    await request<void>('/api/alarms', { method: 'DELETE' })
  },
}
