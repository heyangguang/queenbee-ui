"use client";

import { useState, useCallback } from "react";
import { usePolling } from "@/lib/hooks";
import { getAgents, deleteAgent, type AgentConfig } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProviderLogo, getProviderColor } from "@/components/ui/provider-logo";
import { Bot, Plus, Pencil, Trash2, FolderOpen, MessageSquare, Sparkles, X, Check, Brain } from "lucide-react";
import Link from "next/link";

export default function AgentsPage() {
    const { data: agents, refresh } = usePolling<Record<string, AgentConfig>>(getAgents, 5000);
    const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
    const [confirmId, setConfirmId] = useState<string | null>(null);

    const handleDelete = useCallback(async (id: string) => {
        setConfirmId(null);
        setDeletedIds(prev => new Set(prev).add(id));
        try {
            await deleteAgent(id);
            refresh();
        } catch {
            setDeletedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
        }
    }, [refresh]);

    const agentList = agents ? Object.entries(agents).filter(([id]) => !deletedIds.has(id)) : [];

    return (
        <div className="p-6 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold tracking-tight flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /> Agent 管理</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">{agentList.length} 个 Agent 已配置</p>
                </div>
                <Link href="/agents/new"><Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> 新建</Button></Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                {agentList.map(([id, agent]) => {
                    const colors = getProviderColor(agent.provider);
                    const modelDisplay = agent.model || "自动";
                    const promptPreview = agent.system_prompt ? agent.system_prompt.replace(/^#\s+/gm, "").trim().slice(0, 50) : "";
                    const dirShort = agent.working_directory ? agent.working_directory.replace(/^\/Users\/\w+\//, "~/") : "";
                    const isConfirming = confirmId === id;
                    return (
                        <Card key={id} className={`transition-colors group relative ${isConfirming ? "border-destructive/50 bg-destructive/5" : "hover:border-primary/30"}`}>
                            <CardContent className="p-3">
                                {/* 确认删除覆盖层 */}
                                {isConfirming && (
                                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-[inherit]">
                                        <div className="text-center space-y-2">
                                            <p className="text-xs font-medium">确认删除 <span className="font-bold">{agent.name}</span>？</p>
                                            <div className="flex gap-2 justify-center">
                                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmId(null)}>
                                                    <X className="h-3 w-3 mr-1" /> 取消
                                                </Button>
                                                <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleDelete(id)}>
                                                    <Check className="h-3 w-3 mr-1" /> 确认
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {/* 第一行：头像 + 名称 + 操作 */}
                                <div className="flex items-center gap-2.5 mb-2">
                                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center text-xs font-bold rounded-md ${colors.bg} ${colors.text}`}>
                                        {agent.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-semibold text-sm truncate">{agent.name}</span>
                                            <span className="text-[9px] text-muted-foreground/50 font-mono">@{id}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-0.5 shrink-0 transition-opacity opacity-0 group-hover:opacity-100">
                                        <Link href={`/agents/${id}/memory`}><Button variant="ghost" size="icon" className="h-6 w-6" title="长期记忆"><Brain className="h-3 w-3" /></Button></Link>
                                        <Link href={`/agents/${id}/soul`}><Button variant="ghost" size="icon" className="h-6 w-6" title="Agent Soul"><Sparkles className="h-3 w-3" /></Button></Link>
                                        <Link href={`/agents/${id}/edit`}><Button variant="ghost" size="icon" className="h-6 w-6"><Pencil className="h-3 w-3" /></Button></Link>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setConfirmId(id)}>
                                            <Trash2 className="h-3 w-3 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                                {/* Provider + Model */}
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <ProviderLogo provider={agent.provider} size={13} />
                                    <span className="text-[11px] text-muted-foreground">{agent.provider}</span>
                                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                                        {modelDisplay === "自动" ? <><Sparkles className="h-2.5 w-2.5 mr-0.5" />自动</> : modelDisplay}
                                    </Badge>
                                </div>
                                {/* 工作目录 */}
                                {dirShort && (
                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50 mb-1">
                                        <FolderOpen className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{dirShort}</span>
                                    </div>
                                )}
                                {/* Prompt 预览 */}
                                {promptPreview && (
                                    <div className="flex items-start gap-1 text-[10px] text-muted-foreground/40 leading-tight">
                                        <MessageSquare className="h-3 w-3 shrink-0 mt-px" />
                                        <span className="line-clamp-2">{promptPreview}…</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {agents && agentList.length === 0 && (
                <Card><CardContent className="text-center py-12"><Bot className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" /><p className="text-xs text-muted-foreground">暂无 Agent，点击上方按钮创建</p></CardContent></Card>
            )}
            {!agents && <div className="text-center py-12 text-muted-foreground text-xs">加载中...</div>}
        </div>
    );
}



