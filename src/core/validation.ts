import type { ThresholdRule } from '@/api/types'
import { DEVICES, PARAM_META_MAP } from '@/config/params'

/** 校验整张阈值表;发现问题返回中文描述(点名设备与参数),全部合法返回 null */
export function validateThresholdRules(rules: ThresholdRule[]): string | null {
  for (const r of rules) {
    if (!Number.isFinite(r.low) || !Number.isFinite(r.high)) {
      return '阈值必须为有效数字'
    }
    if (r.low >= r.high) {
      const deviceName = DEVICES.find((d) => d.id === r.deviceId)?.name ?? r.deviceId
      const label = PARAM_META_MAP[r.paramKey].label
      return `${deviceName} ${label}:下限( ${r.low} )必须小于上限( ${r.high} )`
    }
  }
  return null
}

export function validatePhone(phone: string): boolean {
  return /^1\d{10}$/.test(phone)
}
