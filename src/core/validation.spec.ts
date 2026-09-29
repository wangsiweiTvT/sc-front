import { describe, expect, it } from 'vitest'
import { validatePhone, validateThresholdRules } from './validation'
import { defaultThresholds } from '@/config/params'

describe('validateThresholdRules', () => {
  it('全部合法返回 null', () => {
    expect(validateThresholdRules(defaultThresholds())).toBeNull()
  })

  it('low >= high 返回中文错误并点名设备与参数', () => {
    const rules = defaultThresholds()
    rules[0]!.high = rules[0]!.low
    const msg = validateThresholdRules(rules)!
    expect(msg).toContain('九厂一期-1#')
    expect(msg).toContain('沉降比')
    expect(msg).toContain('小于')
  })

  it('非数字阈值返回错误', () => {
    const rules = defaultThresholds()
    ;(rules[0] as { low: number }).low = Number.NaN
    expect(validateThresholdRules(rules)).toContain('数字')
  })
})

describe('validatePhone', () => {
  it('合法 11 位手机号通过', () => {
    expect(validatePhone('13800000000')).toBe(true)
  })

  it('位数不足、非 1 开头、含非数字均拒绝', () => {
    expect(validatePhone('1380000000')).toBe(false)
    expect(validatePhone('23800000000')).toBe(false)
    expect(validatePhone('1380000000a')).toBe(false)
  })
})
