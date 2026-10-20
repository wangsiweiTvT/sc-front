/** 「x 分钟前关注」确认文案,四期 §9.3 手动获取最新关注后展示;不足 1 分钟 → 刚刚关注;无时间 → 已关注 */
export function followedAgoText(subscribeTime: number | null, nowMs: number): string {
  if (subscribeTime === null) return '已关注'
  const minutes = Math.max(0, Math.floor((nowMs - subscribeTime * 1000) / 60_000))
  return minutes < 1 ? '刚刚关注' : `${minutes} 分钟前关注`
}
