import { describe, expect, it } from 'vitest'
import {
  alarmFromPayload,
  alarmToPayload,
  readingFromRow,
  snapshotFromPayload,
  type AlarmPayload,
  type SensorRow,
} from './adapters'
import type { AlarmRecord, Reading } from './types'

const iso = '2026-10-08T09:59:58'
const ms = new Date(iso).getTime()

const fullRow = {
  id: 1,
  device_id: 'Di-Jiu-Shui-Chang-1',
  sf: 1.52,
  vf: 14,
  fc: 1180,
  phf: 7.21,
  tf: 18.6,
  cf: 0.52,
  settling_ratio: 99,
  reported_at: iso,
  received_at: iso,
}

describe('readingFromRow(sensor 行 → Reading)', () => {
  it('映射六参数:device_id→deviceId、reported_at→毫秒时间戳,不消费 settling_ratio/id/received_at', () => {
    expect(readingFromRow(fullRow)).toEqual({
      deviceId: 'Di-Jiu-Shui-Chang-1',
      params: { Sf: 1.52, Vf: 14, Fc: 1180, pHf: 7.21, Tf: 18.6, Cf: 0.52 },
      timestamp: ms,
    })
  })

  it('为 null 或缺失的参数不进入 params', () => {
    expect(readingFromRow({ ...fullRow, cf: null })!.params.Cf).toBeUndefined()
    const withoutCf = { ...fullRow } as Partial<SensorRow>
    delete withoutCf.cf
    expect(readingFromRow(withoutCf as SensorRow)!.params.Cf).toBeUndefined()
  })

  it('reported_at 缺失或不可解析时返回 null(坏行不进曲线)', () => {
    expect(readingFromRow({ ...fullRow, reported_at: '' })).toBeNull()
    const withoutTime = { ...fullRow } as Partial<SensorRow>
    delete withoutTime.reported_at
    expect(readingFromRow(withoutTime as SensorRow)).toBeNull()
  })
})

describe('snapshotFromPayload(快照 → RealtimeSnapshot)', () => {
  it('仅保留四台设备:null 保持 null,库中其他设备(如 Di-Er-Shui-Chang-2)被忽略', () => {
    const snap = snapshotFromPayload({
      server_time: iso,
      readings: {
        'Di-Jiu-Shui-Chang-1': fullRow,
        'Di-Jiu-Shui-Chang-4': null,
        'Di-Er-Shui-Chang-2': fullRow,
      },
    })
    expect(snap.readings['Di-Jiu-Shui-Chang-1']).toEqual({
      deviceId: 'Di-Jiu-Shui-Chang-1',
      params: { Sf: 1.52, Vf: 14, Fc: 1180, pHf: 7.21, Tf: 18.6, Cf: 0.52 },
      timestamp: ms,
    })
    expect(snap.readings['Di-Jiu-Shui-Chang-4']).toBeNull()
    expect((snap.readings as Record<string, Reading | null>)['Di-Er-Shui-Chang-2']).toBeUndefined()
  })

  it('server_time 转毫秒作为 now,快照仅含 now 与 readings 两个字段', () => {
    const snap = snapshotFromPayload({ server_time: iso, readings: {} })
    expect(snap.now).toBe(ms)
    expect(Object.keys(snap).sort()).toEqual(['now', 'readings'])
  })

  it('server_time 缺失或不可解析时回退本机时间', () => {
    const before = Date.now()
    expect(snapshotFromPayload({ readings: {} }).now).toBeGreaterThanOrEqual(before)
    expect(snapshotFromPayload({ server_time: 'not-a-date', readings: {} }).now).toBeGreaterThanOrEqual(before)
  })
})

describe('告警记录 camel↔snake(契约 §4.2)', () => {
  const record: AlarmRecord = {
    id: 'alarm-1728355600000-1',
    time: 1728355600000,
    deviceId: 'Di-Jiu-Shui-Chang-1',
    paramKey: 'Vf',
    type: 'high',
    value: 36.2,
    threshold: 35,
    level: 'warning',
    sms: { status: 'pending', receivers: ['13800000000'] },
  }

  it('alarmToPayload 转成 snake_case,短信未落定不带 sent_at', () => {
    expect(alarmToPayload(record)).toEqual({
      id: 'alarm-1728355600000-1',
      time: 1728355600000,
      device_id: 'Di-Jiu-Shui-Chang-1',
      param_key: 'Vf',
      type: 'high',
      value: 36.2,
      threshold: 35,
      level: 'warning',
      sms: { status: 'pending', receivers: ['13800000000'] },
    })
  })

  it('离线告警的 null 字段(paramKey/value/threshold)原样保留', () => {
    const offline: AlarmRecord = {
      ...record,
      paramKey: null,
      type: 'offline',
      value: null,
      threshold: null,
      level: 'critical',
    }
    const payload = alarmToPayload(offline)
    expect(payload.param_key).toBeNull()
    expect(payload.value).toBeNull()
    expect(payload.threshold).toBeNull()
    expect(payload.type).toBe('offline')
  })

  it('alarmFromPayload 是 alarmToPayload 的逆,sent_at→sentAt', () => {
    const payload: AlarmPayload = {
      ...alarmToPayload(record),
      sms: { status: 'sent', receivers: ['13800000000'], sent_at: 1728355601200 },
    }
    expect(alarmFromPayload(payload)).toEqual({
      ...record,
      sms: { status: 'sent', receivers: ['13800000000'], sentAt: 1728355601200 },
    })
  })
})
