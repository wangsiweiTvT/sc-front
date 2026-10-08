import type { AlarmRecord, Receiver } from '@/api/types'

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
