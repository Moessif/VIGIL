# 🛡️ 警心护航 · 沉浸式反诈科普平台

面向警校生与公安实际需求的人工智能（AI+）教育赋能平台。通过「主线 AI 动态导演 + 多模态拟真交互（文本/图片/语音/实时电话）」把用户放进高度拟真的诈骗情境中"做中学"，并以四维能力画像（身份核验 / 资金安全 / 隐私保护 / 应急处置）量化反诈能力。

## 功能总览

- **训练中心**：推荐情景、情景列表（未练过/失败重来/复习）、本周四维能力。
- **情景训练引擎**：剧本 DSL 护栏 + 主线 AI 导演，动态编排剧情；支持自由文本与选项回复、图片/语音消息、虚拟电话（实时语音）；"转账/报警/拉黑"等关键决策随时触发结局与复盘。
- **案例库**：全部情景 + 个人成绩、解锁结局、诈骗类型、难度、历史趋势折线图。
- **能力报告**：战绩、能力段位、四维雷达图、能力趋势。
- **学习记录**：训练流水，可跳转案例详情。
- **管理后台**：AI 供应商/API Key 统一管理、用户管理（重置密码/权限）、情景增删改查、数据库概览。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + TypeScript + Vite + Pinia + Vue Router + Tailwind CSS v4 + ECharts |
| 后端 | NestJS + TypeScript |
| 持久化 | 内置 `node:sqlite`（零外部依赖，生产可平滑切换 PostgreSQL） |
| AI | 主线 `deepseek-v4-pro`（DeepSeek 官方 API）、图片 `qwen-image-3.0-pro`、语音 `qwen-audio-3.0-tts-plus`、实时语音 `qwen-audio-3.0-realtime-plus`（阿里云百炼） |
| 实时语音 | WebSocket 双桥接（浏览器 ⇄ 网关 ⇄ 千问 S2S），支持打断/语气/停顿/喘气 |

## 目录结构

```
policehagent/
├── apps/
│   ├── server/        # NestJS 后端
│   └── web/           # Vue3 前端
├── packages/
│   └── shared/        # 前后端共享类型 + 剧本 DSL 规范
├── pnpm-workspace.yaml
└── package.json
```

## 快速开始

### 环境要求

- Node.js ≥ 20（本项目开发环境为 Node 24）
- pnpm ≥ 10

### 一键启动 / 一键关闭（Windows）

项目根目录提供了两个双击即用的脚本：

| 脚本 | 作用 |
|---|---|
| `start.bat` | 一键启动：首次自动安装依赖，然后启动前后端（前端 5173 / 后端 3000） |
| `stop.bat` | 一键关闭：停止占用 3000/5173 端口的进程及 `concurrently/nest/vite` 开发进程 |

> 也可手动操作：启动用 `pnpm dev`，关闭直接结束对应终端窗口。

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量（可选）

后端默认以 **mock 模式**运行，无需任何 API Key 即可跑通完整训练闭环（图片返回 SVG 占位图、语音由浏览器 `speechSynthesis` 朗读）。

如需接入真实 AI，复制并填写环境变量：

```bash
cp apps/server/.env.example apps/server/.env
# 编辑 .env：设置 AI_MODE=real 并填入 API Key
```

| 变量 | 说明 |
|---|---|
| `AI_MODE` | `mock`（默认，无 Key 可用）/ `real`（调用真实 API） |
| `DEEPSEEK_API_KEY` | 主线 AI（DeepSeek 官方 API） |
| `QWEN_API_KEY` | 千问图片/语音/实时语音（阿里云） |

> API Key 也可在**管理后台 → AI 供应商 → 设置密钥**中动态填写（AES-256-GCM 加密落库，界面仅显示掩码）。

### 3. 启动

一键启动前后端（自动先构建共享包）：

```bash
pnpm dev
```

- 前端：http://localhost:5173
- 后端：http://localhost:3000/api

分别启动：

```bash
pnpm dev:server   # 后端
pnpm dev:web      # 前端
```

### 4. 使用

1. 打开 http://localhost:5173 注册账号（用户名/密码/学校/学历）。
2. 进入「训练中心」选择情景开始训练。
3. 在聊天中回复（选项或自由输入），或使用底部决策栏（转账/报警/拉黑）触发结局。
4. 训练结束查看四维评分与复盘，并在「能力报告」「学习记录」「案例库」中查看成长。

> **初始管理员**：首次启动会自动创建管理员账号 `admin` / `admin123456`（可在 `.env` 的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 修改）。登录后即可进入「管理后台」。

## 生产构建

```bash
pnpm build           # 构建 shared + server + web
pnpm start           # 运行已构建的后端
```

## 实时语音（S2S 虚拟电话）

情景中的「虚拟电话」在真实模式下支持**双向实时语音**：浏览器麦克风 ⇄ 后端网关（`ws://…/api/realtime-call`）⇄ 千问 `qwen-audio-3.0-realtime-plus`（OpenAI Realtime 风格事件协议，`server_vad` 自动轮次检测、支持打断）。接听来电后即可直接说话与对方实时对话，挂断后仍可用选项/文本继续推进剧情。

- 后端网关：`apps/server/src/modules/ai/realtime.gateway.ts`（挂在 Nest HTTP Server 上）。
- 前端：`apps/web/src/composables/useRealtimeCall.ts`（麦克风 PCM16 采集 + 回放，需浏览器授权麦克风）。
- 失败自动降级：实时语音不可用时，回退为「TTS 语音消息 + 选项/文本回复」，训练不中断。

## AI 编排设计

后端统一通过 `AiService`（编排层）+ `AiConfigService`（供应商/密钥管理）访问模型：

- **模型抽象**：`main_chat` / `image` / `tts` / `realtime` 四类 Provider，统一接口，可插拔。
- **接入方式**（均已实测）：主线 `deepseek-v4-pro`（DeepSeek 官方 `/chat/completions`）、图片 `qwen-image-3.0-pro`（百炼 `/api/v1/services/aigc/multimodal-generation/generation`）、语音 `qwen-audio-3.0-tts-plus`（百炼 `/api/v1/services/audio/tts/SpeechSynthesizer`）、实时 `qwen-audio-3.0-realtime-plus`（`wss://…/api-ws/v1/realtime`）。
- **降级链**：主线 AI 失败回退规则剧本；图片失败回退占位图；语音失败由浏览器朗读兜底——**训练永不中断**。
- **剧本护栏**：主线 AI 的所有输出都约束在剧本 DSL（角色/通道/结局）内，安全可控、可复现。

## 说明

本项目仅供反诈科普教育用途，训练话术均来自公开反诈宣传素材。
