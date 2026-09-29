import { describe, expect, it } from 'vitest'
import { createSimulator } from './simulator'
import { PARAM_META_MAP } from '@/config/params'

const T0 = 1_700_000_000_000
/** 恒定 0.5:随机游走步长恰为 0,值停在正常区间中点,便于断言 */
const stableRng = () => 0.5

describe('createSimulator', () => {
  it('backfill 回填 30 分钟、每 10s 一点(180 点/台)', () => {
    const sim = createSimulator({ rng: stableRng })
    sim.backfill(T0)
    expect(sim.history('Di-Jiu-Shui-Chang-1')).toHaveLength(180)
    expect(sim.latest()['Di-Jiu-Shui-Chang-1']?.timestamp).toBe(T0)
  })

  it('tick 为 4 台设备各生成一条,数值停留在正常区间', () => {
    const sim = createSimulator({ rng: stableRng })
    sim.backfill(T0)
    const readings = sim.tick(T0 + 10_000)
    expect(readings).toHaveLength(4)
    for (const r of readings) {
      for (const meta of Object.values(PARAM_META_MAP)) {
        const v = r.params[meta.key]
        expect(v).toBeGreaterThanOrEqual(meta.normal[0])
        expect(v).toBeLessThanOrEqual(meta.normal[1])
      }
    }
  })

  it('手动离线设备不再产生数据,latest 停留在旧值', () => {
    const sim = createSimulator({ rng: stableRng })
    sim.backfill(T0)
    sim.setManualOffline('Di-Jiu-Shui-Chang-2', true)
    expect(sim.isManuallyOffline('Di-Jiu-Shui-Chang-2')).toBe(true)
    const readings = sim.tick(T0 + 10_000)
    expect(readings.some((r) => r.deviceId === 'Di-Jiu-Shui-Chang-2')).toBe(false)
    expect(sim.latest()['Di-Jiu-Shui-Chang-2']?.timestamp).toBe(T0)
    sim.setManualOffline('Di-Jiu-Shui-Chang-2', false)
    expect(sim.tick(T0 + 20_000).some((r) => r.deviceId === 'Di-Jiu-Shui-Chang-2')).toBe(true)
  })

  it('forceAbnormal 注入后数值越出默认阈值方向正确', () => {
    const sim = createSimulator({ rng: stableRng })
    sim.backfill(T0)
    sim.forceAbnormal('Di-Jiu-Shui-Chang-1', 'Vf', 60_000, 'high', T0)
    const r = sim.tick(T0 + 10_000).find((x) => x.deviceId === 'Di-Jiu-Shui-Chang-1')!
    expect(r.params.Vf!).toBeGreaterThan(PARAM_META_MAP.Vf.defaultThreshold[1])

    sim.forceAbnormal('Di-Jiu-Shui-Chang-2', 'Tf', 60_000, 'low', T0)
    const r2 = sim.tick(T0 + 20_000).find((x) => x.deviceId === 'Di-Jiu-Shui-Chang-2')!
    expect(r2.params.Tf!).toBeLessThan(PARAM_META_MAP.Tf.defaultThreshold[0])
  })

  it('注入到期后数值回落到正常区间', () => {
    const sim = createSimulator({ rng: stableRng })
    sim.backfill(T0)
    sim.forceAbnormal('Di-Jiu-Shui-Chang-1', 'Vf', 15_000, 'high', T0)
    sim.tick(T0 + 10_000)
    const r = sim.tick(T0 + 30_000).find((x) => x.deviceId === 'Di-Jiu-Shui-Chang-1')!
    expect(r.params.Vf!).toBeLessThanOrEqual(PARAM_META_MAP.Vf.normal[1])
  })
})
