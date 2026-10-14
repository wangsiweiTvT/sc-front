import type { DeviceId, Receiver, ThresholdRule } from './types'
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
    // 兜底:三期之前的 localStorage 旧数据没有 subscribedDevices 字段,四期之前没有 wechatOpenid
    if (useMock) {
      return loadJSON<Receiver[]>(STORAGE_KEYS.receivers, []).map((r) => ({
        ...r,
        subscribedDevices: r.subscribedDevices ?? [],
        wechatOpenid: r.wechatOpenid ?? null,
      }))
    }
    return request<Receiver[]>('/api/receivers')
  },

  async addReceiver(input: {
    name: string
    phone: string
    subscribedDevices?: DeviceId[]
    wechatOpenid?: string | null
  }): Promise<Receiver> {
    const body = {
      name: input.name,
      phone: input.phone,
      subscribedDevices: input.subscribedDevices ?? [],
      wechatOpenid: input.wechatOpenid ?? null,
    }
    if (useMock) {
      receiverSeq += 1
      const r: Receiver = { id: `rcv-${Date.now()}-${receiverSeq}`, ...body }
      saveJSON(STORAGE_KEYS.receivers, [...loadJSON<Receiver[]>(STORAGE_KEYS.receivers, []), r])
      return r
    }
    return request<Receiver>('/api/receivers', { method: 'POST', body })
  },

  async updateReceiver(receiver: Receiver): Promise<void> {
    if (useMock) {
      saveJSON(
        STORAGE_KEYS.receivers,
        loadJSON<Receiver[]>(STORAGE_KEYS.receivers, []).map((r) => (r.id === receiver.id ? receiver : r)),
      )
      return
    }
    await request<void>(`/api/receivers/${receiver.id}`, {
      method: 'PUT',
      // 四期 §9:wechatOpenid 必传可空(清空传 null),漏了后端 422
      body: {
        name: receiver.name,
        phone: receiver.phone,
        subscribedDevices: receiver.subscribedDevices,
        wechatOpenid: receiver.wechatOpenid,
      },
    })
  },

  async removeReceiver(id: string): Promise<void> {
    if (useMock) {
      saveJSON(STORAGE_KEYS.receivers, loadJSON<Receiver[]>(STORAGE_KEYS.receivers, []).filter((r) => r.id !== id))
      return
    }
    await request<void>(`/api/receivers/${id}`, { method: 'DELETE' })
  },
}
