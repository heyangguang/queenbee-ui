"use client";

import { useState, useEffect, useCallback, use } from "react";
import { getAgentSoul } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Sparkles, RefreshCw, Ghost } from "lucide-react";

export default function AgentSoulPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [content, setContent] = useState("");
    const [exists, setExists] = useState(false);
    const [loading, setLoading] = useState(true);

    const loadSoul = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getAgentSoul(id);
            setContent(data.soul_content);
            setExists(data.exists);
        } catch { /* 静默 */ }
        setLoading(false);
    }, [id]);

    useEffect(() => { loadSoul(); }, [loadSoul]);

    // 简单的 Markdown 渲染：将标题、粗体、列表转为 HTML
    const renderMarkdown = (md: string) => {
        const lines = md.split("\n");
        const html = lines.map(line => {
            // 标题
            if (line.startsWith("### ")) return `<h3 class="text-base font-semibold mt-4 mb-1 text-foreground">${line.slice(4)}</h3>`;
            if (line.startsWith("## ")) return `<h2 class="text-lg font-bold mt-5 mb-1.5 text-foreground">${line.slice(3)}</h2>`;
            if (line.startsWith("# ")) return `<h1 class="text-xl font-bold mt-6 mb-2 text-foreground">${line.slice(2)}</h1>`;
            // 列表项
            if (/^[-*]\s/.test(line)) {
                const content = line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
                return `<li class="ml-4 text-sm leading-relaxed list-disc text-muted-foreground">${content}</li>`;
            }
            // 空行
            if (line.trim() === "") return `<div class="h-2"></div>`;
            // 普通文本
            const text = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
            return `<p class="text-sm leading-relaxed text-muted-foreground">${text}</p>`;
        }).join("");
        return html;
    };

    return (
        <div className="p-6 max-w-4xl space-y-6 animate-fade-in">
            {/* 头部 */}
            <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/5 via-amber-500/10 to-transparent border px-6 py-5">
                <div className="flex items-center gap-4">
                    <Link href="/agents" className="text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="h-4 w-4" /></Link>
                    <div className="flex items-center justify-center h-12 w-12 bg-gradient-to-br from-amber-500 to-orange-400 text-white shadow-lg rounded-lg">
                        <Sparkles className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold tracking-tight">Agent Soul</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">@{id} · 身份认知与成长记录</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={loadSoul} className="gap-1.5">
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />刷新
                    </Button>
                </div>
                <div className="absolute -right-6 -top-6 h-24 w-24 bg-amber-500/5 rounded-full" />
            </div>

            {/* 说明卡片 */}
            <Card className="border-amber-500/20 bg-amber-500/5">
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <Sparkles className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                        <div className="text-xs text-muted-foreground space-y-1">
                            <p className="font-medium text-foreground">Soul 是什么？</p>
                            <p>SOUL.md 是 Agent 的身份文件，记录了它的个性、观点和成长历程。每次完成任务后，Agent 会自我反思并更新这份文件，形成独特的&quot;人格&quot;。</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 内容区域 */}
            {loading ? (
                <div className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />加载中...
                </div>
            ) : !exists ? (
                <div className="py-12 text-center">
                    <Ghost className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">SOUL.md 文件不存在</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Agent 完成第一次任务后会自动创建 Soul 文件</p>
                </div>
            ) : (
                <Card>
                    <CardContent className="p-6">
                        <div
                            className="prose prose-sm max-w-none dark:prose-invert"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                        />
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
