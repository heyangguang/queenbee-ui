<div align="center">

<img src="docs/assets/hero-banner.png" alt="QueenBee Workstation" width="100%" />

# 🐝 QueenBee Workstation

### Multi-Agent Management & Monitoring Web Interface

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Apache_2.0-yellow?style=for-the-badge)](LICENSE)

**[中文](README.md) | English | [日本語](README_JA.md)**

**QueenBee Workstation is the web management interface for the [QueenBee](https://github.com/heyangguang/queenbee) multi-agent engine.** Monitor agent status in real-time, manage team collaboration, inspect message queues, configure skills and memory — all from a high-density dashboard that gives you full control over your entire agent cluster.

[Getting Started](#-getting-started) · [Features](#-features) · [Tech Stack](#-tech-stack) · [Contributing](#-contributing)

</div>

---

## ✨ Features

### 📊 Real-Time Dashboard
The homepage dashboard displays a system-wide overview via SSE:
- **Agent Stats** — Total count, online/offline, active conversation count
- **Queue Status** — Pending / Processing / Completed / Dead message counts
- **Response Time** — Average processing time, trend charts
- **Quick Access** — One-click navigation to Agent, Team, and Queue management

### 💬 Chat Interface
The core interface for direct conversation with agents:
- **@mention Routing** — Send targeted messages with `@agent-name`
- **Real-Time Streaming** — SSE-pushed agent responses
- **Markdown Rendering** — GFM support (code blocks, tables, lists)
- **Conversation History** — Browse and search past conversations

### 🤖 Agent Management
Full lifecycle agent management:
- **Create / Edit** — Configure name, provider, model, fallback provider
- **Prompt Editing** — View and modify agent system prompts
- **Soul Viewing** — Read the agent's SOUL.md self-reflection file
- **Skill Management** — Add or remove skills for agents
- **Reset / Kill** — Reset agent state or force-terminate running processes

### 👥 Team Management
Organize agents into collaborative teams:
- **Team Creation** — Set team name, leader agent, and member list
- **Member Management** — Drag-and-drop sorting, add/remove members
- **Project Binding** — Bind teams to specific project directories

### 📬 Message Queue Monitoring
Complete queue observability:
- **Queue Status** — Real-time Pending/Processing/Completed/Dead counts
- **Dead Letter Management** — View failed messages, one-click retry or delete
- **Processing Recovery** — Recover stuck messages back to Pending status
- **Pending Messages** — View details of messages waiting to be processed

### 🧩 Skill Management
Centralized skill management:
- **Skill Definition CRUD** — Create, edit, delete skill definitions
- **Agent Mounting** — Assign skills to different agents on demand
- **Built-in Skill Import** — One-click import of built-in skills from file system
- **CLI Global Skills** — Scan globally installed skills for each CLI

### 📂 Project Management
Multi-project workspace:
- **Project List** — Create and manage multiple projects
- **Directory Binding** — Bind projects to local code directories
- **Project-Level Memory** — Isolate agent memory by project

### ⚙️ Settings
Global system configuration:
- **Provider Switching** — Default AI provider and model configuration
- **Environment Variables** — API keys and sensitive configuration
- **Compaction Threshold** — Character count for context compaction trigger
- **Timeout Settings** — Agent invocation timeout duration

### 📋 Auxiliary Features
- **Log Viewer** — Queue logs, error logs, debug logs
- **Monitor** — System status (OS, Memory, Goroutine)
- **Dead Letters** — Detailed dead letter information and retry operations
- **Conversations** — Browse historical conversations

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20+
- **npm** 10+
- Running [QueenBee Backend](https://github.com/heyangguang/queenbee) (default `localhost:9876`)

### Installation

```bash
# Clone repository
git clone https://github.com/heyangguang/queenbee-ui.git
cd queenbee-ui

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the application.

### Environment Configuration

Create `.env.local`:

```env
# QueenBee backend URL
NEXT_PUBLIC_API_URL=http://localhost:9876
```

### Production Build

```bash
npm run build
npm start
```

---

## 🛠 Tech Stack

| Category | Technology | Purpose |
|:---------|:-----------|:--------|
| **Framework** | [Next.js 16](https://nextjs.org/) | App Router, SSR |
| **UI** | [React 19](https://react.dev/) | Component architecture |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) | Type safety |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/) | Atomic CSS |
| **Components** | [Radix UI](https://www.radix-ui.com/) | Accessible base components |
| **Icons** | [Lucide React](https://lucide.dev/) | Icon library |
| **Markdown** | [react-markdown](https://github.com/remarkjs/react-markdown) + [remark-gfm](https://github.com/remarkjs/remark-gfm) | GFM rendering |
| **Drag & Drop** | [@dnd-kit](https://dndkit.com/) | Drag-and-drop sorting |

---

## 📁 Project Structure

```
queenbee-ui/
├── public/assets/            # Static assets
├── src/
│   ├── app/                  # 📱 Next.js App Router
│   │   ├── page.tsx          #   Dashboard (real-time stats + quick access)
│   │   ├── layout.tsx        #   Root layout
│   │   ├── globals.css       #   Global styles + design tokens
│   │   ├── chat/             #   💬 Agent chat interface
│   │   ├── agents/           #   🤖 Agent CRUD + Prompt + Soul + Skill
│   │   ├── teams/            #   👥 Team management
│   │   ├── projects/         #   📂 Project management
│   │   ├── skills/           #   🧩 Skill definition management
│   │   ├── office/           #   🏢 Workspace overview
│   │   ├── settings/         #   ⚙️ System configuration
│   │   ├── monitor/          #   📊 System monitoring
│   │   ├── logs/             #   📋 Log viewer
│   │   ├── conversations/    #   💭 Historical conversations
│   │   └── dead-letters/     #   📮 Dead letter messages
│   ├── components/           # 🧱 Reusable components
│   │   ├── ui/               #   Base UI components (Button, Card, Dialog...)
│   │   ├── chat-view.tsx     #   Core chat component (Markdown + SSE streaming)
│   │   └── sidebar.tsx       #   Navigation sidebar
│   └── lib/                  # 📚 Utilities
│       ├── hooks.ts          #   usePolling, useSSE custom hooks
│       └── utils.ts          #   API client functions
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## 🧪 Development

```bash
# Development mode (hot reload)
npm run dev

# Production build
npm run build

# Lint check
npm run lint
```

---

## 🤝 Contributing

Contributions are welcome!

1. **Fork** the repository
2. **Create a branch** (`git checkout -b feat/new-feature`)
3. **Commit** (`git commit -m 'feat: add new feature'`)
4. **Push** (`git push origin feat/new-feature`)
5. **Create a Pull Request**

---

## 📄 License

**Apache License 2.0** — see [LICENSE](LICENSE).

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

| Project | Description |
|:--------|:------------|
| [queenbee](https://github.com/heyangguang/queenbee) | 🐝 Go backend engine — Message queue + Agent scheduling |
| [queenbee-ui](https://github.com/heyangguang/queenbee-ui) | 🖥 This repo — Web management interface |

---

<div align="center">

**Built with 🐝 by the QueenBee Community**

[⭐ Star us on GitHub](https://github.com/heyangguang/queenbee-ui) — Your support keeps us going!

</div>
