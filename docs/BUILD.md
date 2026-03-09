# 🔨 QueenBee Workstation 构建手册

本文档详细介绍 QueenBee Workstation 的构建、开发和部署流程。

---

## 📋 目录

- [环境要求](#环境要求)
- [本地开发](#本地开发)
- [生产构建](#生产构建)
- [Docker 部署](#docker-部署)
- [环境变量](#环境变量)
- [代码质量](#代码质量)
- [CI/CD](#cicd)
- [常见问题](#常见问题)

---

## 环境要求

### 必需工具

| 工具 | 最低版本 | 安装方式 | 用途 |
|:-----|:--------|:--------|:-----|
| **Node.js** | 20+ | [nodejs.org](https://nodejs.org/) / `brew install node` | 运行环境 |
| **npm** | 10+ | 随 Node.js 安装 | 包管理 |
| **Git** | 2.x | `brew install git` | 版本控制 |

### 运行时依赖

| 依赖 | 说明 |
|:-----|:-----|
| **QueenBee 后端** | 必须运行中，默认地址 `http://localhost:3777` |

### 环境验证

```bash
# 检查 Node.js
node --version
# 期望: v20.x 或更高

# 检查 npm
npm --version
# 期望: 10.x 或更高

# 检查后端是否运行
curl http://localhost:3777/api/health
# 期望: {"status": "ok"}
```

---

## 本地开发

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/heyangguang/queenbee-ui.git
cd queenbee-ui

# 安装依赖
npm install

# 配置环境变量
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3777
EOF

# 启动开发服务器（支持热重载）
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可使用。

### 开发服务器特性

- **热重载 (HMR)** — 修改代码后自动刷新
- **TypeScript 类型检查** — 实时类型错误提示
- **Tailwind CSS JIT** — 按需编译样式
- **Fast Refresh** — React 组件级热更新

### 目录结构

```
queenbee-ui/
├── public/assets/            # 静态资源（图片、图标等）
├── src/
│   ├── app/                  # Next.js App Router 页面
│   ├── components/           # 可复用 React 组件
│   │   ├── ui/               # 基础 UI 组件 (Radix UI)
│   │   ├── chat-view.tsx     # 聊天核心组件
│   │   └── sidebar.tsx       # 导航侧边栏
│   └── lib/                  # 工具库
│       ├── hooks.ts          # 自定义 React Hooks
│       └── utils.ts          # API 客户端 + 工具函数
├── .env.local                # 本地环境变量（不提交）
├── next.config.ts            # Next.js 配置
├── tailwind.config.ts        # Tailwind CSS 配置（如有）
├── tsconfig.json             # TypeScript 配置
└── package.json              # 项目配置和脚本
```

---

## 生产构建

### 构建

```bash
# 执行生产构建
npm run build
```

构建产物在 `.next/` 目录中。

### 启动生产服务

```bash
# 构建后启动
npm start
```

默认监听 `http://localhost:3000`。

### 构建优化

Next.js 生产构建自动包含以下优化：
- **代码分割** — 按路由自动分割 JavaScript
- **Tree Shaking** — 移除未使用的代码
- **CSS 压缩** — 压缩 Tailwind CSS 输出
- **图片优化** — 自动压缩和格式转换
- **静态预渲染** — 可静态化的页面预渲染为 HTML

### 分析构建产物

```bash
# 安装分析工具（可选）
npm install @next/bundle-analyzer

# 在 next.config.ts 中启用后执行
ANALYZE=true npm run build
```

---

## Docker 部署

### Dockerfile

```dockerfile
# 依赖安装阶段
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

# 构建阶段
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 运行阶段
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
```

### Docker 命令

```bash
# 构建镜像
docker build -t queenbee-ui:latest .

# 运行
docker run -d \
  --name queenbee-ui \
  -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=http://host.docker.internal:3777 \
  queenbee-ui:latest

# 查看日志
docker logs -f queenbee-ui
```

### Docker Compose（推荐）

```yaml
version: '3.8'

services:
  queenbee:
    image: queenbee:latest
    ports:
      - "3777:3777"
    volumes:
      - queenbee-data:/data

  queenbee-ui:
    image: queenbee-ui:latest
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://queenbee:3777
    depends_on:
      - queenbee

volumes:
  queenbee-data:
```

```bash
docker compose up -d
```

---

## 环境变量

### 必需变量

| 变量 | 说明 | 默认值 | 示例 |
|:-----|:-----|:------|:-----|
| `NEXT_PUBLIC_API_URL` | QueenBee 后端 API 地址 | `http://localhost:9876` | `http://192.168.1.100:3777` |

### 可选变量

| 变量 | 说明 | 默认值 |
|:-----|:-----|:------|
| `PORT` | 前端服务端口 | `3000` |
| `NEXT_TELEMETRY_DISABLED` | 禁用 Next.js 遥测 | `1` |

### 环境变量文件

```bash
# .env.local（本地开发，不提交到 Git）
NEXT_PUBLIC_API_URL=http://localhost:3777

# .env.production（生产环境）
NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

---

## 代码质量

### Lint 检查

```bash
# ESLint 代码检查
npm run lint

# 自动修复
npm run lint -- --fix
```

### 类型检查

```bash
# TypeScript 类型检查
npx tsc --noEmit
```

### 格式化

```bash
# 如安装了 Prettier
npx prettier --write "src/**/*.{ts,tsx,css}"
```

---

## CI/CD

### GitHub Actions

项目使用 GitHub Actions 进行持续集成，配置在 `.github/workflows/ci.yml`：

每次 push 和 PR 自动执行：
1. `npm ci` — 安装依赖
2. `npm run lint` — 代码质量检查
3. `npm run build` — 构建验证

---

## 常见问题

### LightningCSS 安装失败

```
Error: Cannot find module 'lightningcss.darwin-arm64.node'
```

**解决方法**：

```bash
# 清理并重新安装
rm -rf node_modules package-lock.json
npm install
```

### 后端连接失败

```
TypeError: Failed to fetch
```

**解决方法**：
1. 确认后端已启动：`curl http://localhost:3777/api/health`
2. 检查 `.env.local` 中的 `NEXT_PUBLIC_API_URL`
3. 确认没有 CORS 问题

### 端口冲突

```
Error: listen EADDRINUSE: address already in use :::3000
```

**解决方法**：

```bash
# 查找占用端口的进程
lsof -i :3000

# 终止进程
kill -9 <PID>

# 或使用其他端口
PORT=3001 npm run dev
```

### 构建内存不足

```
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed
```

**解决方法**：

```bash
# 增加 Node.js 内存限制
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### 热重载不工作

**解决方法**：
1. 确认文件保存成功
2. 检查 `next.config.ts` 配置
3. 清理 `.next` 缓存：`rm -rf .next && npm run dev`

---

## 更多资源

- [README — 项目概述](../README.md)
- [USAGE — 使用说明](USAGE.md)
- [CONTRIBUTING — 贡献指南](../CONTRIBUTING.md)
- [Next.js 文档](https://nextjs.org/docs)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
