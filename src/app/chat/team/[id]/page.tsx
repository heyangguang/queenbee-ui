"use client";

import { use, useMemo } from "react";
import { usePolling } from "@/lib/hooks";
import { getAgents, getTeams, listProjects, type AgentConfig, type TeamConfig, type Project } from "@/lib/api";
import { ChatView } from "@/components/chat-view";
import { Users } from "lucide-react";

export default function TeamChatPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { data: agents } = usePolling<Record<string, AgentConfig>>(getAgents, 30000);
    const { data: teams } = usePolling<Record<string, TeamConfig>>(getTeams, 30000);
    const { data: allProjects } = usePolling<Project[]>(async () => { const r = await listProjects(); return r.projects || []; }, 30000);
    const team = teams?.[id];
    const label = team?.name || id;

    // 用 useMemo 缓存成员列表，只在 agents/teams 真正变化时重建
    const members = useMemo(() => [
        // 所有团队
        ...Object.entries(teams || {}).map(([tid, t]) => ({
            id: tid,
            name: t.name || tid,
            isTeam: true,
        })),
        // 当前团队的 agent 成员
        ...(team?.agents || []).map((aid) => ({
            id: aid,
            name: agents?.[aid]?.name || aid,
        })),
    ], [agents, teams, team]);

    // 过滤出当前团队关联的项目
    const teamProjects = useMemo(() => {
        if (!allProjects) return [];
        return allProjects
            .filter(p => p.teams?.includes(id))
            .map(p => ({ id: p.id, name: p.name }));
    }, [allProjects, id]);

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 border-b px-4 py-2.5 bg-card">
                <div className="flex h-7 w-7 items-center justify-center bg-blue-50 text-xs font-bold text-primary">
                    {label.charAt(0).toUpperCase()}
                </div>
                <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" /> @{id}{team && <span>· {team.agents.length} 成员 · Leader: {team.leader_agent}</span>}
                    </p>
                </div>
            </div>
            <div className="flex-1 min-h-0">
                <ChatView
                    target={`@${id}`}
                    targetLabel={label}
                    teamId={id}
                    members={members}
                    projects={teamProjects}
                />
            </div>
        </div>
    );
}
