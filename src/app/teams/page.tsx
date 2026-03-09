"use client";

import { useState, useCallback } from "react";
import { usePolling, invalidatePolling } from "@/lib/hooks";
import { getAgents, getTeams, deleteTeam, type AgentConfig, type TeamConfig } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Crown, Bot, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";

export default function TeamsPage() {
    const { data: agents } = usePolling<Record<string, AgentConfig>>(getAgents, 10000);
    const { data: teams, refresh } = usePolling<Record<string, TeamConfig>>(getTeams, 5000, "teams");
    const [deleting, setDeleting] = useState("");

    const handleDelete = useCallback(async (id: string) => {
        setDeleting(id);
        try { await deleteTeam(id); refresh(); invalidatePolling("teams"); } finally { setDeleting(""); }
    }, [refresh]);

    return (
        <div className="p-6 space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold tracking-tight flex items-center gap-2"><Users className="h-5 w-5 text-violet-600" /> Team 管理</h1>
                    <p className="text-sm text-muted-foreground mt-1">创建、编辑和管理 Agent 团队</p>
                </div>
                <Link href="/teams/new"><Button><Plus className="h-4 w-4" /> 新建 Team</Button></Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {teams && Object.entries(teams).map(([id, team]) => (
                    <Card key={id} className="hover:border-violet-400/30 transition-colors group">
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center bg-violet-100 text-sm font-bold text-violet-700">{team.name.charAt(0).toUpperCase()}</div>
                                    <div><p className="font-semibold text-sm">{team.name}</p><p className="text-xs text-muted-foreground">@{id}</p></div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Link href={`/teams/${id}/edit`}><Button variant="ghost" size="icon"><Pencil className="h-3.5 w-3.5" /></Button></Link>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(id)} disabled={deleting === id}>{deleting === id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}</Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Crown className="h-3.5 w-3.5 text-amber-500" /> Leader:
                                    <Badge variant="secondary" className="text-[10px]">{agents?.[team.leader_agent]?.name || team.leader_agent}</Badge>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {team.agents.map((aid) => (
                                        <div key={aid} className="flex items-center gap-1 bg-secondary px-2 py-0.5 text-[10px]">
                                            <Bot className="h-2.5 w-2.5" /> {agents?.[aid]?.name || aid}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {teams && Object.keys(teams).length === 0 && (
                <Card><CardContent className="text-center py-16"><Users className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" /><p className="text-sm text-muted-foreground">暂无 Team，点击上方按钮创建</p></CardContent></Card>
            )}
        </div>
    );
}
