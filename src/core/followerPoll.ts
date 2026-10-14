import type { LatestFollower } from '@/api/wechatApi'

const DEFAULT_INTERVAL_MS = 5_000

/** 「x 分钟前关注」确认文案;不足 1 分钟 → 刚刚关注;无时间 → 已关注 */
export function followedAgoText(subscribeTime: number | null, nowMs: number): string {
  if (subscribeTime === null) return '已关注'
  const minutes = Math.max(0, Math.floor((nowMs - subscribeTime * 1000) / 60_000))
  return minutes < 1 ? '刚刚关注' : `${minutes} 分钟前关注`
}

export interface FollowerPollOptions {
  fetchFollower: () => Promise<LatestFollower>
  /** 命中 openid 时回调一次(随后自动停止轮询) */
  onFollower: (openid: string, subscribeTime: number | null) => void
  intervalMs?: number
}

/**
 * 四期 §9.3 扫码自动回填轮询:start 后立即查一次,之后每 intervalMs 一轮。
 * openid 为 null(还没人扫)→ 继续等下一轮;请求失败(502/503/网络)→ 静默跳过;
 * openid 非空 → 回调一次并停止;stop 后进行中的请求回来不再回调。
 */
export function createFollowerPoll(opts: FollowerPollOptions): {
  start: () => void
  stop: () => void
  refreshNow: () => Promise<void>
} {
  const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS
  let timer: ReturnType<typeof setInterval> | null = null
  let running = false

  /** force = 手动刷新:不要求轮询处于启动状态 */
  async function tick(force = false): Promise<void> {
    try {
      const r = await opts.fetchFollower()
      if (!running && !force) return
      if (r.openid) {
        stop()
        opts.onFollower(r.openid, r.subscribeTime)
      }
    } catch {
      // 渠道未配置(503)/微信接口失败(502)/网络错误:静默忽略,等下一轮
    }
  }

  function start(): void {
    if (running) return
    running = true
    void tick()
    timer = setInterval(() => void tick(), intervalMs)
  }

  function stop(): void {
    running = false
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  return { start, stop, refreshNow: () => tick(true) }
}
