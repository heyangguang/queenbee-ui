"use client";

import { useState, useEffect, useCallback } from "react";
import { getSettings, updateSettings, type Settings } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ProviderLogo, getProviderColor } from "@/components/ui/provider-logo";
import {
    Settings as SettingsIcon, Save, Loader2, FolderOpen, Cpu, Clock,
    Plus, Trash2, Key, Shield, Info, CheckCircle2, AlertTriangle,
} from "lucide-react";

const PROVIDERS = [
    { id: "anthropic", name: "Anthropic", sub: "Claude", defaultModel: "sonnet" },
    { id: "openai", name: "OpenAI", sub: "Codex", defaultModel: "gpt-5.3-codex" },
    { id: "gemini", name: "Gemini", sub: "Google", defaultModel: "flash" },
];

function FormSection({ icon: Icon, title, description, children, action }: {
    icon: React.ElementType; title: string; description?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
    return (
        <Card className="overflow-hidden">
            <div className="px-6 py-4 bg-muted/30 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-8 w-8 bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold">{title}</h3>
                        {description && <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>}
                    </div>
                </div>
                {action}
            </div>
            <CardContent className="p-6 space-y-4">{children}</CardContent>
        </Card>
    );
}

function FormField({ label, help, children }: {
    label: string; help?: string; children: React.ReactNode;
}) {
    return (
        <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">{label}</label>
            {children}
            {help && <p className="text-[10px] text-muted-foreground mt-1.5">{help}</p>}
        </div>
    );
}

export default function SettingsPage() {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

    // 可编辑状态
    const [workspacePath, setWorkspacePath] = useState("");
    const [workspaceName, setWorkspaceName] = useState("");
    const [provider, setProvider] = useState("anthropic");
    const [model, setModel] = useState("sonnet");
    const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);
    const [heartbeat, setHeartbeat] = useState(0);
    const [maxMessages, setMaxMessages] = useState(0);
    const [agentTimeout, setAgentTimeout] = useState(0);
    const [agentIdleTimeout, setAgentIdleTimeout] = useState(0);
    const [conversationTimeout, setConversationTimeout] = useState(0);

    const fetchSettings = useCallback(async () => {
        try {
            const s = await getSettings();
            setSettings(s);
            setWorkspacePath(s.workspace?.path || "");
            setWorkspaceName(s.workspace?.name || "");
            setProvider(s.models?.provider || "anthropic");
            // 根据 provider 取对应 model
            const p = s.models?.provider || "anthropic";
            const m = (s.models as Record<string, { model?: string }>)?.[p]?.model || "";
            setModel(m);
            // ENV
            const env = s.env || {};
            setEnvVars(Object.entries(env).map(([key, value]) => ({ key, value })));
            setHeartbeat(s.monitoring?.heartbeat_interval || 0);
            setMaxMessages(s.max_messages || 0);
            setAgentTimeout(s.agent_timeout || 0);
            setAgentIdleTimeout(s.agent_idle_timeout || 0);
            setConversationTimeout(s.conversation_timeout || 0);
        } catch (e) { showToast("error", (e as Error).message); }
    }, []);

    useEffect(() => { fetchSettings(); }, [fetchSettings]);

    const showToast = (type: "success" | "error", msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3000);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const envObj: Record<string, string> = {};
            envVars.forEach(({ key, value }) => { if (key.trim()) envObj[key.trim()] = value; });
            const updated: Settings = {
                workspace: { path: workspacePath, name: workspaceName },
                models: {
                    provider,
                    [provider]: { model },
                },
                monitoring: heartbeat > 0 ? { heartbeat_interval: heartbeat } : undefined,
                env: Object.keys(envObj).length > 0 ? envObj : undefined,
                max_messages: maxMessages || undefined,
                agent_timeout: agentTimeout || undefined,
                agent_idle_timeout: agentIdleTimeout || undefined,
                conversation_timeout: conversationTimeout || undefined,
            };
            await updateSettings(updated);
            showToast("success", "配置已保存");
        } catch (e) { showToast("error", (e as Error).message); } finally { setSaving(false); }
    };

    const addEnvVar = () => setEnvVars([...envVars, { key: "", value: "" }]);
    const removeEnvVar = (i: number) => setEnvVars(envVars.filter((_, idx) => idx !== i));
    const updateEnvVar = (i: number, field: "key" | "value", val: string) => {
        const next = [...envVars]; next[i] = { ...next[i], [field]: val }; setEnvVars(next);
    };

    const agentCount = settings?.agents ? Object.keys(settings.agents).length : 0;
    const teamCount = settings?.teams ? Object.keys(settings.teams).length : 0;

    return (
        <div className="p-6 max-w-4xl space-y-6 animate-fade-in">
            {/* 页头 */}
            <div className="relative overflow-hidden bg-gradient-to-r from-slate-500/5 via-slate-500/10 to-transparent border px-6 py-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center h-12 w-12 bg-gradient-to-br from-slate-600 to-slate-400 text-white shadow-lg">
                            <SettingsIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">全局设置</h1>
                            <p className="text-xs text-muted-foreground mt-0.5">配置 Workspace、默认模型、环境变量和运行参数</p>
                        </div>
                    </div>
                    <Button onClick={handleSave} disabled={saving} size="lg" className="px-6">
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        保存配置
                    </Button>
                </div>
                <div className="absolute -right-6 -top-6 h-24 w-24 bg-slate-500/5 rounded-full" />
            </div>

            {/* Toast */}
            {toast && (
                <div className={`flex items-center gap-2 text-sm px-4 py-3 border ${toast.type === "success" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-600"
                    }`}>
                    {toast.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                    {toast.msg}
                </div>
            )}

            {/* 工作空间 */}
            <FormSection icon={FolderOpen} title="工作空间" description="Agent 的文件工作目录">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="路径" help="Agent 运行时的工作目录根路径">
                        <Input value={workspacePath} onChange={e => setWorkspacePath(e.target.value)} placeholder="/tmp/queenbee-workspace" />
                    </FormField>
                    <FormField label="名称" help="工作空间的友好名称">
                        <Input value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} placeholder="queenbee-workspace" />
                    </FormField>
                </div>
            </FormSection>

            {/* 默认 Provider 和 Model */}
            <FormSection icon={Cpu} title="默认模型" description="新建 Agent 时的默认 AI 提供商和模型">
                <FormField label="Provider">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-1">
                        {PROVIDERS.map(p => {
                            const colors = getProviderColor(p.id);
                            const selected = provider === p.id;
                            return (
                                <button key={p.id} type="button" onClick={() => { setProvider(p.id); setModel(p.defaultModel); }}
                                    className={`relative flex items-center gap-3 p-3 border transition-all cursor-pointer ${selected ? `${colors.border} ${colors.bg} ring-1 ring-offset-1` : "border-border hover:border-foreground/20"
                                        }`}>
                                    <div className={`flex items-center justify-center h-9 w-9 ${selected ? colors.bg : "bg-muted"} ${selected ? colors.text : "text-muted-foreground"}`}>
                                        <ProviderLogo provider={p.id} size={18} />
                                    </div>
                                    <div className="text-left">
                                        <div className={`text-sm font-medium ${selected ? "" : "text-muted-foreground"}`}>{p.name}</div>
                                        <div className="text-[10px] text-muted-foreground">{p.sub}</div>
                                    </div>
                                    {selected && <div className="absolute top-1.5 right-1.5 h-2 w-2 bg-primary rounded-full" />}
                                </button>
                            );
                        })}
                    </div>
                </FormField>
                <FormField label="Model" help="当前 Provider 下的默认模型 ID">
                    <div className="flex items-center gap-2">
                        <div className={`flex items-center justify-center h-9 w-9 ${getProviderColor(provider).bg} ${getProviderColor(provider).text}`}>
                            <ProviderLogo provider={provider} size={14} />
                        </div>
                        <Input value={model} onChange={e => setModel(e.target.value)} placeholder="模型 ID" className="flex-1" />
                    </div>
                </FormField>
            </FormSection>

            {/* 环境变量 */}
            <FormSection icon={Key} title="环境变量" description="全局环境变量，将注入到所有 Agent 的运行环境"
                action={<Button variant="outline" size="sm" onClick={addEnvVar}><Plus className="h-3.5 w-3.5 mr-1" />添加</Button>}>
                {envVars.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                        <Key className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p>暂无环境变量</p>
                        <p className="text-[10px] mt-1">点击右上角"添加"来配置 API Key 等</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {envVars.map((env, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Input value={env.key} onChange={e => updateEnvVar(i, "key", e.target.value)}
                                    placeholder="ANTHROPIC_API_KEY" className="flex-[2] font-mono text-xs" />
                                <Input value={env.value} onChange={e => updateEnvVar(i, "value", e.target.value)}
                                    placeholder="sk-..." type="password" className="flex-[3] font-mono text-xs" />
                                <Button variant="ghost" size="sm" onClick={() => removeEnvVar(i)} className="text-muted-foreground hover:text-red-500 shrink-0">
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </FormSection>

            {/* 高级参数 */}
            <FormSection icon={Shield} title="高级参数" description="运行时超时和限制参数">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <FormField label="心跳间隔（秒）" help="设为 0 禁用心跳">
                        <Input type="number" value={heartbeat || ""} onChange={e => setHeartbeat(Number(e.target.value))} placeholder="0" />
                    </FormField>
                    <FormField label="最大消息数" help="单次会话最大消息轮次">
                        <Input type="number" value={maxMessages || ""} onChange={e => setMaxMessages(Number(e.target.value))} placeholder="500" />
                    </FormField>
                    <FormField label="Agent 超时（分钟）" help="单个 Agent 绝对超时">
                        <Input type="number" value={agentTimeout || ""} onChange={e => setAgentTimeout(Number(e.target.value))} placeholder="60" />
                    </FormField>
                    <FormField label="Agent 空闲超时（分钟）" help="无输出判定卡死">
                        <Input type="number" value={agentIdleTimeout || ""} onChange={e => setAgentIdleTimeout(Number(e.target.value))} placeholder="5" />
                    </FormField>
                    <FormField label="会话超时（分钟）" help="团队协作会话超时">
                        <Input type="number" value={conversationTimeout || ""} onChange={e => setConversationTimeout(Number(e.target.value))} placeholder="15" />
                    </FormField>
                </div>
            </FormSection>

            {/* 系统概览 */}
            <div className="grid grid-cols-3 gap-3">
                <Card className="hover:border-primary/20 transition-colors">
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold">{agentCount}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Agents</p>
                    </CardContent>
                </Card>
                <Card className="hover:border-primary/20 transition-colors">
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold">{teamCount}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Teams</p>
                    </CardContent>
                </Card>
                <Card className="hover:border-primary/20 transition-colors">
                    <CardContent className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                            <ProviderLogo provider={provider} size={16} />
                            <p className="text-sm font-bold capitalize">{provider}</p>
                        </div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">默认 Provider</p>
                    </CardContent>
                </Card>
            </div>

            {/* 提示 */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 border px-4 py-3">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <p>
                    此页面管理全局默认配置。Agent 和 Team 的具体配置请在各自的管理页面中操作。
                    修改后点击 <strong className="text-foreground">保存配置</strong> 生效。
                </p>
            </div>
        </div>
    );
}
