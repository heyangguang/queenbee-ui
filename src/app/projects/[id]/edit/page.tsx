"use client";

import { useState, useCallback, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { usePolling } from "@/lib/hooks";
import { getTeams, getProject, updateProject, type TeamConfig } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Loader2, Users, FolderKanban, GitBranch, FileText, Info, Check } from "lucide-react";
import Link from "next/link";

function FormSection({ icon: Icon, title, description, children }: {
    icon: React.ElementType; title: string; description?: string; children: React.ReactNode;
}) {
    return (
        <Card className="overflow-hidden">
            <div className="px-6 py-4 bg-muted/30 border-b flex items-center gap-3">
                <div className="flex items-center justify-center h-8 w-8 bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold">{title}</h3>
                    {description && <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>}
                </div>
            </div>
            <CardContent className="p-6 space-y-4">{children}</CardContent>
        </Card>
    );
}

function FormField({ label, required, help, children }: {
    label: string; required?: boolean; help?: string; children: React.ReactNode;
}) {
    return (
        <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">
                {label} {required && <span className="text-red-400">*</span>}
            </label>
            {children}
            {help && <p className="text-[10px] text-muted-foreground mt-1.5">{help}</p>}
        </div>
    );
}

export default function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { data: teams } = usePolling<Record<string, TeamConfig>>(getTeams, 10000);
    const [form, setForm] = useState({ name: "", description: "", repo_path: "", teams: [] as string[] });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getProject(id).then((project) => {
            setForm({ name: project.name, description: project.description || "", repo_path: project.repo_path || "", teams: project.teams || [] });
            setLoading(false);
        }).catch((e) => { setError(e.message); setLoading(false); });
    }, [id]);

    const toggleTeam = (teamId: string) => {
        setForm((f) => ({
            ...f,
            teams: f.teams.includes(teamId) ? f.teams.filter((t) => t !== teamId) : [...f.teams, teamId],
        }));
    };

    const handleSave = useCallback(async () => {
        if (!form.name.trim()) { setError("名称不能为空"); return; }
        setSaving(true); setError("");
        try {
            await updateProject(id, { name: form.name, description: form.description, repo_path: form.repo_path, teams: form.teams });
            router.push("/projects");
        } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
    }, [form, id, router]);

    if (loading) return <div className="p-6 text-center text-muted-foreground">加载中...</div>;

    return (
        <div className="p-6 max-w-4xl space-y-6 animate-fade-in">
            {/* 页头 Banner */}
            <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/5 via-amber-500/10 to-transparent border px-6 py-5">
                <div className="flex items-center gap-4">
                    <Link href="/projects" className="text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div className="flex items-center justify-center h-12 w-12 bg-gradient-to-br from-amber-500 to-orange-400 text-white shadow-lg">
                        <FolderKanban className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">编辑项目</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">@{id}</p>
                    </div>
                </div>
                <div className="absolute -right-6 -top-6 h-24 w-24 bg-amber-500/5 rounded-full" />
            </div>

            {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3">
                    <Info className="h-4 w-4 shrink-0" /> {error}
                </div>
            )}

            {/* 基本信息 */}
            <FormSection icon={FolderKanban} title="基本信息">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="项目 ID">
                        <Input value={id} disabled className="bg-muted text-muted-foreground" />
                    </FormField>
                    <FormField label="项目名称" required>
                        <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    </FormField>
                </div>
            </FormSection>

            {/* 描述与仓库 */}
            <FormSection icon={FileText} title="项目详情">
                <FormField label="项目描述">
                    <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </FormField>
                <FormField label="代码仓库路径">
                    <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Input value={form.repo_path} onChange={e => setForm({ ...form, repo_path: e.target.value })} />
                    </div>
                </FormField>
            </FormSection>

            {/* 关联 Team */}
            <FormSection icon={Users} title="关联 Team" description="Team 下所有 Agent 共享项目级记忆">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {teams && Object.entries(teams).map(([tid, team]) => {
                        const selected = form.teams.includes(tid);
                        return (
                            <button
                                key={tid}
                                onClick={() => toggleTeam(tid)}
                                className={`flex items-center gap-2.5 px-3 py-2.5 border text-left cursor-pointer transition-all
                                    ${selected
                                        ? "bg-primary/5 border-primary/30 text-primary shadow-sm"
                                        : "hover:bg-secondary text-muted-foreground hover:text-foreground border-transparent hover:border-border"
                                    }`}
                            >
                                <div className={`flex h-8 w-8 items-center justify-center text-[11px] font-bold shrink-0
                                    ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                    {team.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-medium truncate">{team.name}</p>
                                    <p className="text-[10px] text-muted-foreground">@{tid} · {team.agents.length}人</p>
                                </div>
                                {selected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-auto" />}
                            </button>
                        );
                    })}
                </div>
                {form.teams.length > 0 && (
                    <Badge variant="secondary" className="text-[10px]">{form.teams.length} 个 Team 已关联</Badge>
                )}
            </FormSection>

            <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-background/80 backdrop-blur-md border-t flex items-center justify-between">
                <Link href="/projects"><Button variant="ghost" className="text-muted-foreground">取消</Button></Link>
                <Button onClick={handleSave} disabled={saving} size="lg" className="px-6">
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    保存
                </Button>
            </div>
        </div>
    );
}
