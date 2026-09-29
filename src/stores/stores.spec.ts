import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function freshStores() {
  vi.resetModules()
  const monitorMod = await import('@/stores/monitor')
  const alarmsMod = await import('@/stores/alarms')
  const settingsMod = await import('@/stores/settings')
  const simMod = await import('@/mock/simulator')
  return {
    monitor: monitorMod.useMonitorStore(),
    alarms: alarmsMod.useAlarmsStore(),
    settings: settingsMod.useSettingsStore(),
    simulator: simMod.simulator,
  }
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: 1_700_000_000_000 })
  // 0.5 → 随机游走步长 0、不触发自动离线/异常、短信不失败,测试完全确定
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('monitor + alarms 集成', () => {
  it('初始化:加载 4 设备、24 条默认阈值,完成首轮刷新', async () => {
    const { monitor, settings } = await freshStores()
    await monitor.init()
    expect(monitor.state.devices).toHaveLength(4)
    expect(settings.state.thresholds).toHaveLength(24)
    expect(Object.keys(monitor.state.statuses)).toHaveLength(4)
    monitor.stop()
  })

  it('参数越界 → abnormal + 告警入库 + 模拟短信置 sent + 未读 +1', async () => {
    const { monitor, alarms, settings, simulator } = await freshStores()
    await monitor.init()
    // 无接收人时短信立即 failed;先加一名接收人,验证完整链路到 sent
    await settings.addReceiver('测试员', '13800000000')
    simulator.forceAbnormal('Di-Jiu-Shui-Chang-1', 'Vf', 60_000, 'high')
    await vi.advanceTimersByTimeAsync(2_000)
    expect(alarms.state.records).toHaveLength(1)
    expect(alarms.state.records[0]!.type).toBe('high')
    expect(monitor.state.statuses['Di-Jiu-Shui-Chang-1']!.status).toBe('abnormal')
    await vi.advanceTimersByTimeAsync(1_000)
    expect(alarms.state.records[0]!.sms.status).toBe('sent')
    expect(alarms.state.unread).toBe(1)
    monitor.stop()
  })

  it('冷却期内同一越界不重复生成告警', async () => {
    const { monitor, alarms, simulator } = await freshStores()
    await monitor.init()
    simulator.forceAbnormal('Di-Jiu-Shui-Chang-1', 'Vf', 60_000, 'high')
    await vi.advanceTimersByTimeAsync(2_000)
    await vi.advanceTimersByTimeAsync(2_000)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(alarms.state.records).toHaveLength(1)
    monitor.stop()
  })

  it('手动模拟离线 → 60 秒后判离线并产生一条离线告警', async () => {
    const { monitor, alarms } = await freshStores()
    await monitor.init()
    await monitor.toggleOffline('Di-Jiu-Shui-Chang-2')
    expect(monitor.state.forcedOffline).toContain('Di-Jiu-Shui-Chang-2')
    await vi.advanceTimersByTimeAsync(2_000)
    expect(monitor.state.statuses['Di-Jiu-Shui-Chang-2']!.status).toBe('online')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(monitor.state.statuses['Di-Jiu-Shui-Chang-2']!.status).toBe('offline')
    const offline = alarms.state.records.filter((r) => r.deviceId === 'Di-Jiu-Shui-Chang-2' && r.type === 'offline')
    expect(offline).toHaveLength(1)
    monitor.stop()
  })

  it('恢复上报后状态回到 online 且不产生恢复告警', async () => {
    const { monitor, alarms } = await freshStores()
    await monitor.init()
    await monitor.toggleOffline('Di-Jiu-Shui-Chang-3')
    await vi.advanceTimersByTimeAsync(62_000)
    await monitor.toggleOffline('Di-Jiu-Shui-Chang-3')
    await vi.advanceTimersByTimeAsync(4_000)
    expect(monitor.state.statuses['Di-Jiu-Shui-Chang-3']!.status).toBe('online')
    const recoverAlarms = alarms.state.records.filter((r) => r.deviceId === 'Di-Jiu-Shui-Chang-3')
    expect(recoverAlarms).toHaveLength(1) // 仅离线那一条
    monitor.stop()
  })
})

describe('settings store', () => {
  it('接收人增删同步内存与持久层', async () => {
    const { settings } = await freshStores()
    await settings.init()
    await settings.addReceiver('王五', '13900000000')
    expect(settings.state.receivers).toHaveLength(1)
    expect(localStorage.getItem('sc-front:receivers')).toContain('王五')
    await settings.removeReceiver(settings.state.receivers[0]!.id)
    expect(settings.state.receivers).toHaveLength(0)
  })
})
