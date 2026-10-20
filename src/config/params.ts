import sensorImg from '@/assets/devices/sensor.jpg'
import type { Device, DeviceId, ParamKey, ParamMeta, ThresholdRule } from '@/api/types'

/** 参数中文含义为现场口径(2026-10 校正),纠正时只改本表 */
export const PARAM_METAS: ParamMeta[] = [
  { key: 'Sf', label: '沉降速度', unit: 'm/h', decimals: 2, normal: [0.8, 2.5], defaultThreshold: [0.5, 3.5], defaultEnabled: true },
  { key: 'Vf', label: '沉降比', unit: '%', decimals: 1, normal: [8, 25], defaultThreshold: [5, 35], defaultEnabled: true },
  { key: 'Fc', label: '机加池出水浊度', unit: 'NTU', decimals: 1, normal: [2, 6], defaultThreshold: [1, 10], defaultEnabled: true },
  { key: 'pHf', label: 'PH', unit: '', decimals: 2, normal: [6.8, 7.8], defaultThreshold: [6.5, 8.5], defaultEnabled: true },
  { key: 'Tf', label: '温度', unit: '℃', decimals: 1, normal: [12, 24], defaultThreshold: [8, 30], defaultEnabled: true },
  { key: 'Cf', label: '反应池污泥浓度', unit: 'g/L', decimals: 2, normal: [2, 6], defaultThreshold: [1, 10], defaultEnabled: true },
]

export const PARAM_META_MAP = Object.fromEntries(
  PARAM_METAS.map((m) => [m.key, m]),
) as Record<ParamKey, ParamMeta>

export const DEVICES: Device[] = [
  {
    id: 'Di-Jiu-Shui-Chang-1', clientId: 'Di-Jiu-Shui-Chang-1',
    comm: 'MQTT · 100.85.44.98:1883', manager: '王垚', image: sensorImg,
  },
  {
    id: 'Di-Jiu-Shui-Chang-2', clientId: 'Di-Jiu-Shui-Chang-2',
    comm: 'MQTT · 100.85.44.98:1883', manager: '王垚', image: sensorImg,
  },
  {
    id: 'Di-Jiu-Shui-Chang-3', clientId: 'Di-Jiu-Shui-Chang-3',
    comm: 'MQTT · 100.85.44.98:1883', manager: '王垚', image: sensorImg,
  },
  {
    id: 'Di-Jiu-Shui-Chang-4', clientId: 'Di-Jiu-Shui-Chang-4',
    comm: 'MQTT · 100.85.44.98:1883', manager: '王垚', image: sensorImg,
  },
]

export const DEVICE_IDS: DeviceId[] = DEVICES.map((d) => d.id)

/** 超过该时长无新数据即判离线(设备 13 分钟定时上报) */
export const OFFLINE_AFTER_MS = 13 * 60_000
/** 同设备同参数同类型告警的短信冷却窗口 */
export const ALARM_COOLDOWN_MS = 600_000
/** 模拟数据刷新周期 */
export const POLL_INTERVAL_MS = 2_000
/** 告警列表轮询周期(判定在后端检测器,前端拉取刷新) */
export const ALARM_POLL_INTERVAL_MS = 30_000
/** 检测器状态轮询周期 */
export const DETECTOR_POLL_INTERVAL_MS = 60_000
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
