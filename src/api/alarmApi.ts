import type { AlarmRecord } from './types'
import { request } from './http'
import { loadJSON, saveJSON, STORAGE_KEYS } from '@/mock/memory'
import { ALARM_MAX_COUNT } from '@/config/params'

const useMock = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'

export const alarmApi = {
  async getAlarms(): Promise<AlarmRecord[]> {
    if (useMock) return loadJSON<AlarmRecord[]>(STORAGE_KEYS.alarms, [])
    return request<AlarmRecord[]>('/alarms')
  },

  async appendAlarms(records: AlarmRecord[]): Promise<void> {
    if (useMock) {
      const all = [...loadJSON<AlarmRecord[]>(STORAGE_KEYS.alarms, []), ...records]
      saveJSON(STORAGE_KEYS.alarms, all.slice(-ALARM_MAX_COUNT))
      return
    }
    return request<void>('/alarms')
  },

  async updateAlarm(record: AlarmRecord): Promise<void> {
    if (useMock) {
      const all = loadJSON<AlarmRecord[]>(STORAGE_KEYS.alarms, []).map((a) => (a.id === record.id ? record : a))
      saveJSON(STORAGE_KEYS.alarms, all)
      return
    }
    return request<void>(`/alarms/${record.id}`)
  },

  async clearAlarms(): Promise<void> {
    if (useMock) {
      saveJSON(STORAGE_KEYS.alarms, [])
      return
    }
    return request<void>('/alarms')
  },
}
