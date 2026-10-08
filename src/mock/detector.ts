/**
 * mock 模式的"后端检测器"(二期后判定与短信归后端常驻进程,见 docs/backend-api.md §7;
 * 此处按其语义复刻,供 VITE_USE_MOCK=true 的演示/开发模式与测试使用):
 * 每轮扫描 4 台设备 → 状态判定 → 冷却去重产告警 → 落库(localStorage)→ 模拟短信落定。
 */
import type { AlarmRecord, DeviceId, DeviceStatus } from '@/api/types'
import { detectAlarms } from './alarmEngine'
import { sendSms } from './smsService'
import { judgeDeviceStatus } from '@/core/statusRule'
import { simulator } from './simulator'
import { loadJSON, saveJSON, STORAGE_KEYS } from './memory'
import { useSettingsStore } from '@/stores/settings'
import { ALARM_MAX_COUNT, DEVICE_IDS } from '@/config/params'

const prevStatus = new Map<DeviceId, DeviceStatus>()

function updateOne(record: AlarmRecord): void {
  const all = loadJSON<AlarmRecord[]>(STORAGE_KEYS.alarms, [])
  saveJSON(STORAGE_KEYS.alarms, all.map((a) => (a.id === record.id ? record : a)))
}

export const mockDetector = {
  tick(now: number): void {
    const settings = useSettingsStore()
    const latest = simulator.latest()
    const existing = loadJSON<AlarmRecord[]>(STORAGE_KEYS.alarms, [])
    const fresh: AlarmRecord[] = []
    for (const id of DEVICE_IDS) {
      const statusInfo = judgeDeviceStatus({
        latestReading: latest[id] ?? null,
        now,
        rules: settings.rulesFor(id),
      })
      fresh.push(...detectAlarms({ deviceId: id, prevStatus: prevStatus.get(id) ?? null, statusInfo, now, existingAlarms: existing }))
      prevStatus.set(id, statusInfo.status)
    }
    if (fresh.length === 0) return
    saveJSON(STORAGE_KEYS.alarms, [...existing, ...fresh].slice(-ALARM_MAX_COUNT))
    const receivers = settings.state.receivers
    for (const record of fresh) {
      sendSms(record, { receivers, onSettled: updateOne })
    }
  },
}
