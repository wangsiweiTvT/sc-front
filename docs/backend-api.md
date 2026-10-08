# 九厂一期监控前端 · 后端接口需求清单

> 交付对象:后端开发(可直接交给后端 agent 开发)。版本 v1,日期 2026-10-08。
> 目标:本文档全部完成后,前端把 `VITE_USE_MOCK=false` 即可切换到真实数据,页面与 store 零改动。
> 前端类型定义参照 `src/api/types.ts`(若你能访问前端仓库);消费这些接口的前端代码在 `src/api/*.ts`。

## 0. 现状

- 现有后端 `api.py`(FastAPI,`python3 -m uvicorn api:app --port 8000`,交互文档 `/docs`)已提供 3 个只读接口:
  - `GET /api/devices` — 设备列表(条数、最后上报时间)
  - `GET /api/devices/{device_id}/latest` — 单设备最新一条(无数据 404)
  - `GET /api/devices/{device_id}/data` — 单设备历史区间(升序,默认近 24h,limit 1~10000)
- 数据来源:sensor_data 表(MQTT `Chen-Su-Yi/<client_id>` 采集入库),行结构:
  `id, device_id, sf, vf, fc, phf, tf, cf, settling_ratio, reported_at, received_at`
- **下文按"页面/功能 → 需要什么数据 → 现有接口能否满足"组织;差口汇总在 §4。**

## 1. 全局约定

- Base URL:`http://127.0.0.1:8000`,路径一律带 `/api` 前缀(与现有一致)。
- **CORS(必做,否则前端完全无法调用)**:前端开发跑在 `http://localhost:5173`,现有 api.py 未开 CORS,需加:
  ```python
  from fastapi.middleware.cors import CORSMiddleware
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
      allow_methods=["*"], allow_headers=["*"],
  )
  ```
- 字段风格:只读的 sensor 接口维持现状(snake_case + ISO 时间);**新增的存储型接口(告警/阈值/接收人)即前端 JSON 原样存取**,字段名与时间格式按 §4 样例,后端无需理解字段含义。
- 错误响应:沿用 FastAPI 默认 `{"detail": "..."}`;前端只做失败提示,不解析错误内容。
- 鉴权:v1 无(内网使用)。
- 调用频率:`latest` 类接口前端每 2 秒轮询一次,其余为低频操作;现有数据量级下无压力。

## 2. 页面/功能 → 数据需求

### 2.1 实时监控页(4 张设备卡片,每 2 秒轮询)

- 需要什么:4 台设备各自的**最新一条读数**(六参数 + 上报时间),一次快照全部拿到;个别设备没有数据时用 `null` 占位。
- 在线/离线判定**在前端做**(最新读数距今超过 13 分钟即离线——设备 13 分钟定时上报),后端不需要标记设备状态。
- 现有接口判定:
  - `GET /api/devices/{id}/latest` ✓ 可用——前端并发调 4 次,404 视为"从未上报"(按离线处理)。
  - ◐ **建议新增** `GET /api/readings/latest` 一次返回 4 台(省 3 次请求、省 404 处理),见 §4.4;不加也能跑,属可选优化。

### 2.2 设备详情抽屉(历史曲线)

- 需要什么:选定设备,取一段按时间**升序**的历史行(前端拿到后画 6 参数曲线,时间窗与条数由接口默认值控制即可——现有"近 24h、limit 1000"正合适)。
- 现有接口判定:`GET /api/devices/{device_id}/data` **✓ 完全满足,零改动**。
- 字段差异见 §3 对照表(前端侧适配,不需要后端改);唯一待确认:`settling_ratio` 与 `vf` 是否同义?前端 v1 以 `vf` 为准,不消费 `settling_ratio`;若 `settling_ratio` 才是权威列,请明确。

### 2.3 告警记录页

- 需要什么:告警记录的**列表 / 批量追加 / 按 id 更新 / 清空**。记录由**前端判定生成**(阈值越限、离线、10 分钟短信冷却、等级映射全在前端),后端只做存储;单表上限 500 条,超出丢弃最旧。
- 现有接口判定:✗ 无,需新增 4 个操作,见 §4.2。

### 2.4 阈值配置页(含短信接收人)

- 需要什么:
  - 阈值规则:4 设备 × 6 参数 = **24 条**,整体读取 / 整体保存(前端已做校验:low < high)。
  - 接收人:列表 / 添加(服务端生成 id)/ 删除;手机号规则 `^1\d{10}$`(前端已校验,后端兜底可选)。
- 现有接口判定:✗ 无,需新增,见 §4.3、§4.5。

### 2.5 短信通知(边界说明)

- v1 短信为**前端模拟**:告警产生后短信状态 `pending → sent/failed`(无接收人即 failed),10 分钟冷却;状态随告警记录一起存储(`sms` 字段),后端**不发送**短信。
- 二期建议(本期不做):把告警判定 + 真实短信网关移到后端(浏览器关了也能发)。届时前端只读 `sms.status`,本期存储结构已兼容,无需预留接口。

## 3. 字段对照表(sensor_data ↔ 前端模型)

| 前端字段 | sensor_data 列 | 说明 |
|---|---|---|
| `DeviceId` | `device_id` | `Di-Jiu-Shui-Chang-1` … `-4`,与 MQTT client_id 一致 |
| `params.Vf` | `vf` | 沉降比 % |
| `params.Sf` | `sf` | 沉降速度 m/h |
| `params.Fc` | `fc` | 流量 m³/h |
| `params.pHf` | `phf` | pH |
| `params.Tf` | `tf` | 温度 ℃ |
| `params.Cf` | `cf` | 余氯 mg/L |
| `timestamp` | `reported_at` | 前端用 epoch 毫秒数;ISO 字符串由前端适配层转换 |
| — | `settling_ratio` | 前端暂不消费;与 `vf` 的关系请后端确认(见 §2.2) |
| — | `id`、`received_at` | 前端不消费 |
| `Device` 静态档案(name/model/location/manager/image 等) | 无 | v1 前端用本地设备档案,**后端不需要提供**;将来要后端管理时扩展 `GET /api/devices` 即可(§4.6) |

## 4. 需要后端做的事(汇总)

| 优先级 | 事项 | 接口 | 状态 |
|---|---|---|---|
| **必做** | 开 CORS | (api.py 加中间件) | 改现有 |
| **必做** | 告警存储 | `GET/POST/PUT/DELETE /api/alarms` | 新增 |
| **必做** | 阈值规则 | `GET/PUT /api/thresholds` | 新增 |
| **必做** | 短信接收人 | `GET/POST/DELETE /api/receivers` | 新增 |
| 可选 | 4 台最新聚合 | `GET /api/readings/latest` | 新增(不加则前端用 4×`/latest`) |
| 可选 | 设备静态档案 | 扩展 `GET /api/devices` | 新增(v1 前端本地档案,不需要) |
| ~~可选~~ | ~~演示用离线开关~~ | ~~`POST /api/devices/{id}/simulate-offline`~~ | 前端"模拟离线"按钮已于 2026-10-08 移除,该接口不再有消费者(后端可留可删) |
| 已有 | 历史曲线 | `GET /api/devices/{device_id}/data` | 零改动 ✓ |
| 已有 | 单设备最新 | `GET /api/devices/{device_id}/latest` | 零改动 ✓(绕行方案使用) |

### 4.1 CORS(必做)

见 §1 代码片段。验收:`curl -s -D - -o /dev/null -H "Origin: http://localhost:5173" http://127.0.0.1:8000/api/devices | grep -i access-control` 应能看到 `access-control-allow-origin`。

### 4.2 告警存储(必做)

前端"生产"告警记录并推送过来,后端原样存取。记录结构(字段含义供阅读,**存储无需理解**;`time`/`sent_at` 为毫秒时间戳):

```json
{
  "id": "alarm-1728355600000-1",
  "time": 1728355600000,
  "device_id": "Di-Jiu-Shui-Chang-1",
  "param_key": "Vf",
  "type": "high",
  "value": 36.2,
  "threshold": 35,
  "level": "warning",
  "sms": { "status": "sent", "receivers": ["13800000000"], "sent_at": 1728355601200 }
}
```

整机离线告警时 `param_key = null`、`value = null`、`threshold = null`、`type = "offline"`、`level = "critical"`。`id` 由前端生成(`alarm-<毫秒>-<序号>`),后端原样存。

| 操作 | 约定 |
|---|---|
| `GET /api/alarms` | 返回全部记录(数组,追加顺序即可,展示排序前端自己做) |
| `POST /api/alarms` | 请求体为**记录数组**,追加保存;总量裁剪至最新 500 条;响应 `200 {}` |
| `PUT /api/alarms/{id}` | 请求体为单条完整记录,按 id 覆盖(**建议 upsert:不存在就插入,始终 200**,前端不处理 404) |
| `DELETE /api/alarms` | 清空;响应 `200 {}` |

样例:

```bash
curl -s -X POST http://127.0.0.1:8000/api/alarms -H 'Content-Type: application/json' -d '[{
  "id": "alarm-1728355600000-1", "time": 1728355600000,
  "device_id": "Di-Jiu-Shui-Chang-1", "param_key": "Vf", "type": "high",
  "value": 36.2, "threshold": 35, "level": "warning",
  "sms": {"status": "pending", "receivers": ["13800000000"]}
}]'
curl -s http://127.0.0.1:8000/api/alarms
curl -s -X DELETE http://127.0.0.1:8000/api/alarms
```

### 4.3 阈值规则(必做)

规则结构(24 条 = 4 设备 × 6 参数,`deviceId` ∈ `Di-Jiu-Shui-Chang-1..4`,`paramKey` ∈ `Vf/Sf/Fc/pHf/Tf/Cf`):

```json
{ "deviceId": "Di-Jiu-Shui-Chang-1", "paramKey": "Vf", "low": 5, "high": 35, "enabled": true }
```

| 操作 | 约定 |
|---|---|
| `GET /api/thresholds` | 返回 24 条;**无记录时返回下表默认值**(前端不兜底) |
| `PUT /api/thresholds` | 请求体为完整 24 条数组,整体覆盖;响应 `200 {}` |

默认表(4 台设备相同,`enabled` 全 `true`):

| paramKey | low | high |
|---|---|---|
| Vf | 5 | 35 |
| Sf | 0.5 | 3.5 |
| Fc | 800 | 1500 |
| pHf | 6.5 | 8.5 |
| Tf | 8 | 30 |
| Cf | 0.2 | 1.0 |

样例:

```bash
curl -s http://127.0.0.1:8000/api/thresholds
curl -s -X PUT http://127.0.0.1:8000/api/thresholds -H 'Content-Type: application/json' \
  -d '[{"deviceId":"Di-Jiu-Shui-Chang-1","paramKey":"Vf","low":5,"high":35,"enabled":true}]'
```

### 4.4 实时快照(可选,建议做)

`GET /api/readings/latest` — 一次返回 4 台设备各自最新一条;行结构与现有 `/latest` 相同,无数据的设备为 `null`:

```json
{
  "server_time": "2026-10-08T10:00:00",
  "readings": {
    "Di-Jiu-Shui-Chang-1": { "id": 123, "device_id": "Di-Jiu-Shui-Chang-1", "sf": 1.52, "vf": 14.0,
      "fc": 1180, "phf": 7.21, "tf": 18.6, "cf": 0.52, "settling_ratio": 14.0,
      "reported_at": "2026-10-08T09:59:58", "received_at": "2026-10-08T09:59:58" },
    "Di-Jiu-Shui-Chang-2": { "…": "…" },
    "Di-Jiu-Shui-Chang-3": { "…": "…" },
    "Di-Jiu-Shui-Chang-4": null
  }
}
```

实现自选(逐台取最新 / 窗口函数均可);`server_time` 供前端做离线判定基准。**若不加此接口,前端将并发调用现有 `GET /api/devices/{id}/latest` ×4 并把 404 视为 `null`,功能不受影响。**

### 4.5 短信接收人(必做)

| 操作 | 约定 |
|---|---|
| `GET /api/receivers` | 返回数组 `[{ "id": "rcv-1", "name": "张工", "phone": "13800000000" }]`,可为空 |
| `POST /api/receivers` | 请求体 `{ "name": "张工", "phone": "13800000000" }`;**id 由服务端生成**;返回创建后的完整对象(200/201 均可) |
| `DELETE /api/receivers/{id}` | 删除;响应 `200 {}`;id 不存在也返回 200(幂等) |

手机号校验 `^1\d{10}$`(前端已校验,后端兜底可选)。样例:

```bash
curl -s -X POST http://127.0.0.1:8000/api/receivers -H 'Content-Type: application/json' -d '{"name":"张工","phone":"13800000000"}'
curl -s http://127.0.0.1:8000/api/receivers
curl -s -X DELETE http://127.0.0.1:8000/api/receivers/rcv-1
```

### 4.6 其余可选

- **设备静态档案**:v1 前端用本地档案(name/model/location/manager/image 等),后端无需提供;将来若要后端管理,在现有 `GET /api/devices` 响应里补静态字段即可,前端届时切换。
- **演示用离线开关**(已废弃):v1 原为页面"模拟离线"按钮预留,前端已于 2026-10-08 移除该按钮——离线判定完全由"13 分钟无新数据"驱动,无人工入口。后端的空实现接口保留或删除均可,前端不再调用。

## 5. 验收自测清单(全部通过即对接就绪)

```bash
# 1) CORS
curl -s -D - -o /dev/null -H "Origin: http://localhost:5173" http://127.0.0.1:8000/api/devices | grep -i access-control
# 2) 历史(已有,应不变)
curl -s "http://127.0.0.1:8000/api/devices/Di-Jiu-Shui-Chang-1/data?limit=5"
# 3) 实时快照(若实现 §4.4)
curl -s http://127.0.0.1:8000/api/readings/latest
# 4) 阈值:首访返回 24 条默认值;PUT 后 GET 能取回
curl -s http://127.0.0.1:8000/api/thresholds
# 5) 告警:POST 一条 → GET 可见 → PUT 改 sms.status → DELETE 后为空
# 6) 接收人:POST 返回带 id 的对象 → GET 可见 → DELETE 后不可见
# 7) 告警超过 500 条时,GET 只返回最新 500 条
```

前端接入方式(前端侧工作,不由后端做):`.env.local` 设 `VITE_USE_MOCK=false` 与 `VITE_API_BASE=http://127.0.0.1:8000`,前端在 `src/api/http.ts` 统一发起请求并做 §3 的字段转换。

## 6. 后端确认(v1,2026-10-08)

后端已按本文档实现并通过 §5 全部七条验收(仓库 commit `62122fb`,api.py v0.2.0)。逐项确认:

- **§4.1 CORS** ✓ 已加(允许 `localhost:5173` 与 `127.0.0.1:5173`),验收命令返回 `access-control-allow-origin`。
- **§4.2 告警存储** ✓ 四操作全部实现。POST 批量追加按 id upsert,追加后自动裁剪保留最新 500 条(已实测 505→500,最旧的被裁);PUT 按 id upsert 始终 200;DELETE 清空;GET 按追加顺序返回。记录 JSON 原样存 `alarms.payload`(MySQL JSON 列),后端不解析字段含义。
- **§4.3 阈值规则** ✓ 空表 GET 返回代码默认 24 条(low/high 与 §4.3 默认表一致,enabled 全 true);PUT 校验字段(deviceId/paramKey/low/high 缺失或非数字返回 400),事务内整体覆盖。注:此表未来兼作二期后端检测器的配置源,结构不变。
- **§4.4 实时快照** ✓ 已实现。返回 `Di-Jiu-Shui-Chang-1..4` **加上 sensor_data 中出现过的其他设备**(当前库里有一台历史测试设备 `Di-Er-Shui-Chang-2` 也会出现在快照里,忽略即可),无数据为 null,含 `server_time`。
- **§4.5 接收人** ✓ id 服务端生成,格式 `rcv-<8 位十六进制>`;POST 返回完整对象;手机号后端兜底校验 `^1\d{10}$`(不合法返回 422);DELETE 幂等。
- **§4.6 simulate-offline** ✓ 空实现返回 `200 {}`。
- **§2.2 settling_ratio 问题答复**:`vf` 是权威列。发布端代码里 `Vf`(沉降比)是必发字段,`settling_ratio` 是可选补充参数(设备不携带时为 NULL),两者同单位。前端 v1 只消费 `vf` 是对的。
- **§2.3/§2.5 说明**:v1 告警判定在前端、后端只存储,按本文档执行;二期把判定+真实短信移到后端时,`thresholds` 表直接复用,前端无需变更接口。

对接期间接口若有字段/行为出入,在本节下追加条目沟通。

- **前端变更(2026-10-08)**:页面"模拟离线"按钮及前端 `toggleOffline`/`setDeviceOffline` 已彻底移除,快照模型不再含 `forcedOffline` 字段(后端快照本就未返回 `forced_offline`,无影响);`simulate-offline` 接口不再有前端消费者,保留或删除均可。离线告警链路仍由前端判定并测试覆盖(13 分钟无数据 → critical 告警)。

- **前端接入确认(v1,2026-10-08)**:前端已实现真实分支(http 层 + `src/api/adapters.ts` 字段适配),`.env.local` 设 `VITE_USE_MOCK=false` + `VITE_API_BASE=http://127.0.0.1:8000` 后冒烟通过——readings/latest 快照(正确忽略 `Di-Er-Shui-Chang-2`)、CORS、thresholds 默认表、alarms/receivers 空表 GET 均正常;测试套件 75/75,构建通过。注:1# 当前实测 Vf=2.0 低于阈值下限 5,页面按设计显示"异常"并生成告警,属真实数据下的预期行为。
