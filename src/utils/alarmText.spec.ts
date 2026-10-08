import { describe, expect, it } from 'vitest'
import { buildSmsText } from './alarmText'
import type { AlarmRecord } from '@/api/types'

const T0 = 1_700_000_000_000

function highAlarm(): AlarmRecord {
  return {
    id: 'a1', time: T0, deviceId: 'Di-Jiu-Shui-Chang-1', paramKey: 'Vf', type: 'high',
    value: 38.25, threshold: 35, level: 'warning', sms: { status: 'pending', receivers: [] },
  }
}

function offlineAlarm(): AlarmRecord {
  return {
    id: 'a2', time: T0, deviceId: 'Di-Jiu-Shui-Chang-1', paramKey: null, type: 'offline',
    value: null, threshold: null, level: 'critical', sms: { status: 'pending', receivers: [] },
  }
}

describe('buildSmsText', () => {
  it('超上限文案含设备名、参数、值、方向与阈值', () => {
    const text = buildSmsText(highAlarm(), '九厂一期-1#')
    expect(text).toContain('九厂一期-1#')
    expect(text).toContain('沉降比')
    expect(text).toContain('38.3')
    expect(text).toContain('超上限')
    expect(text).toContain('35')
  })

  it('离线文案', () => {
    expect(buildSmsText(offlineAlarm(), '九厂一期-1#')).toContain('设备离线')
  })
})
