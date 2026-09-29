import type { DeviceStatusInfo, ParamViolation, Reading, ThresholdRule } from '@/api/types'
import { OFFLINE_AFTER_MS } from '@/config/params'

export interface StatusJudgeInput {
  latestReading: Reading | null
  now: number
  rules: ThresholdRule[]
}

/**
 * 设备状态判定:
 * - offline:无数据或最新数据距今超过 OFFLINE_AFTER_MS
 * - abnormal:在线且任一启用规则越界(值严格大于 high / 小于 low,等于边界不算)
 * - online:其余情况
 */
export function judgeDeviceStatus(input: StatusJudgeInput): DeviceStatusInfo {
  const { latestReading, now, rules } = input
  if (!latestReading || now - latestReading.timestamp > OFFLINE_AFTER_MS) {
    return { status: 'offline', violations: [] }
  }
  const violations: ParamViolation[] = []
  for (const r of rules) {
    if (!r.enabled) continue
    const value = latestReading.params[r.paramKey]
    if (value === undefined) continue
    if (value > r.high) violations.push({ paramKey: r.paramKey, value, type: 'high', threshold: r.high })
    else if (value < r.low) violations.push({ paramKey: r.paramKey, value, type: 'low', threshold: r.low })
  }
  return { status: violations.length > 0 ? 'abnormal' : 'online', violations }
}
