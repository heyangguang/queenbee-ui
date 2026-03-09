# 🐝 QueenBee Workstation 使用说明

本文档详细介绍 QueenBee Workstation 的使用方法，涵盖所有页面功能和操作指南。

---

## 📋 目录

- [快速开始](#快速开始)
- [Dashboard 首页](#dashboard-首页)
- [Chat 对话](#chat-对话)
- [Agent 管理](#agent-管理)
- [Team 管理](#team-管理)
- [消息队列](#消息队列)
- [Skill 管理](#skill-管理)
- [Project 管理](#project-管理)
- [Settings 配置](#settings-配置)
- [监控与日志](#监控与日志)

---

## 快速开始

### 1. 确保后端运行

QueenBee Workstation 需要连接到 [QueenBee 后端](https://github.com/heyangguang/queenbee)：

```bash
# 在后端仓库中
queenbee start
# 确认 http://localhost:3777 可用
```

### 2. 启动前端

```bash
cd queenbee-ui
npm run dev
```

### 3. 访问界面

打开浏览器访问 [http://localhost:3000](http://localhost:3000)

---

## Dashboard 首页

Dashboard 是系统的总览页面，通过 SSE（Server-Sent Events）实时更新数据。

### 核心指标

| 指标 | 说明 |
|:-----|:-----|
| **Agent 总数** | 已创建的 Agent 数量 |
| **在线 Agent** | 当前活跃的 Agent |
| **队列状态** | Pending / Processing / Completed / Dead 消息计数 |
| **响应时间** | 平均处理耗时 |

### 快捷入口

- 📤 **发送消息** — 快速进入 Chat 页面
- 🤖 **管理 Agent** — 跳转 Agent 列表
- 👥 **管理 Team** — 跳转 Team 列表
- 📬 **队列状态** — 查看消息队列详情

---

## Chat 对话

Chat 是与 Agent 直接交互的核心界面。

### 发送消息

1. 在输入框中输入消息
2. 使用 `@agent-name` 指定目标 Agent
3. 按 Enter 或点击发送按钮

```
@coder 请实现一个用户登录功能
```

### 功能特性

- **@mention 自动补全** — 输入 `@` 时自动提示可用 Agent
- **Markdown 渲染** — 支持代码块、表格、列表等 GFM 语法
- **SSE 流式响应** — Agent 回复实时推送显示
- **对话历史** — 浏览和搜索历史聊天记录

---

## Agent 管理

### 创建 Agent

1. 进入 **Agents** 页面
2. 点击 **创建 Agent** 按钮
3. 填写配置：
   - **名称** — Agent 的唯一标识（用于 @mention）
   - **描述** — Agent 的职责描述
   - **Provider** — AI 服务商（Anthropic / Google / OpenAI / OpenCode）
   - **Model** — 使用的模型（留空使用默认）
   - **Fallback Provider** — 备用服务商
   - **系统提示词** — Agent 的行为指令

### 管理 Agent

| 操作 | 说明 |
|:-----|:-----|
| **编辑** | 修改 Agent 配置和 Prompt |
| **查看 Soul** | 读取 Agent 的 SOUL.md 自省文件 |
| **管理技能** | 添加或移除 Agent 的技能 |
| **重置** | 重置 Agent 对话状态 |
| **强制终止** | 终止 Agent 正在运行的进程 |
| **删除** | 删除 Agent（不可恢复） |

---

## Team 管理

### 创建 Team

1. 进入 **Teams** 页面
2. 点击 **创建 Team**
3. 设置：
   - **Team 名称** — 团队标识
   - **Leader Agent** — 团队负责人（接收 @team-name 消息）
   - **成员列表** — 添加团队成员

### 成员管理

- **拖拽排序** — 通过拖拽调整成员顺序
- **添加/移除** — 管理团队成员组成
- **项目关联** — 绑定 Team 到特定项目目录

---

## 消息队列

### 队列状态

| 状态 | 说明 |
|:-----|:-----|
| **Pending** | 等待处理的消息 |
| **Processing** | 正在处理中的消息 |
| **Completed** | 已完成的消息 |
| **Dead** | 失败 5 次后进入死信队列 |

### 操作

| 操作 | 说明 |
|:-----|:-----|
| **查看详情** | 展开查看消息内容和状态 |
| **重试死信** | 将死信消息重新放入队列 |
| **恢复 Processing** | 将卡住的消息恢复到 Pending |
| **删除** | 永久删除消息 |

---

## Skill 管理

### 创建技能

1. 进入 **Skills** 页面
2. 点击 **创建技能**
3. 填写：
   - **名称** — 技能标识
   - **描述** — 技能功能描述
   - **内容** — SKILL.md 内容（Markdown 格式）
   - **允许的工具** — Agent 使用此技能时可用的工具列表

### 操作

| 操作 | 说明 |
|:-----|:-----|
| **导入内置技能** | 从文件系统导入预设技能 |
| **扫描 CLI 技能** | 扫描各 CLI 已安装的全局技能 |
| **分配给 Agent** | 将技能挂载到指定 Agent |
| **编辑/删除** | 修改或删除技能定义 |

---

## Project 管理

### 创建项目

1. 进入 **Projects** 页面
2. 点击 **创建项目**
3. 设置：
   - **项目名称**
   - **本地目录路径** — 绑定到本地代码目录
   - **描述**

### 项目关联

- 将 Team 绑定到特定项目，Agent 工作在对应的代码目录中
- 项目级记忆隔离，不同项目的 Agent 记忆互不影响

---

## Settings 配置

### 配置项

| 配置 | 说明 |
|:-----|:-----|
| **默认 Provider** | 默认的 AI 服务商 |
| **默认 Model** | 默认使用的模型 |
| **压缩阈值** | 触发上下文压缩的字符数（默认 8000） |
| **超时时间** | Agent 调用的超时时间 |
| **Heartbeat** | 心跳检测间隔 |

---

## 监控与日志

### Monitor 系统监控

实时显示：
- **OS 信息** — 操作系统、架构
- **内存使用** — 已用/总量
- **Goroutine 数** — 当前并发 goroutine 数量

### Logs 日志查看

- **队列日志** — 消息处理记录
- **错误日志** — 系统错误信息
- **调试日志** — 详细调试信息

### Dead Letters 死信消息

- 查看失败消息的详细信息
- 分析失败原因
- 一键重试或删除

---

## 键盘快捷键

| 快捷键 | 功能 |
|:-------|:-----|
| `Enter` | 发送消息 |
| `Shift + Enter` | 消息框内换行 |
| `Esc` | 关闭弹窗/对话框 |

---

## 更多资源

- [README — 项目概述](../README.md)
- [BUILD — 构建手册](BUILD.md)
- [CONTRIBUTING — 贡献指南](../CONTRIBUTING.md)
- [QueenBee 后端](https://github.com/heyangguang/queenbee)
