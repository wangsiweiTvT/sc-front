import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ALARM_POLL_INTERVAL_MS, OFFLINE_AFTER_MS } from '@/config/params'

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

describe('monitor + alarms 集成(判定已移交后端,mock 模式由模拟检测器复刻)', () => {
  it('初始化:加载 4 设备、24 条默认阈值,完成首轮刷新', async () => {
    const { monitor, settings } = await freshStores()
    await monitor.init()
    expect(monitor.state.devices).toHaveLength(4)
    expect(settings.state.thresholds).toHaveLength(24)
    expect(Object.keys(monitor.state.statuses)).toHaveLength(4)
    monitor.stop()
  })

  it('参数越界 → abnormal 角标;刷新链路不再生成告警(双份记录源已拆除)', async () => {
    const { monitor, alarms, settings, simulator } = await freshStores()
    await monitor.init()
    await settings.addReceiver('测试员', '13800000000')
    simulator.forceAbnormal('Di-Jiu-Shui-Chang-1', 'Vf', 60_000, 'high')
    await vi.advanceTimersByTimeAsync(2_000)
    expect(monitor.state.statuses['Di-Jiu-Shui-Chang-1']!.status).toBe('abnormal')
    expect(alarms.state.records).toHaveLength(0)
    monitor.stop()
  })

  it('告警轮询:模拟检测器产告警入库 → 轮询读到 → 短信落定后下次轮询可见', async () => {
    const { monitor, alarms, settings, simulator } = await freshStores()
    await monitor.init()
    await settings.addReceiver('测试员', '13800000000')
    simulator.forceAbnormal('Di-Jiu-Shui-Chang-1', 'Vf', 10 * 60_000, 'high')
    await vi.advanceTimersByTimeAsync(ALARM_POLL_INTERVAL_MS)
    expect(alarms.state.records).toHaveLength(1)
    expect(alarms.state.records[0]!.type).toBe('high')
    expect(alarms.state.records[0]!.level).toBe('warning')
    await vi.advanceTimersByTimeAsync(1_000) // 模拟短信落定
    await vi.advanceTimersByTimeAsync(ALARM_POLL_INTERVAL_MS)
    expect(alarms.state.records[0]!.sms.status).toBe('sent')
    monitor.stop()
    alarms.stop()
  })

  it('未读数 = 已读水位之后的新增条数;markAllRead 归零后新告警再 +1', async () => {
    const { monitor, alarms, settings, simulator } = await freshStores()
    await monitor.init()
    await settings.addReceiver('测试员', '13800000000')
    simulator.forceAbnormal('Di-Jiu-Shui-Chang-1', 'Vf', 10 * 60_000, 'high')
    await vi.advanceTimersByTimeAsync(ALARM_POLL_INTERVAL_MS)
    expect(alarms.state.unread).toBe(1)
    alarms.markAllRead()
    expect(alarms.state.unread).toBe(0)
    await vi.advanceTimersByTimeAsync(1_000) // 第一条短信落定
    simulator.forceAbnormal('Di-Jiu-Shui-Chang-1', 'Tf', 10 * 60_000, 'high') // 换参数绕开冷却
    await vi.advanceTimersByTimeAsync(ALARM_POLL_INTERVAL_MS)
    expect(alarms.state.records).toHaveLength(2)
    expect(alarms.state.unread).toBe(1)
    monitor.stop()
    alarms.stop()
  })

  it('上报停止 → 检测器产生一条 critical 离线告警;恢复上报不产生恢复告警', async () => {
    const { monitor, alarms, settings, simulator } = await freshStores()
    await monitor.init()
    await settings.addReceiver('测试员', '13800000000')
    await vi.advanceTimersByTimeAsync(ALARM_POLL_INTERVAL_MS) // 首轮扫描:全部在线
    simulator.setManualOffline('Di-Jiu-Shui-Chang-2', true)
    await vi.advanceTimersByTimeAsync(OFFLINE_AFTER_MS + 2 * ALARM_POLL_INTERVAL_MS)
    const offline = alarms.state.records.filter((r) => r.deviceId === 'Di-Jiu-Shui-Chang-2' && r.type === 'offline')
    expect(offline).toHaveLength(1)
    expect(offline[0]!.level).toBe('critical')
    expect(offline[0]!.sms.status).toBe('sent')
    simulator.setManualOffline('Di-Jiu-Shui-Chang-2', false)
    await vi.advanceTimersByTimeAsync(2 * ALARM_POLL_INTERVAL_MS)
    expect(alarms.state.records).toHaveLength(1) // 仅离线那一条,无恢复告警
    monitor.stop()
    alarms.stop()
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
