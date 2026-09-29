/** 真实后端分支统一入口:后端就绪前调用即抛错,防静默失败 */
export async function request<T>(_path: string): Promise<T> {
  throw new Error(`后端 API 尚未接入:${_path}。请保持 VITE_USE_MOCK=true,待后端就绪后在本模块接入。`)
}
