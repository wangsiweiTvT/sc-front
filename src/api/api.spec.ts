import { beforeEach, describe, expect, it } from 'vitest'
import { alarmApi } from './alarmApi'
import { configApi } from './configApi'
import { monitorApi } from './monitorApi'
import { deviceApi } from './deviceApi'
import { STORAGE_KEYS } from '@/mock/memory'
import { DEVICES } from '@/config/params'
import type { AlarmRecord } from './types'

beforeEach(() => localStorage.clear())

describe('configApi', () => {
  it('首次读取返回 24 条默认阈值', async () => {
    const rules = await configApi.getThresholds()
    expect(rules).toHaveLength(24)
  })

  it('save → get 往返一致,且落入 localStorage', async () => {
    const rules = await configApi.getThresholds()
    rules[0]!.low = 1
    await configApi.saveThresholds(rules)
    const again = await configApi.getThresholds()
    expect(again[0]!.low).toBe(1)
    expect(localStorage.getItem(STORAGE_KEYS.thresholds)).toContain('"low":1')
  })

  it('接收人增删', async () => {
    expect(await configApi.getReceivers()).toEqual([])
    const r = await configApi.addReceiver({ name: '张三', phone: '13800000000' })
    expect((await configApi.getReceivers())).toHaveLength(1)
    await configApi.removeReceiver(r.id)
    expect(await configApi.getReceivers()).toEqual([])
  })
})

describe('alarmApi', () => {
  const record: AlarmRecord = {
    id: 'a1', time: 1_700_000_000_000, deviceId: 'Di-Jiu-Shui-Chang-1',
    paramKey: 'Vf', type: 'high', value: 38, threshold: 35, level: 'warning',
    sms: { status: 'pending', receivers: [] },
  }

  it('append → get → update → clear', async () => {
    await alarmApi.appendAlarms([record])
    expect((await alarmApi.getAlarms())).toHaveLength(1)
    const updated = { ...record, sms: { status: 'sent' as const, receivers: ['138'], sentAt: 1 } }
    await alarmApi.updateAlarm(updated)
    expect((await alarmApi.getAlarms())[0]!.sms.status).toBe('sent')
    await alarmApi.clearAlarms()
    expect(await alarmApi.getAlarms()).toEqual([])
  })
})

describe('monitorApi', () => {
  it('getRealtimeReadings 返回 4 台 latest + forcedOffline', async () => {
    const snap = await monitorApi.getRealtimeReadings()
    expect(Object.keys(snap.readings)).toHaveLength(4)
    expect(snap.forcedOffline).toEqual([])
    expect(snap.now).toBeGreaterThan(0)
  })

  it('setDeviceOffline 生效并反映在 forcedOffline', async () => {
    await monitorApi.setDeviceOffline('Di-Jiu-Shui-Chang-3', true)
    const snap = await monitorApi.getRealtimeReadings()
    expect(snap.forcedOffline).toEqual(['Di-Jiu-Shui-Chang-3'])
  })

  it('getHistory 返回该参数的历史点', async () => {
    const history = await monitorApi.getHistory('Di-Jiu-Shui-Chang-1', 'Vf')
    expect(history.length).toBeGreaterThan(0)
    expect(history[0]!.params.Vf).toBeDefined()
  })
})

describe('deviceApi', () => {
  it('getDevices 返回 4 台', async () => {
    expect(await deviceApi.getDevices()).toHaveLength(DEVICES.length)
  })
})
