"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createAgent, getProviders, type AgentConfig, type ProviderInfo } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModelCombobox } from "@/components/ui/model-combobox";
import { CodeEditor } from "@/components/ui/code-editor";
import { ProviderLogo, getProviderColor } from "@/components/ui/provider-logo";
import { ArrowLeft, Check, Loader2, Bot, Cpu, FolderOpen, MessageSquare, Info } from "lucide-react";
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

export default function NewAgentPage() {
    const router = useRouter();
    const [form, setForm] = useState({
        id: "", name: "", provider: "anthropic", model: "",
        working_directory: "", system_prompt: "",
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [providerModels, setProviderModels] = useState<Record<string, ProviderInfo>>({});

    // 加载 Provider 模型列表
    useEffect(() => {
        getProviders().then(({ providers }) => {
            const map: Record<string, ProviderInfo> = {};
            providers.forEach(p => { map[p.id] = p; });
            setProviderModels(map);
        }).catch(() => { /* 静默失败，用户仍可手动输入 */ });
    }, []);

    // 切换 Provider 时重置为自动（默认）
    const handleProviderChange = useCallback((providerId: string) => {
        const defaultModel = DEFAULT_MODEL;
        setForm(prev => ({ ...prev, provider: providerId, model: defaultModel }));
    }, []);

    const handleSave = useCallback(async () => {
        if (!form.id.trim() || !form.name.trim()) { setError("ID 和名称不能为空"); return; }
        setSaving(true); setError("");
        try {
            const agent: AgentConfig = {
                name: form.name, provider: form.provider, model: form.model,
                working_directory: form.working_directory,
                system_prompt: form.system_prompt || undefined,
            };
            await createAgent(form.id, agent);
            router.push("/agents");
        } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
    }, [form, router]);

    const providerColor = getProviderColor(form.provider);
    const currentModels = providerModels[form.provider]?.models || [];

    return (
        <div className="p-6 max-w-4xl space-y-6 animate-fade-in">
            {/* 页头 Banner */}
            <div className="relative overflow-hidden bg-gradient-to-r from-primary/5 via-primary/10 to-transparent border px-6 py-5">
                <div className="flex items-center gap-4">
                    <Link href="/agents" className="text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div className="flex items-center justify-center h-12 w-12 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg">
                        <Bot className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">新建 Agent</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">配置一个新的 AI 助手加入你的团队</p>
                    </div>
                </div>
                <div className="absolute -right-6 -top-6 h-24 w-24 bg-primary/5 rounded-full" />
            </div>

            {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3">
                    <Info className="h-4 w-4 shrink-0" /> {error}
                </div>
            )}

            {/* 基本信息 */}
            <FormSection icon={Bot} title="基本信息" description="Agent 的唯一标识和显示名称">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Agent ID" required help="用于系统标识，创建后不可修改，如 coder、pm">
                        <Input value={form.id} onChange={e => setForm({ ...form, id: e.target.value })} placeholder="coder" />
                    </FormField>
                    <FormField label="显示名称" required help="在界面上展示的友好名称">
                        <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Code Assistant" />
                    </FormField>
                </div>
            </FormSection>

            {/* 模型配置 - Provider Logo 卡片选择 */}
            <FormSection icon={Cpu} title="模型配置" description="选择 AI 提供商和模型">
                <FormField label="Provider" help="AI 服务提供商">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {providerList.map(p => {
                            const selected = form.provider === p.id;
                            const colors = getProviderColor(p.id);
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => handleProviderChange(p.id)}
                                    className={`flex items-center gap-2.5 px-3.5 py-3 border text-left cursor-pointer transition-all ${selected
                                        ? `${colors.bg} ${colors.border} ${colors.text} shadow-sm ring-1 ring-current/20`
                                        : "border-border/50 hover:bg-secondary text-muted-foreground hover:text-foreground"
                                        }`}
                                >
                                    <div className={`flex items-center justify-center h-8 w-8 shrink-0 ${selected ? `${colors.bg} ${colors.text}` : "bg-muted text-muted-foreground"
                                        }`}>
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

            {/* 工作路径 */}
            <FormSection icon={FolderOpen} title="工作路径" description="Agent 的文件系统配置">
                <FormField label="工作目录" help={`留空则默认使用 ~/queenbee-workspace/${form.id || '{agentID}'}/`}>
                    <Input value={form.working_directory} onChange={e => setForm({ ...form, working_directory: e.target.value })} placeholder={`~/queenbee-workspace/${form.id || '{agentID}'}/`} />
                </FormField>
            </FormSection>

            {/* 系统提示词 - Markdown 编辑器 */}
            <FormSection icon={MessageSquare} title="系统提示词" description="定义 Agent 的角色、行为和规则（支持 Markdown）">
                <FormField label="System Prompt" help="支持 Markdown 格式，可切换预览。留空可使用 Prompt 文件代替">
                    <CodeEditor
                        value={form.system_prompt}
                        onChange={v => setForm({ ...form, system_prompt: v })}
                        language="markdown"
                        placeholder="# 角色定义&#10;&#10;你是一个专业的编程助手，擅长..."
                        minRows={8}
                    />
                </FormField>
            </FormSection>

            {/* 底部操作栏 */}
            <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-background/80 backdrop-blur-md border-t flex items-center justify-between">
                <Link href="/agents"><Button variant="ghost" className="text-muted-foreground">取消</Button></Link>
                <Button onClick={handleSave} disabled={saving} size="lg" className="px-6">
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                    创建 Agent
                </Button>
            </div>
        </div>
    );
}

