"use client";

import { useState, useCallback, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { getAgent, updateAgent, getProviders, type AgentConfig, type ProviderInfo } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomSelect } from "@/components/ui/custom-select";
import { ModelCombobox } from "@/components/ui/model-combobox";
import { CodeEditor } from "@/components/ui/code-editor";
import { ProviderLogo, getProviderColor } from "@/components/ui/provider-logo";
import { ArrowLeft, Save, Loader2, Bot, Cpu, FolderOpen, MessageSquare, Info, Check, ShieldAlert } from "lucide-react";
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

const providerList = [
    { id: "anthropic", name: "Anthropic (Claude)" },
    { id: "openai", name: "OpenAI (Codex)" },
    { id: "opencode", name: "OpenCode" },
    { id: "gemini", name: "Google Gemini" },
];

// 切换 Provider 时默认使用“自动”（空字符串 = CLI 默认模型）
const DEFAULT_MODEL = "";

export default function EditAgentPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [form, setForm] = useState({ name: "", provider: "anthropic", model: "sonnet", working_directory: "", system_prompt: "", fallback_provider: "", fallback_model: "" });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [providerModels, setProviderModels] = useState<Record<string, ProviderInfo>>({});

    // 加载 Provider 模型列表
    useEffect(() => {
        getProviders().then(({ providers }) => {
            const map: Record<string, ProviderInfo> = {};
            providers.forEach(p => { map[p.id] = p; });
            setProviderModels(map);
        }).catch(() => { /* 静默失败 */ });
    }, []);

    useEffect(() => {
        getAgent(id).then((agent) => {
            setForm({ name: agent.name, provider: agent.provider, model: agent.model, working_directory: agent.working_directory || "", system_prompt: agent.system_prompt || "", fallback_provider: agent.fallback_provider || "", fallback_model: agent.fallback_model || "" });
            setLoading(false);
        }).catch((e) => { setError(e.message); setLoading(false); });
    }, [id]);

    // 切换 Provider 时重置为自动（默认）
    const handleProviderChange = useCallback((providerId: string) => {
        const defaultModel = DEFAULT_MODEL;
        setForm(prev => ({ ...prev, provider: providerId, model: defaultModel }));
    }, []);

    const handleSave = useCallback(async () => {
        if (!form.name.trim()) { setError("名称不能为空"); return; }
        setSaving(true); setError("");
        try {
            const agent: AgentConfig = { name: form.name, provider: form.provider, model: form.model, working_directory: form.working_directory, system_prompt: form.system_prompt || undefined, fallback_provider: form.fallback_provider || undefined, fallback_model: form.fallback_model || undefined };
            await updateAgent(id, agent);
            router.push("/agents");
        } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
    }, [form, id, router]);

    if (loading) return <div className="p-6 text-center text-muted-foreground">加载中...</div>;

    const providerColor = getProviderColor(form.provider);
    const currentModels = providerModels[form.provider]?.models || [];

    return (
        <div className="p-6 max-w-4xl space-y-6 animate-fade-in">
            <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/5 via-amber-500/10 to-transparent border px-6 py-5">
                <div className="flex items-center gap-4">
                    <Link href="/agents" className="text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="h-4 w-4" /></Link>
                    <div className="flex items-center justify-center h-12 w-12 bg-gradient-to-br from-amber-500 to-orange-400 text-white shadow-lg">
                        <Bot className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">编辑 Agent</h1>
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

            <FormSection icon={Bot} title="基本信息">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Agent ID">
                        <Input value={id} disabled className="bg-muted text-muted-foreground" />
                    </FormField>
                    <FormField label="显示名称" required>
                        <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    </FormField>
                </div>
            </FormSection>

            <FormSection icon={Cpu} title="模型配置">
                <FormField label="Provider">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {providerList.map(p => {
                            const selected = form.provider === p.id;
                            const colors = getProviderColor(p.id);
                            return (
                                <button key={p.id} type="button" onClick={() => handleProviderChange(p.id)}
                                    className={`flex items-center gap-2.5 px-3.5 py-3 border text-left cursor-pointer transition-all ${selected ? `${colors.bg} ${colors.border} ${colors.text} shadow-sm ring-1 ring-current/20` : "border-border/50 hover:bg-secondary text-muted-foreground hover:text-foreground"
                                        }`}>
                                    <div className={`flex items-center justify-center h-8 w-8 shrink-0 ${selected ? `${colors.bg} ${colors.text}` : "bg-muted text-muted-foreground"}`}>
                                        <ProviderLogo provider={p.id} size={18} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold">{p.name.split(" (")[0]}</p>
                                        <p className="text-[10px] opacity-60">{p.name.match(/\((.+)\)/)?.[1] || ""}</p>
                                    </div>
                                    {selected && <Check className="h-3.5 w-3.5 ml-auto shrink-0" />}
                                </button>
                            );
                        })}
                    </div>
                </FormField>
                <FormField label="Model" help="选择预设模型或输入自定义模型 ID，留空则使用 CLI 默认">
                    <div className="flex items-center gap-2">
                        <div className={`flex items-center justify-center h-9 w-9 shrink-0 border ${providerColor.bg} ${providerColor.text} ${providerColor.border}`}>
                            <ProviderLogo provider={form.provider} size={16} />
                        </div>
                        <ModelCombobox
                            value={form.model}
                            onChange={model => setForm({ ...form, model })}
                            models={currentModels}
                        />
                    </div>
                </FormField>
            </FormSection>

            <FormSection icon={ShieldAlert} title="备用模型容错" description="主 Provider 调用失败时自动切换到备用模型（可选）">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="备用 Provider" help="留空则不启用 Failover">
                        <CustomSelect
                            value={form.fallback_provider}
                            onChange={v => setForm({ ...form, fallback_provider: v })}
                            options={[
                                { value: "", label: "不启用" },
                                ...providerList.filter(p => p.id !== form.provider).map(p => ({
                                    value: p.id, label: p.name,
                                })),
                            ]}
                        />
                    </FormField>
                    <FormField label="备用 Model" help="留空则使用 CLI 默认模型">
                        <Input
                            value={form.fallback_model}
                            onChange={e => setForm({ ...form, fallback_model: e.target.value })}
                            placeholder="留空使用默认"
                            disabled={!form.fallback_provider}
                        />
                    </FormField>
                </div>
                {form.fallback_provider && (
                    <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 mt-2">
                        <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>当主 Provider <strong>{form.provider}</strong> 失败时，将自动切换到 <strong>{form.fallback_provider}</strong>。失败的 Provider 将冷却 5 分钟后恢复。</span>
                    </div>
                )}
            </FormSection>

            <FormSection icon={FolderOpen} title="工作路径">
                <FormField label="工作目录" help={`留空则默认使用 ~/queenbee-workspace/${id}/`}>
                    <Input value={form.working_directory} onChange={e => setForm({ ...form, working_directory: e.target.value })} placeholder={`~/queenbee-workspace/${id}/`} />
                </FormField>
            </FormSection>

            <FormSection icon={MessageSquare} title="系统提示词">
                <FormField label="System Prompt">
                    <CodeEditor value={form.system_prompt} onChange={v => setForm({ ...form, system_prompt: v })} language="markdown" minRows={8} />
                </FormField>
            </FormSection>

            <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-background/80 backdrop-blur-md border-t flex items-center justify-between">
                <Link href="/agents"><Button variant="ghost" className="text-muted-foreground">取消</Button></Link>
                <Button onClick={handleSave} disabled={saving} size="lg" className="px-6">
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}保存
                </Button>
            </div>
        </div>
    );
}

