import { reactive } from 'vue'
import { ElNotification } from 'element-plus'
import type { AlarmRecord } from '@/api/types'
import { alarmApi } from '@/api/alarmApi'
import { DEVICES } from '@/config/params'
import { buildSmsText, sendSms } from '@/core/smsService'
import { useSettingsStore } from './settings'

const state = reactive<{ records: AlarmRecord[]; unread: number; loaded: boolean }>({
  records: [],
  unread: 0,
  loaded: false,
})

let initPromise: Promise<void> | null = null

export function useAlarmsStore() {
  const settings = useSettingsStore()

  function init(): Promise<void> {
    initPromise ??= (async () => {
      state.records = await alarmApi.getAlarms()
      state.loaded = true
    })()
    return initPromise
  }

  async function push(records: AlarmRecord[]): Promise<void> {
    if (records.length === 0) return
    await alarmApi.appendAlarms(records)
    const start = state.records.length
    state.records.push(...records)
    for (let i = 0; i < records.length; i++) {
      // 从响应式数组取回代理对象:sendSms 落定时经代理写入,表格单元格才能随之更新
      const record = state.records[start + i]!
      const deviceName = DEVICES.find((d) => d.id === record.deviceId)?.name ?? record.deviceId
      sendSms(record, {
        receivers: settings.state.receivers,
        onSettled: (updated) => {
          void alarmApi.updateAlarm(updated)
          state.unread += 1
          const sent = updated.sms.status === 'sent'
          ElNotification({
            title: sent ? '短信已发送(模拟)' : '短信发送失败',
            message: buildSmsText(updated, deviceName),
            type: sent ? 'success' : 'error',
            duration: 4000,
          })
        },
      })
    }
  }

  async function clearAll(): Promise<void> {
    await alarmApi.clearAlarms()
    state.records = []
    state.unread = 0
  }

  function markAllRead(): void {
    state.unread = 0
  }

  return { state, init, push, clearAll, markAllRead }
}
