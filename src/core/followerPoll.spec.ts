import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFollowerPoll, followedAgoText } from './followerPoll'

const T0 = 1_700_000_000_000
const SUB = 1_700_000_000 - 180 // 3 分钟前关注的 unix 秒

beforeEach(() => vi.useFakeTimers({ now: T0 }))
afterEach(() => vi.useRealTimers())

describe('followedAgoText(关注时间文案)', () => {
  it('不足 1 分钟 → 刚刚关注;整分 → x 分钟前关注;无时间 → 已关注', () => {
    expect(followedAgoText(SUB + 179, T0)).toBe('刚刚关注')
    expect(followedAgoText(SUB, T0)).toBe('3 分钟前关注')
    expect(followedAgoText(null, T0)).toBe('已关注')
  })
})

describe('createFollowerPoll(扫码自动回填轮询,四期 §9.3)', () => {
  it('启动立即查一次;null 继续每 5 秒;openid 到达回调一次并停止', async () => {
    const fetchFollower = vi
      .fn<() => Promise<{ openid: string | null; subscribeTime: number | null }>>()
      .mockResolvedValueOnce({ openid: null, subscribeTime: null })
      .mockResolvedValueOnce({ openid: null, subscribeTime: null })
      .mockResolvedValueOnce({ openid: 'oSCAN1', subscribeTime: SUB })
    const onFollower = vi.fn()
    const poll = createFollowerPoll({ fetchFollower, onFollower })

    poll.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchFollower).toHaveBeenCalledTimes(1)
    expect(onFollower).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(5_000)
    expect(fetchFollower).toHaveBeenCalledTimes(2)
    expect(onFollower).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(5_000)
    expect(onFollower).toHaveBeenCalledTimes(1)
    expect(onFollower).toHaveBeenCalledWith('oSCAN1', SUB)

    await vi.advanceTimersByTimeAsync(15_000)
    expect(fetchFollower).toHaveBeenCalledTimes(3)
    expect(onFollower).toHaveBeenCalledTimes(1)
  })

  it('fetch 拒绝(502/503/网络错误)静默跳过,下一轮继续', async () => {
    const fetchFollower = vi
      .fn<() => Promise<{ openid: string | null; subscribeTime: number | null }>>()
      .mockRejectedValueOnce(new Error('后端接口 502:GET /api/wechat/latest-follower'))
      .mockResolvedValueOnce({ openid: 'oSCAN2', subscribeTime: null })
    const onFollower = vi.fn()
    const poll = createFollowerPoll({ fetchFollower, onFollower })

    poll.start()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(onFollower).toHaveBeenCalledWith('oSCAN2', null)
  })

  it('stop 后不再轮询;进行中的请求回来也不回调', async () => {
    let resolveFetch: (v: { openid: string | null; subscribeTime: number | null }) => void = () => {}
    const fetchFollower = vi
      .fn<() => Promise<{ openid: string | null; subscribeTime: number | null }>>()
      .mockImplementation(() => new Promise((res) => (resolveFetch = res)))
    const onFollower = vi.fn()
    const poll = createFollowerPoll({ fetchFollower, onFollower })

    poll.start()
    await vi.advanceTimersByTimeAsync(0)
    poll.stop()
    resolveFetch({ openid: 'oLATE', subscribeTime: SUB })
    await vi.advanceTimersByTimeAsync(20_000)

    expect(fetchFollower).toHaveBeenCalledTimes(1)
    expect(onFollower).not.toHaveBeenCalled()
  })

  it('refreshNow 不等间隔立即查一次(手动兜底)', async () => {
    const fetchFollower = vi
      .fn<() => Promise<{ openid: string | null; subscribeTime: number | null }>>()
      .mockResolvedValue({ openid: 'oMANUAL', subscribeTime: SUB })
    const onFollower = vi.fn()
    const poll = createFollowerPoll({ fetchFollower, onFollower })

    await poll.refreshNow()
    expect(fetchFollower).toHaveBeenCalledTimes(1)
    expect(onFollower).toHaveBeenCalledWith('oMANUAL', SUB)
  })
})
