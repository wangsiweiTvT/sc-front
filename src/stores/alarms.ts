import { reactive } from 'vue'
import { ElNotification } from 'element-plus'
import type { AlarmRecord } from '@/api/types'
import { alarmApi } from '@/api/alarmApi'
import { buildSmsText } from '@/utils/alarmText'
import { mockDetector } from '@/mock/detector'
import { loadJSON, saveJSON, STORAGE_KEYS } from '@/mock/memory'
import { ALARM_POLL_INTERVAL_MS, DEVICES } from '@/config/params'

const useMock = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'

const state = reactive<{ records: AlarmRecord[]; unread: number; loaded: boolean }>({
  records: [],
  unread: 0,
  loaded: false,
})

let initPromise: Promise<void> | null = null
let pollTimer: number | null = null
let seenIds = new Set<string>()
/** 已读水位:只统计该时间之后产生的告警(判定移交后端后,前端以拉取为准) */
let lastReadAt = 0

function deviceName(id: string): string {
  return DEVICES.find((d) => d.id === id)?.name ?? id
}

function notifyNew(records: AlarmRecord[]): void {
  for (const r of records) {
    if (seenIds.has(r.id)) continue
    seenIds.add(r.id)
    ElNotification({
      title: r.level === 'critical' ? '严重告警' : '告警提醒',
      message: buildSmsText(r, deviceName(r.deviceId)),
      type: r.level === 'critical' ? 'error' : 'warning',
      duration: 4000,
    })
  }
}

function recomputeUnread(): void {
  state.unread = state.records.filter((r) => r.time > lastReadAt).length
}

async function poll(initial: boolean): Promise<void> {
  if (useMock) mockDetector.tick(Date.now())
  state.records = await alarmApi.getAlarms()
  if (initial) seenIds = new Set(state.records.map((r) => r.id))
  else notifyNew(state.records)
  recomputeUnread()
}

export function useAlarmsStore() {
  function init(): Promise<void> {
    initPromise ??= (async () => {
      // 首次使用以当前时间为水位:历史告警不算未读
      lastReadAt = loadJSON<number>(STORAGE_KEYS.alarmReadAt, Date.now())
      await poll(true)
      state.loaded = true
      pollTimer = window.setInterval(() => {
        void poll(false)
      }, ALARM_POLL_INTERVAL_MS)
    })()
    return initPromise
  }

  function markAllRead(): void {
    lastReadAt = Date.now()
    saveJSON(STORAGE_KEYS.alarmReadAt, lastReadAt)
    recomputeUnread()
  }

  async function clearAll(): Promise<void> {
    await alarmApi.clearAlarms()
    state.records = []
    state.unread = 0
    seenIds = new Set()
    lastReadAt = Date.now()
    saveJSON(STORAGE_KEYS.alarmReadAt, lastReadAt)
  }

  function stop(): void {
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  return { state, init, clearAll, markAllRead, stop }
}
