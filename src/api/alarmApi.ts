import type { AlarmRecord } from './types'
import { request } from './http'
import { alarmFromPayload, type AlarmPayload } from './adapters'
import { loadJSON, saveJSON, STORAGE_KEYS } from '@/mock/memory'

const useMock = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'

/** 告警只读(判定与写入都在后端,§7):列表 + 清空 */
export const alarmApi = {
  async getAlarms(): Promise<AlarmRecord[]> {
    if (useMock) return loadJSON<AlarmRecord[]>(STORAGE_KEYS.alarms, [])
    const payloads = await request<AlarmPayload[]>('/api/alarms')
    return payloads.map(alarmFromPayload)
  },

  async clearAlarms(): Promise<void> {
    if (useMock) {
      saveJSON(STORAGE_KEYS.alarms, [])
      return
    }
    await request<void>('/api/alarms', { method: 'DELETE' })
  },
}
