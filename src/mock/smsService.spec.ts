import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendSms } from './smsService'
import type { AlarmRecord, Receiver } from '@/api/types'

const T0 = 1_700_000_000_000
const receivers: Receiver[] = [
  { id: 'r1', name: '张三', phone: '13800000001' },
  { id: 'r2', name: '李四', phone: '13800000002' },
]

function highAlarm(): AlarmRecord {
  return {
    id: 'a1', time: T0, deviceId: 'Di-Jiu-Shui-Chang-1', paramKey: 'Vf', type: 'high',
    value: 38.25, threshold: 35, level: 'warning', sms: { status: 'pending', receivers: [] },
  }
}

beforeEach(() => vi.useFakeTimers({ now: T0 }))
afterEach(() => vi.useRealTimers())

describe('sendSms(模拟短信,仅 mock 检测器使用)', () => {
  it('有接收人:pending → 延迟后 sent,记录接收人与 sentAt', () => {
    const record = highAlarm()
    const settled: AlarmRecord[] = []
    sendSms(record, { receivers, random: () => 0.5, onSettled: (r) => settled.push(r) })
    expect(record.sms.status).toBe('pending')
    expect(record.sms.receivers).toEqual(['13800000001', '13800000002'])
    vi.advanceTimersByTime(1000)
    expect(record.sms.status).toBe('sent')
    expect(record.sms.sentAt).toBe(T0 + 1000)
    expect(settled).toHaveLength(1)
  })

  it('随机数低于失败率 → failed', () => {
    const record = highAlarm()
    sendSms(record, { receivers, random: () => 0.01, failureRate: 0.05 })
    vi.advanceTimersByTime(1000)
    expect(record.sms.status).toBe('failed')
  })

  it('无接收人:立即 failed 并回调', () => {
    const record = highAlarm()
    const settled: AlarmRecord[] = []
    sendSms(record, { receivers: [], onSettled: (r) => settled.push(r) })
    expect(record.sms.status).toBe('failed')
    expect(settled).toHaveLength(1)
    vi.advanceTimersByTime(5000)
    expect(record.sms.sentAt).toBeUndefined()
  })
})
