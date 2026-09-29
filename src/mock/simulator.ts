import type { DeviceId, ParamKey, Reading } from '@/api/types'
import { DEVICES, PARAM_METAS, OFFLINE_AFTER_MS } from '@/config/params'

export interface SimulatorOptions {
  rng?: () => number
  backfillMs?: number
  backfillStepMs?: number
  /** 每 tick 自动掉线概率 */
  autoOfflineRate?: number
  /** 每台设备每 tick 注入异常的概率 */
  abnormalRate?: number
}

const HISTORY_CAP = 2000

export function createSimulator(options: SimulatorOptions = {}) {
  const rng = options.rng ?? Math.random
  const backfillMs = options.backfillMs ?? 30 * 60_000
  const backfillStepMs = options.backfillStepMs ?? 10_000
  const autoOfflineRate = options.autoOfflineRate ?? 0.002
  const abnormalRate = options.abnormalRate ?? 0.015

  const histories = new Map<DeviceId, Reading[]>(DEVICES.map((d) => [d.id, []]))
  const lastValues = new Map<DeviceId, Partial<Record<ParamKey, number>>>()
  const forcedOffline = new Set<DeviceId>()
  const autoOfflineUntil = new Map<DeviceId, number>()
  const abnormalUntil = new Map<string, number>()
  const abnormalDirection = new Map<string, 'high' | 'low'>()

  function pushReading(reading: Reading): void {
    const list = histories.get(reading.deviceId)!
    list.push(reading)
    if (list.length > HISTORY_CAP) list.splice(0, list.length - HISTORY_CAP)
    lastValues.set(reading.deviceId, reading.params)
  }

  function nextValue(meta: (typeof PARAM_METAS)[number], deviceId: DeviceId, now: number): number {
    const [lo, hi] = meta.normal
    const step = (hi - lo) * 0.04
    const abKey = `${deviceId}|${meta.key}`
    const abUntil = abnormalUntil.get(abKey)
    const prev = lastValues.get(deviceId)?.[meta.key]
    if (abUntil !== undefined && abUntil > now) {
      // 异常注入:推向默认阈值外 10% 正常量程处
      const target = abnormalDirection.get(abKey) === 'low'
        ? meta.defaultThreshold[0] - (hi - lo) * 0.1
        : meta.defaultThreshold[1] + (hi - lo) * 0.1
      return target + (rng() - 0.5) * step
    }
    if (abUntil !== undefined && abUntil <= now) {
      abnormalUntil.delete(abKey)
      abnormalDirection.delete(abKey)
    }
    // 正常随机游走,夹在正常区间内
    const base = prev ?? (lo + hi) / 2
    const next = base + (rng() - 0.5) * 2 * step
    return Math.min(hi, Math.max(lo, next))
  }

  function generateReading(deviceId: DeviceId, now: number, inject: boolean): Reading | null {
    if (forcedOffline.has(deviceId)) return null
    const until = autoOfflineUntil.get(deviceId)
    if (until !== undefined) {
      if (until > now) return null
      autoOfflineUntil.delete(deviceId)
    }
    if (inject) {
      if (rng() < autoOfflineRate) {
        autoOfflineUntil.set(deviceId, now + OFFLINE_AFTER_MS * 2 + rng() * 120_000)
        return null
      }
      if (rng() < abnormalRate) {
        const meta = PARAM_METAS[Math.floor(rng() * PARAM_METAS.length)]!
        const direction = rng() < 0.5 ? 'high' : 'low'
        abnormalUntil.set(`${deviceId}|${meta.key}`, now + (15 + rng() * 25) * 1000)
        abnormalDirection.set(`${deviceId}|${meta.key}`, direction)
      }
    }
    const params: Partial<Record<ParamKey, number>> = {}
    for (const meta of PARAM_METAS) {
      params[meta.key] = Number(nextValue(meta, deviceId, now).toFixed(meta.decimals))
    }
    return { deviceId, params, timestamp: now }
  }

  return {
    tick(now: number): Reading[] {
      const out: Reading[] = []
      for (const d of DEVICES) {
        const r = generateReading(d.id, now, true)
        if (r) {
          pushReading(r)
          out.push(r)
        }
      }
      return out
    },
    backfill(now: number): void {
      for (let t = now - backfillMs + backfillStepMs; t <= now; t += backfillStepMs) {
        for (const d of DEVICES) {
          const r = generateReading(d.id, t, false)
          if (r) pushReading(r)
        }
      }
    },
    latest(): Record<DeviceId, Reading | null> {
      return Object.fromEntries(
        DEVICES.map((d) => {
          const list = histories.get(d.id)!
          return [d.id, list.length > 0 ? list[list.length - 1]! : null]
        }),
      ) as Record<DeviceId, Reading | null>
    },
    history(deviceId: DeviceId): Reading[] {
      return [...histories.get(deviceId)!]
    },
    setManualOffline(deviceId: DeviceId, offline: boolean): void {
      if (offline) forcedOffline.add(deviceId)
      else forcedOffline.delete(deviceId)
    },
    isManuallyOffline(deviceId: DeviceId): boolean {
      return forcedOffline.has(deviceId)
    },
    forceAbnormal(deviceId: DeviceId, paramKey: ParamKey, durationMs: number, direction: 'high' | 'low', startMs: number = Date.now()): void {
      abnormalUntil.set(`${deviceId}|${paramKey}`, startMs + durationMs)
      abnormalDirection.set(`${deviceId}|${paramKey}`, direction)
    },
  }
}

/** 应用级单例(Task 7 的 mock api 使用) */
export const simulator = createSimulator()
