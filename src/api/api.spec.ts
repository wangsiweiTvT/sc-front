import { beforeEach, describe, expect, it } from 'vitest'
import { alarmApi } from './alarmApi'
import { configApi } from './configApi'
import { monitorApi } from './monitorApi'
import { deviceApi } from './deviceApi'
import { loadJSON, saveJSON, STORAGE_KEYS } from '@/mock/memory'
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
  it('get → clear(mock:种数据 → 读回 → 清空)', async () => {
    const record: AlarmRecord = {
      id: 'alarm-1', time: 1728355600000, deviceId: 'Di-Jiu-Shui-Chang-1',
      paramKey: null, type: 'offline', value: null, threshold: null,
      level: 'critical', sms: { status: 'sent', receivers: ['138'] },
    }
    saveJSON(STORAGE_KEYS.alarms, [record])
    expect(await alarmApi.getAlarms()).toHaveLength(1)
    await alarmApi.clearAlarms()
    expect(await alarmApi.getAlarms()).toEqual([])
    expect(loadJSON<AlarmRecord[]>(STORAGE_KEYS.alarms, [{ id: 'x' } as AlarmRecord])).toEqual([])
  })
})

describe('monitorApi', () => {
  it('getRealtimeReadings 返回 4 台 latest', async () => {
    const snap = await monitorApi.getRealtimeReadings()
    expect(Object.keys(snap.readings)).toHaveLength(4)
    expect(snap.now).toBeGreaterThan(0)
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
