import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadJSON, saveJSON, STORAGE_KEYS } from './memory'

beforeEach(() => localStorage.clear())

describe('loadJSON/saveJSON', () => {
  it('roundtrip:保存后读取一致', () => {
    saveJSON(STORAGE_KEYS.receivers, [{ id: 'r1', name: '张三', phone: '13800000000' }])
    expect(loadJSON(STORAGE_KEYS.receivers, [])).toEqual([{ id: 'r1', name: '张三', phone: '13800000000' }])
  })

  it('无数据返回 fallback', () => {
    expect(loadJSON(STORAGE_KEYS.alarms, [1, 2])).toEqual([1, 2])
  })

  it('数据损坏返回 fallback 且不抛错', () => {
    localStorage.setItem(STORAGE_KEYS.alarms, '{not-json')
    expect(loadJSON(STORAGE_KEYS.alarms, [])).toEqual([])
  })

  it('localStorage 抛异常时静默降级', () => {
    // happy-dom 的 localStorage 实例不经过 Storage.prototype,须 spy 实例自身
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => saveJSON('k', { a: 1 })).not.toThrow()
    expect(loadJSON('k', 'fallback')).toBe('fallback')
    vi.restoreAllMocks()
  })
})
