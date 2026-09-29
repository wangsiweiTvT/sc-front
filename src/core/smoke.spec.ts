import { describe, expect, it } from 'vitest'

describe('测试基建', () => {
  it('vitest + happy-dom 可用', () => {
    expect(document.createElement('div').ownerDocument).toBeTruthy()
    expect(1 + 1).toBe(2)
  })
})
