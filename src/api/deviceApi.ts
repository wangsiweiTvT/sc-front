import type { Device } from './types'
import { request } from './http'
import { DEVICES } from '@/config/params'

const useMock = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'

export const deviceApi = {
  async getDevices(): Promise<Device[]> {
    if (useMock) return DEVICES
    return request<Device[]>('/devices')
  },
}
