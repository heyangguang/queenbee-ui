"use client";

import { useState, useCallback } from "react";
import { usePolling, timeAgo } from "@/lib/hooks";
import { getDeadMessages, retryDeadMessage, deleteDeadMessage, type DeadMessage } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skull, RefreshCcw, Trash2, Loader2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

export default function DeadLettersPage() {
    const { data: deadLetters, refresh } = usePolling<DeadMessage[]>(getDeadMessages, 5000);
    const [retrying, setRetrying] = useState<number | null>(null);
    const [removing, setRemoving] = useState<number | null>(null);
    const [expanded, setExpanded] = useState<Set<number>>(new Set());

    const toggleExpand = (id: number) => setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const handleRetry = useCallback(async (id: number) => { setRetrying(id); try { await retryDeadMessage(id); refresh(); } finally { setRetrying(null); } }, [refresh]);
    const handleDelete = useCallback(async (id: number) => { setRemoving(id); try { await deleteDeadMessage(id); refresh(); } finally { setRemoving(null); } }, [refresh]);

    return (
        <div className="p-6 space-y-5 animate-fade-in">
            <div>
                <h1 className="text-xl font-bold tracking-tight flex items-center gap-2"><Skull className="h-5 w-5 text-destructive" /> 死信队列</h1>
                <p className="text-sm text-muted-foreground mt-1">查看和管理处理失败的消息</p>
            </div>

            {deadLetters && deadLetters.length > 0 ? (
                <div className="space-y-2">
                    {deadLetters.map((dl) => (
                        <Card key={dl.id} className="hover:border-destructive/30 transition-colors">
                            <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge variant="outline" className="text-[10px] font-mono">#{dl.id}</Badge>
                                            {dl.channel && <Badge variant="secondary" className="text-[10px]">{dl.channel}</Badge>}
                                            {dl.sender && <Badge variant="secondary" className="text-[10px]">{dl.sender}</Badge>}
                                            {dl.agent && <Badge variant="info" className="text-[10px]">@{dl.agent}</Badge>}
                                            {dl.retry_count > 0 && <Badge variant="danger" className="text-[10px]">{dl.retry_count} 次重试</Badge>}
                                        </div>
                                        {dl.last_error && (
                                            <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2">
                                                <button onClick={() => toggleExpand(dl.id)} className="flex items-center gap-1 cursor-pointer w-full text-left">
                                                    {expanded.has(dl.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                                    <span className={expanded.has(dl.id) ? "" : "truncate"}>{dl.last_error}</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-1.5 shrink-0 items-center">
                                        <span className="text-[10px] text-muted-foreground/60 mr-2">{timeAgo(dl.created_at)}</span>
                                        <Button variant="outline" size="sm" onClick={() => handleRetry(dl.id)} disabled={retrying === dl.id}>
                                            {retrying === dl.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}重试
                                        </Button>
                                        <Button variant="destructive" size="sm" onClick={() => handleDelete(dl.id)} disabled={removing === dl.id}>
                                            {removing === dl.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card><CardContent className="text-center py-16"><Skull className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" /><p className="text-sm text-muted-foreground">死信队列为空</p><p className="text-xs text-muted-foreground/60 mt-1">一切正常，无失败消息</p></CardContent></Card>
            )}
        </div>
    );
}
