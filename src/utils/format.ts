import dayjs from 'dayjs'
import type { ParamKey } from '@/api/types'
import { PARAM_META_MAP } from '@/config/params'

export function formatTime(ts: number): string {
  return dayjs(ts).format('HH:mm:ss')
}

export function formatDateTime(ts: number): string {
  return dayjs(ts).format('YYYY-MM-DD HH:mm:ss')
}

export function formatParamValue(value: number | null | undefined, paramKey: ParamKey): string {
  if (value === null || value === undefined) return '--'
  return value.toFixed(PARAM_META_MAP[paramKey].decimals)
}
