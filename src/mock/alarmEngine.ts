import type { AlarmRecord, AlarmType, DeviceId, DeviceStatus, DeviceStatusInfo } from '@/api/types'
import { ALARM_COOLDOWN_MS } from '@/config/params'

export interface DetectAlarmsInput {
  deviceId: DeviceId
  /** 上一次状态;null 表示本次会话首次判定 */
  prevStatus: DeviceStatus | null
  statusInfo: DeviceStatusInfo
  now: number
  existingAlarms: AlarmRecord[]
}

function cooldownKey(deviceId: DeviceId, paramKey: string | null, type: AlarmType): string {
  return `${deviceId}|${paramKey ?? '__offline__'}|${type}`
}

let seq = 0
function defaultGenId(): string {
  seq += 1
  return `alarm-${Date.now()}-${seq}`
}

/**
 * 根据最新状态生成新告警(调用方负责入库与触发短信):
 * - 每个参数越界生成一条 high/low 告警(warning)
 * - 在线→离线迁移生成一条整机离线告警(critical);首次判定即离线、恢复上线均不生成
 * - 冷却:同 (设备, 参数, 类型) 在 ALARM_COOLDOWN_MS 内已有记录则跳过
 */
export function detectAlarms(input: DetectAlarmsInput, genId: () => string = defaultGenId): AlarmRecord[] {
  const { deviceId, prevStatus, statusInfo, now, existingAlarms } = input
  const recent = new Set<string>()
  for (const a of existingAlarms) {
    if (now - a.time < ALARM_COOLDOWN_MS) recent.add(cooldownKey(a.deviceId, a.paramKey, a.type))
  }

  const result: AlarmRecord[] = []
  const tryPush = (key: string, make: (id: string) => AlarmRecord) => {
    if (recent.has(key)) return
    recent.add(key)
    result.push(make(genId()))
  }

  for (const v of statusInfo.violations) {
    tryPush(cooldownKey(deviceId, v.paramKey, v.type), (id) => ({
      id, time: now, deviceId, paramKey: v.paramKey, type: v.type,
      value: v.value, threshold: v.threshold, level: 'warning',
      sms: { status: 'pending', receivers: [] },
    }))
  }

  if (statusInfo.status === 'offline' && prevStatus !== null && prevStatus !== 'offline') {
    tryPush(cooldownKey(deviceId, null, 'offline'), (id) => ({
      id, time: now, deviceId, paramKey: null, type: 'offline',
      value: null, threshold: null, level: 'critical',
      sms: { status: 'pending', receivers: [] },
    }))
  }

  return result
}
