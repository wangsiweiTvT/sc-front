import { describe, expect, it } from 'vitest'
import { detectAlarms } from './alarmEngine'
import type { AlarmRecord, DeviceStatusInfo } from '@/api/types'

const T0 = 1_700_000_000_000
let seq = 0
const genId = () => `id-${++seq}`

function statusInfo(over: Partial<DeviceStatusInfo> = {}): DeviceStatusInfo {
  return {
    status: 'online',
    violations: [{ paramKey: 'Vf', value: 38, type: 'high', threshold: 35 }],
    ...over,
  }
}

function oldAlarm(over: Partial<AlarmRecord> = {}): AlarmRecord {
  return {
    id: `old-${++seq}`, time: T0, deviceId: 'Di-Jiu-Shui-Chang-1',
    paramKey: 'Vf', type: 'high', value: 36, threshold: 35, level: 'warning',
    sms: { status: 'sent', receivers: ['13800000000'] },
    ...over,
  }
}

describe('detectAlarms', () => {
  it('越界 → 生成 warning 级 pending 告警', () => {
    const result = detectAlarms({ deviceId: 'Di-Jiu-Shui-Chang-1', prevStatus: 'online', statusInfo: statusInfo(), now: T0 + 1000, existingAlarms: [] }, genId)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      deviceId: 'Di-Jiu-Shui-Chang-1', paramKey: 'Vf', type: 'high',
      value: 38, threshold: 35, level: 'warning', time: T0 + 1000,
    })
    expect(result[0].sms.status).toBe('pending')
    expect(result[0].sms.receivers).toEqual([])
  })

  it('同设备同参数同类型在 10 分钟冷却内 → 去重不生成', () => {
    const existing = [oldAlarm({ time: T0 + 599_999 })]
    const result = detectAlarms({ deviceId: 'Di-Jiu-Shui-Chang-1', prevStatus: 'abnormal', statusInfo: statusInfo(), now: T0 + 600_000, existingAlarms: existing }, genId)
    expect(result).toHaveLength(0)
  })

  it('恰满 10 分钟 → 冷却结束,允许再告警', () => {
    const existing = [oldAlarm({ time: T0 })]
    const result = detectAlarms({ deviceId: 'Di-Jiu-Shui-Chang-1', prevStatus: 'abnormal', statusInfo: statusInfo(), now: T0 + 600_000, existingAlarms: existing }, genId)
    expect(result).toHaveLength(1)
  })

  it('不同参数或不同类型互不影响冷却', () => {
    const existing = [oldAlarm({ paramKey: 'Tf' })]
    const r1 = detectAlarms({ deviceId: 'Di-Jiu-Shui-Chang-1', prevStatus: 'abnormal', statusInfo: statusInfo(), now: T0 + 1000, existingAlarms: existing }, genId)
    expect(r1).toHaveLength(1)
    const existing2 = [oldAlarm({ type: 'low' })]
    const r2 = detectAlarms({ deviceId: 'Di-Jiu-Shui-Chang-1', prevStatus: 'abnormal', statusInfo: statusInfo(), now: T0 + 1000, existingAlarms: existing2 }, genId)
    expect(r2).toHaveLength(1)
  })

  it('在线→离线生成 critical 离线告警', () => {
    const result = detectAlarms({ deviceId: 'Di-Jiu-Shui-Chang-1', prevStatus: 'online', statusInfo: statusInfo({ status: 'offline', violations: [] }), now: T0 + 1000, existingAlarms: [] }, genId)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ type: 'offline', paramKey: null, value: null, threshold: null, level: 'critical' })
  })

  it('首次启动即为离线(prevStatus=null)不产生离线告警', () => {
    const result = detectAlarms({ deviceId: 'Di-Jiu-Shui-Chang-1', prevStatus: null, statusInfo: statusInfo({ status: 'offline', violations: [] }), now: T0 + 1000, existingAlarms: [] }, genId)
    expect(result).toHaveLength(0)
  })

  it('offline→online 恢复不产生任何告警', () => {
    const result = detectAlarms({ deviceId: 'Di-Jiu-Shui-Chang-1', prevStatus: 'offline', statusInfo: statusInfo({ status: 'online', violations: [] }), now: T0 + 1000, existingAlarms: [] }, genId)
    expect(result).toHaveLength(0)
  })

  it('多个参数同时越界 → 各生成一条', () => {
    const info = statusInfo({
      violations: [
        { paramKey: 'Vf', value: 38, type: 'high', threshold: 35 },
        { paramKey: 'Tf', value: 2, type: 'low', threshold: 8 },
      ],
    })
    const result = detectAlarms({ deviceId: 'Di-Jiu-Shui-Chang-1', prevStatus: 'online', statusInfo: info, now: T0 + 1000, existingAlarms: [] }, genId)
    expect(result).toHaveLength(2)
  })
})
