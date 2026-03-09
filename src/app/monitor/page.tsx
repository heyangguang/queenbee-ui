"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePolling } from "@/lib/hooks";
import {
    getAgents, getSessions, getAgentStats, getStatsTimeline, subscribeToActivity,
    getQueueStatus, recoverStaleMessages, killAgent, killSession,
    getProcessingMessages, recoverProcessingMessage, discardProcessingMessage,
    type AgentConfig, type AgentActivity, type SessionInfo, type AgentStats, type ConversationHistory,
    type QueueStatus, type ProcessingMessage,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Activity, Zap, BarChart3, Clock, Bot, MessageSquare,
    AlertCircle, CheckCircle2, XCircle, Timer, TrendingUp, RefreshCcw, Loader2, Skull,
    RotateCcw, Trash2, Inbox,
} from "lucide-react";

type Tab = "realtime" | "stats" | "timeline";

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    active: { label: "运行中", color: "text-green-400", icon: <Zap className="h-3.5 w-3.5 text-green-400" /> },
    idle_warning: { label: "疑似卡住", color: "text-amber-400", icon: <AlertCircle className="h-3.5 w-3.5 text-amber-400" /> },
    idle_killed: { label: "空闲终止", color: "text-orange-400", icon: <XCircle className="h-3.5 w-3.5 text-orange-400" /> },
    timeout_killed: { label: "超时终止", color: "text-red-400", icon: <XCircle className="h-3.5 w-3.5 text-red-400" /> },
    done: { label: "已完成", color: "text-slate-400", icon: <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" /> },
};

function formatDuration(sec: number): string {
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function timeAgo(ms: number): string {
    const sec = Math.floor((Date.now() - ms) / 1000);
    if (sec < 60) return `${sec}s 前`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m 前`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h 前`;
    return `${Math.floor(sec / 86400)}d 前`;
}

export default function MonitorPage() {
    const [tab, setTab] = useState<Tab>("realtime");
    const [agents, setAgents] = useState<Record<string, AgentConfig>>({});
    const [activities, setActivities] = useState<Map<string, AgentActivity>>(new Map());
    const sseRef = useRef<(() => void) | null>(null);
    // 每秒 tick 驱动 elapsedSec 客户端实时计算（不再依赖服务端 30 秒才更新一次的值）
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const iv = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(iv);
    }, []);

    // 加载 agent 配置
    useEffect(() => { getAgents().then(setAgents).catch(() => { }); }, []);

    // SSE 订阅活跃度
    useEffect(() => {
        const unsub = subscribeToActivity((a) => {
            setActivities(prev => {
                const next = new Map(prev);
                if (a.status === "done") next.delete(a.agentId);
                else next.set(a.agentId, a);
                return next;
            });
        });
        sseRef.current = unsub;
        return () => { unsub(); };
    }, []);

    // Sessions 轮询
    const { data: sessionsData } = usePolling<{ sessions: SessionInfo[]; count: number }>(getSessions, 5000);
    const sessions = sessionsData?.sessions || [];

    // 统计数据
    const { data: agentStatsData } = usePolling<AgentStats[]>(getAgentStats, 10000);
    const agentStats = agentStatsData || [];

    // 时间线
    const { data: timelineData } = usePolling<ConversationHistory[]>(() => getStatsTimeline(20), 10000);
    const timeline = timelineData || [];

    // 队列状态（用于显示 processing 数量）
    const { data: queueStatus, refresh: refreshQueue } = usePolling<QueueStatus>(getQueueStatus, 5000);
    const [recovering, setRecovering] = useState(false);
    const [recoverResult, setRecoverResult] = useState<string | null>(null);

    // Processing 消息轮询
    const { data: processingMsgs, refresh: refreshProcessing } = usePolling<ProcessingMessage[]>(getProcessingMessages, 5000);
    const processingMessages = processingMsgs || [];
    const [actioningMsg, setActioningMsg] = useState<number | null>(null);

    const handleRecover = useCallback(async () => {
        setRecovering(true);
        setRecoverResult(null);
        try {
            const res = await recoverStaleMessages({ kill: true });
            const killedInfo = res.killed?.length ? `强杀 ${res.killed.join(", ")}` : "";
            setRecoverResult(`已恢复 ${res.recovered} 条消息${killedInfo ? ` (${killedInfo})` : ""}`);
            refreshQueue();
            setTimeout(() => setRecoverResult(null), 5000);
        } catch (e) {
            setRecoverResult("恢复失败");
        } finally {
            setRecovering(false);
        }
    }, [refreshQueue]);

    // 单 agent 强杀
    const [killingAgent, setKillingAgent] = useState<string | null>(null);
    const handleKillAgent = useCallback(async (agentId: string) => {
        setKillingAgent(agentId);
        try {
            const res = await killAgent(agentId);
            setRecoverResult(`已强杀 @${agentId}${res.recovered > 0 ? `，恢复 ${res.recovered} 条消息` : ""}`);
            refreshQueue();
            setTimeout(() => setRecoverResult(null), 5000);
        } catch (e) {
            setRecoverResult(`强杀 @${agentId} 失败`);
        } finally {
            setKillingAgent(null);
        }
    }, [refreshQueue]);

    // 终止整个会话
    const [killingSession, setKillingSession] = useState<string | null>(null);
    const handleKillSession = useCallback(async (sessionId: string) => {
        setKillingSession(sessionId);
        try {
            const res = await killSession(sessionId);
            const killedInfo = res.killed_agents?.length ? `强杀 ${res.killed_agents.join(", ")}` : "无活跃进程";
            setRecoverResult(`已终止会话 (${killedInfo}${res.recovered > 0 ? `，恢复 ${res.recovered} 条消息` : ""})`);
            refreshQueue();
            refreshProcessing();
            setTimeout(() => setRecoverResult(null), 5000);
        } catch (e) {
            setRecoverResult(`终止会话失败`);
        } finally {
            setKillingSession(null);
        }
    }, [refreshQueue, refreshProcessing]);

    // 单条 processing 消息操作
    const handleRecoverMsg = useCallback(async (id: number) => {
        setActioningMsg(id);
        try {
            await recoverProcessingMessage(id);
            setRecoverResult(`消息 #${id} 已恢复为待处理`);
            refreshProcessing();
            refreshQueue();
            setTimeout(() => setRecoverResult(null), 3000);
        } catch { setRecoverResult(`恢复消息 #${id} 失败`); }
        finally { setActioningMsg(null); }
    }, [refreshProcessing, refreshQueue]);

    const handleDiscardMsg = useCallback(async (id: number) => {
        setActioningMsg(id);
        try {
            await discardProcessingMessage(id);
            setRecoverResult(`消息 #${id} 已丢弃`);
            refreshProcessing();
            refreshQueue();
            setTimeout(() => setRecoverResult(null), 3000);
        } catch { setRecoverResult(`丢弃消息 #${id} 失败`); }
        finally { setActioningMsg(null); }
    }, [refreshProcessing, refreshQueue]);

    const activeAgents = Array.from(activities.values());
    const tabs = [
        { id: "realtime" as Tab, label: "实时状态", icon: <Activity className="h-3.5 w-3.5" />, badge: sessions.length + activeAgents.length + processingMessages.length },
        { id: "stats" as Tab, label: "执行统计", icon: <BarChart3 className="h-3.5 w-3.5" /> },
        { id: "timeline" as Tab, label: "会话时间线", icon: <Clock className="h-3.5 w-3.5" />, badge: timeline.length },
    ];

    return (
        <div className="p-6 space-y-5 animate-fade-in">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" /> 运行监控
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">实时状态、执行统计、会话历史</p>
                </div>
                {/* 恢复卡死消息按钮 */}
                <div className="flex items-center gap-2">
                    {recoverResult && (
                        <span className="text-xs text-green-500 animate-fade-in">{recoverResult}</span>
                    )}
                    {queueStatus && queueStatus.processing > 0 && (
                        <Badge variant="warning" className="text-[10px]">{queueStatus.processing} 处理中</Badge>
                    )}
                    <Button variant="outline" size="sm" onClick={handleRecover} disabled={recovering}
                        title="立即恢复所有卡在处理中的消息">
                        {recovering ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCcw className="h-3.5 w-3.5 mr-1" />}
                        恢复卡死消息
                    </Button>
                </div>
            </div>

            {/* Tab 切换 */}
            <div className="flex gap-px border-b">
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${tab === t.id ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
                        {t.icon} {t.label}
                        {t.badge ? <Badge variant="secondary" className="text-[9px] ml-1">{t.badge}</Badge> : null}
                    </button>
                ))}
            </div>

            {/* 实时状态 Tab */}
            {tab === "realtime" && (
                <div className="space-y-4">
                    {/* 活跃 Agents */}
                    {activeAgents.length > 0 && (
                        <div className="space-y-2">
                            <h2 className="text-sm font-semibold flex items-center gap-1.5"><Zap className="h-4 w-4 text-green-500" /> 正在工作的 Agent</h2>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {activeAgents.map(a => {
                                    const st = STATUS_MAP[a.status] || STATUS_MAP.active;
                                    const agentName = agents[a.agentId]?.name || a.agentId;
                                    // 客户端实时计算运行时长，不依赖服务端 30 秒一次的更新
                                    const liveElapsed = a.startedAt > 0
                                        ? Math.max(0, Math.floor((Date.now() - a.startedAt) / 1000))
                                        : a.elapsedSec;
                                    // 抑制 tick lint（驱动实时刷新用）
                                    void tick;
                                    return (
                                        <Card key={a.agentId} className="hover:border-primary/30 transition-colors">
                                            <CardContent className="p-3 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        {st.icon}
                                                        <span className="text-sm font-medium">{agentName}</span>
                                                    </div>
                                                    <Badge variant="outline" className={`text-[10px] ${st.color}`}>{st.label}</Badge>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1"><Timer className="h-3 w-3" /> {formatDuration(liveElapsed)}</span>
                                                    <span>{formatBytes(a.stdoutBytes)} 输出</span>
                                                    {a.idleSec > 30 && <span className="text-amber-500">空闲 {a.idleSec}s</span>}
                                                    <Button variant="destructive" size="sm" className="h-5 px-2 text-[10px] ml-auto"
                                                        onClick={() => handleKillAgent(a.agentId)}
                                                        disabled={killingAgent === a.agentId}>
                                                        {killingAgent === a.agentId
                                                            ? <Loader2 className="h-3 w-3 animate-spin mr-0.5" />
                                                            : <Skull className="h-3 w-3 mr-0.5" />}
                                                        强杀
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 活跃会话 */}
                    {sessions.length > 0 ? (
                        <div className="space-y-2">
                            <h2 className="text-sm font-semibold flex items-center gap-1.5"><MessageSquare className="h-4 w-4 text-blue-500" /> 活跃会话 ({sessions.length})</h2>
                            <div className="space-y-2">
                                {sessions.map(s => (
                                    <Card key={s.id} className="hover:border-primary/30 transition-colors">
                                        <CardContent className="p-3 space-y-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" className="text-[10px] font-mono">{s.id.substring(0, 16)}...</Badge>
                                                {s.team && <Badge variant="info" className="text-[10px]">{s.team}</Badge>}
                                                <Badge variant={s.pending > 0 ? "warning" : "success"} className="text-[10px]">
                                                    {s.pending > 0 ? `${s.pending} 处理中` : "完成"}
                                                </Badge>
                                            </div>
                                            {s.original_message && (
                                                <p className="text-xs text-muted-foreground bg-secondary px-3 py-1.5 line-clamp-2">{s.original_message}</p>
                                            )}
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1"><Bot className="h-3 w-3" /> {s.sender}</span>
                                                <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {s.total_messages} 消息</span>
                                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDuration(s.elapsed_seconds)}</span>
                                            </div>
                                            {s.pending_agents?.length > 0 && (
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5">
                                                        <AlertCircle className="h-3 w-3 text-amber-500" />
                                                        {s.pending_agents.map(a => <Badge key={a} variant="warning" className="text-[10px]">@{a}</Badge>)}
                                                    </div>
                                                    <Button variant="destructive" size="sm" className="h-6 px-2.5 text-[11px]"
                                                        onClick={() => handleKillSession(s.id)}
                                                        disabled={killingSession === s.id}>
                                                        {killingSession === s.id
                                                            ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                            : <Skull className="h-3 w-3 mr-1" />}
                                                        终止会话
                                                    </Button>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ) : activeAgents.length === 0 ? (
                        <Card>
                            <CardContent className="text-center py-16">
                                <Activity className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                                <p className="text-sm text-muted-foreground">暂无活跃任务</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">当 Agent 开始工作时将实时显示</p>
                            </CardContent>
                        </Card>
                    ) : null}

                    {/* Processing 消息（卡在处理中的） */}
                    {processingMessages.length > 0 && (
                        <div className="space-y-2">
                            <h2 className="text-sm font-semibold flex items-center gap-1.5"><Inbox className="h-4 w-4 text-orange-500" /> 处理中的消息 ({processingMessages.length})</h2>
                            <div className="space-y-2">
                                {processingMessages.map(m => {
                                    const msgPreview = m.message.length > 100 ? m.message.substring(0, 100) + "..." : m.message;
                                    const stuckSec = Math.floor((Date.now() - m.updated_at) / 1000);
                                    void tick;
                                    return (
                                        <Card key={m.id} className="hover:border-orange-500/30 transition-colors border-orange-500/10">
                                            <CardContent className="p-3 space-y-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge variant="outline" className="text-[10px] font-mono">#{m.id}</Badge>
                                                    {m.agent && <Badge variant="warning" className="text-[10px]">@{m.agent}</Badge>}
                                                    {m.from_agent && <Badge variant="secondary" className="text-[10px]">来自 @{m.from_agent}</Badge>}
                                                    <Badge variant="outline" className="text-[10px] text-orange-400">卡住 {formatDuration(stuckSec)}</Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground bg-secondary px-3 py-1.5 line-clamp-2">{msgPreview}</p>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                        <span className="flex items-center gap-1"><Bot className="h-3 w-3" /> {m.sender}</span>
                                                        <span>{m.channel}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]"
                                                            onClick={() => handleRecoverMsg(m.id)}
                                                            disabled={actioningMsg === m.id}>
                                                            {actioningMsg === m.id
                                                                ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                                : <RotateCcw className="h-3 w-3 mr-1" />}
                                                            立即恢复
                                                        </Button>
                                                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                                                            onClick={() => handleDiscardMsg(m.id)}
                                                            disabled={actioningMsg === m.id}>
                                                            <Trash2 className="h-3 w-3 mr-1" />
                                                            丢弃
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 执行统计 Tab */}
            {tab === "stats" && (
                <div className="space-y-4">
                    {agentStats.length > 0 ? (
                        <>
                            {/* 概览卡片 */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <StatCardMini icon={<Bot className="h-4 w-4" />} label="Agent 总数" value={agentStats.length} color="text-primary" />
                                <StatCardMini icon={<Zap className="h-4 w-4" />} label="总执行次数" value={agentStats.reduce((s, a) => s + a.total_sessions, 0)} color="text-green-500" />
                                <StatCardMini icon={<Timer className="h-4 w-4" />} label="总执行时长"
                                    value={formatDuration(agentStats.reduce((s, a) => s + a.total_duration_sec, 0))} color="text-blue-500" isStr />
                                <StatCardMini icon={<TrendingUp className="h-4 w-4" />} label="平均时长"
                                    value={formatDuration(Math.round(agentStats.reduce((s, a) => s + a.avg_duration_sec, 0) / agentStats.length))} color="text-amber-500" isStr />
                            </div>

                            {/* Agent 列表 */}
                            <div className="space-y-2">
                                {agentStats.map(a => {
                                    const agentName = agents[a.agent_id]?.name || a.agent_id;
                                    return (
                                        <Card key={a.agent_id} className="hover:border-primary/30 transition-colors">
                                            <CardContent className="p-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-8 w-8 items-center justify-center bg-primary/10 text-primary">
                                                            <Bot className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold">{agentName}</p>
                                                            <p className="text-[10px] text-muted-foreground font-mono">@{a.agent_id}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-6 text-xs text-muted-foreground">
                                                        <div className="text-center">
                                                            <p className="text-lg font-bold text-foreground">{a.total_sessions}</p>
                                                            <p className="text-[10px]">执行次数</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-lg font-bold text-foreground">{formatDuration(a.avg_duration_sec)}</p>
                                                            <p className="text-[10px]">平均时长</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-lg font-bold text-foreground">{formatBytes(a.total_stdout_bytes)}</p>
                                                            <p className="text-[10px]">总输出</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-[10px]">{a.last_active_at > 0 ? timeAgo(a.last_active_at) : "-"}</p>
                                                            <p className="text-[10px]">最后活跃</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <Card>
                            <CardContent className="text-center py-16">
                                <BarChart3 className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                                <p className="text-sm text-muted-foreground">暂无执行数据</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">运行任务后将自动记录</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* 会话时间线 Tab */}
            {tab === "timeline" && (
                <div className="space-y-2">
                    {timeline.length > 0 ? timeline.map(conv => {
                        let agentList: string[] = [];
                        try { agentList = JSON.parse(conv.agents || "[]"); } catch { /* skip */ }
                        return (
                            <Card key={conv.id} className="hover:border-primary/30 transition-colors">
                                <CardContent className="p-4 space-y-2">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0 space-y-1.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" className="text-[10px] font-mono">{conv.id.substring(0, 16)}...</Badge>
                                                {conv.team_name && <Badge variant="info" className="text-[10px]">{conv.team_name}</Badge>}
                                                <Badge variant="secondary" className="text-[10px]">{conv.total_rounds} 轮</Badge>
                                            </div>
                                            {conv.original_message && (
                                                <p className="text-xs text-muted-foreground bg-secondary px-3 py-1.5 line-clamp-2">{conv.original_message}</p>
                                            )}
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1"><Timer className="h-3 w-3" /> {formatDuration(conv.duration_sec)}</span>
                                                <span className="flex items-center gap-1"><Bot className="h-3 w-3" /> {conv.sender}</span>
                                                <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {conv.total_messages} 消息</span>
                                            </div>
                                            {agentList.length > 0 && (
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    {agentList.map(a => <Badge key={a} variant="secondary" className="text-[10px]">@{a}</Badge>)}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap ml-3">
                                            {conv.started_at > 0 ? timeAgo(conv.started_at) : ""}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    }) : (
                        <Card>
                            <CardContent className="text-center py-16">
                                <Clock className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                                <p className="text-sm text-muted-foreground">暂无会话历史</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">完成的会话将自动显示在这里</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}

function StatCardMini({ icon, label, value, color, isStr }: { icon: React.ReactNode; label: string; value: number | string; color: string; isStr?: boolean }) {
    return (
        <Card>
            <CardContent className="p-3">
                <div className={`${color} mb-1`}>{icon}</div>
                <p className="text-xl font-bold tracking-tight">{isStr ? value : value}</p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
            </CardContent>
        </Card>
    );
}
