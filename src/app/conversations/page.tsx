"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    getConversationHistory, getConversationTimeline,
    type ConversationHistory, type TimelineItem, type ConversationStep, type ConversationEvent,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, Clock, Bot, Users, ArrowRight, Loader2, Play, Pause, SkipForward, RotateCcw, ChevronDown, ChevronUp, User, Zap } from "lucide-react";

function fmt(ts: number) {
    if (!ts) return "-";
    return new Date(ts).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function shortTime(ts: number) {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function duration(start: number, end: number) {
    if (!start || !end) return "-";
    const s = Math.round((end - start) / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m${s % 60}s`;
}

function parseAgents(agentsStr: string): string[] {
    try { return JSON.parse(agentsStr) || []; } catch { return []; }
}

// Agent 色板
const AGENT_COLORS: Record<string, string> = {};
const PALETTE = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];
function agentColor(id: string): string {
    if (!AGENT_COLORS[id]) AGENT_COLORS[id] = PALETTE[Object.keys(AGENT_COLORS).length % PALETTE.length];
    return AGENT_COLORS[id];
}

// 事件类型中文
const EVENT_LABELS: Record<string, string> = {
    chain_step_start: "开始处理", chain_step_done: "处理完成", chain_step_waiting: "等待中",
    chain_handoff: "任务交接", team_chain_start: "团队协作开始", team_chain_end: "团队协作完成",
    agent_routed: "分配 Agent", processor_start: "处理器启动", message_enqueued: "消息入队",
    response_ready: "响应就绪", message_received: "收到消息",
};

export default function ConversationsPage() {
    const [conversations, setConversations] = useState<ConversationHistory[]>([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [timeline, setTimeline] = useState<TimelineItem[]>([]);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());

    // 回放动画状态
    const [playing, setPlaying] = useState(false);
    const [playIndex, setPlayIndex] = useState(-1);
    const [speed, setSpeed] = useState(1);
    const playTimer = useRef<NodeJS.Timeout | null>(null);
    const timelineEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        getConversationHistory(undefined, 50, 0)
            .then(d => { setConversations(d.conversations || []); setCount(d.count || 0); })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const loadTimeline = useCallback(async (id: string) => {
        setSelectedId(id);
        setTimeline([]);
        setTimelineLoading(true);
        setExpandedEvents(new Set());
        stopPlay();
        try {
            const d = await getConversationTimeline(id);
            let tl = d.timeline || [];
            // 过滤：handoff 只是路由摘要（@pm → @backend），不显示为消息
            tl = tl.filter(item => {
                if (item.type !== "step") return true;
                const s = item.data as ConversationStep;
                return s.message_type !== "handoff";
            });
            setTimeline(tl);
        } catch { /* ignore */ }
        setTimelineLoading(false);
    }, []); // eslint-disable-line

    const toggleEventExpand = (idx: number) => {
        setExpandedEvents(prev => {
            const n = new Set(prev);
            if (n.has(idx)) n.delete(idx); else n.add(idx);
            return n;
        });
    };

    // — 回放控制 —
    const stopPlay = useCallback(() => {
        setPlaying(false);
        if (playTimer.current) { clearTimeout(playTimer.current); playTimer.current = null; }
    }, []);

    const startPlay = useCallback(() => {
        if (timeline.length === 0) return;
        setPlaying(true);
        if (playIndex < 0 || playIndex >= timeline.length - 1) setPlayIndex(0);
    }, [timeline, playIndex]);

    const resetPlay = useCallback(() => {
        stopPlay();
        setPlayIndex(-1);
        setExpandedEvents(new Set());
    }, [stopPlay]);

    useEffect(() => {
        if (!playing || timeline.length === 0) return;
        if (playIndex >= timeline.length - 1) { setPlaying(false); return; }
        const cur = timeline[Math.max(0, playIndex)];
        const next = timeline[playIndex + 1];
        let delay = Math.max(200, Math.min(3000, (next.timestamp - cur.timestamp))) / speed;
        if (playIndex < 0) delay = 300;
        playTimer.current = setTimeout(() => {
            setPlayIndex(prev => prev + 1);
        }, delay);
        return () => { if (playTimer.current) clearTimeout(playTimer.current); };
    }, [playing, playIndex, timeline, speed]);

    useEffect(() => {
        if (playIndex >= 0) {
            setTimeout(() => timelineEndRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
        }
    }, [playIndex]);

    const skipNext = useCallback(() => {
        if (playIndex < timeline.length - 1) setPlayIndex(playIndex + 1);
    }, [playIndex, timeline]);

    const visibleTimeline = playIndex < 0 ? timeline : timeline.slice(0, playIndex + 1);
    const isReplayMode = playIndex >= 0;

    // 统计对话和事件数量
    const stepCount = timeline.filter(t => t.type === "step").length;
    const eventCount = timeline.filter(t => t.type === "event").length;

    return (
        <div className="flex h-full">
            {/* 左侧 — 会话列表 */}
            <div className="w-80 border-r bg-card flex flex-col shrink-0">
                <div className="px-4 py-3 border-b">
                    <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">会话回放</span>
                        <Badge variant="outline" className="text-[9px] ml-auto">{count} 条</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">结构化会话历史 · 时间线回放</p>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : conversations.length === 0 ? (
                        <div className="p-4 text-center">
                            <History className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">暂无会话记录</p>
                        </div>
                    ) : conversations.map(conv => {
                        const agents = parseAgents(conv.agents);
                        return (
                            <button
                                key={conv.id}
                                onClick={() => loadTimeline(conv.id)}
                                className={`w-full text-left px-4 py-3 border-b transition-colors cursor-pointer
                                    ${selectedId === conv.id ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-secondary"}`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge variant={conv.ended_at > 0 ? "success" : "warning"} className="text-[9px]">
                                        {conv.ended_at > 0 ? "完成" : "进行中"}
                                    </Badge>
                                    {conv.team_name && <Badge variant="info" className="text-[9px]">{conv.team_name}</Badge>}
                                    <span className="text-[9px] text-muted-foreground font-mono">{conv.id.slice(0, 12)}…</span>
                                </div>
                                <p className="text-xs line-clamp-2 text-foreground">{conv.original_message || "[无消息]"}</p>
                                <div className="flex items-center gap-3 mt-1.5 text-[9px] text-muted-foreground">
                                    {agents.length > 0 && <span className="flex items-center gap-0.5"><Bot className="h-2.5 w-2.5" /> {agents.join(", ")}</span>}
                                    <span className="flex items-center gap-0.5"><Users className="h-2.5 w-2.5" /> {conv.sender || "user"}</span>
                                    <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {fmt(conv.started_at)}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground">
                                    <span>{conv.total_messages} 消息</span>
                                    <span>{duration(conv.started_at, conv.ended_at)}</span>
                                    {conv.channel && <span>via {conv.channel}</span>}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 右侧 — 时间线 + 回放 */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {selectedId ? (
                    <>
                        {/* 回放控制条 */}
                        <div className="px-6 py-3 border-b bg-card flex items-center gap-3">
                            <Play className="h-4 w-4 text-primary" />
                            <span className="text-sm font-semibold">时间线回放</span>
                            {stepCount > 0 && <Badge variant="outline" className="text-[9px]">💬 {stepCount} 对话</Badge>}
                            {eventCount > 0 && <Badge variant="outline" className="text-[9px]">⚡ {eventCount} 事件</Badge>}

                            <div className="ml-auto flex items-center gap-2">
                                {isReplayMode && (
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                        {playIndex + 1} / {timeline.length}
                                    </span>
                                )}
                                <Button variant="outline" size="sm" className="text-[10px] h-7 px-2"
                                    onClick={() => setSpeed(s => s >= 4 ? 1 : s * 2)}>
                                    {speed}x
                                </Button>
                                <Button variant={playing ? "secondary" : "default"} size="sm" className="h-7 gap-1"
                                    onClick={playing ? stopPlay : startPlay}
                                    disabled={timeline.length === 0}
                                >
                                    {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                                    {playing ? "暂停" : isReplayMode ? "继续" : "播放"}
                                </Button>
                                <Button variant="outline" size="sm" className="h-7" onClick={skipNext}
                                    disabled={playing || playIndex >= timeline.length - 1}>
                                    <SkipForward className="h-3.5 w-3.5" />
                                </Button>
                                {isReplayMode && (
                                    <Button variant="ghost" size="sm" className="h-7" onClick={resetPlay}>
                                        <RotateCcw className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* 时间线内容 — 聊天气泡风格 */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {timelineLoading ? (
                                <div className="flex items-center justify-center h-32">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : timeline.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-sm text-muted-foreground">暂无时间线数据</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-w-3xl mx-auto">
                                    {visibleTimeline.map((item, idx) => {
                                        const isLatest = isReplayMode && idx === playIndex;

                                        if (item.type === "step") {
                                            const step = item.data as ConversationStep;
                                            const isUser = step.message_type === "user_message";
                                            const isHandoff = step.message_type === "handoff";
                                            const color = agentColor(step.from_agent || "system");

                                            // 用户消息 → 右侧蓝色气泡
                                            if (isUser) {
                                                return (
                                                    <div key={idx} className={`flex justify-end gap-2.5 transition-all duration-500 ${isLatest ? "animate-fade-in" : ""}`}>
                                                        <div className="max-w-[75%]">
                                                            <div className="flex items-center justify-end gap-1.5 mb-1 px-1">
                                                                <span className="text-[9px] text-muted-foreground font-mono">{shortTime(step.timestamp)}</span>
                                                                <span className="text-[10px] font-medium text-muted-foreground">用户</span>
                                                            </div>
                                                            <div className={`bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 ${isLatest ? "ring-2 ring-primary/50 shadow-lg" : ""}`}>
                                                                <p className="text-sm whitespace-pre-wrap leading-relaxed">{step.message}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-500 text-white mt-6">
                                                            <User className="h-4 w-4" />
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            // Agent 回复 → 左侧气泡
                                            return (
                                                <div key={idx} className={`flex justify-start gap-2.5 transition-all duration-500 ${isLatest ? "animate-fade-in" : ""}`}>
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-[11px] font-bold mt-6"
                                                        style={{ backgroundColor: color }}>
                                                        {(step.from_agent || "?")[0].toUpperCase()}
                                                    </div>
                                                    <div className="max-w-[80%]">
                                                        <div className="flex items-center gap-1.5 mb-1 px-1">
                                                            <span className="text-[11px] font-semibold" style={{ color }}>@{step.from_agent}</span>
                                                            {isHandoff && step.to_agent && (
                                                                <>
                                                                    <ArrowRight className="h-3 w-3 text-amber-500" />
                                                                    <span className="text-[11px] font-semibold" style={{ color: agentColor(step.to_agent) }}>@{step.to_agent}</span>
                                                                    <Badge variant="warning" className="text-[8px]">交接</Badge>
                                                                </>
                                                            )}
                                                            {!isHandoff && <Badge variant="success" className="text-[8px]">回复</Badge>}
                                                            <span className="text-[9px] text-muted-foreground font-mono ml-1">{shortTime(step.timestamp)}</span>
                                                        </div>
                                                        <div className={`bg-secondary border rounded-2xl rounded-tl-sm px-4 py-2.5 ${isLatest ? "ring-2 ring-primary/50 shadow-lg" : ""}`}>
                                                            {step.message ? (
                                                                <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ wordBreak: "break-word" }}>
                                                                    {step.message}
                                                                </p>
                                                            ) : (
                                                                <p className="text-xs text-muted-foreground italic">[无消息内容]</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // 事件 → 居中紧凑标签（默认收起）
                                        const event = item.data as ConversationEvent;
                                        const expanded = expandedEvents.has(idx);
                                        let eventDetail = "";
                                        try {
                                            const parsed = JSON.parse(event.event_data || "{}");
                                            const agentId = parsed.agentId || parsed.agentName || "";
                                            eventDetail = JSON.stringify(parsed, null, 2);
                                            const label = EVENT_LABELS[event.event_type] || event.event_type;

                                            return (
                                                <div key={idx} className={`flex justify-center transition-all duration-500 ${isLatest ? "animate-fade-in" : ""}`}>
                                                    <div className="max-w-md w-full">
                                                        <button
                                                            onClick={() => toggleEventExpand(idx)}
                                                            className={`w-full flex items-center justify-center gap-1.5 py-1 px-3 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer ${isLatest ? "text-muted-foreground" : ""}`}
                                                        >
                                                            <Zap className="h-2.5 w-2.5" />
                                                            <span>{label}</span>
                                                            {agentId && <span className="font-mono">@{agentId}</span>}
                                                            <span className="font-mono">{shortTime(event.timestamp)}</span>
                                                            {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                                                        </button>
                                                        {expanded && (
                                                            <div className="mt-1 text-[10px] font-mono bg-secondary/30 border p-2 rounded whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto"
                                                                style={{ wordBreak: "break-word" }}>
                                                                {eventDetail}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        } catch {
                                            return (
                                                <div key={idx} className="flex justify-center">
                                                    <span className="text-[10px] text-muted-foreground/40 font-mono">
                                                        ⚡ {event.event_type} · {shortTime(event.timestamp)}
                                                    </span>
                                                </div>
                                            );
                                        }
                                    })}
                                    <div ref={timelineEndRef} />

                                    {isReplayMode && playIndex >= timeline.length - 1 && !playing && (
                                        <div className="text-center py-4">
                                            <Badge variant="success" className="text-xs">✅ 回放完成</Badge>
                                            <p className="text-[10px] text-muted-foreground mt-1">共 {stepCount} 条对话 · {eventCount} 个事件</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <History className="h-12 w-12 text-muted-foreground/15 mx-auto mb-3" />
                            <p className="text-sm text-muted-foreground">选择左侧会话查看时间线回放</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">点击播放按钮可观看动画回放</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
