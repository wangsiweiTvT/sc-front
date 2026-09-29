export const STORAGE_KEYS = {
  thresholds: 'sc-front:thresholds',
  receivers: 'sc-front:receivers',
  alarms: 'sc-front:alarms',
} as const

/** 读取失败(禁用/损坏)时返回 fallback,绝不抛错 */
export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** 写入失败(隐私模式/配额)时静默忽略 */
export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 忽略 */
  }
}
