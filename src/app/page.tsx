"use client";

import { usePolling, useSSE } from "@/lib/hooks";
import {
  getAgents, getTeams, getQueueStatus, getAgentStats, getStatsTimeline,
  type AgentConfig, type TeamConfig, type QueueStatus, type AgentStats, type ConversationHistory,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Bot, Users, Inbox,
  CheckCircle2, AlertTriangle, Clock,
  Building2, Skull, Activity, Zap,
  Timer, TrendingUp, BarChart3, MessageSquare,
} from "lucide-react";

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

function timeAgo(ms: number): string {
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60) return `${sec}s 前`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m 前`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h 前`;
  return `${Math.floor(sec / 86400)}d 前`;
}

export default function DashboardPage() {
  const { data: agents } = usePolling<Record<string, AgentConfig>>(getAgents, 5000);
  const { data: teams } = usePolling<Record<string, TeamConfig>>(getTeams, 5000);
  const { data: queue } = usePolling<QueueStatus>(getQueueStatus, 3000);
  const { data: agentStats } = usePolling<AgentStats[]>(getAgentStats, 15000);
  const { data: timeline } = usePolling<ConversationHistory[]>(() => getStatsTimeline(5), 15000);
  const { events } = useSSE(5);

  const agentCount = agents ? Object.keys(agents).length : 0;
  const teamCount = teams ? Object.keys(teams).length : 0;
  const latestEvent = events[0];
  const totalExecs = agentStats?.reduce((s, a) => s + a.total_sessions, 0) || 0;
  const avgDuration = agentStats && agentStats.length > 0
    ? Math.round(agentStats.reduce((s, a) => s + a.avg_duration_sec, 0) / agentStats.length) : 0;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" /> 仪表盘
        </h1>
        <p className="text-sm text-muted-foreground mt-1">QueenBee 系统实时概览</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={<Bot className="h-4 w-4" />} label="Agents" value={agentCount} color="text-primary" />
        <StatCard icon={<Users className="h-4 w-4" />} label="Teams" value={teamCount} color="text-violet-600" />
        <StatCard icon={<Activity className="h-4 w-4" />} label="活跃会话" value={queue?.active_conversations ?? 0} color="text-green-600" />
        <StatCard icon={<Inbox className="h-4 w-4" />} label="待处理" value={queue?.pending ?? 0} color="text-amber-600" />
        <StatCard icon={<Zap className="h-4 w-4" />} label="总执行次数" value={totalExecs} color="text-sky-600" />
        <StatCard icon={<Timer className="h-4 w-4" />} label="平均时长" value={avgDuration > 0 ? formatDuration(avgDuration) : "-"} color="text-emerald-600" isStr />
      </div>

      {/* 告警条 */}
      {queue && (queue.dead > 0 || queue.responses_pending > 0) && (
        <div className="flex gap-3 flex-wrap">
          {queue.dead > 0 && (
            <Link href="/dead-letters" className="flex items-center gap-2 border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 hover:bg-red-100 transition-colors">
              <AlertTriangle className="h-4 w-4" /> {queue.dead} 条死信消息
            </Link>
          )}
          {queue.responses_pending > 0 && (
            <div className="flex items-center gap-2 border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
              <Clock className="h-4 w-4" /> {queue.responses_pending} 条待发送响应
            </div>
          )}
        </div>
      )}

      {/* 实时状态条 */}
      {latestEvent && (
        <div className="flex items-center gap-2 border bg-card px-4 py-2.5">
          <div className="h-2 w-2 bg-green-500 animate-pulse-dot" />
          <span className="text-xs text-muted-foreground">最新事件：</span>
          <Badge variant="outline" className="text-[10px] font-mono">{latestEvent.type}</Badge>
          {latestEvent.agentId ? <Badge variant="secondary" className="text-[10px]">@{String(latestEvent.agentId)}</Badge> : null}
        </div>
      )}

      {/* 最近任务 + 快捷入口 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 最近完成的任务 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-primary" /> 最近任务</h2>
            <Link href="/monitor" className="text-[10px] text-muted-foreground hover:text-primary transition-colors">查看全部 →</Link>
          </div>
          {timeline && timeline.length > 0 ? timeline.map(conv => {
            let agentList: string[] = [];
            try { agentList = JSON.parse(conv.agents || "[]"); } catch { /* skip */ }
            return (
              <Card key={conv.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-3 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {conv.team_name && <Badge variant="info" className="text-[10px]">{conv.team_name}</Badge>}
                    <Badge variant="secondary" className="text-[10px]">{conv.total_rounds} 轮 · {formatDuration(conv.duration_sec)}</Badge>
                    <span className="text-[10px] text-muted-foreground/60 ml-auto">{timeAgo(conv.started_at)}</span>
                  </div>
                  {conv.original_message && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{conv.original_message}</p>
                  )}
                  {agentList.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {agentList.map(a => <Badge key={a} variant="outline" className="text-[9px]">@{a}</Badge>)}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          }) : (
            <Card>
              <CardContent className="text-center py-10">
                <TrendingUp className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">暂无任务数据</p>
                <p className="text-xs text-muted-foreground/60 mt-1">完成任务后将自动展示</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 快捷入口 */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-1.5"><BarChart3 className="h-4 w-4 text-primary" /> 快捷入口</h2>
          <div className="grid grid-cols-2 gap-2">
            <QuickLink href="/agents" icon={<Bot className="h-5 w-5" />} label="Agent 管理" desc={`${agentCount} 个 Agent`} color="text-primary" />
            <QuickLink href="/teams" icon={<Users className="h-5 w-5" />} label="Team 管理" desc={`${teamCount} 个 Team`} color="text-violet-600" />
            <QuickLink href="/monitor" icon={<Activity className="h-5 w-5" />} label="运行监控" desc="实时状态 · 统计" color="text-green-600" />
            <QuickLink href="/office" icon={<Building2 className="h-5 w-5" />} label="虚拟办公室" desc="实时动画监控" color="text-amber-600" />
            <QuickLink href="/conversations" icon={<MessageSquare className="h-5 w-5" />} label="会话回放" desc="历史对话详情" color="text-slate-600" />
            <QuickLink href="/dead-letters" icon={<Skull className="h-5 w-5" />} label="死信队列" desc={`${queue?.dead ?? 0} 条死信`} color="text-red-600" />
            <QuickLink href="/logs" icon={<CheckCircle2 className="h-5 w-5" />} label="系统日志" desc="查看运行日志" color="text-emerald-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, isStr }: { icon: React.ReactNode; label: string; value: number | string; color: string; isStr?: boolean }) {
  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="p-3">
        <div className={`${color} mb-1.5`}>{icon}</div>
        <p className="text-2xl font-bold tracking-tight">{isStr ? value : value}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wider">{label}</p>
      </CardContent>
    </Card>
  );
}

function QuickLink({ href, icon, label, desc, color }: { href: string; icon: React.ReactNode; label: string; desc: string; color: string }) {
  return (
    <Link href={href}>
      <Card className="hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer h-full">
        <CardContent className="p-3 flex items-start gap-2.5">
          <div className={`${color} mt-0.5`}>{icon}</div>
          <div>
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
