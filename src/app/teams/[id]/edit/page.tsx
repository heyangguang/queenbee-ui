"use client";

import { useState, useCallback, useEffect, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { usePolling } from "@/lib/hooks";
import { getAgents, getTeam, getTeams, updateTeam, type AgentConfig, type TeamConfig } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Loader2, Bot, Users, Crown, Info, Check, Lock } from "lucide-react";
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

export default function EditTeamPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { data: agents } = usePolling<Record<string, AgentConfig>>(getAgents, 10000);
    const { data: teams } = usePolling<Record<string, TeamConfig>>(getTeams, 10000);
    const [form, setForm] = useState({ name: "", agents: [] as string[], leader_agent: "" });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getTeam(id).then((team) => {
            setForm({ name: team.name, agents: team.agents || [], leader_agent: team.leader_agent || "" });
            setLoading(false);
        }).catch((e) => { setError(e.message); setLoading(false); });
    }, [id]);

    // 构建 agent → team 占用映射，排除当前正在编辑的团队
    const agentTeamMap = useMemo(() => {
        const map: Record<string, string> = {};
        if (teams) {
            Object.entries(teams).forEach(([teamId, team]) => {
                if (teamId === id) return; // 排除当前团队
                (team.agents || []).forEach(aid => { map[aid] = team.name; });
            });
        }
        return map;
    }, [teams, id]);

    const toggleAgent = (agentId: string) => {
        // 已被其他团队占用的 Agent 不可选择
        if (agentTeamMap[agentId]) return;
        setForm((f) => {
            const has = f.agents.includes(agentId);
            const next = has ? f.agents.filter((a) => a !== agentId) : [...f.agents, agentId];
            const leader = has && f.leader_agent === agentId ? (next[0] || "") : f.leader_agent || (next[0] || "");
            return { ...f, agents: next, leader_agent: leader };
        });
    };

    const handleSave = useCallback(async () => {
        if (!form.name.trim()) { setError("名称不能为空"); return; }
        setSaving(true); setError("");
        try {
            const team: TeamConfig = { name: form.name, agents: form.agents, leader_agent: form.leader_agent };
            await updateTeam(id, team);
            router.push("/teams");
        } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
    }, [form, id, router]);

    if (loading) return <div className="p-6 text-center text-muted-foreground">加载中...</div>;

    return (
        <div className="p-6 max-w-4xl space-y-6 animate-fade-in">
            <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/5 via-amber-500/10 to-transparent border px-6 py-5">
                <div className="flex items-center gap-4">
                    <Link href="/teams" className="text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div className="flex items-center justify-center h-12 w-12 bg-gradient-to-br from-amber-500 to-orange-400 text-white shadow-lg">
                        <Users className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">编辑 Team</h1>
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

            <FormSection icon={Users} title="基本信息">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Team ID">
                        <Input value={id} disabled className="bg-muted text-muted-foreground" />
                    </FormField>
                    <FormField label="团队名称" required>
                        <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    </FormField>
                </div>
            </FormSection>

            <FormSection icon={Bot} title="团队成员" description="每个 Agent 只能属于一个团队">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {agents && Object.entries(agents).map(([aid, agent]) => {
                        const selected = form.agents.includes(aid);
                        const occupiedBy = agentTeamMap[aid];
                        const disabled = !!occupiedBy;
                        return (
                            <button
                                key={aid}
                                onClick={() => toggleAgent(aid)}
                                disabled={disabled}
                                className={`flex items-center gap-2.5 px-3 py-2.5 border text-left transition-all
                                    ${disabled
                                        ? "opacity-50 cursor-not-allowed bg-muted/50 border-transparent"
                                        : selected
                                            ? "bg-primary/5 border-primary/30 text-primary shadow-sm cursor-pointer"
                                            : "hover:bg-secondary text-muted-foreground hover:text-foreground border-transparent hover:border-border cursor-pointer"
                                    }`}
                            >
                                <div className={`flex h-8 w-8 items-center justify-center text-[11px] font-bold shrink-0
                                    ${disabled ? "bg-muted text-muted-foreground" : selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                    {agent.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium truncate">{agent.name}</p>
                                    {disabled
                                        ? <p className="text-[10px] text-amber-600 flex items-center gap-0.5"><Lock className="h-2.5 w-2.5" />已分配到 {occupiedBy}</p>
                                        : <p className="text-[10px] text-muted-foreground">@{aid}</p>
                                    }
                                </div>
                                {selected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-auto" />}
                            </button>
                        );
                    })}
                </div>
                {form.agents.length > 0 && (
                    <Badge variant="secondary" className="text-[10px]">{form.agents.length} 个成员</Badge>
                )}
            </FormSection>

            {form.agents.length > 0 && (
                <FormSection icon={Crown} title="团队领导">
                    <FormField label="Leader Agent" help="负责分配任务和协调团队">
                        <Select value={form.leader_agent} onChange={e => setForm({ ...form, leader_agent: e.target.value })}>
                            {form.agents.map(aid => (
                                <option key={aid} value={aid}>{agents?.[aid]?.name || aid} (@{aid})</option>
                            ))}
                        </Select>
                    </FormField>
                </FormSection>
            )}

            <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-background/80 backdrop-blur-md border-t flex items-center justify-between">
                <Link href="/teams"><Button variant="ghost" className="text-muted-foreground">取消</Button></Link>
                <Button onClick={handleSave} disabled={saving} size="lg" className="px-6">
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    保存
                </Button>
            </div>
        </div>
    );
}

