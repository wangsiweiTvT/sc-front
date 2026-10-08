import type { Receiver, ThresholdRule } from './types'
import { request } from './http'
import { loadJSON, saveJSON, STORAGE_KEYS } from '@/mock/memory'
import { defaultThresholds } from '@/config/params'

const useMock = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'

let receiverSeq = 0

export const configApi = {
  async getThresholds(): Promise<ThresholdRule[]> {
    if (useMock) return loadJSON<ThresholdRule[]>(STORAGE_KEYS.thresholds, defaultThresholds())
    return request<ThresholdRule[]>('/api/thresholds')
  },

  async saveThresholds(rules: ThresholdRule[]): Promise<void> {
    if (useMock) {
      saveJSON(STORAGE_KEYS.thresholds, rules)
      return
    }
    await request<void>('/api/thresholds', { method: 'PUT', body: rules })
  },

  async getReceivers(): Promise<Receiver[]> {
    if (useMock) return loadJSON<Receiver[]>(STORAGE_KEYS.receivers, [])
    return request<Receiver[]>('/api/receivers')
  },

  async addReceiver(input: { name: string; phone: string }): Promise<Receiver> {
    if (useMock) {
      receiverSeq += 1
      const r: Receiver = { id: `rcv-${Date.now()}-${receiverSeq}`, ...input }
      saveJSON(STORAGE_KEYS.receivers, [...loadJSON<Receiver[]>(STORAGE_KEYS.receivers, []), r])
      return r
    }
    return request<Receiver>('/api/receivers', { method: 'POST', body: input })
  },

  async removeReceiver(id: string): Promise<void> {
    if (useMock) {
      saveJSON(STORAGE_KEYS.receivers, loadJSON<Receiver[]>(STORAGE_KEYS.receivers, []).filter((r) => r.id !== id))
      return
    }
    await request<void>(`/api/receivers/${id}`, { method: 'DELETE' })
  },
}
