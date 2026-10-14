import { request } from './http'

const useMock = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'

/** 契约 §9.3:最新关注且未绑定任何接收人的测试号用户;无人扫码时 openid 为 null */
export interface LatestFollower {
  openid: string | null
  subscribeTime: number | null
}

/** mock 注入:模拟"刚扫码关注";传 null 复位为无人扫码(演示/测试用) */
let simulated: LatestFollower | null = null

export function simulateWechatScan(openid: string | null, subscribeTime: number | null = null): void {
  simulated = openid === null ? null : { openid, subscribeTime }
}

export async function getLatestFollower(): Promise<LatestFollower> {
  if (useMock) return simulated ?? { openid: null, subscribeTime: null }
  return request<LatestFollower>('/api/wechat/latest-follower')
}
