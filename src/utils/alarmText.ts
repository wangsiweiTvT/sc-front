import type { AlarmRecord, ParamKey } from '@/api/types'
import { PARAM_META_MAP } from '@/config/params'

/** 告警通知/短信文案(展示层使用,mock 检测器与真实告警共用) */
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
