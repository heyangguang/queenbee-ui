"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createSkillDefinition } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { CustomSelect } from "@/components/ui/custom-select";
import { CodeEditor } from "@/components/ui/code-editor";
import { ArrowLeft, Check, Loader2, Sparkles, FileText, Settings, Info, Code } from "lucide-react";
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

export default function NewSkillPage() {
    const router = useRouter();
    const [form, setForm] = useState({
        name: "", description: "", content: "",
        category: "工具", allowed_tools: "", version: "1.0.0",
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const handleSave = useCallback(async () => {
        if (!form.name.trim()) { setError("名称不能为空"); return; }
        setSaving(true); setError("");
        try {
            let content = form.content;
            if (!content.trim()) {
                content = `---\nname: ${form.name}\ndescription: "${form.description}"\n${form.allowed_tools ? `allowed-tools: ${form.allowed_tools}\n` : ""}---\n\n# ${form.name}\n\n${form.description}\n`;
            }
            await createSkillDefinition({
                name: form.name, description: form.description, content,
                category: form.category, allowed_tools: form.allowed_tools,
                version: form.version, source: "custom",
            });
            router.push("/skills");
        } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
    }, [form, router]);

    return (
        <div className="p-6 max-w-4xl space-y-6 animate-fade-in">
            {/* 页头 Banner */}
            <div className="relative overflow-hidden bg-gradient-to-r from-violet-500/5 via-violet-500/10 to-transparent border px-6 py-5">
                <div className="flex items-center gap-4">
                    <Link href="/skills" className="text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div className="flex items-center justify-center h-12 w-12 bg-gradient-to-br from-violet-500 to-purple-400 text-white shadow-lg">
                        <Sparkles className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">创建 Skill</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">定义一项新的 AI Agent 技能</p>
                    </div>
                </div>
                <div className="absolute -right-6 -top-6 h-24 w-24 bg-violet-500/5 rounded-full" />
            </div>

            {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3">
                    <Info className="h-4 w-4 shrink-0" /> {error}
                </div>
            )}

            {/* 基本信息 */}
            <FormSection icon={FileText} title="基本信息" description="Skill 的标识、分类和版本">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField label="名称" required help="唯一标识，如 code-review、deploy-helper">
                        <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="my-custom-skill" />
                    </FormField>
                    <FormField label="分类" help="用于分组展示">
                        <CustomSelect
                            value={form.category}
                            onChange={v => setForm({ ...form, category: v })}
                            options={[
                                { value: "工具", label: "🔧 工具" },
                                { value: "自动化", label: "⚡ 自动化" },
                                { value: "分析", label: "📊 分析" },
                                { value: "通信", label: "💬 通信" },
                                { value: "开发", label: "💻 开发" },
                                { value: "其他", label: "📦 其他" },
                            ]}
                        />
                    </FormField>
                    <FormField label="版本" help="语义化版本号">
                        <Input value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} placeholder="1.0.0" />
                    </FormField>
                </div>
            </FormSection>

            {/* 功能描述 */}
            <FormSection icon={Settings} title="功能描述" description="描述 Skill 的用途和工具权限">
                <FormField label="描述" help="清晰说明这个 Skill 做什么、什么场景触发">
                    <Textarea
                        value={form.description}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        rows={3}
                        placeholder="当用户需要 xxx 时触发，用于 xxx 操作..."
                    />
                </FormField>
                <FormField label="允许的工具" help="限制 Skill 可调用的工具。留空表示不限制">
                    <Input value={form.allowed_tools} onChange={e => setForm({ ...form, allowed_tools: e.target.value })} placeholder="Bash(my-tool:*), Read, Write" />
                </FormField>
            </FormSection>

            {/* SKILL.md 内容 - Markdown 编辑器 */}
            <FormSection icon={Code} title="SKILL.md 内容" description="完整的技能定义文档（Markdown 格式，支持预览）">
                <FormField label="内容" help="留空将根据名称和描述自动生成基础模板">
                    <CodeEditor
                        value={form.content}
                        onChange={v => setForm({ ...form, content: v })}
                        language="markdown"
                        placeholder={`---\nname: my-custom-skill\ndescription: "这个技能的描述"\nallowed-tools: Bash(my-tool:*)\n---\n\n# My Custom Skill\n\n## 使用说明\n\n当用户需要 xxx 时，使用此技能...\n\n## 步骤\n\n1. 第一步\n2. 第二步`}
                        minRows={15}
                        maxHeight="600px"
                    />
                </FormField>
            </FormSection>

            {/* 底部操作栏 */}
            <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-background/80 backdrop-blur-md border-t flex items-center justify-between">
                <Link href="/skills"><Button variant="ghost" className="text-muted-foreground">取消</Button></Link>
                <Button onClick={handleSave} disabled={saving} size="lg" className="px-6">
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                    创建 Skill
                </Button>
            </div>
        </div>
    );
}
