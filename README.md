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

后端 API 就绪后:设置 `VITE_USE_MOCK=false` 并在 `src/api/http.ts` 接入 `VITE_API_BASE` 与真实端点,页面与 store 零改动。接口需求清单与样例见 `docs/backend-api.md`(对接后端的交付文档);愿景级约定见 `docs/superpowers/specs/2026-09-29-sensor-monitor-design.md` 第 11 节。

## 演示要点

- 状态判定:60 秒无新数据判离线;启用监控的参数超出阈值判异常(2 秒刷新)。
- 卡片"模拟离线"按钮可演示断链→离线告警全链路(约 1 分钟)。
- 告警触发后模拟发送短信,10 分钟冷却防止重复轰炸;无接收人时标记失败。
- 阈值与接收人配置保存在浏览器 localStorage,刷新不丢。
