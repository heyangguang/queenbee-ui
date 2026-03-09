"use client";

import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { timeAgo } from "@/lib/hooks";
import {
    sendMessage, subscribeToEvents, getConversationHistory, getConversationTimeline, getSessions,
    type EventData, type ConversationHistory, type TimelineItem,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CustomSelect } from "@/components/ui/custom-select";
import { Send, Bot, Users, User, Loader2, CheckCircle2, AlertCircle, ArrowRight, Radio, AtSign, History, FolderKanban, Clock, Zap, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Agent 头像颜色
const AVATAR_COLORS = [
    "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
    "bg-pink-500", "bg-cyan-500", "bg-indigo-500", "bg-rose-500",
];
function agentColor(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ── Markdown 渲染组件 ──
function MarkdownContent({ text }: { text: string }) {
    return (
        <div className="markdown-body text-sm leading-relaxed">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // 代码块
                    code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || "");
                        const isInline = !match && !String(children).includes("\n");
                        if (isInline) {
                            return <code className="bg-secondary/80 text-primary px-1.5 py-0.5 text-[13px] font-mono" {...props}>{children}</code>;
                        }
                        return (
                            <div className="relative my-2">
                                {match && <span className="absolute top-0 right-0 text-[10px] text-muted-foreground/50 px-2 py-1 font-mono">{match[1]}</span>}
                                <code className={`block bg-[#1e293b] text-slate-200 p-3 text-[13px] font-mono overflow-x-auto whitespace-pre ${className || ""}`} {...props}>{children}</code>
                            </div>
                        );
                    },
                    pre({ children }) {
                        return <pre className="bg-transparent p-0 m-0 overflow-visible">{children}</pre>;
                    },
                    // 链接
                    a({ children, href, ...props }) {
                        return <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80" {...props}>{children}</a>;
                    },
                    // 表格
                    table({ children }) {
                        return <div className="overflow-x-auto my-2"><table className="min-w-full text-sm border border-border">{children}</table></div>;
                    },
                    thead({ children }) {
                        return <thead className="bg-secondary/50 text-left">{children}</thead>;
                    },
                    th({ children }) {
                        return <th className="px-3 py-1.5 font-semibold border-b border-border text-[12px]">{children}</th>;
                    },
                    td({ children }) {
                        return <td className="px-3 py-1.5 border-b border-border/50 text-[12px]">{children}</td>;
                    },
                    // 列表
                    ul({ children }) {
                        return <ul className="list-disc pl-5 my-1 space-y-0.5">{children}</ul>;
                    },
                    ol({ children }) {
                        return <ol className="list-decimal pl-5 my-1 space-y-0.5">{children}</ol>;
                    },
                    li({ children }) {
                        return <li className="text-sm">{children}</li>;
                    },
                    // 标题
                    h1({ children }) {
                        return <h1 className="text-lg font-bold mt-3 mb-1">{children}</h1>;
                    },
                    h2({ children }) {
                        return <h2 className="text-base font-bold mt-2.5 mb-1">{children}</h2>;
                    },
                    h3({ children }) {
                        return <h3 className="text-sm font-bold mt-2 mb-0.5">{children}</h3>;
                    },
                    // 段落
                    p({ children }) {
                        return <p className="my-1">{children}</p>;
                    },
                    // 引用块
                    blockquote({ children }) {
                        return <blockquote className="border-l-3 border-primary/30 pl-3 my-2 text-muted-foreground italic">{children}</blockquote>;
                    },
                    // 分隔线
                    hr() {
                        return <hr className="my-3 border-border" />;
                    },
                    // 强调
                    strong({ children }) {
                        return <strong className="font-semibold">{children}</strong>;
                    },
                }}
            >{text}</ReactMarkdown>
        </div>
    );
}

// ── 对话链路类型 ──
type ChainStepStatus = 'pending' | 'running' | 'done' | 'error' | 'handoff';
type ChainStep = {
    agentId: string;
    status: ChainStepStatus;
    startTime?: number;
    elapsedMs?: number;
    handoffTo?: string;
};
type ConversationChain = {
    id: string;
    status: 'running' | 'completed' | 'error';
    startTime: number;
    agents: string[];
    steps: ChainStep[];
    totalElapsedMs?: number;
    teamName?: string;
};

// ── 对话链路状态追踪组件 ──
const ConversationChainTracker = memo(function ConversationChainTracker({
    chains,
}: {
    chains: Map<string, ConversationChain>;
}) {
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    if (chains.size === 0) return null;

    const toggleCollapse = (id: string) => {
        setCollapsed(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    return (
        <div>
            {Array.from(chains.entries()).map(([id, chain]) => {
                const isCollapsed = collapsed.has(id);
                const isRunning = chain.status === 'running';
                const isCompleted = chain.status === 'completed';
                const isError = chain.status === 'error';
                const elapsedSec = chain.totalElapsedMs
                    ? Math.round(chain.totalElapsedMs / 1000)
                    : Math.round((Date.now() - chain.startTime) / 1000);

                return (
                    <div key={id} className="animate-fade-in transition-all">
                        {/* 标题栏 */}
                        <button
                            onClick={() => toggleCollapse(id)}
                            className="w-full flex items-center gap-2 py-0.5 text-left cursor-pointer hover:opacity-80 transition-opacity"
                        >
                            {isCollapsed ? <ChevronRight className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                            <div className={`h-2 w-2 rounded-full flex-shrink-0 ${isRunning ? 'bg-primary animate-pulse-dot' :
                                isCompleted ? 'bg-green-500' : 'bg-destructive'
                                }`} />
                            <span className="text-[11px] font-semibold">
                                {chain.teamName || '对话链'}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                                {elapsedSec}s
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-auto">
                                {chain.steps.length} 步骤
                                {isRunning && ' · 处理中'}
                                {isCompleted && ' · ✓ 完成'}
                                {isError && ' · ✗ 错误'}
                            </span>
                        </button>

                        {/* 步骤详情 */}
                        {!isCollapsed && chain.steps.length > 0 && (
                            <div className="pl-6 pb-1 pt-0.5">
                                <div className="flex flex-wrap items-center gap-1">
                                    {chain.steps.map((step, i) => {
                                        const stepElapsed = step.elapsedMs ? Math.round(step.elapsedMs / 1000) : undefined;
                                        return (
                                            <div key={`${step.agentId}-${i}`} className="flex items-center gap-1">
                                                {i > 0 && (
                                                    <div className="text-muted-foreground/40 text-[10px] mx-0.5">→</div>
                                                )}
                                                <div className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium ${step.status === 'running' ? 'bg-primary/10 text-primary' :
                                                    step.status === 'done' ? 'bg-green-500/10 text-green-600' :
                                                        step.status === 'error' ? 'bg-destructive/10 text-destructive' :
                                                            step.status === 'handoff' ? 'bg-amber-500/10 text-amber-600' :
                                                                'bg-secondary text-muted-foreground'
                                                    }`}>
                                                    {step.status === 'running' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                                                    {step.status === 'done' && <CheckCircle2 className="h-2.5 w-2.5" />}
                                                    {step.status === 'error' && <AlertTriangle className="h-2.5 w-2.5" />}
                                                    {step.status === 'handoff' && <Zap className="h-2.5 w-2.5" />}
                                                    {step.status === 'pending' && <Clock className="h-2.5 w-2.5" />}
                                                    <span>@{step.agentId}</span>
                                                    {stepElapsed !== undefined && <span className="opacity-60">{stepElapsed}s</span>}
                                                    {step.status === 'handoff' && step.handoffTo && (
                                                        <span className="opacity-60">→ @{step.handoffTo}</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
});

// ── 类型 ──

interface FeedItem {
    id: string;
    type: "sent" | "event" | "history_step" | "history_event";
    timestamp: number;
    data: Record<string, unknown>;
}

interface MemberInfo {
    id: string;
    name: string;
    isTeam?: boolean;
}

// 格式化时间
function formatTime(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// 状态栏事件类型的中文翻译
const EVENT_LABELS: Record<string, string> = {
    chain_step_start: "Agent 开始处理",
    chain_step_done: "Agent 完成",
    chain_handoff: "任务交接",
    team_chain_start: "团队开始协作",
    team_chain_end: "团队协作完成",
    agent_routed: "分配 Agent",
    processor_start: "处理器启动",
    message_enqueued: "消息入队",
    response_ready: "响应就绪",
    message_received: "收到消息",
};

interface StatusBarEvent {
    id: string;
    type: string;
    agentId?: string;
    timestamp: number;
}

// ── @mention 高亮 ──

function HighlightedMessage({ text, members }: { text: string; members: MemberInfo[] }) {
    const memberIds = useMemo(() => new Set(members.map((m) => m.id)), [members]);
    const memberNames = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
    const parts = text.split(/(@[\w][\w-]*)/g);
    return (
        <span>
            {parts.map((part, i) => {
                if (part.startsWith("@")) {
                    const aid = part.slice(1);
                    if (memberIds.has(aid)) {
                        return (
                            <span key={i} className="inline-flex items-center gap-0.5 bg-primary/10 text-primary font-medium px-1 py-px mx-0.5" style={{ fontSize: "inherit" }}>
                                <AtSign className="inline h-3 w-3" />
                                {memberNames.get(aid) || aid}
                            </span>
                        );
                    }
                }
                return <span key={i}>{part}</span>;
            })}
        </span>
    );
}

// ── @mention 弹出组件 ──

const MentionPopup = memo(function MentionPopup({
    members, filter, onSelect, activeIndex,
}: {
    members: MemberInfo[];
    filter: string;
    onSelect: (member: MemberInfo) => void;
    activeIndex: number;
}) {
    const filtered = members.filter(
        (m) => m.name.toLowerCase().includes(filter.toLowerCase()) || m.id.toLowerCase().includes(filter.toLowerCase())
    );
    if (filtered.length === 0) return null;

    return (
        <div className="absolute z-50 bg-card border shadow-lg py-1 max-h-48 overflow-y-auto min-w-[220px]" style={{ bottom: "100%", left: 0, marginBottom: 4 }}>
            <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b mb-1">团队成员</div>
            {filtered.map((m, i) => (
                <button
                    key={m.id}
                    onClick={() => onSelect(m)}
                    className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors cursor-pointer ${i === activeIndex ? "bg-accent text-primary" : "hover:bg-accent"}`}
                >
                    <span className="flex h-5 w-5 items-center justify-center bg-primary/10 text-[10px] font-bold text-primary">
                        {m.isTeam ? "T" : m.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="font-medium">{m.name}</span>
                    {m.isTeam && <span className="text-[9px] bg-blue-500/15 text-blue-400 px-1 py-px">团队</span>}
                    <span className="text-[10px] text-muted-foreground font-mono ml-auto">@{m.id}</span>
                </button>
            ))}
        </div>
    );
});

const EMPTY_MEMBERS: MemberInfo[] = [];

// ═══════════════════════════════════════════
// ChatView — 重写版：简化状态管理，杜绝竞态
// ═══════════════════════════════════════════

export function ChatView({
    target, targetLabel, teamId, members = EMPTY_MEMBERS, projects = [],
}: {
    target: string;
    targetLabel: string;
    teamId?: string;
    members?: MemberInfo[];
    projects?: { id: string; name: string }[];
}) {
    // ── 核心状态 ──
    const [feed, setFeed] = useState<FeedItem[]>([]);

    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const sendingRef = useRef(false);
    const [statusEvents, setStatusEvents] = useState<StatusBarEvent[]>([]);
    const [connected, setConnected] = useState(false);
    const [activeChains, setActiveChains] = useState<Map<string, ConversationChain>>(new Map());
    const [loadingHistory, setLoadingHistory] = useState(false);
    const feedEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const historyLoadedRef = useRef(false);

    // ── Agent 思考状态（三态：thinking → done → handoff） ──
    type ThinkingPhase = 'thinking' | 'done' | 'handoff';
    type ThinkingInfo = {
        name: string; startTime: number; phase: ThinkingPhase;
        elapsedMs?: number; responseLength?: number; handoffTo?: string;
    };
    const [thinkingAgents, setThinkingAgents] = useState<Map<string, ThinkingInfo>>(new Map());
    const [elapsed, setElapsed] = useState(0); // 驱动计时器刷新

    const [showMention, setShowMention] = useState(false);
    const [mentionFilter, setMentionFilter] = useState("");
    const [mentionIndex, setMentionIndex] = useState(0);
    const mentionStartRef = useRef<number>(-1);

    // 项目选择
    const [selectedProjectId, setSelectedProjectId] = useState<string>("");

    // 追加 feed（functional update 保证闭包安全）
    const appendFeed = useCallback((items: FeedItem[]) => {
        setFeed(prev => [...prev, ...items].slice(-300));
    }, []);

    // 前置 feed（加载历史时用，去重）
    const prependFeed = useCallback((items: FeedItem[]) => {
        setFeed(prev => {
            const existingIds = new Set(prev.map(f => f.id));
            const newItems = items.filter(h => !existingIds.has(h.id));
            return [...newItems, ...prev];
        });
    }, []);

    // 自动滚到底部（用容器 scrollTop 更可靠）
    const scrollToBottom = useCallback(() => {
        requestAnimationFrame(() => {
            const el = scrollContainerRef.current;
            if (el) el.scrollTop = el.scrollHeight;
        });
    }, []);

    // feed 变化或思考状态变化时自动滚动到底部
    useEffect(() => {
        scrollToBottom();
    }, [feed.length, thinkingAgents.size, scrollToBottom]);

    // ── 加载历史 ──
    useEffect(() => {
        if (!teamId || historyLoadedRef.current) return;
        historyLoadedRef.current = true;
        setLoadingHistory(true);
        (async () => {
            try {
                const { conversations } = await getConversationHistory(teamId, 5, 0);
                const historyItems: FeedItem[] = [];

                // 1) 加载已完成的会话历史
                if (conversations && conversations.length > 0) {
                    for (const conv of conversations) {
                        try {
                            const { timeline } = await getConversationTimeline(conv.id);
                            if (timeline) {
                                const filtered = timeline.filter((item) => {
                                    if (item.type !== "step") return true;
                                    const s = item.data as unknown as Record<string, unknown>;
                                    return String(s.message_type) !== "handoff";
                                });
                                for (let idx = 0; idx < filtered.length; idx++) {
                                    const item = filtered[idx];
                                    if (item.type === "step") {
                                        const step = item.data as unknown as Record<string, unknown>;
                                        historyItems.push({
                                            id: `hist_${conv.id}_${step.id || item.timestamp}_${idx}`,
                                            type: "history_step",
                                            timestamp: item.timestamp < 1e12 ? item.timestamp * 1000 : item.timestamp,
                                            data: {
                                                type: step.message_type,
                                                agentId: step.from_agent,
                                                toAgent: step.to_agent,
                                                message: step.message,
                                                responseText: step.message,
                                            },
                                        });
                                    }
                                }
                            }
                        } catch { /* 静默 */ }
                    }
                }

                // 2) 加载活跃（进行中）的会话步骤 + 初始化思考状态
                try {
                    const { sessions } = await getSessions();
                    const completedIds = new Set((conversations || []).map(c => c.id));
                    // 收集所有正在工作的 agent，用于初始化思考指示器
                    const pendingAgentsInit = new Map<string, number>(); // agentId → startTime
                    for (const s of sessions) {
                        // 收集 pending agents 及其开始时间
                        if (s.pending_agents) {
                            const startTime = Date.now() - (s.elapsed_seconds || 0) * 1000;
                            for (const aid of s.pending_agents) {
                                if (!pendingAgentsInit.has(aid)) {
                                    pendingAgentsInit.set(aid, startTime);
                                }
                            }
                        }
                        if (completedIds.has(s.id)) continue;
                        try {
                            const { timeline } = await getConversationTimeline(s.id);
                            if (timeline) {
                                const filtered = timeline.filter((item) => {
                                    if (item.type !== "step") return true;
                                    const ss = item.data as unknown as Record<string, unknown>;
                                    if (String(ss.message_type) === "handoff") return false;
                                    // 过滤路由格式消息 @xxx → @yyy
                                    const msg = String(ss.message || "").trim();
                                    if (/^@\S+\s*→\s*@\S+$/.test(msg)) return false;
                                    if (/^@\S+\s*->\s*@\S+$/.test(msg)) return false;
                                    return true;
                                });
                                for (let idx = 0; idx < filtered.length; idx++) {
                                    const item = filtered[idx];
                                    if (item.type === "step") {
                                        const step = item.data as unknown as Record<string, unknown>;
                                        historyItems.push({
                                            id: `active_${s.id}_${step.id || item.timestamp}_${idx}`,
                                            type: "history_step",
                                            timestamp: item.timestamp < 1e12 ? item.timestamp * 1000 : item.timestamp,
                                            data: {
                                                type: step.message_type,
                                                agentId: step.from_agent,
                                                toAgent: step.to_agent,
                                                message: step.message,
                                                responseText: step.message,
                                            },
                                        });
                                    }
                                }
                            }
                        } catch { /* skip */ }
                    }
                    // 初始化思考指示器：页面加载时如果有 agent 正在工作，立即显示
                    if (pendingAgentsInit.size > 0) {
                        setThinkingAgents(prev => {
                            const next = new Map(prev);
                            for (const [aid, startTime] of pendingAgentsInit) {
                                if (!next.has(aid)) {
                                    next.set(aid, { name: aid, startTime, phase: 'thinking' });
                                }
                            }
                            return next;
                        });
                    }

                    // 初始化对话链路追踪：从活跃 sessions 恢复链路状态
                    const chainsInit = new Map<string, ConversationChain>();
                    for (const s of sessions) {
                        if (completedIds.has(s.id)) continue;
                        const startTime = Date.now() - (s.elapsed_seconds || 0) * 1000;
                        const steps: ChainStep[] = [];
                        // 从 timeline events 提取已完成的步骤
                        try {
                            const { timeline } = await getConversationTimeline(s.id);
                            if (timeline) {
                                for (const item of timeline) {
                                    if (item.type === "event") {
                                        const ev = item.data as unknown as Record<string, unknown>;
                                        const evType = String(ev.event_type || "");
                                        let evData: Record<string, unknown> = {};
                                        try { evData = JSON.parse(String(ev.event_data || "{}")); } catch { /* skip */ }
                                        const aid = String(evData.agentId || "");
                                        if (evType === "chain_step_start" && aid) {
                                            steps.push({ agentId: aid, status: 'done', startTime: item.timestamp });
                                        } else if (evType === "chain_step_done" && aid) {
                                            const idx = steps.findIndex(st => st.agentId === aid && st.status !== 'done');
                                            if (idx >= 0) {
                                                steps[idx] = { ...steps[idx], status: 'done', elapsedMs: evData.elapsedMs ? Number(evData.elapsedMs) : undefined };
                                            }
                                        }
                                    }
                                }
                            }
                        } catch { /* skip */ }
                        // 将当前正在处理的 agents 标记为 running
                        if (s.pending_agents) {
                            for (const aid of s.pending_agents) {
                                const existingIdx = steps.findIndex(st => st.agentId === aid);
                                if (existingIdx >= 0) {
                                    steps[existingIdx] = { ...steps[existingIdx], status: 'running' };
                                } else {
                                    steps.push({ agentId: aid, status: 'running', startTime });
                                }
                            }
                        }
                        chainsInit.set(s.id, {
                            id: s.id,
                            status: 'running',
                            startTime,
                            agents: s.pending_agents || [],
                            steps,
                            teamName: s.team || undefined,
                        });
                    }
                    if (chainsInit.size > 0) {
                        setActiveChains(chainsInit);
                    }
                } catch { /* sessions API 失败不影响 */ }

                if (historyItems.length > 0) {
                    prependFeed(historyItems);
                }
            } catch { /* 静默 */ }
            setLoadingHistory(false);
            scrollToBottom();
        })();
    }, [teamId]); // eslint-disable-line

    // ── SSE 实时事件 ──
    useEffect(() => {
        // 仅更新状态栏的事件（不进消息流）
        const STATUS_ONLY_EVENTS = new Set([
            "processor_start", "message_enqueued",
            "message_received",   // handleSend 已添加用户消息，不重复
            "agent_routed",       // 流程事件，状态栏已显示
            "chain_step_start",   // 流程事件，状态栏已显示
            "response_ready",     // chain_step_done 已有回复，不重复
            "team_chain_start",   // 团队协作开始，状态栏已显示
            "team_chain_end",     // 团队协作完成，状态栏已显示
        ]);

        const unsub = subscribeToEvents(
            (event) => {
                setConnected(true);
                const e = event as unknown as Record<string, unknown>;
                const agentId = e.agentId ? String(e.agentId) : "";
                const ts = event.timestamp < 1e12 ? event.timestamp * 1000 : event.timestamp;
                const mkId = () => `sse_${ts}_${Math.random().toString(36).slice(2, 6)}`;

                // 更新状态栏（所有事件都更新）
                setStatusEvents(prev => [{
                    id: mkId(), type: event.type, agentId: agentId || undefined, timestamp: ts,
                }, ...prev].slice(0, 10));

                // ── 更新思考状态（后端驱动三态） ──
                if (event.type === "team_chain_end" || event.type === "conversation_timeout") {
                    // 全局结束：清除所有
                    setThinkingAgents(new Map());
                } else if ((event.type === "chain_step_start" || event.type === "agent_routed") && agentId) {
                    // 开始思考：用后端 startedAt 校准时间
                    const startedAt = e.startedAt ? Number(e.startedAt) : ts;
                    setThinkingAgents(prev => {
                        const next = new Map(prev);
                        next.set(agentId, { name: agentId, startTime: startedAt, phase: 'thinking' });
                        return next;
                    });
                } else if (event.type === "chain_step_done" && agentId) {
                    // 思考完成：转为 done 态，显示后端提供的 elapsedMs 和 responseLength
                    setThinkingAgents(prev => {
                        const next = new Map(prev);
                        const existing = prev.get(agentId);
                        next.set(agentId, {
                            name: agentId,
                            startTime: existing?.startTime || ts,
                            phase: 'done',
                            elapsedMs: e.elapsedMs ? Number(e.elapsedMs) : undefined,
                            responseLength: e.responseLength ? Number(e.responseLength) : undefined,
                        });
                        return next;
                    });
                    // 2 秒后自动移除 done 态
                    setTimeout(() => {
                        setThinkingAgents(prev => {
                            const info = prev.get(agentId);
                            if (!info || info.phase !== 'done') return prev;
                            const next = new Map(prev);
                            next.delete(agentId);
                            return next;
                        });
                    }, 2000);
                } else if (event.type === "chain_handoff" && agentId) {
                    // 任务交接：fromAgent 转为 handoff 态
                    const fromAgent = e.fromAgent ? String(e.fromAgent) : agentId;
                    const toAgent = e.toAgent ? String(e.toAgent) : "";
                    setThinkingAgents(prev => {
                        const next = new Map(prev);
                        const existing = prev.get(fromAgent);
                        if (existing) {
                            next.set(fromAgent, { ...existing, phase: 'handoff', handoffTo: toAgent });
                        } else {
                            next.set(fromAgent, { name: fromAgent, startTime: ts, phase: 'handoff', handoffTo: toAgent });
                        }
                        return next;
                    });
                    // 收到下一个 agent 的 chain_step_start 时 handoff 态会被自然清除
                    // 兜底：5 秒后自动清除 handoff 态
                    setTimeout(() => {
                        setThinkingAgents(prev => {
                            const info = prev.get(fromAgent);
                            if (!info || info.phase !== 'handoff') return prev;
                            const next = new Map(prev);
                            next.delete(fromAgent);
                            return next;
                        });
                    }, 5000);
                } else if ((event.type === "agent_error" || event.type === "agent_timeout") && agentId) {
                    // 错误/超时：直接移除
                    setThinkingAgents(prev => {
                        if (!prev.has(agentId)) return prev;
                        const next = new Map(prev);
                        next.delete(agentId);
                        return next;
                    });
                }

                // ── 更新对话链路追踪 ──
                const convId = e.conversationId ? String(e.conversationId) : "";
                if (event.type === "team_chain_start" && convId) {
                    const chainAgents = (e.agents as string[]) || [];
                    const teamName = e.teamName ? String(e.teamName) : undefined;
                    setActiveChains(prev => {
                        const next = new Map(prev);
                        next.set(convId, {
                            id: convId, status: 'running', startTime: ts,
                            agents: chainAgents, steps: [], teamName,
                        });
                        return next;
                    });
                } else if ((event.type === "chain_step_start" || event.type === "agent_routed") && convId && agentId) {
                    setActiveChains(prev => {
                        let chain = prev.get(convId);
                        const next = new Map(prev);
                        // 如果没有匹配的 chain（错过了 team_chain_start 或非 team 对话），自动创建
                        if (!chain) {
                            chain = { id: convId, status: 'running', startTime: ts, agents: [], steps: [], teamName: undefined };
                        }
                        const existingIdx = chain.steps.findIndex(s => s.agentId === agentId && s.status !== 'done' && s.status !== 'error');
                        const newSteps = [...chain.steps];
                        if (existingIdx >= 0) {
                            newSteps[existingIdx] = { ...newSteps[existingIdx], status: 'running', startTime: ts };
                        } else {
                            newSteps.push({ agentId, status: 'running', startTime: ts });
                        }
                        next.set(convId, { ...chain, steps: newSteps });
                        return next;
                    });
                } else if (event.type === "chain_step_done" && convId && agentId) {
                    setActiveChains(prev => {
                        const chain = prev.get(convId);
                        if (!chain) return prev;
                        const next = new Map(prev);
                        const newSteps = chain.steps.map(s =>
                            s.agentId === agentId && s.status === 'running'
                                ? { ...s, status: 'done' as ChainStepStatus, elapsedMs: e.elapsedMs ? Number(e.elapsedMs) : undefined }
                                : s
                        );
                        next.set(convId, { ...chain, steps: newSteps });
                        return next;
                    });
                } else if (event.type === "chain_handoff" && convId) {
                    const fromAgent = e.fromAgent ? String(e.fromAgent) : agentId;
                    const toAgent = e.toAgent ? String(e.toAgent) : "";
                    setActiveChains(prev => {
                        const chain = prev.get(convId);
                        if (!chain) return prev;
                        const next = new Map(prev);
                        const newSteps = chain.steps.map(s =>
                            s.agentId === fromAgent && (s.status === 'running' || s.status === 'done')
                                ? { ...s, status: 'handoff' as ChainStepStatus, handoffTo: toAgent }
                                : s
                        );
                        next.set(convId, { ...chain, steps: newSteps });
                        return next;
                    });
                } else if ((event.type === "agent_error" || event.type === "agent_timeout") && convId && agentId) {
                    setActiveChains(prev => {
                        const chain = prev.get(convId);
                        if (!chain) return prev;
                        const next = new Map(prev);
                        const newSteps = chain.steps.map(s =>
                            s.agentId === agentId && s.status === 'running'
                                ? { ...s, status: 'error' as ChainStepStatus }
                                : s
                        );
                        const hasRunning = newSteps.some(s => s.status === 'running');
                        next.set(convId, { ...chain, steps: newSteps, status: hasRunning ? 'running' : 'error' });
                        return next;
                    });
                } else if ((event.type === "team_chain_end" || event.type === "conversation_timeout") && convId) {
                    setActiveChains(prev => {
                        const chain = prev.get(convId);
                        if (!chain) return prev;
                        const next = new Map(prev);
                        const totalMs = e.elapsedMs ? Number(e.elapsedMs) : Date.now() - chain.startTime;
                        next.set(convId, {
                            ...chain,
                            status: event.type === "conversation_timeout" ? 'error' : 'completed',
                            totalElapsedMs: totalMs,
                            steps: chain.steps.map(s => s.status === 'running' ? { ...s, status: 'done' as ChainStepStatus } : s),
                        });
                        // 已完成的对话链 10 秒后自动清除
                        setTimeout(() => {
                            setActiveChains(p => {
                                const c = p.get(convId);
                                if (!c || c.status === 'running') return p;
                                const n = new Map(p);
                                n.delete(convId);
                                return n;
                            });
                        }, 10000);
                        return next;
                    });
                }

                // 白名单：只有 chain_step_done 带 responseText 才进消息流
                if (event.type === "chain_step_done" && e.responseText) {
                    const respText = String(e.responseText);
                    // 过滤路由消息 @xxx → @yyy
                    const trimResp = respText.trim();
                    if (/^@\S+\s*→\s*@\S+$/.test(trimResp) || /^@\S+\s*->\s*@\S+$/.test(trimResp)) {
                        // 跳过路由消息，不进入 feed
                    } else {
                        // 去重：同一会话中同一 agent 相同内容才去重（不同会话的相同内容允许重复）
                        const convId = e.conversationId ? String(e.conversationId) : "";
                        setFeed(prev => {
                            const isDup = prev.some(f =>
                                f.type === "event" &&
                                f.data?.type === "chain_step_done" &&
                                String(f.data?.agentId || "") === agentId &&
                                String(f.data?.responseText || "") === respText &&
                                String((f.data as Record<string, unknown>)?.conversationId || "") === convId
                            );
                            if (isDup) return prev;
                            return [...prev, {
                                id: mkId(),
                                type: "event" as const,
                                timestamp: ts,
                                data: event as unknown as Record<string, unknown>,
                            }].slice(-300);
                        });
                        scrollToBottom();
                    }
                }
            },
            () => setConnected(false),
            () => setConnected(true),
        );
        return () => unsub();
    }, []); // eslint-disable-line

    // ── 实时计时器：每秒刷新 elapsed 驱动 UI 更新 ──
    useEffect(() => {
        const hasThinking = Array.from(thinkingAgents.values()).some(i => i.phase === 'thinking');
        if (!hasThinking) return;
        const timer = setInterval(() => setElapsed(e => e + 1), 1000);
        return () => clearInterval(timer);
    }, [thinkingAgents.size, Array.from(thinkingAgents.values()).some(i => i.phase === 'thinking')]); // eslint-disable-line

    // 思考状态完全由后端 SSE 事件驱动（chain_step_done / agent_error / agent_timeout / team_chain_end）
    // 不需要前端超时兜底

    // ── 发送消息 ──
    const handleSend = useCallback(async () => {
        if (!message.trim() || sending || sendingRef.current) return;
        sendingRef.current = true;
        const text = message.trim();
        setMessage("");
        setSending(true);
        const agent = target.startsWith("@") ? target.slice(1) : undefined;
        // 如果用户输入已经以 @someone 开头（@了任何成员），不再补团队前缀
        const alreadyHasMention = /^@[\w][\w-]*/.test(text);
        const alreadyHasPrefix = agent && text.startsWith(target);
        const fullMessage = (agent && !alreadyHasPrefix && !alreadyHasMention) ? `${target} ${text}` : text;
        try {
            const res = await sendMessage({
                message: fullMessage,
                sender: "office_user", channel: "api",
                ...(selectedProjectId ? { project_id: selectedProjectId } : {}),
            });
            appendFeed([{
                id: res.message_id, type: "sent", timestamp: Date.now(),
                data: { message: fullMessage, target, messageId: res.message_id },
            }]);
            scrollToBottom();
        } catch {
            appendFeed([{
                id: `err_${Date.now()}`, type: "sent", timestamp: Date.now(),
                data: { message: fullMessage, target, error: true },
            }]);
        } finally { setSending(false); sendingRef.current = false; }
    }, [message, sending, target, selectedProjectId, appendFeed, scrollToBottom]);

    // 获取当前 @mention 过滤后的成员列表
    const filteredMembers = useMemo(() => {
        if (!showMention) return [];
        return members.filter(
            (m) => m.name.toLowerCase().includes(mentionFilter.toLowerCase()) || m.id.toLowerCase().includes(mentionFilter.toLowerCase())
        );
    }, [showMention, members, mentionFilter]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showMention && filteredMembers.length > 0) {
            if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((prev) => (prev + 1) % filteredMembers.length); return; }
            if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length); return; }
            if (e.key === "Enter") { e.preventDefault(); handleMentionSelect(filteredMembers[mentionIndex]); return; }
            if (e.key === "Escape") { e.preventDefault(); setShowMention(false); return; }
        }
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setMessage(val);
        if (members.length === 0) return;
        const cursorPos = e.target.selectionStart || 0;
        const textBeforeCursor = val.slice(0, cursorPos);
        const atIdx = textBeforeCursor.lastIndexOf("@");
        if (atIdx >= 0) {
            const charBefore = atIdx > 0 ? textBeforeCursor[atIdx - 1] : " ";
            if (charBefore === " " || charBefore === "\n" || atIdx === 0) {
                const query = textBeforeCursor.slice(atIdx + 1);
                if (!query.includes(" ")) {
                    setShowMention(true); setMentionFilter(query); setMentionIndex(0); mentionStartRef.current = atIdx;
                    return;
                }
            }
        }
        setShowMention(false);
    };

    const handleMentionSelect = (member: MemberInfo) => {
        const start = mentionStartRef.current;
        if (start < 0) return;
        const before = message.slice(0, start);
        const cursorPos = textareaRef.current?.selectionStart || message.length;
        const after = message.slice(cursorPos);
        const newMsg = `${before}@${member.id} ${after}`;
        setMessage(newMsg);
        setShowMention(false);
        setTimeout(() => {
            if (textareaRef.current) {
                const pos = start + member.id.length + 2;
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(pos, pos);
            }
        }, 0);
    };

    // ── 渲染 ──
    const sorted = [...feed].sort((a, b) => a.timestamp - b.timestamp);

    return (
        <div className="flex h-full flex-col">
            {/* 状态栏 */}
            <div className="flex items-center gap-2 border-b px-4 py-1.5 bg-secondary/50">
                <div className={`h-1.5 w-1.5 ${connected ? "bg-green-500 animate-pulse-dot" : "bg-destructive"}`} />
                <span className="text-[10px] text-muted-foreground">{connected ? "已连接" : "连接中..."}</span>
                {statusEvents.length > 0 && (
                    <>
                        <span className="text-border">|</span>
                        <div className="flex items-center gap-1.5 overflow-hidden">
                            <Radio className="h-3 w-3 text-primary animate-pulse" />
                            <span className="text-[10px] text-muted-foreground truncate">
                                {EVENT_LABELS[statusEvents[0].type] || statusEvents[0].type}
                            </span>
                        </div>
                    </>
                )}
            </div>

            {/* 对话链路状态追踪面板（与状态栏一体） */}
            {activeChains.size > 0 && (
                <div className="px-4 py-1.5 bg-secondary/50 border-b">
                    <ConversationChainTracker chains={activeChains} />
                </div>
            )}

            {/* 消息流 */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-2">
                {loadingHistory && (
                    <div className="flex items-center justify-center py-4 gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">加载历史消息...</span>
                    </div>
                )}
                {!loadingHistory && sorted.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="flex h-14 w-14 items-center justify-center bg-secondary mb-3">
                            {target.includes("team") ? <Users className="h-6 w-6 text-violet-600" /> : <Bot className="h-6 w-6 text-primary" />}
                        </div>
                        <p className="text-sm font-medium">{targetLabel}</p>
                        <p className="text-xs text-muted-foreground mt-1">发送消息开始对话</p>
                        {members.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-2">
                                输入 <kbd className="bg-secondary px-1 py-0.5 font-mono text-[10px] border">@</kbd> 可以提及团队成员
                            </p>
                        )}
                    </div>
                )}

                {sorted.map((item) => (
                    <FeedEntry key={item.id} item={item} members={members} />
                ))}

                {/* Agent 思考状态指示器（三态：thinking / done / handoff） */}
                {thinkingAgents.size > 0 && (
                    <div className="animate-fade-in">
                        {Array.from(thinkingAgents.entries()).map(([id, info]) => {
                            const elapsedSec = info.phase === 'thinking'
                                ? Math.floor((Date.now() - info.startTime) / 1000)
                                : info.elapsedMs ? Math.floor(info.elapsedMs / 1000) : 0;
                            // 防止 elapsed 变量未使用的 lint 告警（它驱动重渲染）
                            void elapsed;
                            return (
                                <div key={id} className={`flex items-center gap-2.5 py-1 transition-opacity duration-500 ${info.phase === 'done' ? 'opacity-70' : 'opacity-100'}`}>
                                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-[11px] font-bold ${agentColor(id)}`}>
                                        {id.charAt(0).toUpperCase()}
                                    </div>
                                    <div className={`flex items-center gap-2 border rounded-lg px-4 py-2 ${info.phase === 'thinking' ? 'bg-secondary/60 border-border/50' :
                                        info.phase === 'done' ? 'bg-green-500/10 border-green-500/30' :
                                            'bg-amber-500/10 border-amber-500/30'
                                        }`}>
                                        <span className="text-[11px] font-semibold text-foreground">{info.name}</span>
                                        {info.phase === 'thinking' && (
                                            <>
                                                <span className="text-[11px] text-muted-foreground">正在思考</span>
                                                <span className="text-[10px] font-mono text-muted-foreground/70">{elapsedSec}s</span>
                                                <div className="typing-indicator">
                                                    <span /><span /><span />
                                                </div>
                                            </>
                                        )}
                                        {info.phase === 'done' && (
                                            <>
                                                <span className="text-[11px] text-green-600">回复完成 ✓</span>
                                                {elapsedSec > 0 && <span className="text-[10px] font-mono text-green-600/70">{elapsedSec}s</span>}
                                                {info.responseLength && info.responseLength > 0 && (
                                                    <span className="text-[10px] font-mono text-green-600/70">· {info.responseLength}字</span>
                                                )}
                                            </>
                                        )}
                                        {info.phase === 'handoff' && (
                                            <>
                                                <span className="text-[11px] text-amber-600">→ @{info.handoffTo || '...'}</span>
                                                <span className="text-[11px] text-amber-600/70">任务交接中</span>
                                                <div className="typing-indicator">
                                                    <span /><span /><span />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div ref={feedEndRef} />
            </div>

            {/* 输入区 */}
            <div className="border-t bg-card p-3 relative">
                {showMention && members.length > 0 && (
                    <MentionPopup members={members} filter={mentionFilter} onSelect={handleMentionSelect} activeIndex={mentionIndex} />
                )}
                <div className="flex gap-2 items-end">
                    <textarea
                        ref={textareaRef}
                        value={message}
                        onChange={handleInput}
                        onKeyDown={handleKeyDown}
                        onBlur={() => setTimeout(() => setShowMention(false), 200)}
                        placeholder={target ? `发送给 ${targetLabel}（@ 可指定成员）` : "输入消息..."}
                        rows={2}
                        className="flex-1 text-sm flex w-full border bg-background px-3 py-2 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors resize-none"
                    />
                    <Button onClick={handleSend} disabled={!message.trim() || sending} className="h-[52px] px-4">
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                </div>
                {target && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">
                            发送至 <Badge variant="outline" className="text-[10px] px-1 py-0">{target}</Badge>
                        </span>
                        {projects.length > 0 && (
                            <>
                                <span className="text-border">|</span>
                                <FolderKanban className="h-3 w-3 text-emerald-500" />
                                <CustomSelect
                                    value={selectedProjectId}
                                    onChange={v => setSelectedProjectId(v)}
                                    className="text-[10px] h-6 w-36 border-none"
                                    options={[
                                        { value: "", label: "自动识别项目" },
                                        ...projects.map(p => ({ value: p.id, label: p.name })),
                                    ]}
                                />
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── 消息条目 ──

function FeedEntry({ item, members }: { item: FeedItem; members: MemberInfo[] }) {
    // 用户发送的消息 → 右侧蓝色气泡
    if (item.type === "sent") {
        const err = item.data.error as boolean;
        return (
            <div className="flex justify-end gap-2.5">
                <div className={`max-w-[70%] px-4 py-2.5 rounded-lg ${err ? "bg-red-50 border border-red-200 text-red-800" : "bg-primary text-primary-foreground"}`}>
                    <p className="text-sm whitespace-pre-wrap">{String(item.data.message)}</p>
                    <div className="flex items-center justify-end gap-1.5 mt-1">
                        {err ? <AlertCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3 opacity-60" />}
                        <span className="text-[10px] opacity-60">{timeAgo(item.timestamp)}</span>
                    </div>
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-500 text-white">
                    <User className="h-4 w-4" />
                </div>
            </div>
        );
    }

    // 历史消息
    if (item.type === "history_step") {
        const d = item.data;
        const fromAgent = String(d.agentId || d.fromAgent || "");
        const msgText = String(d.message || d.responseText || "");
        const msgType = String(d.type || "");
        const isUser = msgType === "user_message";
        // 过滤路由消息（handoff 和 @xxx → @yyy 格式）
        if (msgType === "handoff") return null;
        const trimmed = msgText.trim();
        if (/^@\S+\s*→\s*@\S+$/.test(trimmed)) return null;
        if (/^@\S+\s*->\s*@\S+$/.test(trimmed)) return null;

        if (isUser) {
            return (
                <div className="flex justify-end gap-2.5">
                    <div className="max-w-[70%] px-4 py-2.5 rounded-lg bg-primary/80 text-primary-foreground">
                        <p className="text-sm whitespace-pre-wrap">{msgText}</p>
                        <div className="flex items-center justify-end gap-1.5 mt-1">
                            <History className="h-3 w-3 opacity-40" />
                            <span className="text-[10px] opacity-60">{formatTime(item.timestamp)}</span>
                        </div>
                    </div>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-500 text-white">
                        <User className="h-4 w-4" />
                    </div>
                </div>
            );
        }

        return (
            <div className="flex justify-start gap-2.5">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-[11px] font-bold ${agentColor(fromAgent || "agent")}`}>
                    {fromAgent ? fromAgent.charAt(0).toUpperCase() : <Bot className="h-4 w-4" />}
                </div>
                <div className="max-w-[80%]">
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[11px] font-semibold">{fromAgent || "Agent"}</span>
                        {msgType === "handoff" && <span className="text-[10px] text-amber-500">· 交接</span>}
                        <History className="h-3 w-3 text-muted-foreground/30" />
                    </div>
                    <div className="bg-secondary border rounded-lg px-4 py-2.5">
                        {msgText && (
                            <MarkdownContent text={msgText} />
                        )}
                        <span className="text-[10px] text-muted-foreground/60 mt-1 block">{formatTime(item.timestamp)}</span>
                    </div>
                </div>
            </div>
        );
    }

    if (item.type === "history_event") return null;

    // 实时 SSE 事件
    const event = item.data as EventData;
    const agentId = event.agentId ? String(event.agentId) : "";

    // message_received → 用户消息气泡（右侧）
    if (event.type === "message_received" && event.message) {
        const senderName = String((event as Record<string, unknown>).sender || "用户");
        return (
            <div className="flex justify-end gap-2.5">
                <div className="max-w-[70%] px-4 py-2.5 rounded-lg bg-primary text-primary-foreground">
                    <p className="text-sm whitespace-pre-wrap">
                        <HighlightedMessage text={String(event.message)} members={members} />
                    </p>
                    <div className="flex items-center justify-end gap-1.5 mt-1">
                        <span className="text-[10px] opacity-60">{senderName}</span>
                        <span className="text-[10px] opacity-60">·</span>
                        <span className="text-[10px] opacity-60">{timeAgo(item.timestamp)}</span>
                    </div>
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-500 text-white">
                    <User className="h-4 w-4" />
                </div>
            </div>
        );
    }

    // chain_step_done 带 responseText → agent 回复气泡
    if (event.type === "chain_step_done" && event.responseText) {
        return (
            <div className="flex justify-start gap-2.5">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-[11px] font-bold ${agentColor(agentId || "agent")}`}>
                    {agentId ? agentId.charAt(0).toUpperCase() : <Bot className="h-4 w-4" />}
                </div>
                <div className="max-w-[80%]">
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[11px] font-semibold">{agentId || "Agent"}</span>
                        <span className="text-[10px] text-green-500">· 已完成</span>
                    </div>
                    <div className="bg-secondary border rounded-lg px-4 py-2.5">
                        <MarkdownContent text={String(event.responseText)} />
                        <span className="text-[10px] text-muted-foreground/60 mt-1 block">{timeAgo(item.timestamp)}</span>
                    </div>
                </div>
            </div>
        );
    }

    // 其他事件（带消息内容）
    if (event.responseText || event.message) {
        const text = String(event.responseText || event.message || "");
        const label = EVENT_LABELS[event.type] || event.type;
        return (
            <div className="flex justify-start gap-2.5">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-[11px] font-bold ${agentColor(agentId || "agent")}`}>
                    {agentId ? agentId.charAt(0).toUpperCase() : <Bot className="h-4 w-4" />}
                </div>
                <div className="max-w-[80%]">
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[11px] font-semibold">{agentId || "Agent"}</span>
                        <span className="text-[10px] text-muted-foreground">· {label}</span>
                    </div>
                    <div className="bg-secondary border rounded-lg px-4 py-2.5">
                        <MarkdownContent text={text} />
                        <span className="text-[10px] text-muted-foreground/60 mt-1 block">{timeAgo(item.timestamp)}</span>
                    </div>
                </div>
            </div>
        );
    }

    // 纯系统事件 → 居中小标签
    const label = EVENT_LABELS[event.type] || event.type;
    return (
        <div className="flex justify-center">
            <div className="text-[10px] text-muted-foreground/60 bg-secondary/30 px-3 py-0.5 flex items-center gap-1.5">
                {agentId && <span className="font-mono">@{agentId}</span>}
                <span>{label}</span>
                <span className="opacity-50">{timeAgo(item.timestamp)}</span>
            </div>
        </div>
    );
}
