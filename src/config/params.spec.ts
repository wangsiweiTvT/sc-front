import { describe, expect, it } from 'vitest'
import {
  ALARM_COOLDOWN_MS,
  ALARM_POLL_INTERVAL_MS,
  ALARM_MAX_COUNT,
  DEVICES,
  DETECTOR_POLL_INTERVAL_MS,
  OFFLINE_AFTER_MS,
  PARAM_METAS,
  defaultThresholds,
} from './params'

describe('配置元数据不变式', () => {
  it('共 6 项参数,键唯一', () => {
    expect(PARAM_METAS).toHaveLength(6)
    expect(new Set(PARAM_METAS.map((m) => m.key)).size).toBe(6)
  })

  it('每项参数 normal 在默认阈值区间内,且 low < high', () => {
    for (const m of PARAM_METAS) {
      expect(m.defaultThreshold[0]).toBeLessThan(m.defaultThreshold[1])
      expect(m.normal[0]).toBeGreaterThanOrEqual(m.defaultThreshold[0])
      expect(m.normal[1]).toBeLessThanOrEqual(m.defaultThreshold[1])
    }
  })

  it('共 4 台设备,id 与 clientId 唯一', () => {
    expect(DEVICES).toHaveLength(4)
    expect(new Set(DEVICES.map((d) => d.id)).size).toBe(4)
    expect(new Set(DEVICES.map((d) => d.clientId)).size).toBe(4)
  })

  it('默认阈值表为 4×6=24 条且字段齐全', () => {
    const rules = defaultThresholds()
    expect(rules).toHaveLength(24)
    for (const r of rules) {
      expect(r.low).toBeLessThan(r.high)
      expect(r.enabled).toBe(true)
    }
  })

  it('时间常量与上报周期一致', () => {
    expect(OFFLINE_AFTER_MS).toBe(13 * 60_000) // 设备 13 分钟定时上报
    expect(ALARM_COOLDOWN_MS).toBe(600_000)
    expect(ALARM_POLL_INTERVAL_MS).toBe(30_000) // §7:告警列表 30~60s 轮询
    expect(DETECTOR_POLL_INTERVAL_MS).toBe(60_000)
    expect(ALARM_MAX_COUNT).toBe(500)
  })
})
