<div align="center">

<img src="docs/assets/hero-banner.png" alt="QueenBee Workstation" width="100%" />

# 🐝 QueenBee Workstation

### Multi-Agent 管理与监控 Web 界面

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Apache_2.0-yellow?style=for-the-badge)](LICENSE)

**QueenBee Workstation 是 [QueenBee](https://github.com/heyangguang/queenbee) 多 Agent 引擎的 Web 管理界面。** 实时监控 Agent 状态、管理 Team 协作、查看消息队列、配置技能与记忆——通过一个高密度的 Dashboard 掌控整个 Agent 集群。

[Getting Started](#-getting-started) · [Features](#-features) · [Tech Stack](#-tech-stack) · [Contributing](#-contributing)

</div>

---

## ✨ Features

### 📊 实时 Dashboard
首页仪表盘通过 SSE 实时展示系统全景：
- **Agent 统计** — 总数、在线/离线、活跃对话数
- **队列状态** — Pending / Processing / Completed / Dead 消息计数
- **响应时间** — 平均处理耗时、趋势图
- **快捷入口** — 一键跳转到 Agent、Team、队列管理

### 💬 Chat 交互界面
与 Agent 直接对话的核心界面：
- **@mention 路由** — 在消息中 `@agent-name` 定向发送
- **实时流式响应** — SSE 推送 Agent 回复
- **Markdown 渲染** — 支持 GFM（代码块、表格、列表）
- **对话历史** — 浏览和搜索历史聊天记录

### 🤖 Agent 管理
全生命周期 Agent 管理：
- **创建 / 编辑** — 配置名称、Provider、Model、Fallback Provider
- **Prompt 编辑** — 查看和修改 Agent 系统提示词
- **Soul 查看** — 读取 Agent 的 SOUL.md 自省文件
- **技能装卸** — 为 Agent 添加或移除 Skill
- **重置 / 强杀** — 重置 Agent 状态或强制终止运行中的进程

### 👥 Team 管理
组织 Agent 为协作团队：
- **Team 创建** — 设置 Team 名称、Leader Agent 和成员列表
- **成员管理** — 拖拽排序、添加移除成员
- **项目关联** — 绑定 Team 到特定项目目录

### 📬 消息队列监控
完整的队列可观测性：
- **队列状态** — 实时 Pending/Processing/Completed/Dead 计数
- **死信管理** — 查看失败消息、一键重试或删除
- **Processing 恢复** — 恢复卡住的消息到 Pending 状态
- **排队消息** — 查看等待处理的消息详情

### 🧩 Skill 管理
集中式技能管理：
- **技能定义 CRUD** — 创建、编辑、删除技能定义
- **Agent 挂载** — 按需将技能分配给不同 Agent
- **内置技能导入** — 一键从文件系统导入内置技能
- **CLI 全局技能** — 扫描各 CLI 已安装的全局技能

### 📂 Project 管理
多项目工作空间：
- **项目列表** — 创建和管理多个项目
- **目录关联** — 绑定项目到本地代码目录
- **项目级记忆** — 按项目隔离 Agent 记忆

### ⚙️ Settings 配置
全局系统配置：
- **Provider 切换** — 默认 AI Provider 和模型配置
- **环境变量** — API Key 等敏感配置
- **压缩阈值** — 上下文压缩触发字符数
- **超时设置** — Agent 调用超时时间

### 📋 辅助功能
- **Logs 查看** — 队列日志、错误日志、调试日志
- **Monitor 监控** — 系统状态（OS、内存、Goroutine）
- **Dead Letters** — 死信消息详细信息和重试操作
- **Conversations** — 历史对话浏览

---

## 🚀 Getting Started

### 前置要求

- **Node.js** 20+
- **npm** 10+
- 运行中的 [QueenBee 后端](https://github.com/heyangguang/queenbee)（默认 `localhost:9876`）

### 安装

```bash
# 克隆仓库
git clone https://github.com/heyangguang/queenbee-ui.git
cd queenbee-ui

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可使用。

### 环境配置

创建 `.env.local`：

```env
# QueenBee 后端地址
NEXT_PUBLIC_API_URL=http://localhost:9876
```

### 生产构建

```bash
npm run build
npm start
```

---

## 🛠 Tech Stack

| 类别 | 技术 | 用途 |
|:-----|:-----|:-----|
| **框架** | [Next.js 16](https://nextjs.org/) | App Router, SSR |
| **UI** | [React 19](https://react.dev/) | 组件架构 |
| **语言** | [TypeScript 5](https://www.typescriptlang.org/) | 类型安全 |
| **样式** | [Tailwind CSS 4](https://tailwindcss.com/) | 原子化 CSS |
| **组件** | [Radix UI](https://www.radix-ui.com/) | 无障碍基础组件 |
| **图标** | [Lucide React](https://lucide.dev/) | 图标库 |
| **Markdown** | [react-markdown](https://github.com/remarkjs/react-markdown) + [remark-gfm](https://github.com/remarkjs/remark-gfm) | GFM 渲染 |
| **拖拽** | [@dnd-kit](https://dndkit.com/) | 拖拽排序交互 |

---

## 📁 Project Structure

```
queenbee-ui/
├── public/assets/            # 静态资源
├── src/
│   ├── app/                  # 📱 Next.js App Router
│   │   ├── page.tsx          #   Dashboard 首页（实时统计 + 快捷入口）
│   │   ├── layout.tsx        #   根布局
│   │   ├── globals.css       #   全局样式 + 设计 Token
│   │   ├── chat/             #   💬 Agent 对话界面
│   │   ├── agents/           #   🤖 Agent CRUD + Prompt + Soul + Skill
│   │   ├── teams/            #   👥 Team 管理
│   │   ├── projects/         #   📂 项目管理
│   │   ├── skills/           #   🧩 技能定义管理
│   │   ├── office/           #   🏢 工作空间概览
│   │   ├── settings/         #   ⚙️ 系统配置
│   │   ├── monitor/          #   📊 系统监控
│   │   ├── logs/             #   📋 日志查看
│   │   ├── conversations/    #   💭 历史对话
│   │   └── dead-letters/     #   📮 死信消息
│   ├── components/           # 🧱 可复用组件
│   │   ├── ui/               #   基础 UI 组件 (Button, Card, Dialog...)
│   │   ├── chat-view.tsx     #   核心聊天组件（Markdown + SSE 流式）
│   │   └── sidebar.tsx       #   导航侧边栏
│   └── lib/                  # 📚 工具库
│       ├── hooks.ts          #   usePolling, useSSE 等自定义 Hook
│       └── utils.ts          #   API 客户端函数
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## 🧪 开发

```bash
# 开发模式（热重载）
npm run dev

# 生产构建
npm run build

# Lint 检查
npm run lint
```

---

## 🤝 Contributing

欢迎贡献！

1. **Fork** 本仓库
2. **创建分支** (`git checkout -b feat/new-feature`)
3. **提交** (`git commit -m 'feat: 添加新功能'`)
4. **推送** (`git push origin feat/new-feature`)
5. **创建 Pull Request**

---

## 📄 License

**Apache License 2.0** — 详见 [LICENSE](LICENSE)。

---

## 👤 Author

<table>
<tr>
<td align="center">
<a href="https://github.com/heyangguang">
<img src="https://github.com/heyangguang.png" width="100px;" alt="Kuber" /><br />
<sub><b>Kuber</b></sub>
</a><br />
<a href="mailto:heyangev@gmail.com">📧 heyangev@gmail.com</a>
</td>
</tr>
</table>

---

## 🔗 Related

| 项目 | 说明 |
|:-----|:-----|
| [queenbee](https://github.com/heyangguang/queenbee) | 🐝 Go 后端引擎 — 消息队列 + Agent 调度 |
| [queenbee-ui](https://github.com/heyangguang/queenbee-ui) | 🖥 本仓库 — Web 管理界面 |

---

<div align="center">

**Built with 🐝 by the QueenBee Community**

[⭐ Star us on GitHub](https://github.com/heyangguang/queenbee-ui) — 你的支持是我们的动力！

</div>
