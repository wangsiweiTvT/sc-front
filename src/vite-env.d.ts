/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'true'(默认)用模拟数据;'false' 走真实后端(尚未实现时抛错) */
  readonly VITE_USE_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
