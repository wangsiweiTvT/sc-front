# 九厂一期工艺参数传感器监控 — 设计文档

日期:2026-09-29
状态:已确认(口头设计经用户批准)

## 1. 背景与目标

第九水厂一期有 4 台工艺参数传感器(数据上报 client_id:`Di-Jiu-Shui-Chang-1` ~ `Di-Jiu-Shui-Chang-4`,经 MQTT 主题 `Chen-Su-Yi/<client_id>` 上报)。本仓库(sc-front)为其建设**纯前端监控大屏**,实现:

1. 4 台设备**在线 / 离线 / 异常状态实时展示**;
2. 设备**基本信息与图片展示**;
3. **短信自动告警**(模拟发送)及**告警阈值配置界面**。

真实数据链路:Python 采集端 → MQTT Broker → 用户自建后端 → MySQL(`mqtt_data.sensor_data`)。后端 API 尚未就绪;本阶段用模拟数据开发,数据层按真实 API 形状抽象,后端就绪后切换数据源即可。

### 成功标准

- 打开 `/monitor` 能看到 4 张设备卡片,状态徽标与参数值按 2s 节奏实时刷新;
- 能演示在线→离线→异常三种状态的转换(含手动"模拟离线/恢复");
- 点击设备卡片可见设备信息、图片、6 项参数实时值与趋势曲线;
- 参数越界自动产生告警记录,并完成一次"模拟短信发送"(记录短信状态与接收人);
- 在 `/settings` 可修改任意设备×参数的高/低阈值与监控开关、管理接收手机号,保存后立即生效并持久化;
- 核心判定逻辑(状态、告警、冷却)有单元测试覆盖。

## 2. 范围

### 做

- 3 个页面:实时监控大屏、告警记录、阈值配置;
- 前端模拟数据引擎(随机游走 + 可控离线/异常注入);
- 状态判定、告警触发、短信模拟发送(带冷却去重);
- 阈值/接收人/告警记录的 localStorage 持久化;
- 深色监控大屏风格(Element Plus 暗色变量 + Tailwind 4);
- vitest 单元测试(核心逻辑)。

### 不做

- 后端服务、真实短信网关对接、数据库访问;
- WebSocket/MQTT 直连(前端不直连 Broker);
- 用户登录、权限、多租户;
- 移动端专门适配(桌面浏览器优先,布局不刻意适配手机)。

## 3. 技术选型

| 项 | 选择 | 理由 |
|---|---|---|
| 框架 | Vue 3 `<script setup>` + TS(现有) | 仓库现状 |
| UI | Element Plus(暗色)+ Tailwind CSS 4(现有) | 仓库现状,暗色大屏 |
| 路由 | vue-router 4 | 3 页面导航 |
| 图表 | ECharts(按需引入折线图) | 趋势曲线 |
| 状态管理 | `reactive()` 组合式 store(不引入 pinia) | 状态量小,减依赖 |
| 测试 | vitest | 轻量,与 vite 同生态 |
| 定时刷新 | `setInterval` 轮询模拟层 | 与将来后端轮询/推送切换成本最低 |

新增依赖:`vue-router@4`、`echarts`、`vitest`(dev)。

## 4. 架构

```
src/
├── api/                 # 数据层接口(签名 = 将来后端 API)
│   ├── types.ts         # 全部领域类型
│   ├── deviceApi.ts     # getDevices / getDeviceImage
│   ├── monitorApi.ts    # getRealtimeReadings / getStatusOverview
│   ├── alarmApi.ts      # getAlarms / markAlarmSmsSent / simulateSmsSend
│   └── configApi.ts     # getThresholds / saveThresholds / getReceivers / addReceiver / removeReceiver
├── mock/                # 模拟实现(与 api 同签名),由 VITE_USE_MOCK 切换
│   ├── simulator.ts     # 数据发生器:随机游走、离线/异常注入
│   └── memory.ts        # localStorage 持久层
├── stores/              # reactive 组合式 store
│   ├── monitor.ts       # 设备实时状态
│   ├── alarms.ts        # 告警记录 + 铃铛未读
│   └── settings.ts      # 阈值与接收人
├── core/                # 纯逻辑(可单测,无 DOM/无框架依赖)
│   ├── statusRule.ts    # 在线/离线/异常判定
│   ├── alarmEngine.ts   # 越界检测 + 冷却去重 + 告警生成
│   └── smsService.ts    # 模拟短信发送(延迟、状态机)
├── views/
│   ├── MonitorView.vue  # /monitor 大屏
│   ├── AlarmsView.vue   # /alarms 告警记录
│   └── SettingsView.vue # /settings 阈值配置
├── components/
│   ├── DeviceCard.vue       # 设备卡片(状态徽标/参数摘要)
│   ├── DeviceDrawer.vue     # 设备详情抽屉(信息+图片+趋势)
│   ├── StatusBadge.vue      # 状态徽标(在线绿/离线灰/异常红呼吸)
│   ├── TrendChart.vue       # echarts 折线封装
│   ├── AlarmBell.vue        # 顶栏告警铃铛(未读红点)
│   └── LayoutShell.vue      # 深色顶栏 + 导航布局
├── config/
│   └── params.ts        # 6 参数元数据(名称/单位/小数位/默认正常范围/默认阈值)
└── router/index.ts
```

**数据源切换约定**:`VITE_USE_MOCK`(默认 `true`)。`src/api/*.ts` 内部根据该开关返回 mock 实现或调用真实 HTTP(后端就绪时补 `baseURL` 与具体端点)。mock 实现内部复用 `core/` 纯逻辑(simulator 产数据、smsService 走发送状态机),保证"逻辑一套、数据源两套"。页面与 store 只依赖 api 层,永远不直接 import mock。

## 5. 数据模型

```ts
type DeviceId = 'Di-Jiu-Shui-Chang-1' | ... | '-4'
type ParamKey = 'Vf' | 'Sf' | 'Fc' | 'pHf' | 'Tf' | 'Cf'

interface Device {
  id: DeviceId
  clientId: string          // Di-Jiu-Shui-Chang-N
  name: string              // 九厂一期-1#
  model: string             // 设备型号
  location: string          // 安装位置(如 1# 沉淀池)
  commissionDate: string    // 投运日期
  comm: string              // 通信方式(MQTT / 100.85.44.98:1883)
  manager: string           // 负责人
  image: string             // 图片资源路径
}

interface Reading {
  deviceId: DeviceId
  params: Record<ParamKey, number>
  timestamp: number         // epoch ms
}

type DeviceStatus = 'online' | 'offline' | 'abnormal'

interface ThresholdRule {
  deviceId: DeviceId
  paramKey: ParamKey
  low: number
  high: number
  enabled: boolean          // 该参数是否参与监控
}

interface Receiver { id: string; name: string; phone: string }

interface AlarmRecord {
  id: string
  time: number
  deviceId: DeviceId
  paramKey: ParamKey | null // null = 整机离线告警
  type: 'high' | 'low' | 'offline'
  value: number | null
  threshold: number | null
  level: 'warning' | 'critical'   // 映射:high/low → warning;offline → critical
  sms: { status: 'pending' | 'sent' | 'failed'; receivers: string[]; sentAt?: number }
}

interface ParamMeta {
  key: ParamKey; label: string; unit: string; decimals: number
  normal: [number, number]      // 模拟数据正常游走范围
  defaultThreshold: [number, number]
  defaultEnabled: boolean
}
```

### 参数元数据默认值(集中 `config/params.ts`,含义为暂定猜测,用户可随时改配置纠正)

| key | 中文名 | 单位 | 正常范围 | 默认阈值 | 小数位 |
|---|---|---|---|---|---|
| Vf | 沉降比 | % | 8–25 | 5 / 35 | 1 |
| Sf | 沉降速度 | m/h | 0.8–2.5 | 0.5 / 3.5 | 2 |
| Fc | 流量 | m³/h | 900–1400 | 800 / 1500 | 0 |
| pHf | pH | — | 6.8–7.8 | 6.5 / 8.5 | 2 |
| Tf | 温度 | ℃ | 12–24 | 8 / 30 | 1 |
| Cf | 余氯 | mg/L | 0.3–0.8 | 0.2 / 1.0 | 2 |

## 6. 核心规则

### 6.1 状态判定(`core/statusRule.ts`,纯函数)

- **online**:存在时间戳距今 ≤ **60s** 的数据,且无参数越界;
- **abnormal**:在线,且任一**启用监控**的参数值 ∉ `[low, high]`(越界即异常,取最严重者展示);
- **offline**:最近一条数据时间戳距今 > 60s,或从未上报。
- 判定输入 `(latestReading, now, thresholdRules)`,输出 `DeviceStatus` + 越界参数明细,便于卡片与告警引擎复用同一份结论。

### 6.2 告警引擎(`core/alarmEngine.ts`,纯函数 + store 协作)

每次新数据到达:

1. 用 statusRule 判定;
2. 若参数越界 → 生成 `high`/`low` 类型告警;若设备由在线转离线 → 生成 `offline` 告警(恢复不生成记录,只刷新状态);
3. **冷却去重**:同 `(deviceId, paramKey, type)` 在 **10 分钟**冷却窗口内已告警过 → 不再新建记录、不重发短信(窗口可配置);
4. 新告警入列后交给 `smsService`。

### 6.3 模拟短信(`core/smsService.ts`)

- 发送 = 约 1s 延迟后把 `sms.status` 置 `sent`(随机 5% 置 `failed` 以演示失败态);
- 内容模板:`【水厂监控】九厂一期-1# 沉降比 38.2%,超上限 35%,请及时处理。`
- 接收人取自 settings;无接收人时状态置 `failed` 并提示"未配置接收人";
- 发送完成:顶栏铃铛红点 +1,toast 提示"短信已发送至 3 位接收人(模拟)"。

### 6.4 模拟数据引擎(`mock/simulator.ts`)

- 每 **2s** 为每台在线设备生成一条 Reading:上一值 + 随机小步长(随机游走),夹在正常范围内;
- **异常注入**:每台设备每 tick 有 ~1.5% 概率把某参数推出阈值外并持续 15–40s 后回落,保证演示时能看到异常;
- **离线演示**:每台设备卡片提供"模拟离线/恢复"手动按钮(停发/恢复数据);另有 ~0.2%/tick 自动掉线概率;
- 时钟推进与随机数通过参数注入,保证可测试;
- 启动时为每台设备**回填近 30 分钟历史点**(每 10s 一点),供抽屉趋势图开箱即有曲线(页面展示窗口以实际数据为准,标题写"近期趋势")。

## 7. 页面设计

### 7.1 `/monitor` 实时监控大屏(默认路由)

- 顶栏:系统标题"九厂一期工艺参数监控"、实时时钟、在线/离线/异常统计计数、告警铃铛;
- 主体:4 张设备卡片(2×2 网格),每张含:设备名与 client_id、状态徽标(online 绿 / offline 灰 / abnormal 红呼吸动画)、6 参数当前值(越界项红色高亮)、最近上报时间、"模拟离线/恢复"按钮;
- 点击卡片 → 右侧抽屉(DeviceDrawer):设备基本信息表、设备图片、6 参数实时值、选中参数的 24h 趋势折线(echarts,深色主题)。

### 7.2 `/alarms` 告警记录

- el-table:时间、设备、参数、类型(超上限/超下限/离线)、当前值、阈值、级别、短信状态(已发送/失败/发送中)与接收人数;
- 筛选:按设备、按类型;清空记录按钮。

### 7.3 `/settings` 阈值配置

- 设备 Tab × 参数行表格:低阈值、高阈值输入(el-input-number,校验 low < high)、监控开关;
- 短信接收人卡片列表:姓名、手机号(11 位校验)、增删;
- 保存按钮 → 写入 localStorage → 成功提示,立即生效。

## 8. 持久化

- key 前缀 `sc-front:`:`thresholds`、`receivers`、`alarms`(上限 500 条,超出丢弃最旧);
- 读取失败/损坏时回退默认值;全部 try/catch 包裹(隐私模式等场景不崩溃)。

## 9. 错误处理

- 模拟层所有读取均有默认值兜底;判定函数对缺参/乱序数据健壮(缺字段按 null 跳过该参数);
- 告警短信失败不阻塞监控主循环;铃铛与卡片状态以 store 单一数据源为准。

## 10. 测试策略(vitest)

纯逻辑全测,组件不强行上测试:

- `statusRule.spec.ts`:三种状态判定、边界(恰 60s、恰等于阈值)、缺数据;
- `alarmEngine.spec.ts`:越界生成、类型正确、10 分钟冷却去重、恢复不产生记录;
- `smsService.spec.ts`:状态机 pending→sent/failed、无接收人失败;
- `simulator.spec.ts`:游走范围受控、离线停发;
- `settings` 校验逻辑:low<high、手机号格式。

## 11. 未来对接后端(非本期实现,仅约定)

- 后端提供:`GET /devices`、`GET /readings/latest`、`GET /alarms`、`GET/PUT /thresholds`、`GET/POST/DELETE /receivers`;
- 前端把 `VITE_USE_MOCK=false` + `VITE_API_BASE` 指向后端即可,页面与 store 零改动;
- 真实短信发送在后端完成,前端只读 `sms.status`。
