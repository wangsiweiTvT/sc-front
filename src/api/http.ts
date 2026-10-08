/** 真实后端分支统一入口:fetch + JSON;非 2xx 抛错防静默失败 */
const base: string = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  if (!res.ok) throw new Error(`后端接口 ${res.status}:${method} ${path}`)
  return (await res.json()) as T
}
