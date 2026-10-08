import type { Device } from './types'
import { DEVICES } from '@/config/params'

/** v1 设备档案由前端本地维护(契约 §4.6),后端不提供该数据 */
export const deviceApi = {
  async getDevices(): Promise<Device[]> {
    return DEVICES
  },
}
