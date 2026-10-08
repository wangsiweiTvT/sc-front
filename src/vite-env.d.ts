/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'true'(默认)用模拟数据;'false' 走真实后端 */
  readonly VITE_USE_MOCK?: string
  /** 真实后端地址;VITE_USE_MOCK=false 时使用,缺省 http://127.0.0.1:8000 */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.svg' {
  const src: string
  export default src
}
