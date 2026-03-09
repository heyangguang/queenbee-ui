"use client";

import { useState, useMemo } from "react";
import { usePolling } from "@/lib/hooks";
import { getAgents, getTeams, type AgentConfig, type TeamConfig } from "@/lib/api";
import { ChatView } from "@/components/chat-view";
import { Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Clock } from "lucide-react";
import Link from "next/link";

export default function ChatPage() {
    const { data: agents } = usePolling<Record<string, AgentConfig>>(getAgents, 5000);
    const { data: teams } = usePolling<Record<string, TeamConfig>>(getTeams, 5000);
    const [target, setTarget] = useState("");

    const targetOptions: { value: string; label: string; group: string }[] = [
        { value: "", label: "默认 Agent", group: "" },
    ];
    if (agents) {
        for (const [id, agent] of Object.entries(agents)) {
            targetOptions.push({ value: `@${id}`, label: agent.name, group: "agent" });
        }
    }
    if (teams) {
        for (const [id, team] of Object.entries(teams)) {
            targetOptions.push({ value: `@${id}`, label: team.name, group: "team" });
        }
    }

    const selectedLabel = target ? targetOptions.find((o) => o.value === target)?.label || target : "新对话";

    // 判断是否选中了 Team，提取 teamId 和成员列表
    const teamId = useMemo(() => {
        if (!target.startsWith("@") || !teams) return undefined;
        const id = target.slice(1);
        return teams[id] ? id : undefined;
    }, [target, teams]);

    const members = useMemo(() => {
        if (!teamId || !teams || !teams[teamId]) return [];
        return (teams[teamId].agents || []).map((aid) => ({
            id: aid,
            name: agents?.[aid]?.name || aid,
        }));
    }, [teamId, teams, agents]);

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 bg-card shrink-0">
                <div className="flex items-center gap-3">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <label className="text-xs font-medium text-muted-foreground shrink-0">发送至：</label>
                    <Select value={target} onChange={(e) => setTarget(e.target.value)} className="max-w-xs text-sm">
                        {targetOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.group === "team" ? "👥 " : opt.group === "agent" ? "🤖 " : ""}{opt.label}
                            </option>
                        ))}
                    </Select>
                    {target && <Badge variant="outline" className="text-[10px] font-mono">{target}</Badge>}
                </div>
                <Link href="/chat/history" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Clock className="h-3.5 w-3.5" /> 历史记录
                </Link>
            </div>
            <div className="flex-1 min-h-0">
                <ChatView
                    target={target}
                    targetLabel={selectedLabel}
                    teamId={teamId}
                    members={members}
                />
            </div>
        </div>
    );
}
