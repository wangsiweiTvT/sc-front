# Windows 部署与日常操作手册（全链路）

> 适用：在一台 Windows 机器上从零跑通「MySQL + 后端三服务 + 前端」的完整监控链路，以及日常启停与排障。
> 本手册放在 sc-front 仓库，但内容同时覆盖后端 sc-backend。路径以 `D:\sc_backend\sc-backend`（后端）、`D:\sc_front\sc-front`（前端，示例）为准，按实际调整。

## 0. 前置条件

| 依赖 | 说明 |
|---|---|
| Node.js LTS | 前端 `npm run dev` / `build` 用，官网安装包勾选 Add to PATH |
| Python 3.9 环境 | 本机 conda 环境 `sc-backend`，位于 `D:\Anaconda3\envs\sc-backend`（已建好） |
| MySQL 8.x | 本机安装，root 密码自定义；密码记好，后面 `.env` 要用；Windows 服务默认自启 |
| MQTT broker | 采集端默认连**本机** broker `127.0.0.1:1883`（代码常量：`app/mqtt_consumer.py` 的 `BROKER_HOST`）。本机演示需装一个 broker（如 mosquitto，装完服务自启）；若 broker 在别的机器，改该常量后重启采集端 |

> 本机的老 Anaconda（ProgramData 下，conda 4.5）**不要用来跑**：无 `conda init`、装包报权限错。统一用上面独立环境的全路径。

## 1. 数据库准备（一次性）

```powershell
cd D:\sc_backend\sc-backend

# mysql 不在 PATH 时用全路径，如 "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
# 1) 建库
mysql -uroot -p -e "CREATE DATABASE IF NOT EXISTS mqtt_data"

# 2) 导入表结构。注意：PowerShell 不支持 < 重定向，借 cmd 执行
cmd /c "mysql -uroot -p mqtt_data < schema.sql"

# 3) 验证：应列出 sensor_data / alarms / thresholds / receivers / detector_status 五张表
mysql -uroot -p -e "SHOW TABLES" mqtt_data
```

## 2. 后端部署（一次性）

```powershell
cd D:\sc_backend\sc-backend

# 独立 conda 环境全路径（$py 设置一次，本窗口后续命令都用它）
$py = "D:\Anaconda3\envs\sc-backend\python.exe"
& $py --version                       # 确认 Python 3.9.x

# 安装依赖（此前在 Anaconda base 里装会报 WinError 5，务必用这个 python）
& $py -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 配置文件：复制模板为 .env 并填入你的 MySQL 密码（.env 被 git 忽略，绝不进仓库）
copy .env.example .env
notepad .env                          # 只需改 DB_PASSWORD=<你的MySQL密码>，其余默认即可

mkdir logs                            # 日志目录（首次运行需要）
```

## 3. 启动后端服务

**所有命令都在后端仓库根目录执行**：代码在 `app/` 包里，模块名是 `app.xxx`。不在根目录、或把模块写成 `api:app`，就会报 `Could not import module "api"`。

三个常驻服务各开一个 PowerShell 窗口（**关窗口 = 停服务**，每个窗口都要先 `cd D:\sc_backend\sc-backend` 并重新设 `$py`）：

```powershell
# 窗口 1 —— 采集端：订阅 MQTT，数据入库
& $py -m app.mqtt_consumer

# 窗口 2 —— 检测器：每 10 秒扫库判定告警并发短信（浏览器关了它也在跑）
& $py -m app.anomaly_detector

# 窗口 3 —— REST API：给前端供数
& $py -m uvicorn app.api:app --port 8000

# 窗口 4（可选）—— 模拟发送端：无真实设备时模拟 4 台设备每 13 分钟上报
& $py -m app.mqtt_client
```

验证：

- 浏览器开 `http://127.0.0.1:8000/docs` → FastAPI 交互文档能打开；
- `http://127.0.0.1:8000/api/detector/status` → 返回 `{"running":true,...}`（检测器 60 秒内扫过即 true）。

## 4. 前端部署（一次性）

```powershell
cd D:\sc_front\sc-front        # 前端仓库目录，按实际路径调整
npm install

# 数据源开关：项目根目录建 .env.local（git 已忽略），两行：
#   VITE_USE_MOCK=false
#   VITE_API_BASE=http://127.0.0.1:8000
notepad .env.local

npm run dev                    # 开发模式，默认 http://localhost:5173
```

验证（三条齐了才算通）：

1. 顶栏出现绿色「**检测器运行中**」——mock 模式没有这个指示，它出现 = 已连上真实后端；
2. 四张设备卡片显示真实上报值，约 2 秒刷新一次；
3. F12 → Network 面板有发往 `127.0.0.1:8000` 的请求且状态 200。

**dev 与 build 的区别（重要）：**

| 方式 | 改 `.env.local` 之后 | 适合 |
|---|---|---|
| `npm run dev` | 重启 dev server 即生效 | 开发、调试、日常自用（**推荐**） |
| `npm run build` + `npm run preview` | 必须**重新 build**——环境变量在构建时打进产物 | 长期挂机给别人看 |

> 用 preview 时页面有数据但后端没开 ≠ 异常：说明上次构建时处于 mock 模式（内置模拟器不需要后端）。preview 跑的是上次 build 的产物，与当前 `.env.local` 无关。

## 5. 日常启停

开机后按顺序启动（每个服务一个窗口，命令见第 3、4 节）：

```
MySQL（Windows 服务，装机后自启，无需手动）
→ MQTT broker（若用）
→ 采集端 → 检测器 → API → 前端
```

当天不用了：逐窗口 Ctrl+C。前端 dev 窗口同理。

日志：各服务写 `logs\<服务名>.log`（consumer / detector / api / mqtt_client），超 10MB 自动轮转、旧文件保留 7 天。看实时日志：

```powershell
Get-Content logs\detector.log -Tail 20 -Wait
```

## 6. 故障排查

| 症状 | 原因 | 处理 |
|---|---|---|
| pip 安装报 `WinError 5 拒绝访问` | 装进了系统级 Anaconda base（无权限） | 改用独立环境全路径 `& $py -m pip ...`（第 2 节） |
| `conda activate` 报 `CommandNotFoundError` | 老 conda（4.5）没有 `conda init` | 用全路径方案；或开始菜单打开「Anaconda Prompt」 |
| uvicorn 报 `Could not import module "api"` | 不在后端仓库根目录，或模块名写成 `api:app` | `cd` 到仓库根目录，用 `app.api:app` |
| 启动即报 `RuntimeError: 缺少数据库密码` | 根目录没有 `.env` 或没填 `DB_PASSWORD` | 按第 2 节建 `.env` 并填密码 |
| 导 schema 报 `No database selected` / `<` 语法错 | 库没建，或用了 PowerShell 的 `<` 重定向 | 按第 1 节：先建库，再 `cmd /c "mysql ... < schema.sql"` |
| 页面空白/一直加载，Network 请求红色 | API 没起，或 `VITE_API_BASE` 写错 | 先浏览器开 `http://127.0.0.1:8000/docs` 自查后端 |
| Network 报 CORS / 跨域错误 | 页面来源不在后端白名单（当前仅 `localhost:5173` / `127.0.0.1:5173`） | 用 dev 默认地址 `http://localhost:5173` 访问；换端口/主机时改 `app/api.py` 的 `allow_origins` 后重启 API |
| 顶栏「检测器已停止」或接口 `running:false` | 检测器窗口挂了，或 60 秒内没扫描 | 看窗口 2 的报错与 `logs\detector.log` |
| 没起后端但页面有数据 | 前端跑在 mock 模式（`.env.local` 缺失或未生效） | 核对两行配置；dev 重启；build+preview 则重新 build |
| 采集端反复报 MQTT 连接失败 | 本机 1883 端口没有 broker | 装 mosquitto，或改 `BROKER_HOST` 指向实际 broker |
| API 报 MySQL 连不上 | MySQL 服务没起 / 端口 / 密码错 | `services.msc` 查 MySQL 服务；核对 `.env` 的 `DB_*` |

## 7. 安全红线

- `.env`（后端）与 `.env.local`（前端）均已被各自 `.gitignore` 忽略——**密码永远不进仓库**；
- 任何文档、聊天记录外发时不得包含真实密码；
- 换 MySQL 密码后：改 `.env` → 重启三个后端服务窗口。

---

系统结构、数据流与概念解释见 [system-guide.md](system-guide.md)；接口契约见 [backend-api.md](backend-api.md)。
