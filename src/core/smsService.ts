import type { AlarmRecord, ParamKey, Receiver } from '@/api/types'
import { PARAM_META_MAP } from '@/config/params'

export function buildSmsText(record: AlarmRecord, deviceName: string): string {
  if (record.type === 'offline') {
    return `【水厂监控】${deviceName} 设备离线,请及时检查。`
  }
  const meta = PARAM_META_MAP[record.paramKey as ParamKey]
  const side = record.type === 'high' ? '超上限' : '低于下限'
  const unit = meta.unit ? ` ${meta.unit}` : ''
  const valueText = (record.value ?? 0).toFixed(meta.decimals)
  return `【水厂监控】${deviceName} ${meta.label} ${valueText}${unit},${side} ${record.threshold}${unit},请及时处理。`
}

export interface SendSmsOptions {
  receivers: Receiver[]
  now?: () => number
  delayMs?: number
  failureRate?: number
  random?: () => number
  onSettled?: (record: AlarmRecord) => void
}

/**
 * 模拟短信发送:原地修改 record.sms。
 * 无接收人 → 立即 failed;否则 pending,延迟 delayMs 后按 failureRate 概率置 sent/failed。
 */
export function sendSms(record: AlarmRecord, options: SendSmsOptions): void {
  const { receivers, now = Date.now, delayMs = 1000, failureRate = 0.05, random = Math.random, onSettled } = options
  record.sms.receivers = receivers.map((r) => r.phone)
  if (receivers.length === 0) {
    record.sms.status = 'failed'
    onSettled?.(record)
    return
  }
  record.sms.status = 'pending'
  setTimeout(() => {
    record.sms.status = random() < failureRate ? 'failed' : 'sent'
    record.sms.sentAt = now()
    onSettled?.(record)
  }, delayMs)
}
