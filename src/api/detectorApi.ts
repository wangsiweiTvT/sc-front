import { request } from './http'

const useMock = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'

export interface DetectorStatus {
  running: boolean
  lastScanAt: number | null
  scansCount: number
}

/** 后端检测器运行状态(§7;mock 模式返回固定在线值,UI 侧不展示) */
export const detectorApi = {
  async getStatus(): Promise<DetectorStatus> {
    if (useMock) return { running: true, lastScanAt: Date.now(), scansCount: 0 }
    const payload = await request<{ running: boolean; last_scan_at: string | null; scans_count: number }>(
      '/api/detector/status',
    )
    const ts = payload.last_scan_at === null ? Number.NaN : Date.parse(payload.last_scan_at)
    return { running: payload.running, lastScanAt: Number.isNaN(ts) ? null : ts, scansCount: payload.scans_count }
  },
}
