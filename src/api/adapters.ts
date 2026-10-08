/** 真实后端 JSON ↔ 前端模型的字段适配(契约见 docs/backend-api.md §3、§4.2) */
import type { AlarmRecord, DeviceId, ParamKey, RealtimeSnapshot, Reading, SmsStatus } from './types'
import { DEVICE_IDS } from '@/config/params'

/** sensor_data 行(FastAPI row_to_dict 输出):snake_case 列名 + ISO 时间 */
export interface SensorRow {
  device_id: string
  sf: number | null
  vf: number | null
  fc: number | null
  phf: number | null
  tf: number | null
  cf: number | null
  reported_at: string
}

/** GET /api/readings/latest 响应(§4.4);快照可能包含四台之外的设备 */
export interface SnapshotPayload {
  server_time?: string
  readings: Record<string, SensorRow | null>
  forced_offline?: string[]
}

/** 后端存储的告警记录(§4.2:前端 JSON 原样存取,snake_case + 毫秒时间戳) */
export interface AlarmPayload {
  id: string
  time: number
  device_id: string
  param_key: ParamKey | null
  type: string
  value: number | null
  threshold: number | null
  level: string
  sms: { status: SmsStatus; receivers: string[]; sent_at?: number }
}

const PARAM_BY_COLUMN = [
  ['sf', 'Sf'],
  ['vf', 'Vf'],
  ['fc', 'Fc'],
  ['phf', 'pHf'],
  ['tf', 'Tf'],
  ['cf', 'Cf'],
] as const satisfies ReadonlyArray<readonly [keyof SensorRow, ParamKey]>

/** 行 → Reading;reported_at 缺失或不可解析返回 null(坏行不进曲线与状态判定) */
export function readingFromRow(row: SensorRow): Reading | null {
  const timestamp = Date.parse(row.reported_at)
  if (Number.isNaN(timestamp)) return null
  const params: Partial<Record<ParamKey, number>> = {}
  for (const [column, paramKey] of PARAM_BY_COLUMN) {
    const value = row[column]
    if (value !== null && value !== undefined) params[paramKey] = value
  }
  return { deviceId: row.device_id as DeviceId, params, timestamp }
}

/** 快照 → RealtimeSnapshot:仅保留四台设备,null 保持 null,多余设备忽略 */
export function snapshotFromPayload(payload: SnapshotPayload): RealtimeSnapshot {
  const parsed = payload.server_time === undefined ? Number.NaN : Date.parse(payload.server_time)
  const readings = Object.fromEntries(
    DEVICE_IDS.map((id) => {
      const row = payload.readings[id]
      return [id, row ? readingFromRow(row) : null]
    }),
  ) as RealtimeSnapshot['readings']
  const forcedOffline = (payload.forced_offline ?? []).filter((id): id is DeviceId =>
    (DEVICE_IDS as string[]).includes(id),
  )
  return { now: Number.isNaN(parsed) ? Date.now() : parsed, readings, forcedOffline }
}

export function alarmToPayload(record: AlarmRecord): AlarmPayload {
  const sms: AlarmPayload['sms'] = { status: record.sms.status, receivers: [...record.sms.receivers] }
  if (record.sms.sentAt !== undefined) sms.sent_at = record.sms.sentAt
  return {
    id: record.id,
    time: record.time,
    device_id: record.deviceId,
    param_key: record.paramKey,
    type: record.type,
    value: record.value,
    threshold: record.threshold,
    level: record.level,
    sms,
  }
}

export function alarmFromPayload(payload: AlarmPayload): AlarmRecord {
  const sms: AlarmRecord['sms'] = { status: payload.sms.status, receivers: [...payload.sms.receivers] }
  if (payload.sms.sent_at !== undefined) sms.sentAt = payload.sms.sent_at
  return {
    id: payload.id,
    time: payload.time,
    deviceId: payload.device_id as DeviceId,
    paramKey: payload.param_key,
    type: payload.type as AlarmRecord['type'],
    value: payload.value,
    threshold: payload.threshold,
    level: payload.level as AlarmRecord['level'],
    sms,
  }
}
