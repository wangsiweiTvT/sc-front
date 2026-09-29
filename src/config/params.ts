import sensorImg from '@/assets/devices/sensor.jpg'
import type { Device, DeviceId, ParamKey, ParamMeta, ThresholdRule } from '@/api/types'

/** 参数中文含义为暂定设定,纠正时只改本表 */
export const PARAM_METAS: ParamMeta[] = [
  { key: 'Vf', label: '沉降比', unit: '%', decimals: 1, normal: [8, 25], defaultThreshold: [5, 35], defaultEnabled: true },
  { key: 'Sf', label: '沉降速度', unit: 'm/h', decimals: 2, normal: [0.8, 2.5], defaultThreshold: [0.5, 3.5], defaultEnabled: true },
  { key: 'Fc', label: '流量', unit: 'm³/h', decimals: 0, normal: [900, 1400], defaultThreshold: [800, 1500], defaultEnabled: true },
  { key: 'pHf', label: 'pH', unit: '', decimals: 2, normal: [6.8, 7.8], defaultThreshold: [6.5, 8.5], defaultEnabled: true },
  { key: 'Tf', label: '温度', unit: '℃', decimals: 1, normal: [12, 24], defaultThreshold: [8, 30], defaultEnabled: true },
  { key: 'Cf', label: '余氯', unit: 'mg/L', decimals: 2, normal: [0.3, 0.8], defaultThreshold: [0.2, 1.0], defaultEnabled: true },
]

export const PARAM_META_MAP = Object.fromEntries(
  PARAM_METAS.map((m) => [m.key, m]),
) as Record<ParamKey, ParamMeta>

export const DEVICES: Device[] = [
  {
    id: 'Di-Jiu-Shui-Chang-1', clientId: 'Di-Jiu-Shui-Chang-1', name: '九厂一期-1#',
    model: 'SP-300 多参数水质监测仪', location: '1# 沉淀池', commissionDate: '2025-03-18',
    comm: 'MQTT · 100.85.44.98:1883', manager: '张工', image: sensorImg,
  },
  {
    id: 'Di-Jiu-Shui-Chang-2', clientId: 'Di-Jiu-Shui-Chang-2', name: '九厂一期-2#',
    model: 'SP-300 多参数水质监测仪', location: '2# 沉淀池', commissionDate: '2025-03-18',
    comm: 'MQTT · 100.85.44.98:1883', manager: '李工', image: sensorImg,
  },
  {
    id: 'Di-Jiu-Shui-Chang-3', clientId: 'Di-Jiu-Shui-Chang-3', name: '九厂一期-3#',
    model: 'SP-300 多参数水质监测仪', location: '3# 沉淀池', commissionDate: '2025-04-02',
    comm: 'MQTT · 100.85.44.98:1883', manager: '王工', image: sensorImg,
  },
  {
    id: 'Di-Jiu-Shui-Chang-4', clientId: 'Di-Jiu-Shui-Chang-4', name: '九厂一期-4#',
    model: 'SP-300 多参数水质监测仪', location: '加药间', commissionDate: '2025-04-02',
    comm: 'MQTT · 100.85.44.98:1883', manager: '赵工', image: sensorImg,
  },
]

export const DEVICE_IDS: DeviceId[] = DEVICES.map((d) => d.id)

/** 超过该时长无新数据即判离线 */
export const OFFLINE_AFTER_MS = 60_000
/** 同设备同参数同类型告警的短信冷却窗口 */
export const ALARM_COOLDOWN_MS = 600_000
/** 模拟数据刷新周期 */
export const POLL_INTERVAL_MS = 2_000
/** 告警记录持久化上限,超出丢弃最旧 */
export const ALARM_MAX_COUNT = 500

/** 首次使用时按参数元数据生成的默认阈值表(4 设备 × 6 参数) */
export function defaultThresholds(): ThresholdRule[] {
  return DEVICES.flatMap((d) =>
    PARAM_METAS.map((m) => ({
      deviceId: d.id,
      paramKey: m.key,
      low: m.defaultThreshold[0],
      high: m.defaultThreshold[1],
      enabled: m.defaultEnabled,
    })),
  )
}
