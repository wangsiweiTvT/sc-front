# 九厂一期传感器监控实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为九厂一期 4 台工艺参数传感器建设纯前端深色监控大屏:实时在线/离线/异常状态、设备信息与图片、模拟短信告警与阈值配置界面。

**Architecture:** 数据层(`src/api/`)按将来后端 API 形状定义接口,`src/mock/`(模拟器 + localStorage 持久层)提供同签名实现,由 `VITE_USE_MOCK` 切换;核心判定逻辑(`src/core/`)为无框架依赖的纯函数,被 mock 与 store 共用;页面与 store 只依赖 api 层,不直接 import mock。

**Tech Stack:** Vue 3 `<script setup>` + TS、Element Plus(暗色)、Tailwind CSS 4、vue-router 4(hash 模式)、ECharts、vitest + happy-dom。

**Spec:** docs/superpowers/specs/2026-09-29-sensor-monitor-design.md

## Global Constraints

- 纯前端:禁止引入任何后端代码、数据库驱动、MQTT 客户端;**任何代码与文档不得出现数据库账号密码**。
- 新增依赖仅限:`vue-router`、`echarts`、`dayjs`(运行时),`vitest`、`happy-dom`(dev)。
- 每个任务结束时 `npx vue-tsc -b` 必须零错误;含测试的任务 `npm test` 必须全绿。
- 所有 localStorage 读写必须 try/catch 并有默认值兜底(统一走 `src/mock/memory.ts`,其他文件不得直接调用 localStorage)。
- 界面与提示文案全部中文;状态色:在线=绿、离线=灰、异常=红(呼吸闪烁)。
- 时间常量与 spec 一致,集中 `src/config/params.ts`:`OFFLINE_AFTER_MS = 60_000`、`ALARM_COOLDOWN_MS = 600_000`、`POLL_INTERVAL_MS = 2_000`、`ALARM_MAX_COUNT = 500`。
- 提交信息以 `feat:`/`test:`/`chore:`/`docs:` 开头,末尾带尾行:`Co-Authored-By: Claude Code <noreply@anthropic.com>`(用第二个 `-m` 传入)。

## Review Focus

spec 暗示但测试最容易漏的五类输入,已把对应测试钉进所属任务:

1. localStorage 禁用/数据损坏 → 页面不崩溃、回退默认值(Task 6 `memory.spec.ts`)。
2. 数据报文缺某参数字段 → 判定跳过该参数,不抛错(Task 3 `statusRule.spec.ts`)。
3. 同一越界持续数小时 → 10 分钟冷却限制短信频率,不轰炸(Task 4 `alarmEngine.spec.ts` + Task 8 集成测试)。
4. 阈值 low ≥ high、手机号格式错误的输入 → 保存/添加被拒并给中文提示(Task 8 `validation.spec.ts`,Task 13 界面接线)。
5. 设备恢复上线(offline→online)→ 不产生"恢复"类假告警(Task 4 `alarmEngine.spec.ts`)。

---

### Task 1: 项目基建 — 依赖、vitest、暗色主题

**Files:**
- Modify: `package.json`(依赖与脚本)
- Modify: `vite.config.ts`(别名 + vitest)
- Modify: `tsconfig.app.json`(`@/` 路径别名)
- Create: `src/vite-env.d.ts`
- Modify: `src/main.ts`(Element Plus 全量引入 + dark class)
- Modify: `src/style.css`(深色大屏设计令牌)
- Test: `src/core/smoke.spec.ts`

**Interfaces:**
- Consumes: 无(首个任务)。
- Produces: `@/` 路径别名(后续所有任务);`import.meta.env.VITE_USE_MOCK?: string` 类型;可运行的 `npm test` / `npx vue-tsc -b`。

- [ ] **Step 1: 安装依赖**

```bash
npm install vue-router echarts dayjs
npm install -D vitest happy-dom
```

- [ ] **Step 2: 配置 vite(别名 + vitest)**

`vite.config.ts` 整体替换为:

```ts
/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    AutoImport({ resolvers: [ElementPlusResolver()] }),
    Components({ resolvers: [ElementPlusResolver()] }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.spec.ts'],
  },
})
```

`tsconfig.app.json` 在 `compilerOptions` 中加入:

```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

- [ ] **Step 3: 环境类型 + 脚本**

新建 `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'true'(默认)用模拟数据;'false' 走真实后端(尚未实现时抛错) */
  readonly VITE_USE_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

`package.json` 的 `scripts` 改为:

```json
"scripts": {
  "dev": "vite",
  "build": "vue-tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 4: 冒烟测试**

新建 `src/core/smoke.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'

describe('测试基建', () => {
  it('vitest + happy-dom 可用', () => {
    expect(document.createElement('div').ownerDocument).toBeTruthy()
    expect(1 + 1).toBe(2)
  })
})
```

运行 `npm test`,预期 PASS(1 passed)。

- [ ] **Step 5: 暗色主题接线**

`src/main.ts` 整体替换为:

```ts
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './style.css'
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import App from './App.vue'

document.documentElement.classList.add('dark')

createApp(App).use(ElementPlus).mount('#app')
```

`src/style.css` 整体替换为:

```css
@import "tailwindcss";

/* Tailwind 4 类名式暗色:dark: 变体跟随 html.dark */
@custom-variant dark (&:where(.dark, .dark *));

:root {
  --sc-bg: #0b1220;
  --sc-panel: #111a2e;
  --sc-border: #1e2a44;
  --sc-text-main: #e5ecf8;
  --sc-text-dim: #8ea0bf;
  --sc-online: #34d399;
  --sc-offline: #64748b;
  --sc-abnormal: #f87171;
}

html, body, #app {
  height: 100%;
  margin: 0;
}

body {
  background: var(--sc-bg);
  color: var(--sc-text-main);
  font-family: "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif;
}

/* 状态徽标呼吸闪烁 */
@keyframes sc-breathe {
  0%, 100% { box-shadow: 0 0 0 0 rgba(248, 113, 113, 0.55); }
  50% { box-shadow: 0 0 0 6px rgba(248, 113, 113, 0); }
}
.sc-badge-abnormal {
  animation: sc-breathe 1.6s ease-in-out infinite;
}

.sc-panel {
  background: var(--sc-panel);
  border: 1px solid var(--sc-border);
  border-radius: 10px;
}

.sc-dim { color: var(--sc-text-dim); }
```

- [ ] **Step 6: 验证**

```bash
npm test && npx vue-tsc -b && npm run build
```

预期:测试通过、类型零错、构建成功。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: 测试基建与暗色大屏主题" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: 领域类型、参数元数据、设备种子与设备图片

**Files:**
- Create: `src/api/types.ts`
- Create: `src/config/params.ts`
- Create: `src/assets/devices/sensor-1.svg` ~ `sensor-4.svg`
- Test: `src/config/params.spec.ts`

**Interfaces:**
- Consumes: 无。
- Produces(后续所有任务依赖,签名原样使用):
  - 类型:`DeviceId`、`ParamKey`、`DeviceStatus`、`AlarmType`、`AlarmLevel`、`SmsStatus`、`Device`、`Reading`、`ParamViolation`、`DeviceStatusInfo`、`ThresholdRule`、`Receiver`、`SmsInfo`、`AlarmRecord`、`ParamMeta`、`RealtimeSnapshot`
  - `PARAM_METAS: ParamMeta[]`、`PARAM_META_MAP: Record<ParamKey, ParamMeta>`、`DEVICES: Device[]`
  - 常量:`OFFLINE_AFTER_MS`、`ALARM_COOLDOWN_MS`、`POLL_INTERVAL_MS`、`ALARM_MAX_COUNT`

- [ ] **Step 1: 写领域类型**

新建 `src/api/types.ts`:

```ts
export type DeviceId =
  | 'Di-Jiu-Shui-Chang-1'
  | 'Di-Jiu-Shui-Chang-2'
  | 'Di-Jiu-Shui-Chang-3'
  | 'Di-Jiu-Shui-Chang-4'

export type ParamKey = 'Vf' | 'Sf' | 'Fc' | 'pHf' | 'Tf' | 'Cf'

export type DeviceStatus = 'online' | 'offline' | 'abnormal'
export type AlarmType = 'high' | 'low' | 'offline'
export type AlarmLevel = 'warning' | 'critical'
export type SmsStatus = 'pending' | 'sent' | 'failed'

export interface Device {
  id: DeviceId
  clientId: string
  name: string
  model: string
  location: string
  commissionDate: string
  comm: string
  manager: string
  image: string
}

export interface Reading {
  deviceId: DeviceId
  params: Partial<Record<ParamKey, number>>
  timestamp: number
}

export interface ParamViolation {
  paramKey: ParamKey
  value: number
  type: 'high' | 'low'
  threshold: number
}

export interface DeviceStatusInfo {
  status: DeviceStatus
  violations: ParamViolation[]
}

export interface ThresholdRule {
  deviceId: DeviceId
  paramKey: ParamKey
  low: number
  high: number
  enabled: boolean
}

export interface Receiver {
  id: string
  name: string
  phone: string
}

export interface SmsInfo {
  status: SmsStatus
  receivers: string[]
  sentAt?: number
}

export interface AlarmRecord {
  id: string
  time: number
  deviceId: DeviceId
  /** null 表示整机离线告警 */
  paramKey: ParamKey | null
  type: AlarmType
  value: number | null
  threshold: number | null
  /** high/low → warning;offline → critical */
  level: AlarmLevel
  sms: SmsInfo
}

export interface ParamMeta {
  key: ParamKey
  label: string
  unit: string
  decimals: number
  /** 模拟数据随机游走的正常范围 */
  normal: [number, number]
  defaultThreshold: [number, number]
  defaultEnabled: boolean
}

export interface RealtimeSnapshot {
  now: number
  readings: Record<DeviceId, Reading | null>
  /** 手动"模拟离线"中的设备(按钮状态展示用) */
  forcedOffline: DeviceId[]
}
```

- [ ] **Step 2: 4 张设备示意 SVG**

新建 `src/assets/devices/sensor-1.svg`(内容如下,其余 3 张按同模板只改两处:渐变色值与 `<text>` 编号):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220">
  <defs>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0ea5e9"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="320" height="220" rx="14" fill="#0f172a"/>
  <rect x="0" y="0" width="320" height="44" rx="14" fill="url(#accent)" opacity="0.25"/>
  <rect x="24" y="64" width="120" height="120" rx="10" fill="#16233d" stroke="#26385c"/>
  <rect x="44" y="84" width="80" height="34" rx="6" fill="#0b1220" stroke="#26385c"/>
  <text x="84" y="107" text-anchor="middle" fill="#e5ecf8" font-size="16" font-family="monospace">1#</text>
  <circle cx="132" cy="76" r="5" fill="#34d399"/>
  <rect x="76" y="184" width="16" height="20" fill="#26385c"/>
  <rect x="60" y="204" width="48" height="8" rx="3" fill="url(#accent)"/>
  <text x="180" y="96" fill="#8ea0bf" font-size="13">多参数工艺监测终端</text>
  <text x="180" y="120" fill="#e5ecf8" font-size="15">九厂一期 · 1#</text>
  <text x="180" y="146" fill="#8ea0bf" font-size="12">MQTT 上报 · 6 项参数</text>
  <text x="180" y="168" fill="#8ea0bf" font-size="12">Sf / Vf / Fc / pHf / Tf / Cf</text>
</svg>
```

`sensor-2.svg`:渐变两处 stop 改为 `#a78bfa`/`#8b5cf6`,`1#`→`2#`,`九厂一期 · 1#`→`九厂一期 · 2#`。
`sensor-3.svg`:改为 `#34d399`/`#10b981`,`3#`。
`sensor-4.svg`:改为 `#fbbf24`/`#f59e0b`,`4#`。

- [ ] **Step 3: 参数元数据 + 设备种子 + 常量**

新建 `src/config/params.ts`:

```ts
import sensorImg1 from '@/assets/devices/sensor-1.svg'
import sensorImg2 from '@/assets/devices/sensor-2.svg'
import sensorImg3 from '@/assets/devices/sensor-3.svg'
import sensorImg4 from '@/assets/devices/sensor-4.svg'
import type { Device, DeviceId, ParamKey, ParamMeta, ThresholdRule } from '@/api/types'

/** 参数中文含义为暂定设定,纠正时只改本表 */
export const PARAM_METAS: ParamMeta[] = [
  { key: 'Vf', label: '沉降比', unit: '%', decimals: 1, normal: [8, 25], defaultThreshold: [5, 35], defaultEnabled: true },
  { key: 'Sf', label: '沉降速度', unit: 'm/h', decimals: 2, normal: [0.8, 2.5], defaultThreshold: [0.5, 3.5], defaultEnabled: true },
  { key: 'Fc', label: '流量', unit: 'm³/h', decimals: 0, normal: [900, 1400], defaultThreshold: [800, 1500], defaultEnabled: true },
  { key: 'pHf', label: 'pH', unit: '', decimals: 2, normal: [6.8, 7.8], defaultThreshold: [6.5, 8.5], defaultEnabled: true },
  { key: 'Tf', label: '温度', unit: '℃', decimals: 1, normal: [12, 24], defaultThreshold: [8, 30], defaultEnabled: true },
  { key: 'Cf', label: '余氯', unit: 'mg/L', decimals: 2, normal: [0.3, 0.8], defaultThreshold: [0.2, 1.0], defaultEnabled: true },
]

export const PARAM_META_MAP = Object.fromEntries(
  PARAM_METAS.map((m) => [m.key, m]),
) as Record<ParamKey, ParamMeta>

export const DEVICES: Device[] = [
  {
    id: 'Di-Jiu-Shui-Chang-1', clientId: 'Di-Jiu-Shui-Chang-1', name: '九厂一期-1#',
    model: 'SP-300 多参数水质监测仪', location: '1# 沉淀池', commissionDate: '2025-03-18',
    comm: 'MQTT · 100.85.44.98:1883', manager: '张工', image: sensorImg1,
  },
  {
    id: 'Di-Jiu-Shui-Chang-2', clientId: 'Di-Jiu-Shui-Chang-2', name: '九厂一期-2#',
    model: 'SP-300 多参数水质监测仪', location: '2# 沉淀池', commissionDate: '2025-03-18',
    comm: 'MQTT · 100.85.44.98:1883', manager: '李工', image: sensorImg2,
  },
  {
    id: 'Di-Jiu-Shui-Chang-3', clientId: 'Di-Jiu-Shui-Chang-3', name: '九厂一期-3#',
    model: 'SP-300 多参数水质监测仪', location: '3# 沉淀池', commissionDate: '2025-04-02',
    comm: 'MQTT · 100.85.44.98:1883', manager: '王工', image: sensorImg3,
  },
  {
    id: 'Di-Jiu-Shui-Chang-4', clientId: 'Di-Jiu-Shui-Chang-4', name: '九厂一期-4#',
    model: 'SP-300 多参数水质监测仪', location: '加药间', commissionDate: '2025-04-02',
    comm: 'MQTT · 100.85.44.98:1883', manager: '赵工', image: sensorImg4,
  },
]

export const DEVICE_IDS: DeviceId[] = DEVICES.map((d) => d.id)

/** 超过该时长无新数据即判离线 */
export const OFFLINE_AFTER_MS = 60_000
/** 同设备同参数同类型告警的短信冷却窗口 */
export const ALARM_COOLDOWN_MS = 600_000
/** 模拟数据刷新周期 */
export const POLL_INTERVAL_MS = 2_000
/** 告警记录持久化上限,超出丢弃最旧 */
export const ALARM_MAX_COUNT = 500

/** 首次使用时按参数元数据生成的默认阈值表(4 设备 × 6 参数) */
export function defaultThresholds(): ThresholdRule[] {
  return DEVICES.flatMap((d) =>
    PARAM_METAS.map((m) => ({
      deviceId: d.id,
      paramKey: m.key,
      low: m.defaultThreshold[0],
      high: m.defaultThreshold[1],
      enabled: m.defaultEnabled,
    })),
  )
}
```

注意:svg 模块需要类型声明。`src/vite-env.d.ts` 追加:

```ts
declare module '*.svg' {
  const src: string
  export default src
}
```

- [ ] **Step 4: 配置不变式测试**

新建 `src/config/params.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ALARM_COOLDOWN_MS, DEVICES, OFFLINE_AFTER_MS, PARAM_METAS, defaultThresholds } from './params'

describe('配置元数据不变式', () => {
  it('共 6 项参数,键唯一', () => {
    expect(PARAM_METAS).toHaveLength(6)
    expect(new Set(PARAM_METAS.map((m) => m.key)).size).toBe(6)
  })

  it('每项参数 normal 在默认阈值区间内,且 low < high', () => {
    for (const m of PARAM_METAS) {
      expect(m.defaultThreshold[0]).toBeLessThan(m.defaultThreshold[1])
      expect(m.normal[0]).toBeGreaterThanOrEqual(m.defaultThreshold[0])
      expect(m.normal[1]).toBeLessThanOrEqual(m.defaultThreshold[1])
    }
  })

  it('共 4 台设备,id 与 clientId 唯一', () => {
    expect(DEVICES).toHaveLength(4)
    expect(new Set(DEVICES.map((d) => d.id)).size).toBe(4)
    expect(new Set(DEVICES.map((d) => d.clientId)).size).toBe(4)
  })

  it('默认阈值表为 4×6=24 条且字段齐全', () => {
    const rules = defaultThresholds()
    expect(rules).toHaveLength(24)
    for (const r of rules) {
      expect(r.low).toBeLessThan(r.high)
      expect(r.enabled).toBe(true)
    }
  })

  it('时间常量与 spec 一致', () => {
    expect(OFFLINE_AFTER_MS).toBe(60_000)
    expect(ALARM_COOLDOWN_MS).toBe(600_000)
  })
})
```

- [ ] **Step 5: 运行测试与类型检查**

```bash
npm test && npx vue-tsc -b
```

预期:全绿。

- [ ] **Step 6: Commit**

```bash
git add src/api/types.ts src/config/params.ts src/config/params.spec.ts src/assets/devices src/vite-env.d.ts
git commit -m "feat: 领域类型、参数元数据与设备种子数据" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: 状态判定纯函数 statusRule

**Files:**
- Create: `src/core/statusRule.ts`
- Test: `src/core/statusRule.spec.ts`

**Interfaces:**
- Consumes: Task 2 的 `Reading`/`ThresholdRule`/`DeviceStatusInfo`/`ParamViolation` 类型、`OFFLINE_AFTER_MS`。
- Produces(供 Task 8 store、Task 7 无关):
  - `interface StatusJudgeInput { latestReading: Reading | null; now: number; rules: ThresholdRule[] }`
  - `function judgeDeviceStatus(input: StatusJudgeInput): DeviceStatusInfo`

- [ ] **Step 1: 写失败测试**

新建 `src/core/statusRule.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { judgeDeviceStatus } from './statusRule'
import type { Reading, ThresholdRule } from '@/api/types'

const T0 = 1_700_000_000_000

function reading(params: Partial<Reading['params']>, ts = T0): Reading {
  return { deviceId: 'Di-Jiu-Shui-Chang-1', params, timestamp: ts }
}

function rule(over: Partial<ThresholdRule> = {}): ThresholdRule {
  return { deviceId: 'Di-Jiu-Shui-Chang-1', paramKey: 'Vf', low: 5, high: 35, enabled: true, ...over }
}

describe('judgeDeviceStatus', () => {
  it('正常数据 → online,无越界', () => {
    const info = judgeDeviceStatus({ latestReading: reading({ Vf: 15 }), now: T0 + 1_000, rules: [rule()] })
    expect(info.status).toBe('online')
    expect(info.violations).toEqual([])
  })

  it('恰好在 60s 边界仍在线,60s+1ms 判离线', () => {
    expect(judgeDeviceStatus({ latestReading: reading({ Vf: 15 }), now: T0 + 60_000, rules: [] }).status).toBe('online')
    expect(judgeDeviceStatus({ latestReading: reading({ Vf: 15 }), now: T0 + 60_001, rules: [] }).status).toBe('offline')
  })

  it('从无数据(初始)判离线', () => {
    expect(judgeDeviceStatus({ latestReading: null, now: T0, rules: [rule()] }).status).toBe('offline')
  })

  it('超上限 → abnormal 且给出 high 越界明细', () => {
    const info = judgeDeviceStatus({ latestReading: reading({ Vf: 38 }), now: T0, rules: [rule()] })
    expect(info.status).toBe('abnormal')
    expect(info.violations).toEqual([{ paramKey: 'Vf', value: 38, type: 'high', threshold: 35 }])
  })

  it('低于下限 → abnormal 且给出 low 越界明细', () => {
    const info = judgeDeviceStatus({ latestReading: reading({ Vf: 3 }), now: T0, rules: [rule()] })
    expect(info.status).toBe('abnormal')
    expect(info.violations[0].type).toBe('low')
  })

  it('值恰好等于阈值边界(=high / =low)不算越界', () => {
    expect(judgeDeviceStatus({ latestReading: reading({ Vf: 35 }), now: T0, rules: [rule()] }).status).toBe('online')
    expect(judgeDeviceStatus({ latestReading: reading({ Vf: 5 }), now: T0, rules: [rule()] }).status).toBe('online')
  })

  it('enabled=false 的规则不参与判定', () => {
    const info = judgeDeviceStatus({ latestReading: reading({ Vf: 99 }), now: T0, rules: [rule({ enabled: false })] })
    expect(info.status).toBe('online')
  })

  it('报文缺该参数字段 → 跳过,不抛错', () => {
    const info = judgeDeviceStatus({ latestReading: reading({}), now: T0, rules: [rule()] })
    expect(info.status).toBe('online')
  })

  it('多参数同时越界 → 全部列入明细', () => {
    const rules = [rule(), rule({ paramKey: 'Tf', low: 8, high: 30 })]
    const info = judgeDeviceStatus({ latestReading: reading({ Vf: 99, Tf: 2 }), now: T0, rules })
    expect(info.violations).toHaveLength(2)
  })
})
```

- [ ] **Step 2: 运行确认失败**

```bash
npx vitest run src/core/statusRule.spec.ts
```

预期:FAIL(`Cannot find module './statusRule'`)。

- [ ] **Step 3: 最小实现**

新建 `src/core/statusRule.ts`:

```ts
import type { DeviceStatusInfo, ParamViolation, Reading, ThresholdRule } from '@/api/types'
import { OFFLINE_AFTER_MS } from '@/config/params'

export interface StatusJudgeInput {
  latestReading: Reading | null
  now: number
  rules: ThresholdRule[]
}

/**
 * 设备状态判定:
 * - offline:无数据或最新数据距今超过 OFFLINE_AFTER_MS
 * - abnormal:在线且任一启用规则越界(值严格大于 high / 小于 low,等于边界不算)
 * - online:其余情况
 */
export function judgeDeviceStatus(input: StatusJudgeInput): DeviceStatusInfo {
  const { latestReading, now, rules } = input
  if (!latestReading || now - latestReading.timestamp > OFFLINE_AFTER_MS) {
    return { status: 'offline', violations: [] }
  }
  const violations: ParamViolation[] = []
  for (const r of rules) {
    if (!r.enabled) continue
    const value = latestReading.params[r.paramKey]
    if (value === undefined) continue
    if (value > r.high) violations.push({ paramKey: r.paramKey, value, type: 'high', threshold: r.high })
    else if (value < r.low) violations.push({ paramKey: r.paramKey, value, type: 'low', threshold: r.low })
  }
  return { status: violations.length > 0 ? 'abnormal' : 'online', violations }
}
```

- [ ] **Step 4: 运行确认通过**

```bash
npx vitest run src/core/statusRule.spec.ts
```

预期:PASS(9 个用例)。

- [ ] **Step 5: Commit**

```bash
git add src/core/statusRule.ts src/core/statusRule.spec.ts
git commit -m "feat: 在线/离线/异常状态判定纯函数" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: 告警引擎 alarmEngine(越界检测 + 冷却去重)

**Files:**
- Create: `src/core/alarmEngine.ts`
- Test: `src/core/alarmEngine.spec.ts`

**Interfaces:**
- Consumes: Task 2 的 `AlarmRecord`/`DeviceStatus`/`DeviceStatusInfo`/`DeviceId`、`ALARM_COOLDOWN_MS`。
- Produces(供 Task 8):
  - `interface DetectAlarmsInput { deviceId: DeviceId; prevStatus: DeviceStatus | null; statusInfo: DeviceStatusInfo; now: number; existingAlarms: AlarmRecord[] }`
  - `function detectAlarms(input: DetectAlarmsInput, genId?: () => string): AlarmRecord[]`
  - level 映射:high/low → `'warning'`,offline → `'critical'`;新告警 `sms: { status: 'pending', receivers: [] }`

- [ ] **Step 1: 写失败测试**

新建 `src/core/alarmEngine.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { detectAlarms } from './alarmEngine'
import type { AlarmRecord, DeviceStatusInfo } from '@/api/types'

const T0 = 1_700_000_000_000
let seq = 0
const genId = () => `id-${++seq}`

function statusInfo(over: Partial<DeviceStatusInfo> = {}): DeviceStatusInfo {
  return {
    status: 'online',
    violations: [{ paramKey: 'Vf', value: 38, type: 'high', threshold: 35 }],
    ...over,
  }
}

function oldAlarm(over: Partial<AlarmRecord> = {}): AlarmRecord {
  return {
    id: `old-${++seq}`, time: T0, deviceId: 'Di-Jiu-Shui-Chang-1',
    paramKey: 'Vf', type: 'high', value: 36, threshold: 35, level: 'warning',
    sms: { status: 'sent', receivers: ['13800000000'] },
    ...over,
  }
}

describe('detectAlarms', () => {
  it('越界 → 生成 warning 级 pending 告警', () => {
    const result = detectAlarms({ deviceId: 'Di-Jiu-Shui-Chang-1', prevStatus: 'online', statusInfo: statusInfo(), now: T0 + 1000, existingAlarms: [] }, genId)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      deviceId: 'Di-Jiu-Shui-Chang-1', paramKey: 'Vf', type: 'high',
      value: 38, threshold: 35, level: 'warning', time: T0 + 1000,
    })
    expect(result[0].sms.status).toBe('pending')
    expect(result[0].sms.receivers).toEqual([])
  })

  it('同设备同参数同类型在 10 分钟冷却内 → 去重不生成', () => {
    const existing = [oldAlarm({ time: T0 + 599_999 })]
    const result = detectAlarms({ deviceId: 'Di-Jiu-Shui-Chang-1', prevStatus: 'abnormal', statusInfo: statusInfo(), now: T0 + 600_000, existingAlarms: existing }, genId)
    expect(result).toHaveLength(0)
  })

  it('恰满 10 分钟 → 冷却结束,允许再告警', () => {
    const existing = [oldAlarm({ time: T0 })]
    const result = detectAlarms({ deviceId: 'Di-Jiu-Shui-Chang-1', prevStatus: 'abnormal', statusInfo: statusInfo(), now: T0 + 600_000, existingAlarms: existing }, genId)
    expect(result).toHaveLength(1)
  })

  it('不同参数或不同类型互不影响冷却', () => {
    const existing = [oldAlarm({ paramKey: 'Tf' })]
    const r1 = detectAlarms({ deviceId: 'Di-Jiu-Shui-Chang-1', prevStatus: 'abnormal', statusInfo: statusInfo(), now: T0 + 1000, existingAlarms: existing }, genId)
    expect(r1).toHaveLength(1)
    const existing2 = [oldAlarm({ type: 'low' })]
    const r2 = detectAlarms({ deviceId: 'Di-Jiu-Shui-Chang-1', prevStatus: 'abnormal', statusInfo: statusInfo(), now: T0 + 1000, existingAlarms: existing2 }, genId)
    expect(r2).toHaveLength(1)
  })

  it('在线→离线生成 critical 离线告警', () => {
    const result = detectAlarms({ deviceId: 'Di-Jiu-Shui-Chang-1', prevStatus: 'online', statusInfo: statusInfo({ status: 'offline', violations: [] }), now: T0 + 1000, existingAlarms: [] }, genId)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ type: 'offline', paramKey: null, value: null, threshold: null, level: 'critical' })
  })

  it('首次启动即为离线(prevStatus=null)不产生离线告警', () => {
    const result = detectAlarms({ deviceId: 'Di-Jiu-Shui-Chang-1', prevStatus: null, statusInfo: statusInfo({ status: 'offline', violations: [] }), now: T0 + 1000, existingAlarms: [] }, genId)
    expect(result).toHaveLength(0)
  })

  it('offline→online 恢复不产生任何告警', () => {
    const result = detectAlarms({ deviceId: 'Di-Jiu-Shui-Chang-1', prevStatus: 'offline', statusInfo: statusInfo({ status: 'online', violations: [] }), now: T0 + 1000, existingAlarms: [] }, genId)
    expect(result).toHaveLength(0)
  })

  it('多个参数同时越界 → 各生成一条', () => {
    const info = statusInfo({
      violations: [
        { paramKey: 'Vf', value: 38, type: 'high', threshold: 35 },
        { paramKey: 'Tf', value: 2, type: 'low', threshold: 8 },
      ],
    })
    const result = detectAlarms({ deviceId: 'Di-Jiu-Shui-Chang-1', prevStatus: 'online', statusInfo: info, now: T0 + 1000, existingAlarms: [] }, genId)
    expect(result).toHaveLength(2)
  })
})
```

- [ ] **Step 2: 运行确认失败**

```bash
npx vitest run src/core/alarmEngine.spec.ts
```

预期:FAIL(模块不存在)。

- [ ] **Step 3: 最小实现**

新建 `src/core/alarmEngine.ts`:

```ts
import type { AlarmRecord, AlarmType, DeviceId, DeviceStatus, DeviceStatusInfo } from '@/api/types'
import { ALARM_COOLDOWN_MS } from '@/config/params'

export interface DetectAlarmsInput {
  deviceId: DeviceId
  /** 上一次状态;null 表示本次会话首次判定 */
  prevStatus: DeviceStatus | null
  statusInfo: DeviceStatusInfo
  now: number
  existingAlarms: AlarmRecord[]
}

function cooldownKey(deviceId: DeviceId, paramKey: string | null, type: AlarmType): string {
  return `${deviceId}|${paramKey ?? '__offline__'}|${type}`
}

let seq = 0
function defaultGenId(): string {
  seq += 1
  return `alarm-${Date.now()}-${seq}`
}

/**
 * 根据最新状态生成新告警(调用方负责入库与触发短信):
 * - 每个参数越界生成一条 high/low 告警(warning)
 * - 在线→离线迁移生成一条整机离线告警(critical);首次判定即离线、恢复上线均不生成
 * - 冷却:同 (设备, 参数, 类型) 在 ALARM_COOLDOWN_MS 内已有记录则跳过
 */
export function detectAlarms(input: DetectAlarmsInput, genId: () => string = defaultGenId): AlarmRecord[] {
  const { deviceId, prevStatus, statusInfo, now, existingAlarms } = input
  const recent = new Set<string>()
  for (const a of existingAlarms) {
    if (now - a.time < ALARM_COOLDOWN_MS) recent.add(cooldownKey(a.deviceId, a.paramKey, a.type))
  }

  const result: AlarmRecord[] = []
  const tryPush = (key: string, make: (id: string) => AlarmRecord) => {
    if (recent.has(key)) return
    recent.add(key)
    result.push(make(genId()))
  }

  for (const v of statusInfo.violations) {
    tryPush(cooldownKey(deviceId, v.paramKey, v.type), (id) => ({
      id, time: now, deviceId, paramKey: v.paramKey, type: v.type,
      value: v.value, threshold: v.threshold, level: 'warning',
      sms: { status: 'pending', receivers: [] },
    }))
  }

  if (statusInfo.status === 'offline' && prevStatus !== null && prevStatus !== 'offline') {
    tryPush(cooldownKey(deviceId, null, 'offline'), (id) => ({
      id, time: now, deviceId, paramKey: null, type: 'offline',
      value: null, threshold: null, level: 'critical',
      sms: { status: 'pending', receivers: [] },
    }))
  }

  return result
}
```

- [ ] **Step 4: 运行确认通过**

```bash
npx vitest run src/core/alarmEngine.spec.ts
```

预期:PASS(8 个用例)。

- [ ] **Step 5: Commit**

```bash
git add src/core/alarmEngine.ts src/core/alarmEngine.spec.ts
git commit -m "feat: 告警检测与 10 分钟冷却去重引擎" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: 模拟短信服务 smsService

**Files:**
- Create: `src/core/smsService.ts`
- Test: `src/core/smsService.spec.ts`

**Interfaces:**
- Consumes: Task 2 的 `AlarmRecord`/`Receiver`/`ParamKey`、`PARAM_META_MAP`。
- Produces(供 Task 8):
  - `function buildSmsText(record: AlarmRecord, deviceName: string): string`
  - `interface SendSmsOptions { receivers: Receiver[]; now?: () => number; delayMs?: number; failureRate?: number; random?: () => number; onSettled?: (record: AlarmRecord) => void }`
  - `function sendSms(record: AlarmRecord, options: SendSmsOptions): void`(原地修改 `record.sms`;无接收人立即 failed;否则 pending → 延迟后 sent/failed)

- [ ] **Step 1: 写失败测试**

新建 `src/core/smsService.spec.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSmsText, sendSms } from './smsService'
import type { AlarmRecord, Receiver } from '@/api/types'

const T0 = 1_700_000_000_000
const receivers: Receiver[] = [
  { id: 'r1', name: '张三', phone: '13800000001' },
  { id: 'r2', name: '李四', phone: '13800000002' },
]

function highAlarm(): AlarmRecord {
  return {
    id: 'a1', time: T0, deviceId: 'Di-Jiu-Shui-Chang-1', paramKey: 'Vf', type: 'high',
    value: 38.25, threshold: 35, level: 'warning', sms: { status: 'pending', receivers: [] },
  }
}

function offlineAlarm(): AlarmRecord {
  return {
    id: 'a2', time: T0, deviceId: 'Di-Jiu-Shui-Chang-1', paramKey: null, type: 'offline',
    value: null, threshold: null, level: 'critical', sms: { status: 'pending', receivers: [] },
  }
}

beforeEach(() => vi.useFakeTimers({ now: T0 }))
afterEach(() => vi.useRealTimers())

describe('buildSmsText', () => {
  it('超上限文案含设备名、参数、值、方向与阈值', () => {
    const text = buildSmsText(highAlarm(), '九厂一期-1#')
    expect(text).toContain('九厂一期-1#')
    expect(text).toContain('沉降比')
    expect(text).toContain('38.3')
    expect(text).toContain('超上限')
    expect(text).toContain('35')
  })

  it('离线文案', () => {
    expect(buildSmsText(offlineAlarm(), '九厂一期-1#')).toContain('设备离线')
  })
})

describe('sendSms', () => {
  it('有接收人:pending → 延迟后 sent,记录接收人与 sentAt', () => {
    const record = highAlarm()
    const settled: AlarmRecord[] = []
    sendSms(record, { receivers, random: () => 0.5, onSettled: (r) => settled.push(r) })
    expect(record.sms.status).toBe('pending')
    expect(record.sms.receivers).toEqual(['13800000001', '13800000002'])
    vi.advanceTimersByTime(1000)
    expect(record.sms.status).toBe('sent')
    expect(record.sms.sentAt).toBe(T0 + 1000)
    expect(settled).toHaveLength(1)
  })

  it('随机数低于失败率 → failed', () => {
    const record = highAlarm()
    sendSms(record, { receivers, random: () => 0.01, failureRate: 0.05 })
    vi.advanceTimersByTime(1000)
    expect(record.sms.status).toBe('failed')
  })

  it('无接收人:立即 failed 并回调', () => {
    const record = highAlarm()
    const settled: AlarmRecord[] = []
    sendSms(record, { receivers: [], onSettled: (r) => settled.push(r) })
    expect(record.sms.status).toBe('failed')
    expect(settled).toHaveLength(1)
    vi.advanceTimersByTime(5000)
    expect(record.sms.sentAt).toBeUndefined()
  })
})
```

- [ ] **Step 2: 运行确认失败**

```bash
npx vitest run src/core/smsService.spec.ts
```

预期:FAIL(模块不存在)。

- [ ] **Step 3: 最小实现**

新建 `src/core/smsService.ts`:

```ts
import type { AlarmRecord, ParamKey, Receiver } from '@/api/types'
import { PARAM_META_MAP } from '@/config/params'

export function buildSmsText(record: AlarmRecord, deviceName: string): string {
  if (record.type === 'offline') {
    return `【水厂监控】${deviceName} 设备离线,请及时检查。`
  }
  const meta = PARAM_META_MAP[record.paramKey as ParamKey]
  const side = record.type === 'high' ? '超上限' : '低于下限'
  const unit = meta.unit ? ` ${meta.unit}` : ''
  const valueText = (record.value ?? 0).toFixed(meta.decimals)
  return `【水厂监控】${deviceName} ${meta.label} ${valueText}${unit},${side} ${record.threshold}${unit},请及时处理。`
}

export interface SendSmsOptions {
  receivers: Receiver[]
  now?: () => number
  delayMs?: number
  failureRate?: number
  random?: () => number
  onSettled?: (record: AlarmRecord) => void
}

/**
 * 模拟短信发送:原地修改 record.sms。
 * 无接收人 → 立即 failed;否则 pending,延迟 delayMs 后按 failureRate 概率置 sent/failed。
 */
export function sendSms(record: AlarmRecord, options: SendSmsOptions): void {
  const { receivers, now = Date.now, delayMs = 1000, failureRate = 0.05, random = Math.random, onSettled } = options
  record.sms.receivers = receivers.map((r) => r.phone)
  if (receivers.length === 0) {
    record.sms.status = 'failed'
    onSettled?.(record)
    return
  }
  record.sms.status = 'pending'
  setTimeout(() => {
    record.sms.status = random() < failureRate ? 'failed' : 'sent'
    record.sms.sentAt = now()
    onSettled?.(record)
  }, delayMs)
}
```

- [ ] **Step 4: 运行确认通过**

```bash
npx vitest run src/core/smsService.spec.ts
```

预期:PASS(5 个用例)。

- [ ] **Step 5: Commit**

```bash
git add src/core/smsService.ts src/core/smsService.spec.ts
git commit -m "feat: 模拟短信发送状态机与文案模板" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: localStorage 持久层 memory + 模拟数据引擎 simulator

**Files:**
- Create: `src/mock/memory.ts`
- Create: `src/mock/simulator.ts`
- Test: `src/mock/memory.spec.ts`
- Test: `src/mock/simulator.spec.ts`

**Interfaces:**
- Consumes: Task 2 的 `Reading`/`DeviceId`/`ParamKey`/`ParamMeta` 类型、`PARAM_METAS`/`DEVICES`/`OFFLINE_AFTER_MS`/`defaultThresholds`。
- Produces(供 Task 7):
  - `function loadJSON<T>(key: string, fallback: T): T`、`function saveJSON(key: string, value: unknown): void`
  - `const STORAGE_KEYS = { thresholds: 'sc-front:thresholds', receivers: 'sc-front:receivers', alarms: 'sc-front:alarms' } as const`
  - `interface SimulatorOptions { rng?: () => number; backfillMs?: number; backfillStepMs?: number; autoOfflineRate?: number; abnormalRate?: number }`
  - `function createSimulator(options?: SimulatorOptions)`,返回:
    - `tick(now: number): Reading[]`(为每台在线设备生成一条,推进历史)
    - `backfill(now: number): void`(回填近 30 分钟历史,无异常/离线注入)
    - `latest(): Record<DeviceId, Reading | null>`
    - `history(deviceId: DeviceId): Reading[]`
    - `setManualOffline(deviceId: DeviceId, offline: boolean): void`
    - `isManuallyOffline(deviceId: DeviceId): boolean`
    - `forceAbnormal(deviceId: DeviceId, paramKey: ParamKey, durationMs: number, direction: 'high' | 'low', startMs?: number): void`(演示/测试注入;`startMs` 缺省用 `Date.now()`,单测传固定时刻)
  - 注意:模块导出单例 `export const simulator = createSimulator()`(Task 7/8 使用)。

- [ ] **Step 1: memory 失败测试**

新建 `src/mock/memory.spec.ts`:

```ts
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
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => saveJSON('k', { a: 1 })).not.toThrow()
    expect(loadJSON('k', 'fallback')).toBe('fallback')
    vi.restoreAllMocks()
  })
})
```

- [ ] **Step 2: 运行确认失败,然后实现 memory**

```bash
npx vitest run src/mock/memory.spec.ts
```

新建 `src/mock/memory.ts`:

```ts
export const STORAGE_KEYS = {
  thresholds: 'sc-front:thresholds',
  receivers: 'sc-front:receivers',
  alarms: 'sc-front:alarms',
} as const

/** 读取失败(禁用/损坏)时返回 fallback,绝不抛错 */
export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** 写入失败(隐私模式/配额)时静默忽略 */
export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 忽略 */
  }
}
```

再运行,预期 PASS(4 个用例)。

- [ ] **Step 3: simulator 失败测试**

新建 `src/mock/simulator.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createSimulator } from './simulator'
import { PARAM_META_MAP } from '@/config/params'

const T0 = 1_700_000_000_000
/** 恒定 0.5:随机游走步长恰为 0,值停在正常区间中点,便于断言 */
const stableRng = () => 0.5

describe('createSimulator', () => {
  it('backfill 回填 30 分钟、每 10s 一点(180 点/台)', () => {
    const sim = createSimulator({ rng: stableRng })
    sim.backfill(T0)
    expect(sim.history('Di-Jiu-Shui-Chang-1')).toHaveLength(180)
    expect(sim.latest()['Di-Jiu-Shui-Chang-1']?.timestamp).toBe(T0)
  })

  it('tick 为 4 台设备各生成一条,数值停留在正常区间', () => {
    const sim = createSimulator({ rng: stableRng })
    sim.backfill(T0)
    const readings = sim.tick(T0 + 10_000)
    expect(readings).toHaveLength(4)
    for (const r of readings) {
      for (const meta of Object.values(PARAM_META_MAP)) {
        const v = r.params[meta.key]
        expect(v).toBeGreaterThanOrEqual(meta.normal[0])
        expect(v).toBeLessThanOrEqual(meta.normal[1])
      }
    }
  })

  it('手动离线设备不再产生数据,latest 停留在旧值', () => {
    const sim = createSimulator({ rng: stableRng })
    sim.backfill(T0)
    sim.setManualOffline('Di-Jiu-Shui-Chang-2', true)
    expect(sim.isManuallyOffline('Di-Jiu-Shui-Chang-2')).toBe(true)
    const readings = sim.tick(T0 + 10_000)
    expect(readings.some((r) => r.deviceId === 'Di-Jiu-Shui-Chang-2')).toBe(false)
    expect(sim.latest()['Di-Jiu-Shui-Chang-2']?.timestamp).toBe(T0)
    sim.setManualOffline('Di-Jiu-Shui-Chang-2', false)
    expect(sim.tick(T0 + 20_000).some((r) => r.deviceId === 'Di-Jiu-Shui-Chang-2')).toBe(true)
  })

  it('forceAbnormal 注入后数值越出默认阈值方向正确', () => {
    const sim = createSimulator({ rng: stableRng })
    sim.backfill(T0)
    sim.forceAbnormal('Di-Jiu-Shui-Chang-1', 'Vf', 60_000, 'high', T0)
    const r = sim.tick(T0 + 10_000).find((x) => x.deviceId === 'Di-Jiu-Shui-Chang-1')!
    expect(r.params.Vf!).toBeGreaterThan(PARAM_META_MAP.Vf.defaultThreshold[1])

    sim.forceAbnormal('Di-Jiu-Shui-Chang-2', 'Tf', 60_000, 'low', T0)
    const r2 = sim.tick(T0 + 20_000).find((x) => x.deviceId === 'Di-Jiu-Shui-Chang-2')!
    expect(r2.params.Tf!).toBeLessThan(PARAM_META_MAP.Tf.defaultThreshold[0])
  })

  it('注入到期后数值回落到正常区间', () => {
    const sim = createSimulator({ rng: stableRng })
    sim.backfill(T0)
    sim.forceAbnormal('Di-Jiu-Shui-Chang-1', 'Vf', 15_000, 'high', T0)
    sim.tick(T0 + 10_000)
    const r = sim.tick(T0 + 30_000).find((x) => x.deviceId === 'Di-Jiu-Shui-Chang-1')!
    expect(r.params.Vf!).toBeLessThanOrEqual(PARAM_META_MAP.Vf.normal[1])
  })
})
```

说明:本文件不使用 fake timers,全部时间以参数传入,`forceAbnormal` 用 `startMs` 参数固定注入起点。运行确认 FAIL。

- [ ] **Step 4: 实现 simulator**

新建 `src/mock/simulator.ts`:

```ts
import type { DeviceId, ParamKey, Reading } from '@/api/types'
import { DEVICES, PARAM_METAS, OFFLINE_AFTER_MS } from '@/config/params'

export interface SimulatorOptions {
  rng?: () => number
  backfillMs?: number
  backfillStepMs?: number
  /** 每 tick 自动掉线概率 */
  autoOfflineRate?: number
  /** 每台设备每 tick 注入异常的概率 */
  abnormalRate?: number
}

const HISTORY_CAP = 2000

export function createSimulator(options: SimulatorOptions = {}) {
  const rng = options.rng ?? Math.random
  const backfillMs = options.backfillMs ?? 30 * 60_000
  const backfillStepMs = options.backfillStepMs ?? 10_000
  const autoOfflineRate = options.autoOfflineRate ?? 0.002
  const abnormalRate = options.abnormalRate ?? 0.015

  const histories = new Map<DeviceId, Reading[]>(DEVICES.map((d) => [d.id, []]))
  const lastValues = new Map<DeviceId, Partial<Record<ParamKey, number>>>()
  const forcedOffline = new Set<DeviceId>()
  const autoOfflineUntil = new Map<DeviceId, number>()
  const abnormalUntil = new Map<string, number>()
  const abnormalDirection = new Map<string, 'high' | 'low'>()

  function pushReading(reading: Reading): void {
    const list = histories.get(reading.deviceId)!
    list.push(reading)
    if (list.length > HISTORY_CAP) list.splice(0, list.length - HISTORY_CAP)
    lastValues.set(reading.deviceId, reading.params)
  }

  function nextValue(meta: (typeof PARAM_METAS)[number], deviceId: DeviceId, now: number): number {
    const [lo, hi] = meta.normal
    const step = (hi - lo) * 0.04
    const abKey = `${deviceId}|${meta.key}`
    const abUntil = abnormalUntil.get(abKey)
    const prev = lastValues.get(deviceId)?.[meta.key]
    if (abUntil !== undefined && abUntil > now) {
      // 异常注入:推向默认阈值外 10% 正常量程处
      const target = abnormalDirection.get(abKey) === 'low'
        ? meta.defaultThreshold[0] - (hi - lo) * 0.1
        : meta.defaultThreshold[1] + (hi - lo) * 0.1
      return target + (rng() - 0.5) * step
    }
    if (abUntil !== undefined && abUntil <= now) {
      abnormalUntil.delete(abKey)
      abnormalDirection.delete(abKey)
    }
    // 正常随机游走,夹在正常区间内
    const base = prev ?? (lo + hi) / 2
    const next = base + (rng() - 0.5) * 2 * step
    return Math.min(hi, Math.max(lo, next))
  }

  function generateReading(deviceId: DeviceId, now: number, inject: boolean): Reading | null {
    if (forcedOffline.has(deviceId)) return null
    const until = autoOfflineUntil.get(deviceId)
    if (until !== undefined) {
      if (until > now) return null
      autoOfflineUntil.delete(deviceId)
    }
    if (inject) {
      if (rng() < autoOfflineRate) {
        autoOfflineUntil.set(deviceId, now + OFFLINE_AFTER_MS * 2 + rng() * 120_000)
        return null
      }
      if (rng() < abnormalRate) {
        const meta = PARAM_METAS[Math.floor(rng() * PARAM_METAS.length)]!
        const direction = rng() < 0.5 ? 'high' : 'low'
        abnormalUntil.set(`${deviceId}|${meta.key}`, now + (15 + rng() * 25) * 1000)
        abnormalDirection.set(`${deviceId}|${meta.key}`, direction)
      }
    }
    const params: Partial<Record<ParamKey, number>> = {}
    for (const meta of PARAM_METAS) {
      params[meta.key] = Number(nextValue(meta, deviceId, now).toFixed(meta.decimals))
    }
    return { deviceId, params, timestamp: now }
  }

  return {
    tick(now: number): Reading[] {
      const out: Reading[] = []
      for (const d of DEVICES) {
        const r = generateReading(d.id, now, true)
        if (r) {
          pushReading(r)
          out.push(r)
        }
      }
      return out
    },
    backfill(now: number): void {
      for (let t = now - backfillMs + backfillStepMs; t <= now; t += backfillStepMs) {
        for (const d of DEVICES) {
          const r = generateReading(d.id, t, false)
          if (r) pushReading(r)
        }
      }
    },
    latest(): Record<DeviceId, Reading | null> {
      return Object.fromEntries(
        DEVICES.map((d) => {
          const list = histories.get(d.id)!
          return [d.id, list.length > 0 ? list[list.length - 1]! : null]
        }),
      ) as Record<DeviceId, Reading | null>
    },
    history(deviceId: DeviceId): Reading[] {
      return [...histories.get(deviceId)!]
    },
    setManualOffline(deviceId: DeviceId, offline: boolean): void {
      if (offline) forcedOffline.add(deviceId)
      else forcedOffline.delete(deviceId)
    },
    isManuallyOffline(deviceId: DeviceId): boolean {
      return forcedOffline.has(deviceId)
    },
    forceAbnormal(deviceId: DeviceId, paramKey: ParamKey, durationMs: number, direction: 'high' | 'low', startMs: number = Date.now()): void {
      abnormalUntil.set(`${deviceId}|${paramKey}`, startMs + durationMs)
      abnormalDirection.set(`${deviceId}|${paramKey}`, direction)
    },
  }
}

/** 应用级单例(Task 7 的 mock api 使用) */
export const simulator = createSimulator()
```

注意 `forceAbnormal` 的可选 `startMs` 参数:单测传入固定 T0 以脱离真实时钟;运行时(如 Task 8 集成测试在 fake timers 下)不传即用 `Date.now()`。

- [ ] **Step 5: 运行确认通过**

```bash
npx vitest run src/mock/
```

预期:PASS(memory 4 + simulator 5)。

- [ ] **Step 6: Commit**

```bash
git add src/mock/
git commit -m "feat: localStorage 持久层与传感器数据模拟引擎" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: API 层与 VITE_USE_MOCK 切换

**Files:**
- Create: `src/api/http.ts`
- Create: `src/api/deviceApi.ts`
- Create: `src/api/monitorApi.ts`
- Create: `src/api/alarmApi.ts`
- Create: `src/api/configApi.ts`
- Test: `src/api/api.spec.ts`

**Interfaces:**
- Consumes: Task 2 类型与配置、Task 6 `simulator`/`loadJSON`/`saveJSON`/`STORAGE_KEYS`、`defaultThresholds`。
- Produces(供 Task 8 与所有视图):
  - `deviceApi.getDevices(): Promise<Device[]>`
  - `monitorApi.getRealtimeReadings(): Promise<RealtimeSnapshot>`(mock 分支:首次调用先 `simulator.backfill(now)` 回填 30 分钟历史,之后每次 `simulator.tick(now)` 再取 latest)
  - `monitorApi.getHistory(deviceId: DeviceId, paramKey: ParamKey): Promise<Reading[]>`(按参数过滤)
  - `monitorApi.setDeviceOffline(deviceId: DeviceId, offline: boolean): Promise<void>`
  - `alarmApi.getAlarms(): Promise<AlarmRecord[]>`、`appendAlarms(records: AlarmRecord[]): Promise<void>`、`updateAlarm(record: AlarmRecord): Promise<void>`(按 id 替换)、`clearAlarms(): Promise<void>`;append 时裁剪到最近 `ALARM_MAX_COUNT` 条
  - `configApi.getThresholds(): Promise<ThresholdRule[]>`、`saveThresholds(rules): Promise<void>`、`getReceivers(): Promise<Receiver[]>`、`addReceiver(input: { name: string; phone: string }): Promise<Receiver>`、`removeReceiver(id: string): Promise<void>`
  - `http.request<T>(path: string): Promise<T>`:非 mock 分支统一抛"后端未接入"错误(本期占位)

- [ ] **Step 1: 写失败测试**

新建 `src/api/api.spec.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { alarmApi } from './alarmApi'
import { configApi } from './configApi'
import { monitorApi } from './monitorApi'
import { deviceApi } from './deviceApi'
import { STORAGE_KEYS } from '@/mock/memory'
import { DEVICES } from '@/config/params'
import type { AlarmRecord } from './types'

beforeEach(() => localStorage.clear())

describe('configApi', () => {
  it('首次读取返回 24 条默认阈值', async () => {
    const rules = await configApi.getThresholds()
    expect(rules).toHaveLength(24)
  })

  it('save → get 往返一致,且落入 localStorage', async () => {
    const rules = await configApi.getThresholds()
    rules[0]!.low = 1
    await configApi.saveThresholds(rules)
    const again = await configApi.getThresholds()
    expect(again[0]!.low).toBe(1)
    expect(localStorage.getItem(STORAGE_KEYS.thresholds)).toContain('"low":1')
  })

  it('接收人增删', async () => {
    expect(await configApi.getReceivers()).toEqual([])
    const r = await configApi.addReceiver({ name: '张三', phone: '13800000000' })
    expect((await configApi.getReceivers())).toHaveLength(1)
    await configApi.removeReceiver(r.id)
    expect(await configApi.getReceivers()).toEqual([])
  })
})

describe('alarmApi', () => {
  const record: AlarmRecord = {
    id: 'a1', time: 1_700_000_000_000, deviceId: 'Di-Jiu-Shui-Chang-1',
    paramKey: 'Vf', type: 'high', value: 38, threshold: 35, level: 'warning',
    sms: { status: 'pending', receivers: [] },
  }

  it('append → get → update → clear', async () => {
    await alarmApi.appendAlarms([record])
    expect((await alarmApi.getAlarms())).toHaveLength(1)
    const updated = { ...record, sms: { status: 'sent' as const, receivers: ['138'], sentAt: 1 } }
    await alarmApi.updateAlarm(updated)
    expect((await alarmApi.getAlarms())[0]!.sms.status).toBe('sent')
    await alarmApi.clearAlarms()
    expect(await alarmApi.getAlarms()).toEqual([])
  })
})

describe('monitorApi', () => {
  it('getRealtimeReadings 返回 4 台 latest + forcedOffline', async () => {
    const snap = await monitorApi.getRealtimeReadings()
    expect(Object.keys(snap.readings)).toHaveLength(4)
    expect(snap.forcedOffline).toEqual([])
    expect(snap.now).toBeGreaterThan(0)
  })

  it('setDeviceOffline 生效并反映在 forcedOffline', async () => {
    await monitorApi.setDeviceOffline('Di-Jiu-Shui-Chang-3', true)
    const snap = await monitorApi.getRealtimeReadings()
    expect(snap.forcedOffline).toEqual(['Di-Jiu-Shui-Chang-3'])
  })

  it('getHistory 返回该参数的历史点', async () => {
    const history = await monitorApi.getHistory('Di-Jiu-Shui-Chang-1', 'Vf')
    expect(history.length).toBeGreaterThan(0)
    expect(history[0]!.params.Vf).toBeDefined()
  })
})

describe('deviceApi', () => {
  it('getDevices 返回 4 台', async () => {
    expect(await deviceApi.getDevices()).toHaveLength(DEVICES.length)
  })
})
```

- [ ] **Step 2: 运行确认失败**

```bash
npx vitest run src/api/api.spec.ts
```

预期:FAIL(模块不存在)。

- [ ] **Step 3: 实现四个 api 模块**

新建 `src/api/http.ts`:

```ts
/** 真实后端分支统一入口:后端就绪前调用即抛错,防静默失败 */
export async function request<T>(_path: string): Promise<T> {
  throw new Error(`后端 API 尚未接入:${_path}。请保持 VITE_USE_MOCK=true,待后端就绪后在本模块接入。`)
}
```

新建 `src/api/deviceApi.ts`:

```ts
import type { Device } from './types'
import { request } from './http'
import { DEVICES } from '@/config/params'

const useMock = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'

export const deviceApi = {
  async getDevices(): Promise<Device[]> {
    if (useMock) return DEVICES
    return request<Device[]>('/devices')
  },
}
```

新建 `src/api/monitorApi.ts`:

```ts
import type { DeviceId, ParamKey, RealtimeSnapshot, Reading } from './types'
import { request } from './http'
import { simulator } from '@/mock/simulator'
import { DEVICE_IDS } from '@/config/params'

const useMock = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'

let started = false

export const monitorApi = {
  async getRealtimeReadings(): Promise<RealtimeSnapshot> {
    if (useMock) {
      const now = Date.now()
      if (!started) {
        simulator.backfill(now)
        started = true
      }
      simulator.tick(now)
      const latest = simulator.latest()
      const readings = Object.fromEntries(DEVICE_IDS.map((id) => [id, latest[id] ?? null])) as RealtimeSnapshot['readings']
      return {
        now,
        readings,
        forcedOffline: DEVICE_IDS.filter((id) => simulator.isManuallyOffline(id)),
      }
    }
    return request<RealtimeSnapshot>('/readings/latest')
  },

  async getHistory(deviceId: DeviceId, paramKey: ParamKey): Promise<Reading[]> {
    if (useMock) {
      return simulator.history(deviceId).filter((r) => r.params[paramKey] !== undefined)
    }
    return request<Reading[]>(`/readings/history?deviceId=${deviceId}&paramKey=${paramKey}`)
  },

  async setDeviceOffline(deviceId: DeviceId, offline: boolean): Promise<void> {
    if (useMock) {
      simulator.setManualOffline(deviceId, offline)
      return
    }
    return request<void>(`/devices/${deviceId}/simulate-offline`)
  },
}
```

新建 `src/api/alarmApi.ts`:

```ts
import type { AlarmRecord } from './types'
import { request } from './http'
import { loadJSON, saveJSON, STORAGE_KEYS } from '@/mock/memory'
import { ALARM_MAX_COUNT } from '@/config/params'

const useMock = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'

export const alarmApi = {
  async getAlarms(): Promise<AlarmRecord[]> {
    if (useMock) return loadJSON<AlarmRecord[]>(STORAGE_KEYS.alarms, [])
    return request<AlarmRecord[]>('/alarms')
  },

  async appendAlarms(records: AlarmRecord[]): Promise<void> {
    if (useMock) {
      const all = [...loadJSON<AlarmRecord[]>(STORAGE_KEYS.alarms, []), ...records]
      saveJSON(STORAGE_KEYS.alarms, all.slice(-ALARM_MAX_COUNT))
      return
    }
    return request<void>('/alarms')
  },

  async updateAlarm(record: AlarmRecord): Promise<void> {
    if (useMock) {
      const all = loadJSON<AlarmRecord[]>(STORAGE_KEYS.alarms, []).map((a) => (a.id === record.id ? record : a))
      saveJSON(STORAGE_KEYS.alarms, all)
      return
    }
    return request<void>(`/alarms/${record.id}`)
  },

  async clearAlarms(): Promise<void> {
    if (useMock) {
      saveJSON(STORAGE_KEYS.alarms, [])
      return
    }
    return request<void>('/alarms')
  },
}
```

新建 `src/api/configApi.ts`:

```ts
import type { Receiver, ThresholdRule } from './types'
import { request } from './http'
import { loadJSON, saveJSON, STORAGE_KEYS } from '@/mock/memory'
import { defaultThresholds } from '@/config/params'

const useMock = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'

let receiverSeq = 0

export const configApi = {
  async getThresholds(): Promise<ThresholdRule[]> {
    if (useMock) return loadJSON<ThresholdRule[]>(STORAGE_KEYS.thresholds, defaultThresholds())
    return request<ThresholdRule[]>('/thresholds')
  },

  async saveThresholds(rules: ThresholdRule[]): Promise<void> {
    if (useMock) {
      saveJSON(STORAGE_KEYS.thresholds, rules)
      return
    }
    return request<void>('/thresholds')
  },

  async getReceivers(): Promise<Receiver[]> {
    if (useMock) return loadJSON<Receiver[]>(STORAGE_KEYS.receivers, [])
    return request<Receiver[]>('/receivers')
  },

  async addReceiver(input: { name: string; phone: string }): Promise<Receiver> {
    if (useMock) {
      receiverSeq += 1
      const r: Receiver = { id: `rcv-${Date.now()}-${receiverSeq}`, ...input }
      saveJSON(STORAGE_KEYS.receivers, [...loadJSON<Receiver[]>(STORAGE_KEYS.receivers, []), r])
      return r
    }
    return request<Receiver>('/receivers')
  },

  async removeReceiver(id: string): Promise<void> {
    if (useMock) {
      saveJSON(STORAGE_KEYS.receivers, loadJSON<Receiver[]>(STORAGE_KEYS.receivers, []).filter((r) => r.id !== id))
      return
    }
    return request<void>(`/receivers/${id}`)
  },
}
```

- [ ] **Step 4: 运行确认通过**

```bash
npx vitest run src/api/api.spec.ts
```

预期:PASS(8 个用例)。

- [ ] **Step 5: Commit**

```bash
git add src/api/
git commit -m "feat: api 数据层与 VITE_USE_MOCK 模拟实现" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 8: 校验模块 + 三个 store(轮询装配、告警链路)

**Files:**
- Create: `src/core/validation.ts`
- Create: `src/stores/settings.ts`
- Create: `src/stores/alarms.ts`
- Create: `src/stores/monitor.ts`
- Test: `src/core/validation.spec.ts`
- Test: `src/stores/stores.spec.ts`

**Interfaces:**
- Consumes: Task 3 `judgeDeviceStatus`、Task 4 `detectAlarms`、Task 5 `sendSms`/`buildSmsText`、Task 7 全部 api、Task 6 `simulator`(测试)。
- Produces(供 Task 9-13):
  - `validateThresholdRules(rules: ThresholdRule[]): string | null`(错误信息含设备名与参数中文名;null=通过)
  - `validatePhone(phone: string): boolean`(`/^1\d{10}$/`)
  - `useSettingsStore()` → `{ state: { thresholds, receivers, loaded }, init(): Promise<void>, rulesFor(deviceId), ruleFor(deviceId, paramKey), save(): Promise<void>, addReceiver(name, phone): Promise<Receiver>, removeReceiver(id): Promise<void> }`
  - `useAlarmsStore()` → `{ state: { records, unread, loaded }, init(), push(records): Promise<void>, clearAll(): Promise<void>, markAllRead(): void }`;push 对每条记录调用 sendSms,onSettled 时 `updateAlarm` 持久化 + `unread+1` + ElNotification 提示
  - `useMonitorStore()` → `{ state, init(): Promise<void>, refresh(): Promise<void>, stop(): void, toggleOffline(deviceId): Promise<void>, statusCounts: ComputedRef<{ online: number; offline: number; abnormal: number }> }`;init 幂等,装配 2s 轮询

- [ ] **Step 1: 写校验模块失败测试**

新建 `src/core/validation.spec.ts`:

```ts
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
```

- [ ] **Step 2: 运行确认失败后实现**

```bash
npx vitest run src/core/validation.spec.ts
```

新建 `src/core/validation.ts`:

```ts
import type { ThresholdRule } from '@/api/types'
import { DEVICES, PARAM_META_MAP } from '@/config/params'

/** 校验整张阈值表;发现问题返回中文描述(点名设备与参数),全部合法返回 null */
export function validateThresholdRules(rules: ThresholdRule[]): string | null {
  for (const r of rules) {
    if (!Number.isFinite(r.low) || !Number.isFinite(r.high)) {
      return '阈值必须为有效数字'
    }
    if (r.low >= r.high) {
      const deviceName = DEVICES.find((d) => d.id === r.deviceId)?.name ?? r.deviceId
      const label = PARAM_META_MAP[r.paramKey].label
      return `${deviceName} ${label}:下限( ${r.low} )必须小于上限( ${r.high} )`
    }
  }
  return null
}

export function validatePhone(phone: string): boolean {
  return /^1\d{10}$/.test(phone)
}
```

再运行,预期 PASS(5 个用例)。

- [ ] **Step 3: 写 store 失败测试**

新建 `src/stores/stores.spec.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function freshStores() {
  vi.resetModules()
  const monitorMod = await import('@/stores/monitor')
  const alarmsMod = await import('@/stores/alarms')
  const settingsMod = await import('@/stores/settings')
  const simMod = await import('@/mock/simulator')
  return {
    monitor: monitorMod.useMonitorStore(),
    alarms: alarmsMod.useAlarmsStore(),
    settings: settingsMod.useSettingsStore(),
    simulator: simMod.simulator,
  }
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: 1_700_000_000_000 })
  // 0.5 → 随机游走步长 0、不触发自动离线/异常、短信不失败,测试完全确定
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('monitor + alarms 集成', () => {
  it('初始化:加载 4 设备、24 条默认阈值,完成首轮刷新', async () => {
    const { monitor, settings } = await freshStores()
    await monitor.init()
    expect(monitor.state.devices).toHaveLength(4)
    expect(settings.state.thresholds).toHaveLength(24)
    expect(Object.keys(monitor.state.statuses)).toHaveLength(4)
    monitor.stop()
  })

  it('参数越界 → abnormal + 告警入库 + 模拟短信置 sent + 未读 +1', async () => {
    const { monitor, alarms, simulator } = await freshStores()
    await monitor.init()
    simulator.forceAbnormal('Di-Jiu-Shui-Chang-1', 'Vf', 60_000, 'high')
    await vi.advanceTimersByTimeAsync(2_000)
    expect(alarms.state.records).toHaveLength(1)
    expect(alarms.state.records[0]!.type).toBe('high')
    expect(monitor.state.statuses['Di-Jiu-Shui-Chang-1']!.status).toBe('abnormal')
    await vi.advanceTimersByTimeAsync(1_000)
    expect(alarms.state.records[0]!.sms.status).toBe('sent')
    expect(alarms.state.unread).toBe(1)
    monitor.stop()
  })

  it('冷却期内同一越界不重复生成告警', async () => {
    const { monitor, alarms, simulator } = await freshStores()
    await monitor.init()
    simulator.forceAbnormal('Di-Jiu-Shui-Chang-1', 'Vf', 60_000, 'high')
    await vi.advanceTimersByTimeAsync(2_000)
    await vi.advanceTimersByTimeAsync(2_000)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(alarms.state.records).toHaveLength(1)
    monitor.stop()
  })

  it('手动模拟离线 → 60 秒后判离线并产生一条离线告警', async () => {
    const { monitor, alarms } = await freshStores()
    await monitor.init()
    await monitor.toggleOffline('Di-Jiu-Shui-Chang-2')
    expect(monitor.state.forcedOffline).toContain('Di-Jiu-Shui-Chang-2')
    await vi.advanceTimersByTimeAsync(2_000)
    expect(monitor.state.statuses['Di-Jiu-Shui-Chang-2']!.status).toBe('online')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(monitor.state.statuses['Di-Jiu-Shui-Chang-2']!.status).toBe('offline')
    const offline = alarms.state.records.filter((r) => r.deviceId === 'Di-Jiu-Shui-Chang-2' && r.type === 'offline')
    expect(offline).toHaveLength(1)
    monitor.stop()
  })

  it('恢复上报后状态回到 online 且不产生恢复告警', async () => {
    const { monitor, alarms } = await freshStores()
    await monitor.init()
    await monitor.toggleOffline('Di-Jiu-Shui-Chang-3')
    await vi.advanceTimersByTimeAsync(62_000)
    await monitor.toggleOffline('Di-Jiu-Shui-Chang-3')
    await vi.advanceTimersByTimeAsync(4_000)
    expect(monitor.state.statuses['Di-Jiu-Shui-Chang-3']!.status).toBe('online')
    const recoverAlarms = alarms.state.records.filter((r) => r.deviceId === 'Di-Jiu-Shui-Chang-3')
    expect(recoverAlarms).toHaveLength(1) // 仅离线那一条
    monitor.stop()
  })
})

describe('settings store', () => {
  it('接收人增删同步内存与持久层', async () => {
    const { settings } = await freshStores()
    await settings.init()
    await settings.addReceiver('王五', '13900000000')
    expect(settings.state.receivers).toHaveLength(1)
    expect(localStorage.getItem('sc-front:receivers')).toContain('王五')
    await settings.removeReceiver(settings.state.receivers[0]!.id)
    expect(settings.state.receivers).toHaveLength(0)
  })
})
```

- [ ] **Step 4: 运行确认失败**

```bash
npx vitest run src/stores/stores.spec.ts
```

预期:FAIL(store 模块不存在)。

- [ ] **Step 5: 实现 settings store**

新建 `src/stores/settings.ts`:

```ts
import { reactive } from 'vue'
import type { DeviceId, ParamKey, Receiver, ThresholdRule } from '@/api/types'
import {
  addReceiver as apiAddReceiver,
  getReceivers as apiGetReceivers,
  getThresholds as apiGetThresholds,
  removeReceiver as apiRemoveReceiver,
  saveThresholds as apiSaveThresholds,
} from '@/api/configApi'

const state = reactive<{ thresholds: ThresholdRule[]; receivers: Receiver[]; loaded: boolean }>({
  thresholds: [],
  receivers: [],
  loaded: false,
})

let initPromise: Promise<void> | null = null

export function useSettingsStore() {
  function init(): Promise<void> {
    initPromise ??= (async () => {
      const [thresholds, receivers] = await Promise.all([apiGetThresholds(), apiGetReceivers()])
      state.thresholds = thresholds
      state.receivers = receivers
      state.loaded = true
    })()
    return initPromise
  }

  function rulesFor(deviceId: DeviceId): ThresholdRule[] {
    return state.thresholds.filter((r) => r.deviceId === deviceId)
  }

  function ruleFor(deviceId: DeviceId, paramKey: ParamKey): ThresholdRule | undefined {
    return state.thresholds.find((r) => r.deviceId === deviceId && r.paramKey === paramKey)
  }

  async function save(): Promise<void> {
    const plain = JSON.parse(JSON.stringify(state.thresholds)) as ThresholdRule[]
    await apiSaveThresholds(plain)
  }

  async function addReceiver(name: string, phone: string): Promise<Receiver> {
    const r = await apiAddReceiver({ name, phone })
    state.receivers.push(r)
    return r
  }

  async function removeReceiver(id: string): Promise<void> {
    await apiRemoveReceiver(id)
    state.receivers = state.receivers.filter((r) => r.id !== id)
  }

  return { state, init, rulesFor, ruleFor, save, addReceiver, removeReceiver }
}
```

- [ ] **Step 6: 实现 alarms store**

新建 `src/stores/alarms.ts`:

```ts
import { reactive } from 'vue'
import { ElNotification } from 'element-plus'
import type { AlarmRecord } from '@/api/types'
import {
  appendAlarms as apiAppendAlarms,
  clearAlarms as apiClearAlarms,
  getAlarms as apiGetAlarms,
  updateAlarm as apiUpdateAlarm,
} from '@/api/alarmApi'
import { DEVICES } from '@/config/params'
import { buildSmsText, sendSms } from '@/core/smsService'
import { useSettingsStore } from './settings'

const state = reactive<{ records: AlarmRecord[]; unread: number; loaded: boolean }>({
  records: [],
  unread: 0,
  loaded: false,
})

let initPromise: Promise<void> | null = null

export function useAlarmsStore() {
  const settings = useSettingsStore()

  function init(): Promise<void> {
    initPromise ??= (async () => {
      state.records = await apiGetAlarms()
      state.loaded = true
    })()
    return initPromise
  }

  async function push(records: AlarmRecord[]): Promise<void> {
    if (records.length === 0) return
    await apiAppendAlarms(records)
    state.records.push(...records)
    for (const record of records) {
      const deviceName = DEVICES.find((d) => d.id === record.deviceId)?.name ?? record.deviceId
      sendSms(record, {
        receivers: settings.state.receivers,
        onSettled: (updated) => {
          void apiUpdateAlarm(updated)
          state.unread += 1
          const sent = updated.sms.status === 'sent'
          ElNotification({
            title: sent ? '短信已发送(模拟)' : '短信发送失败',
            message: buildSmsText(updated, deviceName),
            type: sent ? 'success' : 'error',
            duration: 4000,
          })
        },
      })
    }
  }

  async function clearAll(): Promise<void> {
    await apiClearAlarms()
    state.records = []
    state.unread = 0
  }

  function markAllRead(): void {
    state.unread = 0
  }

  return { state, init, push, clearAll, markAllRead }
}
```

- [ ] **Step 7: 实现 monitor store**

新建 `src/stores/monitor.ts`:

```ts
import { computed, reactive } from 'vue'
import type { Device, DeviceId, DeviceStatusInfo, RealtimeSnapshot, Reading } from '@/api/types'
import { getDevices } from '@/api/deviceApi'
import { getRealtimeReadings, setDeviceOffline } from '@/api/monitorApi'
import { judgeDeviceStatus } from '@/core/statusRule'
import { detectAlarms } from '@/core/alarmEngine'
import { POLL_INTERVAL_MS } from '@/config/params'
import { useAlarmsStore } from './alarms'
import { useSettingsStore } from './settings'

interface MonitorState {
  inited: boolean
  devices: Device[]
  readings: Record<string, Reading | null>
  statuses: Record<string, DeviceStatusInfo>
  forcedOffline: DeviceId[]
  timer: number | null
  lastRefreshAt: number | null
}

const state = reactive<MonitorState>({
  inited: false,
  devices: [],
  readings: {},
  statuses: {},
  forcedOffline: [],
  timer: null,
  lastRefreshAt: null,
})

export function useMonitorStore() {
  const settings = useSettingsStore()
  const alarms = useAlarmsStore()

  async function refresh(): Promise<void> {
    if (state.devices.length === 0) return
    const snap: RealtimeSnapshot = await getRealtimeReadings()
    state.readings = snap.readings
    state.forcedOffline = snap.forcedOffline
    state.lastRefreshAt = snap.now
    for (const device of state.devices) {
      const info = judgeDeviceStatus({
        latestReading: snap.readings[device.id] ?? null,
        now: snap.now,
        rules: settings.rulesFor(device.id),
      })
      const prev = state.statuses[device.id]?.status ?? null
      const fresh = detectAlarms({
        deviceId: device.id,
        prevStatus: prev,
        statusInfo: info,
        now: snap.now,
        existingAlarms: alarms.state.records,
      })
      state.statuses[device.id] = info
      if (fresh.length > 0) await alarms.push(fresh)
    }
  }

  async function init(): Promise<void> {
    if (state.inited) return
    state.inited = true
    state.devices = await getDevices()
    await settings.init()
    await alarms.init()
    await refresh()
    state.timer = window.setInterval(() => {
      void refresh()
    }, POLL_INTERVAL_MS)
  }

  function stop(): void {
    if (state.timer !== null) {
      clearInterval(state.timer)
      state.timer = null
    }
  }

  async function toggleOffline(deviceId: DeviceId): Promise<void> {
    const target = !state.forcedOffline.includes(deviceId)
    await setDeviceOffline(deviceId, target)
    state.forcedOffline = target
      ? [...state.forcedOffline, deviceId]
      : state.forcedOffline.filter((id) => id !== deviceId)
  }

  const statusCounts = computed(() => {
    const counts = { online: 0, offline: 0, abnormal: 0 }
    for (const device of state.devices) {
      const s = state.statuses[device.id]?.status
      if (s === 'online' || s === 'offline' || s === 'abnormal') counts[s] += 1
    }
    return counts
  })

  return { state, init, refresh, stop, toggleOffline, statusCounts }
}
```

- [ ] **Step 8: 运行确认通过**

```bash
npx vitest run src/stores/ src/core/validation.spec.ts
```

预期:PASS(集成 5 + settings 1 + validation 5)。

- [ ] **Step 9: Commit**

```bash
git add src/core/validation.ts src/core/validation.spec.ts src/stores/
git commit -m "feat: 设置/告警/监控 store 与告警链路装配" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 9: 路由、LayoutShell 布局、顶栏与告警铃铛

**Files:**
- Create: `src/router/index.ts`
- Create: `src/components/LayoutShell.vue`
- Create: `src/components/AlarmBell.vue`
- Create: `src/views/MonitorView.vue`(占位,Task 10 完善)
- Create: `src/views/AlarmsView.vue`(占位,Task 12 完善)
- Create: `src/views/SettingsView.vue`(占位,Task 13 完善)
- Modify: `src/main.ts`(挂路由)
- Modify: `src/App.vue`(换 LayoutShell)
- Delete: `src/components/HelloWorld.vue`

**Interfaces:**
- Consumes: Task 8 `useMonitorStore`(init/statusCounts)、`useAlarmsStore`(unread/markAllRead)。
- Produces: 路由名 `'monitor' | 'alarms' | 'settings'`(hash 模式);三视图文件存在。占位视图内容为 `<template><div class="sc-dim p-6">建设中</div></template>`,Task 10/12/13 整体替换。

- [ ] **Step 1: 路由**

新建 `src/router/index.ts`:

```ts
import { createRouter, createWebHashHistory } from 'vue-router'
import MonitorView from '@/views/MonitorView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/monitor' },
    { path: '/monitor', name: 'monitor', component: MonitorView },
    { path: '/alarms', name: 'alarms', component: () => import('@/views/AlarmsView.vue') },
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
  ],
})
```

- [ ] **Step 2: 三个占位视图**

`src/views/MonitorView.vue`、`src/views/AlarmsView.vue`、`src/views/SettingsView.vue` 内容均为:

```vue
<template>
  <div class="sc-dim p-6">建设中</div>
</template>
```

- [ ] **Step 3: AlarmBell**

新建 `src/components/AlarmBell.vue`:

```vue
<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAlarmsStore } from '@/stores/alarms'

const router = useRouter()
const alarms = useAlarmsStore()

function open(): void {
  alarms.markAllRead()
  void router.push({ name: 'alarms' })
}
</script>

<template>
  <el-badge :value="alarms.state.unread" :hidden="alarms.state.unread === 0" :max="99">
    <el-button circle text aria-label="告警记录" @click="open">🔔</el-button>
  </el-badge>
</template>
```

- [ ] **Step 4: LayoutShell**

新建 `src/components/LayoutShell.vue`:

```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { useMonitorStore } from '@/stores/monitor'
import AlarmBell from './AlarmBell.vue'

const route = useRoute()
const router = useRouter()
const monitor = useMonitorStore()

const nowText = ref(dayjs().format('YYYY-MM-DD HH:mm:ss'))
let clockTimer: number | null = null

onMounted(() => {
  void monitor.init()
  clockTimer = window.setInterval(() => {
    nowText.value = dayjs().format('YYYY-MM-DD HH:mm:ss')
  }, 1000)
})

onBeforeUnmount(() => {
  if (clockTimer !== null) clearInterval(clockTimer)
})

const activeMenu = computed(() => (route.name as string) ?? 'monitor')
const counts = monitor.statusCounts

function go(name: string): void {
  void router.push({ name })
}
</script>

<template>
  <el-container class="min-h-screen">
    <el-header height="64px" class="flex items-center justify-between border-b border-[var(--sc-border)]">
      <div class="flex items-center gap-6">
        <span class="text-xl font-semibold tracking-wide whitespace-nowrap">九厂一期工艺参数监控</span>
        <el-menu mode="horizontal" :default-active="activeMenu" class="!border-b-0" @select="go">
          <el-menu-item index="monitor">实时监控</el-menu-item>
          <el-menu-item index="alarms">告警记录</el-menu-item>
          <el-menu-item index="settings">阈值配置</el-menu-item>
        </el-menu>
      </div>
      <div class="flex items-center gap-5">
        <div class="flex items-center gap-3 text-sm whitespace-nowrap">
          <span class="text-[var(--sc-online)]">在线 {{ counts.online }}</span>
          <span class="text-[var(--sc-offline)]">离线 {{ counts.offline }}</span>
          <span class="text-[var(--sc-abnormal)]">异常 {{ counts.abnormal }}</span>
        </div>
        <span class="sc-dim text-sm tabular-nums">{{ nowText }}</span>
        <AlarmBell />
      </div>
    </el-header>
    <el-main>
      <router-view />
    </el-main>
  </el-container>
</template>
```

- [ ] **Step 5: 接线 App.vue 与 main.ts,删除模板残留**

`src/App.vue` 整体替换:

```vue
<script setup lang="ts">
import LayoutShell from '@/components/LayoutShell.vue'
</script>

<template>
  <LayoutShell />
</template>
```

`src/main.ts` 在 `createApp(App)` 前追加路由挂载,最终为:

```ts
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './style.css'
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import App from './App.vue'
import { router } from './router'

document.documentElement.classList.add('dark')

createApp(App).use(ElementPlus).use(router).mount('#app')
```

删除 `src/components/HelloWorld.vue`。

- [ ] **Step 6: 验证并提交**

```bash
npm test && npx vue-tsc -b && npm run build
npm run dev
# 手动:打开 http://localhost:5173,应见深色布局、顶栏统计(离线 4/初始)、时钟走秒、三页可切换
```

```bash
git add -A
git commit -m "feat: 路由与深色布局骨架(顶栏统计/时钟/告警铃铛)" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 10: 格式化工具 + StatusBadge + DeviceCard + 监控大屏

**Files:**
- Create: `src/utils/format.ts`
- Create: `src/components/StatusBadge.vue`
- Create: `src/components/DeviceCard.vue`
- Modify: `src/views/MonitorView.vue`(整体替换占位)

**Interfaces:**
- Consumes: Task 8 `useMonitorStore`(state.devices/readings/statuses/forcedOffline、toggleOffline、init)。
- Produces(Task 11/12 复用):
  - `formatTime(ts: number): string`(`HH:mm:ss`)、`formatDateTime(ts: number): string`(`YYYY-MM-DD HH:mm:ss`)、`formatParamValue(value: number | null | undefined, paramKey: ParamKey): string`(按小数位,空值 `'--'`)
  - `StatusBadge` props `{ status: DeviceStatus }`
  - `DeviceCard` props `{ device: Device; reading: Reading | null; statusInfo: DeviceStatusInfo | undefined; forcedOffline: boolean }`,emits `open`、`toggleOffline`

- [ ] **Step 1: format 工具**

新建 `src/utils/format.ts`:

```ts
import dayjs from 'dayjs'
import type { ParamKey } from '@/api/types'
import { PARAM_META_MAP } from '@/config/params'

export function formatTime(ts: number): string {
  return dayjs(ts).format('HH:mm:ss')
}

export function formatDateTime(ts: number): string {
  return dayjs(ts).format('YYYY-MM-DD HH:mm:ss')
}

export function formatParamValue(value: number | null | undefined, paramKey: ParamKey): string {
  if (value === null || value === undefined) return '--'
  return value.toFixed(PARAM_META_MAP[paramKey].decimals)
}
```

- [ ] **Step 2: StatusBadge**

新建 `src/components/StatusBadge.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { DeviceStatus } from '@/api/types'

const props = defineProps<{ status: DeviceStatus }>()

const config = computed(() => {
  switch (props.status) {
    case 'online':
      return { text: '在线', type: 'success' as const, cls: '' }
    case 'offline':
      return { text: '离线', type: 'info' as const, cls: '' }
    case 'abnormal':
      return { text: '异常', type: 'danger' as const, cls: 'sc-badge-abnormal' }
  }
})
</script>

<template>
  <el-tag :type="config.type" :class="config.cls" effect="dark" round>{{ config.text }}</el-tag>
</template>
```

- [ ] **Step 3: DeviceCard**

新建 `src/components/DeviceCard.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import type { Device, DeviceStatusInfo, ParamKey, Reading } from '@/api/types'
import { PARAM_METAS } from '@/config/params'
import StatusBadge from './StatusBadge.vue'
import { formatParamValue, formatTime } from '@/utils/format'

const props = defineProps<{
  device: Device
  reading: Reading | null
  statusInfo: DeviceStatusInfo | undefined
  forcedOffline: boolean
}>()

defineEmits<{ open: []; toggleOffline: [] }>()

const agoText = computed(() => {
  if (!props.reading) return '暂无数据'
  const s = Math.max(0, Math.floor((Date.now() - props.reading.timestamp) / 1000))
  return `${formatTime(props.reading.timestamp)}(${s}s前)`
})

function violationFor(key: ParamKey) {
  return props.statusInfo?.violations.find((v) => v.paramKey === key)
}
</script>

<template>
  <div
    class="sc-panel flex cursor-pointer flex-col gap-4 p-5 transition-colors hover:border-[#38bdf8]/50"
    @click="$emit('open')"
  >
    <div class="flex items-center justify-between">
      <div>
        <div class="text-lg font-semibold">{{ device.name }}</div>
        <div class="sc-dim mt-0.5 text-xs">{{ device.clientId }}</div>
      </div>
      <StatusBadge :status="statusInfo?.status ?? 'offline'" />
    </div>

    <div class="grid grid-cols-3 gap-x-4 gap-y-2">
      <div v-for="meta in PARAM_METAS" :key="meta.key" class="text-sm">
        <span class="sc-dim">{{ meta.label }}</span>
        <span
          class="ml-1 tabular-nums"
          :class="violationFor(meta.key) ? 'font-semibold text-[var(--sc-abnormal)]' : ''"
        >
          {{ formatParamValue(reading?.params[meta.key], meta.key) }}{{ meta.unit }}
        </span>
      </div>
    </div>

    <div class="flex items-center justify-between text-xs">
      <span class="sc-dim">最近上报:{{ agoText }}</span>
      <el-tooltip content="停止该设备模拟上报;离线判定为 60 秒无数据,约 1 分钟后状态切换" placement="top">
        <el-button
          size="small"
          :type="forcedOffline ? 'success' : 'warning'"
          plain
          @click.stop="$emit('toggleOffline')"
        >
          {{ forcedOffline ? '恢复上报' : '模拟离线' }}
        </el-button>
      </el-tooltip>
    </div>
  </div>
</template>
```

- [ ] **Step 4: MonitorView**

`src/views/MonitorView.vue` 整体替换:

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { Device } from '@/api/types'
import { useMonitorStore } from '@/stores/monitor'
import DeviceCard from '@/components/DeviceCard.vue'

const monitor = useMonitorStore()
const selected = ref<Device | null>(null)
const drawerVisible = ref(false)

onMounted(() => {
  void monitor.init()
})

function open(device: Device): void {
  selected.value = device
  drawerVisible.value = true
}
</script>

<template>
  <div>
    <div class="grid grid-cols-2 gap-5">
      <DeviceCard
        v-for="device in monitor.state.devices"
        :key="device.id"
        :device="device"
        :reading="monitor.state.readings[device.id] ?? null"
        :status-info="monitor.state.statuses[device.id]"
        :forced-offline="monitor.state.forcedOffline.includes(device.id)"
        @open="open(device)"
        @toggle-offline="monitor.toggleOffline(device.id)"
      />
    </div>

    <el-drawer v-model="drawerVisible" :title="selected?.name" size="520px">
      <div class="sc-dim">{{ selected?.clientId }}(详情抽屉于下一任务接入)</div>
    </el-drawer>
  </div>
</template>
```

- [ ] **Step 5: 验证并提交**

```bash
npm test && npx vue-tsc -b && npm run build
npm run dev
# 手动:大屏 2×2 四卡片,数值每 2s 刷新;点"模拟离线"约 1 分钟后该卡片变灰、顶栏离线计数 +1
```

```bash
git add src/utils/ src/components/ src/views/MonitorView.vue
git commit -m "feat: 监控大屏设备卡片与状态徽标" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 11: 趋势图 + 设备详情抽屉

**Files:**
- Create: `src/components/TrendChart.vue`
- Create: `src/components/DeviceDrawer.vue`
- Modify: `src/views/MonitorView.vue`(抽屉替换为 DeviceDrawer)

**Interfaces:**
- Consumes: Task 7 `monitorApi.getHistory`、Task 10 `StatusBadge`/`formatDateTime`/`formatParamValue`、Task 8 `useMonitorStore`。
- Produces: `TrendChart` props `{ deviceId: DeviceId; paramKey: ParamKey }`;`DeviceDrawer` props `{ device: Device | null }` + `defineModel<boolean>()` 显隐。

- [ ] **Step 1: TrendChart**

新建 `src/components/TrendChart.vue`:

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import type { DeviceId, ParamKey } from '@/api/types'
import { getHistory } from '@/api/monitorApi'
import { PARAM_META_MAP } from '@/config/params'

const props = defineProps<{ deviceId: DeviceId; paramKey: ParamKey }>()

const el = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null

async function render(): Promise<void> {
  if (!el.value) return
  const meta = PARAM_META_MAP[props.paramKey]
  const history = await getHistory(props.deviceId, props.paramKey)
  const times = history.map((r) => dayjs(r.timestamp).format('HH:mm:ss'))
  const values = history.map((r) => r.params[props.paramKey] ?? null)
  chart ??= echarts.init(el.value)
  chart.setOption(
    {
      backgroundColor: 'transparent',
      grid: { left: 56, right: 16, top: 30, bottom: 28 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: times,
        axisLabel: { color: '#8ea0bf' },
        axisLine: { lineStyle: { color: '#1e2a44' } },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLabel: { color: '#8ea0bf' },
        splitLine: { lineStyle: { color: '#1e2a44' } },
      },
      series: [
        {
          name: meta.label,
          type: 'line',
          data: values,
          showSymbol: false,
          smooth: true,
          lineStyle: { color: '#38bdf8' },
          areaStyle: { color: 'rgba(56, 189, 248, 0.12)' },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#f87171', type: 'dashed' },
            label: { color: '#f87171', formatter: '阈值上限 {b}' },
            data: [{ yAxis: meta.defaultThreshold[1] }],
          },
        },
      ],
    },
    true,
  )
}

function onResize(): void {
  chart?.resize()
}

onMounted(() => {
  void render()
  window.addEventListener('resize', onResize)
})

watch(
  () => [props.deviceId, props.paramKey] as const,
  () => void render(),
)

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="el" class="h-64 w-full" />
</template>
```

- [ ] **Step 2: DeviceDrawer**

新建 `src/components/DeviceDrawer.vue`:

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Device, ParamKey } from '@/api/types'
import { PARAM_METAS } from '@/config/params'
import { useMonitorStore } from '@/stores/monitor'
import StatusBadge from './StatusBadge.vue'
import TrendChart from './TrendChart.vue'
import { formatDateTime, formatParamValue } from '@/utils/format'

const props = defineProps<{ device: Device | null }>()
const visible = defineModel<boolean>({ required: true })

const monitor = useMonitorStore()
const activeParam = ref<ParamKey>('Vf')

watch(visible, (v) => {
  if (v) activeParam.value = 'Vf'
})

const reading = computed(() => (props.device ? monitor.state.readings[props.device.id] ?? null : null))
const statusInfo = computed(() => (props.device ? monitor.state.statuses[props.device.id] : undefined))
</script>

<template>
  <el-drawer v-model="visible" :title="device?.name" size="560px">
    <template v-if="device">
      <img :src="device.image" :alt="device.name" class="w-full rounded-lg border border-[var(--sc-border)]" />

      <el-descriptions :column="2" border size="small" class="mt-4">
        <el-descriptions-item label="设备编号">{{ device.clientId }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <StatusBadge :status="statusInfo?.status ?? 'offline'" />
        </el-descriptions-item>
        <el-descriptions-item label="型号">{{ device.model }}</el-descriptions-item>
        <el-descriptions-item label="安装位置">{{ device.location }}</el-descriptions-item>
        <el-descriptions-item label="投运日期">{{ device.commissionDate }}</el-descriptions-item>
        <el-descriptions-item label="负责人">{{ device.manager }}</el-descriptions-item>
        <el-descriptions-item label="通信方式" :span="2">{{ device.comm }}</el-descriptions-item>
        <el-descriptions-item label="最近上报" :span="2">
          {{ reading ? formatDateTime(reading.timestamp) : '暂无数据' }}
        </el-descriptions-item>
      </el-descriptions>

      <div class="mt-4 grid grid-cols-3 gap-2">
        <div
          v-for="meta in PARAM_METAS"
          :key="meta.key"
          class="sc-panel cursor-pointer p-2 text-center"
          :class="activeParam === meta.key ? 'ring-1 ring-[#38bdf8]' : ''"
          @click="activeParam = meta.key"
        >
          <div class="sc-dim text-xs">{{ meta.label }}</div>
          <div class="text-base tabular-nums">{{ formatParamValue(reading?.params[meta.key], meta.key) }}</div>
          <div class="sc-dim text-xs">{{ meta.unit }}</div>
        </div>
      </div>

      <div class="mt-4">
        <TrendChart :device-id="device.id" :param-key="activeParam" />
      </div>
    </template>
  </el-drawer>
</template>
```

- [ ] **Step 3: MonitorView 换用 DeviceDrawer**

`src/views/MonitorView.vue` 中,占位抽屉替换为:

```vue
<DeviceDrawer v-model="drawerVisible" :device="selected" />
```

并在 script 中导入:`import DeviceDrawer from '@/components/DeviceDrawer.vue'`。

- [ ] **Step 4: 验证并提交**

```bash
npm test && npx vue-tsc -b && npm run build
npm run dev
# 手动:点任一卡片 → 抽屉出现设备图片、信息表、6 参数块;切换参数块趋势图随之刷新
```

```bash
git add src/components/ src/views/MonitorView.vue
git commit -m "feat: 设备详情抽屉与 echarts 趋势图" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 12: 告警记录页

**Files:**
- Modify: `src/views/AlarmsView.vue`(整体替换占位)

**Interfaces:**
- Consumes: Task 8 `useAlarmsStore`(state.records/unread、init、clearAll)、Task 10 `formatDateTime`/`formatParamValue`、Task 2 `PARAM_META_MAP`/`DEVICES`。

- [ ] **Step 1: 实现页面**

`src/views/AlarmsView.vue` 整体替换:

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { AlarmRecord, AlarmType, DeviceId } from '@/api/types'
import { useAlarmsStore } from '@/stores/alarms'
import { DEVICES, PARAM_META_MAP } from '@/config/params'
import { formatDateTime, formatParamValue } from '@/utils/format'

const alarms = useAlarmsStore()
const filterDevice = ref<DeviceId | ''>('')
const filterType = ref<AlarmType | ''>('')

onMounted(() => {
  void alarms.init()
})

const filtered = computed(() =>
  alarms.state.records
    .filter((r) => (filterDevice.value ? r.deviceId === filterDevice.value : true))
    .filter((r) => (filterType.value ? r.type === filterType.value : true))
    .slice()
    .reverse(),
)

const typeText: Record<AlarmType, string> = { high: '超上限', low: '超下限', offline: '离线' }
const smsText: Record<AlarmRecord['sms']['status'], string> = { sent: '已发送', pending: '发送中', failed: '失败' }

function paramLabel(key: AlarmRecord['paramKey']): string {
  return key ? PARAM_META_MAP[key].label : '整机'
}

function deviceName(id: DeviceId): string {
  return DEVICES.find((d) => d.id === id)?.name ?? id
}

async function clearAll(): Promise<void> {
  await ElMessageBox.confirm('确定清空全部告警记录?', '提示', { type: 'warning' })
  await alarms.clearAll()
  ElMessage.success('已清空')
}
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <el-select v-model="filterDevice" placeholder="全部设备" clearable class="w-44">
          <el-option v-for="d in DEVICES" :key="d.id" :label="d.name" :value="d.id" />
        </el-select>
        <el-select v-model="filterType" placeholder="全部类型" clearable class="w-36">
          <el-option label="超上限" value="high" />
          <el-option label="超下限" value="low" />
          <el-option label="离线" value="offline" />
        </el-select>
      </div>
      <el-button type="danger" plain @click="clearAll">清空记录</el-button>
    </div>

    <el-table :data="filtered" border stripe size="small" class="w-full">
      <el-table-column label="时间" width="170">
        <template #default="{ row }">{{ formatDateTime(row.time) }}</template>
      </el-table-column>
      <el-table-column label="设备" width="130">
        <template #default="{ row }">{{ deviceName(row.deviceId) }}</template>
      </el-table-column>
      <el-table-column label="参数" width="100">
        <template #default="{ row }">{{ paramLabel(row.paramKey) }}</template>
      </el-table-column>
      <el-table-column label="类型" width="90">
        <template #default="{ row }">
          <el-tag :type="row.type === 'offline' ? 'danger' : 'warning'" size="small">{{ typeText[row.type as AlarmType] }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="当前值" width="110">
        <template #default="{ row }">
          {{ row.value === null ? '--' : formatParamValue(row.value, row.paramKey!) }}
        </template>
      </el-table-column>
      <el-table-column label="阈值" width="90">
        <template #default="{ row }">{{ row.threshold ?? '--' }}</template>
      </el-table-column>
      <el-table-column label="级别" width="90">
        <template #default="{ row }">
          <el-tag :type="row.level === 'critical' ? 'danger' : 'warning'" size="small" effect="plain">
            {{ row.level === 'critical' ? '严重' : '警告' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="短信">
        <template #default="{ row }">
          <el-tag :type="row.sms.status === 'sent' ? 'success' : row.sms.status === 'failed' ? 'danger' : 'info'" size="small">
            {{ smsText[row.sms.status] }}
          </el-tag>
          <span class="sc-dim ml-2 text-xs">
            {{ row.sms.receivers.length > 0 ? `${row.sms.receivers.length} 位接收人` : '无接收人' }}
          </span>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="filtered.length === 0" class="sc-dim mt-6 text-center">暂无告警记录</div>
  </div>
</template>
```

- [ ] **Step 2: 验证并提交**

```bash
npm test && npx vue-tsc -b && npm run build
npm run dev
# 手动:告警页出现此前产生的记录;筛选设备/类型生效;清空需确认
```

```bash
git add src/views/AlarmsView.vue
git commit -m "feat: 告警记录页(筛选/清空/短信状态)" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 13: 阈值配置页(阈值表格 + 接收人管理)

**Files:**
- Modify: `src/views/SettingsView.vue`(整体替换占位)

**Interfaces:**
- Consumes: Task 8 `useSettingsStore`(state、init、save、addReceiver、removeReceiver)、Task 8 `validateThresholdRules`/`validatePhone`、Task 2 `DEVICES`/`PARAM_META_MAP`。

- [ ] **Step 1: 实现页面**

`src/views/SettingsView.vue` 整体替换:

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSettingsStore } from '@/stores/settings'
import { validatePhone, validateThresholdRules } from '@/core/validation'
import { DEVICES, PARAM_META_MAP } from '@/config/params'

const settings = useSettingsStore()

onMounted(() => {
  void settings.init()
})

async function saveAll(): Promise<void> {
  const err = validateThresholdRules(settings.state.thresholds)
  if (err) {
    ElMessage.error(err)
    return
  }
  await settings.save()
  ElMessage.success('阈值配置已保存并生效')
}

const dialogVisible = ref(false)
const form = ref({ name: '', phone: '' })

async function submitReceiver(): Promise<void> {
  const name = form.value.name.trim()
  if (!name) {
    ElMessage.error('请输入姓名')
    return
  }
  if (!validatePhone(form.value.phone)) {
    ElMessage.error('手机号须为 1 开头的 11 位数字')
    return
  }
  await settings.addReceiver(name, form.value.phone)
  ElMessage.success('接收人已添加')
  dialogVisible.value = false
  form.value = { name: '', phone: '' }
}

async function removeReceiver(id: string): Promise<void> {
  await ElMessageBox.confirm('确定删除该接收人?', '提示', { type: 'warning' })
  await settings.removeReceiver(id)
}
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <span class="sc-dim text-sm">修改后点击"保存"生效;判定周期 2 秒,即时应用于状态与告警。</span>
      <el-button type="primary" @click="saveAll">保存</el-button>
    </div>

    <el-tabs type="border-card">
      <el-tab-pane v-for="device in DEVICES" :key="device.id" :label="device.name">
        <el-table :data="settings.rulesFor(device.id)" border size="small">
          <el-table-column label="参数" width="140">
            <template #default="{ row }">{{ PARAM_META_MAP[row.paramKey as keyof typeof PARAM_META_MAP].label }}</template>
          </el-table-column>
          <el-table-column label="下限" width="200">
            <template #default="{ row }">
              <el-input-number
                v-model="row.low"
                :precision="PARAM_META_MAP[row.paramKey as keyof typeof PARAM_META_MAP].decimals"
                :step="1"
                size="small"
              />
            </template>
          </el-table-column>
          <el-table-column label="上限" width="200">
            <template #default="{ row }">
              <el-input-number
                v-model="row.high"
                :precision="PARAM_META_MAP[row.paramKey as keyof typeof PARAM_META_MAP].decimals"
                :step="1"
                size="small"
              />
            </template>
          </el-table-column>
          <el-table-column label="参与监控">
            <template #default="{ row }">
              <el-switch v-model="row.enabled" />
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <div class="sc-panel mt-6 p-5">
      <div class="mb-3 flex items-center justify-between">
        <span class="font-semibold">短信接收人</span>
        <el-button size="small" type="primary" plain @click="dialogVisible = true">添加接收人</el-button>
      </div>
      <el-table :data="settings.state.receivers" border size="small" class="w-full" empty-text="暂无接收人,告警短信将标记为发送失败">
        <el-table-column prop="name" label="姓名" width="160" />
        <el-table-column prop="phone" label="手机号" width="200" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button size="small" type="danger" plain @click="removeReceiver(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" title="添加接收人" width="400px">
      <el-form label-width="70px">
        <el-form-item label="姓名">
          <el-input v-model="form.name" placeholder="如:张工" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" placeholder="1 开头的 11 位数字" maxlength="11" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitReceiver">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>
```

- [ ] **Step 2: 验证并提交**

```bash
npm test && npx vue-tsc -b && npm run build
npm run dev
# 手动:四个设备 Tab 各 6 行;把某参数上限改小并保存 → 回监控页数十秒内对应参数越界告警;
# low ≥ high 时保存被拒并提示具体设备与参数;添加非法手机号被拒;刷新页面配置仍在
```

```bash
git add src/views/SettingsView.vue
git commit -m "feat: 阈值配置页与短信接收人管理" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 14: 收尾 — README、全量验证、人工验收

**Files:**
- Modify: `README.md`(整体替换)

**Interfaces:**
- Consumes: 前序全部任务的交付物。
- Produces: 可交付状态。

- [ ] **Step 1: 重写 README**

`README.md` 整体替换:

```markdown
# sc-front · 九厂一期工艺参数监控大屏

纯前端监控大屏:4 台工艺参数传感器(九厂一期)的在线/离线/异常状态实时展示、设备信息与图片、模拟短信告警与告警阈值配置。

## 运行

```bash
npm install
npm run dev        # 开发,默认 http://localhost:5173
npm test           # vitest 单元测试
npm run build      # 类型检查 + 产物构建
```

## 数据源

当前使用模拟数据(`VITE_USE_MOCK=true` 为默认)。真实报文形状:`{ deviceId, params: { Sf, Vf, Fc, pHf, Tf, Cf }, timestamp }`,与 Python 采集端经 MQTT(`Chen-Su-Yi/<client_id>`)上报的数据一致。

后端 API 就绪后:设置 `VITE_USE_MOCK=false` 并在 `src/api/http.ts` 接入 `VITE_API_BASE` 与真实端点,页面与 store 零改动。约定端点见 `docs/superpowers/specs/2026-09-29-sensor-monitor-design.md` 第 11 节。

## 演示要点

- 状态判定:60 秒无新数据判离线;启用监控的参数超出阈值判异常(2 秒刷新)。
- 卡片"模拟离线"按钮可演示断链→离线告警全链路(约 1 分钟)。
- 告警触发后模拟发送短信,10 分钟冷却防止重复轰炸;无接收人时标记失败。
- 阈值与接收人配置保存在浏览器 localStorage,刷新不丢。
```

注意:README 中的嵌套代码围栏写法——外层不要用四反引号包整段,直接把上述内容作为文件内容写入(其中代码块为三反引号),不要在文件里再包一层。

- [ ] **Step 2: 全量验证**

```bash
npm test && npx vue-tsc -b && npm run build
```

预期:全部通过。

- [ ] **Step 3: 人工验收清单(请用户在浏览器逐项确认)**

1. 打开 `npm run dev` 页面:深色大屏,4 张设备卡片,数值约每 2 秒变化,顶栏统计与时钟正常。
2. 点"模拟离线"→ 约 1 分钟后该卡片变灰、顶栏离线 +1、铃铛出现红点、弹出"短信已发送"通知。
3. 点"恢复上报"→ 数秒内恢复在线,不产生"恢复"告警。
4. 等待异常注入(卡片某参数变红)或把某阈值上限改小保存触发 → 异常状态 + 告警记录 + 短信通知。
5. 点卡片 → 抽屉:设备图片、基本信息、参数块、趋势曲线(可切换参数)。
6. 告警页:筛选设备/类型、清空记录需确认。
7. 设置页:改阈值保存 → 立即生效;非法输入(low ≥ high、错手机号)被拒;刷新页面配置仍在。

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README 运行说明与后端接入约定" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"
```





