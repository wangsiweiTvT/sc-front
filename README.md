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

真实后端已接入:项目根目录建 `.env.local`(git 忽略)写入两行——`VITE_USE_MOCK=false` 与 `VITE_API_BASE=http://127.0.0.1:8000`,再把后端跑起来(`python3 -m uvicorn api:app --port 8000`)即可;接口契约与验收清单见 `docs/backend-api.md`。不建该文件或删掉两行即回到模拟数据。打包部署时按部署环境设置同名变量。愿景级约定见 `docs/superpowers/specs/2026-09-29-sensor-monitor-design.md` 第 11 节。

## 演示要点

- 状态判定:13 分钟无新数据判离线(设备 13 分钟定时上报);启用监控的参数超出阈值判异常(2 秒刷新)。
- 卡片"模拟离线"按钮可演示断链→离线告警全链路(约 1 分钟)。
- 告警触发后模拟发送短信,10 分钟冷却防止重复轰炸;无接收人时标记失败。
- 阈值与接收人配置保存在浏览器 localStorage,刷新不丢。
