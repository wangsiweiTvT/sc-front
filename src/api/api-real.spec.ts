import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEVICES } from '@/config/params'
import type { Reading } from './types'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

const fetchOf = (handler: FetchLike) => vi.fn(handler)

const iso = '2026-10-08T09:59:58'
const ms = new Date(iso).getTime()

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('request(真实 HTTP 层)', () => {
  it('以 VITE_API_BASE(缺省 127.0.0.1:8000) + path 请求并解析 JSON', async () => {
    const fetchMock = fetchOf(async () => jsonResponse({ ok: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const { request } = await import('./http')
    await expect(request<{ ok: number }>('/api/alarms')).resolves.toEqual({ ok: 1 })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/alarms',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('非 2xx 抛错且带状态码,防静默失败', async () => {
    vi.stubGlobal('fetch', fetchOf(async () => jsonResponse({ detail: 'x' }, 404)))
    const { request } = await import('./http')
    await expect(request('/api/alarms')).rejects.toThrow(/404/)
  })

  it('带 body 时序列化为 JSON 并带 Content-Type', async () => {
    const fetchMock = fetchOf(async () => jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)
    const { request } = await import('./http')
    await request('/api/thresholds', { method: 'PUT', body: [{ a: 1 }] })
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      method: 'PUT',
      body: JSON.stringify([{ a: 1 }]),
      headers: { 'Content-Type': 'application/json' },
    })
  })
})

describe('VITE_USE_MOCK=false 时的真实分支接线', () => {
  async function importReal<T>(load: () => Promise<T>): Promise<T> {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.resetModules()
    return load()
  }

  it('deviceApi.getDevices 始终用本地设备档案,不打后端(契约 §4.6)', async () => {
    const fetchMock = fetchOf(async () => jsonResponse({}, 500))
    vi.stubGlobal('fetch', fetchMock)
    const { deviceApi } = await importReal(() => import('./deviceApi'))
    await expect(deviceApi.getDevices()).resolves.toEqual(DEVICES)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('monitorApi.getRealtimeReadings 映射快照,忽略四台之外的设备', async () => {
    const fetchMock = fetchOf(async () =>
      jsonResponse({
        server_time: iso,
        readings: {
          'Di-Jiu-Shui-Chang-1': {
            device_id: 'Di-Jiu-Shui-Chang-1', sf: 1.52, vf: 14, fc: 1180,
            phf: 7.21, tf: 18.6, cf: 0.52, reported_at: iso,
          },
          'Di-Er-Shui-Chang-2': null,
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { monitorApi } = await importReal(() => import('./monitorApi'))
    const snap = await monitorApi.getRealtimeReadings()
    expect(snap.now).toBe(ms)
    expect(snap.readings['Di-Jiu-Shui-Chang-1']!.params).toEqual({
      Sf: 1.52, Vf: 14, Fc: 1180, pHf: 7.21, Tf: 18.6, Cf: 0.52,
    })
    expect(snap.readings['Di-Jiu-Shui-Chang-4']).toBeNull()
    expect((snap.readings as Record<string, Reading | null>)['Di-Er-Shui-Chang-2']).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('monitorApi.getHistory 走 /data 并把行映射为 Reading', async () => {
    vi.stubGlobal(
      'fetch',
      fetchOf(async () =>
        jsonResponse([
          { device_id: 'Di-Jiu-Shui-Chang-1', sf: 1.5, vf: 10, reported_at: iso },
          { device_id: 'Di-Jiu-Shui-Chang-1', sf: 1.6, vf: 11, reported_at: '2026-10-08T10:00:00' },
        ]),
      ),
    )
    const { monitorApi } = await importReal(() => import('./monitorApi'))
    const history = await monitorApi.getHistory('Di-Jiu-Shui-Chang-1', 'Sf')
    expect(history).toEqual([
      { deviceId: 'Di-Jiu-Shui-Chang-1', params: { Sf: 1.5, Vf: 10 }, timestamp: ms },
      { deviceId: 'Di-Jiu-Shui-Chang-1', params: { Sf: 1.6, Vf: 11 }, timestamp: ms + 2000 },
    ])
  })

  it('alarmApi.getAlarms 把 snake_case 记录映射为前端模型', async () => {
    vi.stubGlobal(
      'fetch',
      fetchOf(async () =>
        jsonResponse([
          {
            id: 'alarm-1', time: 1728355600000, device_id: 'Di-Jiu-Shui-Chang-1',
            param_key: 'Vf', type: 'high', value: 36.2, threshold: 35, level: 'warning',
            sms: { status: 'sent', receivers: ['13800000000'], sent_at: 1728355601200 },
          },
        ]),
      ),
    )
    const { alarmApi } = await importReal(() => import('./alarmApi'))
    await expect(alarmApi.getAlarms()).resolves.toEqual([
      {
        id: 'alarm-1', time: 1728355600000, deviceId: 'Di-Jiu-Shui-Chang-1',
        paramKey: 'Vf', type: 'high', value: 36.2, threshold: 35, level: 'warning',
        sms: { status: 'sent', receivers: ['13800000000'], sentAt: 1728355601200 },
      },
    ])
  })

  it('detectorApi.getStatus 映射 /api/detector/status', async () => {
    vi.stubGlobal(
      'fetch',
      fetchOf(async () => jsonResponse({ running: true, last_scan_at: iso, scans_count: 42 })),
    )
    const { detectorApi } = await importReal(() => import('./detectorApi'))
    await expect(detectorApi.getStatus()).resolves.toEqual({ running: true, lastScanAt: ms, scansCount: 42 })
  })

  it('detectorApi.getStatus:last_scan_at 为 null → lastScanAt null', async () => {
    vi.stubGlobal(
      'fetch',
      fetchOf(async () => jsonResponse({ running: false, last_scan_at: null, scans_count: 0 })),
    )
    const { detectorApi } = await importReal(() => import('./detectorApi'))
    await expect(detectorApi.getStatus()).resolves.toEqual({ running: false, lastScanAt: null, scansCount: 0 })
  })

  it('configApi.getThresholds 透传 camelCase;addReceiver POST {name, phone} 返回服务端 id', async () => {
    const fetchMock = fetchOf(async () => jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse([{ deviceId: 'Di-Jiu-Shui-Chang-1', paramKey: 'Vf', low: 5, high: 35, enabled: true }]))
      .mockResolvedValueOnce(jsonResponse({ id: 'rcv-ab12cd34', name: '张工', phone: '13800000000' }))
    vi.stubGlobal('fetch', fetchMock)
    const { configApi } = await importReal(() => import('./configApi'))
    await expect(configApi.getThresholds()).resolves.toEqual([
      { deviceId: 'Di-Jiu-Shui-Chang-1', paramKey: 'Vf', low: 5, high: 35, enabled: true },
    ])
    await expect(configApi.addReceiver({ name: '张工', phone: '13800000000' })).resolves.toEqual({
      id: 'rcv-ab12cd34', name: '张工', phone: '13800000000',
    })
    expect(JSON.parse((fetchMock.mock.calls[1]![1] as RequestInit).body as string)).toEqual({
      name: '张工', phone: '13800000000',
    })
  })
})
