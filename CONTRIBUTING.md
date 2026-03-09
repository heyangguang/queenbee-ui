# 贡献指南

感谢你对 QueenBee Workstation 项目的关注！我们欢迎所有形式的贡献。

## 📋 目录

- [行为准则](#行为准则)
- [如何贡献](#如何贡献)
- [开发环境搭建](#开发环境搭建)
- [代码规范](#代码规范)
- [提交规范](#提交规范)
- [Pull Request 流程](#pull-request-流程)

---

## 行为准则

本项目遵循 [Contributor Covenant](https://www.contributor-covenant.org/) 行为准则。参与本项目即表示同意遵守此准则。

---

## 如何贡献

### 🐛 报告 Bug

1. 在 [Issues](https://github.com/heyangguang/queenbee-ui/issues) 中搜索是否已有相同问题
2. 创建新 Issue，包含：
   - 清晰的标题和复现步骤
   - 预期行为 vs 实际行为
   - 浏览器信息和截图
   - 控制台错误日志

### 💡 功能建议

在 Issues 中创建 Feature Request，描述功能概述和使用场景。

### 🔧 代码贡献

1. Fork 本仓库
2. 创建功能分支
3. 编写代码
4. 提交 Pull Request

---

## 开发环境搭建

### 前置要求

| 工具 | 最低版本 | 用途 |
|:-----|:--------|:-----|
| **Node.js** | 20+ | 运行环境 |
| **npm** | 10+ | 包管理 |
| **Git** | 2.x | 版本控制 |
| **QueenBee 后端** | 运行中 | API 服务 |

### 快速开始

```bash
# 1. Fork 并克隆
git clone https://github.com/YOUR_USERNAME/queenbee-ui.git
cd queenbee-ui

# 2. 安装依赖
npm install

# 3. 配置环境
cp .env.example .env.local
# 编辑 .env.local 设置后端地址

# 4. 启动开发服务器
npm run dev

# 5. 打开浏览器
open http://localhost:3000
```

---

## 代码规范

### TypeScript

- 使用严格的 TypeScript 类型
- 避免使用 `any`，优先使用明确的类型定义
- 组件使用 `React.FC` 或函数声明

### React 组件

```tsx
// ✅ 推荐：函数声明
export default function AgentCard({ agent }: { agent: Agent }) {
  return <div>{agent.name}</div>
}

// ✅ 推荐：独立类型声明
interface AgentCardProps {
  agent: Agent
  onEdit?: (id: string) => void
}
```

### 样式

- 使用 Tailwind CSS 类名
- 复杂样式组合使用 `cn()` 工具函数
- 设计 Token 在 `globals.css` 中定义

### 文件命名

| 类型 | 命名 | 示例 |
|:-----|:-----|:-----|
| 页面 | `page.tsx` | `app/agents/page.tsx` |
| 布局 | `layout.tsx` | `app/layout.tsx` |
| 组件 | kebab-case | `agent-card.tsx` |
| 工具 | camelCase | `utils.ts` |

---

## 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

| 类型 | 说明 | 示例 |
|:-----|:-----|:-----|
| `feat` | 新功能 | `feat(chat): 添加消息搜索功能` |
| `fix` | Bug 修复 | `fix(sidebar): 修复导航高亮问题` |
| `docs` | 文档 | `docs: 更新使用说明` |
| `style` | 样式变更 | `style(agent): 优化卡片间距` |
| `refactor` | 重构 | `refactor(hooks): 重构 usePolling` |

---

## Pull Request 流程

### 分支命名

```
feat/消息搜索
fix/sidebar-高亮
docs/使用说明更新
```

### 审查清单

- [ ] 通过 `npm run lint`
- [ ] 通过 `npm run build`（无构建错误）
- [ ] 组件有合理的类型定义
- [ ] 响应式布局正常
- [ ] 所有交互元素有唯一 ID

---

## 💬 联系方式

- **GitHub Issues** — Bug 报告和功能请求
- **Email** — [heyangev@gmail.com](mailto:heyangev@gmail.com)

---

感谢你的贡献！🐝
