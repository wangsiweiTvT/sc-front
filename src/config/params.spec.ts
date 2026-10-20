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

  it('指标名称与单位按现场口径(2026-10 校正):浊度 NTU、污泥浓度 g/L', () => {
    const byKey = Object.fromEntries(PARAM_METAS.map((m) => [m.key, m]))
    expect(byKey.Sf).toMatchObject({ label: '沉降速度', unit: 'm/h' })
    expect(byKey.Vf).toMatchObject({ label: '沉降比', unit: '%' })
    expect(byKey.Fc).toMatchObject({ label: '机加池出水浊度', unit: 'NTU', decimals: 1, defaultThreshold: [1, 10] })
    expect(byKey.pHf).toMatchObject({ label: 'PH', unit: '' })
    expect(byKey.Tf).toMatchObject({ label: '温度', unit: '℃' })
    expect(byKey.Cf).toMatchObject({ label: '反应池污泥浓度', unit: 'g/L', decimals: 2, defaultThreshold: [1, 10] })
  })

  it('设备档案不再含型号/安装位置/投运日期;负责人统一王垚', () => {
    for (const d of DEVICES) {
      expect(d).not.toHaveProperty('model')
      expect(d).not.toHaveProperty('location')
      expect(d).not.toHaveProperty('commissionDate')
      expect(d.manager).toBe('王垚')
    }
  })
})
