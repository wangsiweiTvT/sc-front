export type DeviceId =
  | 'Di-Jiu-Shui-Chang-1'
  | 'Di-Jiu-Shui-Chang-2'
  | 'Di-Jiu-Shui-Chang-3'
  | 'Di-Jiu-Shui-Chang-4'

export type ParamKey = 'Vf' | 'Sf' | 'Fc' | 'pHf' | 'Tf' | 'Cf'

export type DeviceStatus = 'online' | 'offline' | 'abnormal'
export type AlarmType = 'high' | 'low' | 'offline'
export type AlarmLevel = 'warning' | 'critical'
export type SmsStatus = 'pending' | 'sent' | 'failed'

export interface Device {
  id: DeviceId
  clientId: string
  name: string
  model: string
  location: string
  commissionDate: string
  comm: string
  manager: string
  image: string
}

export interface Reading {
  deviceId: DeviceId
  params: Partial<Record<ParamKey, number>>
  timestamp: number
}

export interface ParamViolation {
  paramKey: ParamKey
  value: number
  type: 'high' | 'low'
  threshold: number
}

export interface DeviceStatusInfo {
  status: DeviceStatus
  violations: ParamViolation[]
}

export interface ThresholdRule {
  deviceId: DeviceId
  paramKey: ParamKey
  low: number
  high: number
  enabled: boolean
}

export interface Receiver {
  id: string
  name: string
  phone: string
}

export interface SmsInfo {
  status: SmsStatus
  receivers: string[]
  sentAt?: number
}

export interface AlarmRecord {
  id: string
  time: number
  deviceId: DeviceId
  /** null 表示整机离线告警 */
  paramKey: ParamKey | null
  type: AlarmType
  value: number | null
  threshold: number | null
  /** high/low → warning;offline → critical */
  level: AlarmLevel
  sms: SmsInfo
}

export interface ParamMeta {
  key: ParamKey
  label: string
  unit: string
  decimals: number
  /** 模拟数据随机游走的正常范围 */
  normal: [number, number]
  defaultThreshold: [number, number]
  defaultEnabled: boolean
}

export interface RealtimeSnapshot {
  now: number
  readings: Record<DeviceId, Reading | null>
  /** 手动"模拟离线"中的设备(按钮状态展示用) */
  forcedOffline: DeviceId[]
}
