import { describe, expect, it } from 'vitest'
import { judgeDeviceStatus } from './statusRule'
import type { Reading, ThresholdRule } from '@/api/types'

const T0 = 1_700_000_000_000

function reading(params: Partial<Reading['params']>, ts = T0): Reading {
  return { deviceId: 'Di-Jiu-Shui-Chang-1', params, timestamp: ts }
}

function rule(over: Partial<ThresholdRule> = {}): ThresholdRule {
  return { deviceId: 'Di-Jiu-Shui-Chang-1', paramKey: 'Vf', low: 5, high: 35, enabled: true, ...over }
}

describe('judgeDeviceStatus', () => {
  it('正常数据 → online,无越界', () => {
    const info = judgeDeviceStatus({ latestReading: reading({ Vf: 15 }), now: T0 + 1_000, rules: [rule()] })
    expect(info.status).toBe('online')
    expect(info.violations).toEqual([])
  })

  it('恰好在 60s 边界仍在线,60s+1ms 判离线', () => {
    expect(judgeDeviceStatus({ latestReading: reading({ Vf: 15 }), now: T0 + 60_000, rules: [] }).status).toBe('online')
    expect(judgeDeviceStatus({ latestReading: reading({ Vf: 15 }), now: T0 + 60_001, rules: [] }).status).toBe('offline')
  })

  it('从无数据(初始)判离线', () => {
    expect(judgeDeviceStatus({ latestReading: null, now: T0, rules: [rule()] }).status).toBe('offline')
  })

  it('超上限 → abnormal 且给出 high 越界明细', () => {
    const info = judgeDeviceStatus({ latestReading: reading({ Vf: 38 }), now: T0, rules: [rule()] })
    expect(info.status).toBe('abnormal')
    expect(info.violations).toEqual([{ paramKey: 'Vf', value: 38, type: 'high', threshold: 35 }])
  })

  it('低于下限 → abnormal 且给出 low 越界明细', () => {
    const info = judgeDeviceStatus({ latestReading: reading({ Vf: 3 }), now: T0, rules: [rule()] })
    expect(info.status).toBe('abnormal')
    expect(info.violations[0].type).toBe('low')
  })

  it('值恰好等于阈值边界(=high / =low)不算越界', () => {
    expect(judgeDeviceStatus({ latestReading: reading({ Vf: 35 }), now: T0, rules: [rule()] }).status).toBe('online')
    expect(judgeDeviceStatus({ latestReading: reading({ Vf: 5 }), now: T0, rules: [rule()] }).status).toBe('online')
  })

  it('enabled=false 的规则不参与判定', () => {
    const info = judgeDeviceStatus({ latestReading: reading({ Vf: 99 }), now: T0, rules: [rule({ enabled: false })] })
    expect(info.status).toBe('online')
  })

  it('报文缺该参数字段 → 跳过,不抛错', () => {
    const info = judgeDeviceStatus({ latestReading: reading({}), now: T0, rules: [rule()] })
    expect(info.status).toBe('online')
  })

  it('多参数同时越界 → 全部列入明细', () => {
    const rules = [rule(), rule({ paramKey: 'Tf', low: 8, high: 30 })]
    const info = judgeDeviceStatus({ latestReading: reading({ Vf: 99, Tf: 2 }), now: T0, rules })
    expect(info.violations).toHaveLength(2)
  })
})
