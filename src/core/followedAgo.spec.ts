import { describe, expect, it } from 'vitest'
import { followedAgoText } from './followedAgo'

const T0 = 1_700_000_000_000
const SUB = 1_700_000_000 - 180 // 3 分钟前关注的 unix 秒

describe('followedAgoText(关注时间文案,四期 §9.3 手动获取)', () => {
  it('不足 1 分钟 → 刚刚关注;整分 → x 分钟前关注;无时间 → 已关注', () => {
    expect(followedAgoText(SUB + 179, T0)).toBe('刚刚关注')
    expect(followedAgoText(SUB, T0)).toBe('3 分钟前关注')
    expect(followedAgoText(null, T0)).toBe('已关注')
  })
})
