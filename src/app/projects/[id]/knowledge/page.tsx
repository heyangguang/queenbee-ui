"use client";

import { useState, useEffect, useCallback, use } from "react";
import { listMemoriesByScope, storeMemoryByScope, forgetMemoriesByScope, deleteMemoryById, type MemoryItem } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CustomSelect } from "@/components/ui/custom-select";
import Link from "next/link";
import { ArrowLeft, FolderKanban, Search, Trash2, Plus, RefreshCw, Sparkles, BookOpen, Heart, Lightbulb, CheckCircle2 } from "lucide-react";

const categoryConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    fact: { label: "事实", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: BookOpen },
    preference: { label: "偏好", color: "bg-purple-500/10 text-purple-600 border-purple-500/20", icon: Heart },
    learning: { label: "经验", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: Lightbulb },
    decision: { label: "决策", color: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: CheckCircle2 },
    context: { label: "上下文", color: "bg-gray-500/10 text-gray-600 border-gray-500/20", icon: BookOpen },
};

function CategoryBadge({ category }: { category: string }) {
    const config = categoryConfig[category] || categoryConfig.fact;
    const Icon = config.icon;
    return (
        <Badge variant="outline" className={`${config.color} text-[10px] px-1.5 py-0 gap-1`}>
            <Icon className="h-2.5 w-2.5" />{config.label}
        </Badge>
    );
}

function SourceBadge({ source }: { source: string }) {
    if (source === "auto") return <Badge variant="outline" className="bg-cyan-500/10 text-cyan-600 border-cyan-500/20 text-[10px] px-1.5 py-0 gap-1"><Sparkles className="h-2.5 w-2.5" />自动</Badge>;
    return <Badge variant="outline" className="bg-gray-500/10 text-gray-600 border-gray-500/20 text-[10px] px-1.5 py-0">手动</Badge>;
}

export default function ProjectKnowledgePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [memories, setMemories] = useState<MemoryItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [newContent, setNewContent] = useState("");
    const [newCategory, setNewCategory] = useState("fact");
    const [adding, setAdding] = useState(false);
    const { confirm, ConfirmUI } = useConfirm();

    const loadMemories = useCallback(async () => {
        setLoading(true);
        try {
            const data = await listMemoriesByScope("project", id, 50);
            setMemories(data.memories || []);
            setTotalCount(data.count);
        } catch { /* 静默 */ }
        setLoading(false);
    }, [id]);

    useEffect(() => { loadMemories(); }, [loadMemories]);

    const handleAdd = useCallback(async () => {
        if (!newContent.trim()) return;
        setAdding(true);
        try {
            const { memory } = await storeMemoryByScope("project", id, newContent.trim(), newCategory);
            setMemories(prev => [memory, ...prev]);
            setTotalCount(prev => prev + 1);
            setNewContent("");
            setShowAdd(false);
        } catch { /* 静默 */ }
        setAdding(false);
    }, [id, newContent, newCategory]);

    const handleClearAll = useCallback(async () => {
        const ok = await confirm({ title: "清除确认", message: "确定要清除此项目的所有知识吗？此操作不可逆。", variant: "danger", confirmText: "清除全部" });
        if (!ok) return;
        try {
            await forgetMemoriesByScope("project", id);
            setMemories([]);
            setTotalCount(0);
        } catch { /* 静默 */ }
    }, [id]);

    const formatTime = (ts: number) => {
        const d = new Date(ts);
        const now = new Date();
        const diff = now.getTime() - ts;
        if (diff < 60000) return "刚刚";
        if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
        if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
        return d.toLocaleDateString();
    };

    return (
        <div className="p-6 max-w-4xl space-y-6 animate-fade-in">
            {/* 头部 */}
            <div className="relative overflow-hidden bg-gradient-to-r from-emerald-500/5 via-emerald-500/10 to-transparent border px-6 py-5">
                <div className="flex items-center gap-4">
                    <Link href="/projects" className="text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="h-4 w-4" /></Link>
                    <div className="flex items-center justify-center h-12 w-12 bg-gradient-to-br from-emerald-500 to-green-400 text-white shadow-lg">
                        <FolderKanban className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold tracking-tight">项目知识</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">@{id} · {totalCount} 条知识</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)} className="gap-1.5">
                            <Plus className="h-3.5 w-3.5" />添加
                        </Button>
                        {totalCount > 0 && (
                            <Button variant="outline" size="sm" onClick={handleClearAll} className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50">
                                <Trash2 className="h-3.5 w-3.5" />清空
                            </Button>
                        )}
                    </div>
                </div>
                <div className="absolute -right-6 -top-6 h-24 w-24 bg-emerald-500/5 rounded-full" />
            </div>

            {/* 说明 */}
            <Card className="border-emerald-500/20 bg-emerald-500/5">
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <Sparkles className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        <div className="text-xs text-muted-foreground space-y-1">
                            <p className="font-medium text-foreground">项目知识如何工作？</p>
                            <p>项目知识在该项目关联的所有 Team 的 Agent 间共享。当对话中指定了此项目，Agent 会自动搜索并注入相关的项目知识到上下文中。</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 手动添加 */}
            {showAdd && (
                <Card>
                    <CardContent className="p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <CustomSelect
                                value={newCategory}
                                onChange={v => setNewCategory(v)}
                                className="w-28"
                                options={[
                                    { value: "fact", label: "事实" },
                                    { value: "preference", label: "偏好" },
                                    { value: "learning", label: "经验" },
                                    { value: "decision", label: "决策" },
                                ]}
                            />
                            <Input className="flex-1" placeholder="输入项目知识..." value={newContent} onChange={e => setNewContent(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") handleAdd(); }} />
                            <Button size="sm" onClick={handleAdd} disabled={adding || !newContent.trim()}>
                                {adding ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "保存"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 知识列表 */}
            {loading ? (
                <div className="py-12 text-center text-muted-foreground"><RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />加载中...</div>
            ) : memories.length === 0 ? (
                <div className="py-12 text-center">
                    <FolderKanban className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">暂无项目知识</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">点击"添加"手动录入，或通过对话中指定项目时自动提取</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {memories.map(m => (
                        <Card key={m.id} className="group hover:shadow-sm transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm leading-relaxed">{m.content}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <CategoryBadge category={m.category} />
                                            <SourceBadge source={m.source} />
                                            <span className="text-[10px] text-muted-foreground">{formatTime(m.created_at)}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            const ok = await confirm({ title: "删除知识", message: "确定删除这条知识？", variant: "danger" });
                                            if (!ok) return;
                                            try {
                                                await deleteMemoryById(m.id);
                                                setMemories(prev => prev.filter(x => x.id !== m.id));
                                                setTotalCount(prev => prev - 1);
                                            } catch { /* 静默 */ }
                                        }}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-500"
                                        title="删除这条知识"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
            <ConfirmUI />
        </div>
    );
}
