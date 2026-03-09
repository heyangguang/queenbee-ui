"use client";

import { useState, useCallback, useEffect } from "react";
import { usePolling } from "@/lib/hooks";
import {
    getAgents, getAgentSkills, addAgentSkill, removeAgentSkill,
    getSkillDefinitions, deleteSkillDefinition, importBuiltinSkills,
    getCLIGlobalSkills, updateSkillDefinition,
    type AgentConfig, type AgentSkill, type SkillDefinition, type CLIGlobalSkill,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SkillMarkdown } from "@/components/ui/skill-markdown";
import { CustomSelect } from "@/components/ui/custom-select";
import { Sheet, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/sheet";
import {
    Sparkles, Bot, Plus, Trash2, Loader2, Check,
    Terminal, BookOpen, Download,
    ChevronDown, ChevronRight, Search, FileText, Power,
    Eye, Code, Tag, Clock, Layers, Globe, Pencil, Save, X,
} from "lucide-react";
import Link from "next/link";

// 颜色映射
const skillColors: Record<string, string> = {
    "agent-browser": "from-blue-500 to-cyan-400",
    "imagegen": "from-pink-500 to-rose-400",
    "schedule": "from-amber-500 to-orange-400",
    "send-user-message": "from-green-500 to-emerald-400",
    "skill-creator": "from-violet-500 to-purple-400",
};

function getSkillGradient(name: string): string {
    return skillColors[name] || "from-slate-500 to-slate-400";
}

export default function SkillsPage() {
    const { data: agents } = usePolling<Record<string, AgentConfig>>(getAgents, 5000);
    const [skillDefs, setSkillDefs] = useState<SkillDefinition[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<string>("");
    const [agentSkills, setAgentSkills] = useState<AgentSkill[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState("");
    const [expandAgent, setExpandAgent] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    // 详情抽屉状态
    const [detailSkill, setDetailSkill] = useState<SkillDefinition | null>(null);
    // 编辑模式
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState({ description: "", content: "", category: "", version: "", allowed_tools: "" });
    const [editSaving, setEditSaving] = useState(false);

    const startEditing = useCallback((skill: SkillDefinition) => {
        setEditForm({
            description: skill.description || "",
            content: skill.content || "",
            category: skill.category || "",
            version: skill.version || "1.0.0",
            allowed_tools: skill.allowed_tools || "",
        });
        setEditing(true);
    }, []);

    const handleSaveEdit = useCallback(async () => {
        if (!detailSkill) return;
        setEditSaving(true);
        try {
            const res = await updateSkillDefinition(detailSkill.id, editForm);
            // 更新本地列表
            setSkillDefs(prev => prev.map(s => s.id === detailSkill.id ? res.skill : s));
            setDetailSkill(res.skill);
            setEditing(false);
        } catch (e) { console.error("保存失败:", e); }
        finally { setEditSaving(false); }
    }, [detailSkill, editForm]);

    // CLI 全局技能
    const [cliSkills, setCliSkills] = useState<CLIGlobalSkill[]>([]);
    const [cliLoading, setCliLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"market" | "cli">("market");
    const [cliDetailSkill, setCliDetailSkill] = useState<CLIGlobalSkill | null>(null);

    useEffect(() => {
        getCLIGlobalSkills()
            .then(res => setCliSkills(res.skills || []))
            .catch(() => setCliSkills([]))
            .finally(() => setCliLoading(false));
    }, []);

    // 获取 Skill 定义
    const refreshDefs = useCallback(async () => {
        try {
            const res = await getSkillDefinitions();
            setSkillDefs(res.skills || []);
        } catch { setSkillDefs([]); }
    }, []);

    useEffect(() => { refreshDefs(); }, [refreshDefs]);

    // 自动选第一个 Agent
    useEffect(() => {
        if (!selectedAgent && agents) {
            const firstId = Object.keys(agents)[0];
            if (firstId) setSelectedAgent(firstId);
        }
    }, [agents, selectedAgent]);

    // Agent 技能
    const refreshSkills = useCallback(async () => {
        if (!selectedAgent) return;
        setLoading(true);
        try {
            const res = await getAgentSkills(selectedAgent);
            setAgentSkills(res.skills || []);
        } catch { setAgentSkills([]); } finally { setLoading(false); }
    }, [selectedAgent]);

    useEffect(() => { refreshSkills(); }, [refreshSkills]);

    const handleInstall = useCallback(async (skill: SkillDefinition) => {
        if (!selectedAgent) return;
        setActionLoading(`install-${skill.id}`);
        try {
            await addAgentSkill(selectedAgent, {
                skill_name: skill.name, description: skill.description,
                source: skill.source, enabled: true,
            });
            await refreshSkills();
        } catch (e) { console.error("装载失败:", e); }
        finally { setActionLoading(""); }
    }, [selectedAgent, refreshSkills]);

    const handleUninstall = useCallback(async (skillId: number) => {
        if (!selectedAgent) return;
        setActionLoading(`remove-${skillId}`);
        try {
            await removeAgentSkill(selectedAgent, skillId);
            await refreshSkills();
        } catch (e) { console.error("卸载失败:", e); }
        finally { setActionLoading(""); }
    }, [selectedAgent, refreshSkills]);

    const handleDeleteDef = useCallback(async (id: number) => {
        setActionLoading(`delete-${id}`);
        try {
            await deleteSkillDefinition(id);
            await refreshDefs();
            // 如果抽屉正在展示被删除的 skill，关掉
            if (detailSkill?.id === id) setDetailSkill(null);
        } catch (e) { console.error("删除失败:", e); }
        finally { setActionLoading(""); }
    }, [refreshDefs, detailSkill]);

    const handleImport = useCallback(async () => {
        setActionLoading("import");
        try {
            const res = await importBuiltinSkills();
            setSkillDefs(res.skills || []);
        } catch (e) { console.error("导入失败:", e); }
        finally { setActionLoading(""); }
    }, []);

    const isInstalled = (name: string) => agentSkills.some(s => s.skill_name === name);

    const filtered = skillDefs.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-6 space-y-6 animate-fade-in">
            {/* 页头 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" /> Skills 管理
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">创建、管理和装载 Agent 技能</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleImport} disabled={actionLoading === "import"}>
                        {actionLoading === "import"
                            ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                            : <Download className="h-3.5 w-3.5 mr-1" />}
                        导入内置
                    </Button>
                    <Link href="/skills/new">
                        <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> 创建 Skill</Button>
                    </Link>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
                {/* 左侧：Agent 选择器 + 已装载 */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <button
                            onClick={() => setExpandAgent(!expandAgent)}
                            className="flex w-full items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                            {expandAgent ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            选择 Agent ({agents ? Object.keys(agents).length : 0})
                        </button>

                        {expandAgent && agents && (
                            <div className="space-y-1.5">
                                {Object.entries(agents).map(([id, agent]) => (
                                    <button
                                        key={id}
                                        onClick={() => setSelectedAgent(id)}
                                        className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-all cursor-pointer border ${selectedAgent === id
                                            ? "bg-primary/5 border-primary/30 text-primary shadow-sm"
                                            : "border-transparent hover:bg-secondary text-muted-foreground hover:text-foreground"
                                            }`}
                                    >
                                        <div className={`flex h-7 w-7 items-center justify-center text-[11px] font-bold ${selectedAgent === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                            }`}>
                                            {agent.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="text-left flex-1 min-w-0">
                                            <p className="font-medium text-xs truncate">{agent.name}</p>
                                            <p className="text-[10px] text-muted-foreground">@{id}</p>
                                        </div>
                                        {selectedAgent === id && (
                                            <Badge variant="secondary" className="text-[9px] shrink-0">
                                                {loading ? "..." : agentSkills.length} 技能
                                            </Badge>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 已装载技能卡片 */}
                    {selectedAgent && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 px-1">
                                <Bot className="h-3 w-3" /> @{selectedAgent} 已装载
                            </h3>
                            {loading ? (
                                <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                            ) : agentSkills.length === 0 ? (
                                <Card className="border-dashed">
                                    <CardContent className="text-center py-6">
                                        <Sparkles className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                                        <p className="text-xs text-muted-foreground">暂无技能</p>
                                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">从右侧选择技能装载</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-2">
                                    {agentSkills.map(skill => {
                                        const isRemoving = actionLoading === `remove-${skill.id}`;
                                        return (
                                            <Card key={skill.id} className="hover:border-primary/20 transition-all group">
                                                <CardContent className="p-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`flex h-8 w-8 items-center justify-center bg-gradient-to-br ${getSkillGradient(skill.skill_name)} text-white shrink-0 shadow-sm`}>
                                                            <Sparkles className="h-3.5 w-3.5" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-semibold truncate">{skill.skill_name}</p>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <Badge variant={skill.source === "builtin" ? "secondary" : "outline"} className="text-[8px] px-1.5 py-0">
                                                                    {skill.source === "builtin" ? "内置" : "自定义"}
                                                                </Badge>
                                                                <span className="flex items-center gap-0.5 text-[9px] text-green-600">
                                                                    <Power className="h-2.5 w-2.5" /> 启用
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="ghost" size="icon"
                                                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                                            onClick={() => handleUninstall(skill.id)}
                                                            disabled={isRemoving}
                                                        >
                                                            {isRemoving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3 text-destructive" />}
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 右侧：Tab 切换（技能市场 / CLI 全局） */}
                <div className="space-y-4">

                    {/* Tab 栏 */}
                    <div className="flex items-center border-b">
                        <button
                            onClick={() => setActiveTab("market")}
                            className={`px-4 py-2 text-sm font-medium transition-colors relative cursor-pointer ${activeTab === "market"
                                ? "text-primary"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            <Sparkles className="h-3.5 w-3.5 inline-block mr-1.5 -mt-0.5" />
                            技能市场
                            <Badge variant="secondary" className="text-[9px] ml-1.5">{skillDefs.length}</Badge>
                            {activeTab === "market" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
                        </button>
                        <button
                            onClick={() => setActiveTab("cli")}
                            className={`px-4 py-2 text-sm font-medium transition-colors relative cursor-pointer ${activeTab === "cli"
                                ? "text-primary"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            <Globe className="h-3.5 w-3.5 inline-block mr-1.5 -mt-0.5" />
                            CLI 全局
                            {!cliLoading && <Badge variant="outline" className="text-[9px] ml-1.5">{cliSkills.length}</Badge>}
                            {activeTab === "cli" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
                        </button>
                    </div>

                    {/* Tab 内容 */}
                    {activeTab === "market" ? (
                        /* ═══ 技能市场 ═══ */
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text" value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="搜索技能..."
                                    className="w-full pl-9 pr-4 py-2 text-sm border bg-card focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {filtered.map(skill => {
                                    const installed = isInstalled(skill.name);
                                    const isAdding = actionLoading === `install-${skill.id}`;
                                    const isDeleting = actionLoading === `delete-${skill.id}`;
                                    return (
                                        <Card
                                            key={skill.id}
                                            className={`group hover:border-primary/30 transition-all hover:shadow-md cursor-pointer ${installed ? "border-green-200 bg-green-50/30" : ""}`}
                                            onClick={() => setDetailSkill(skill)}
                                        >
                                            <CardContent className="p-4">
                                                <div className="flex items-start gap-3 mb-3">
                                                    <div className={`flex h-10 w-10 items-center justify-center bg-gradient-to-br ${getSkillGradient(skill.name)} text-white shrink-0 shadow-sm`}>
                                                        <Sparkles className="h-5 w-5" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="font-semibold text-sm">{skill.name}</p>
                                                            <Badge variant={skill.source === "builtin" ? "secondary" : "outline"} className="text-[9px]">
                                                                {skill.source === "builtin" ? "内置" : skill.source === "community" ? "社区" : "自定义"}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                                                            {skill.description || "暂无描述"}
                                                        </p>
                                                    </div>
                                                    <Eye className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/60 transition-colors shrink-0 mt-1" />
                                                </div>

                                                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                                                    {skill.category && <Badge variant="outline" className="text-[9px] gap-1"><Tag className="h-2.5 w-2.5" /> {skill.category}</Badge>}
                                                    <Badge variant="outline" className="text-[9px] gap-1"><FileText className="h-2.5 w-2.5" /> v{skill.version || "1.0.0"}</Badge>
                                                    {skill.content && <Badge variant="outline" className="text-[9px] gap-1"><BookOpen className="h-2.5 w-2.5" /> {skill.content.length} 字</Badge>}
                                                    {skill.allowed_tools && <Badge variant="outline" className="text-[9px] gap-1"><Terminal className="h-2.5 w-2.5" /> 工具</Badge>}
                                                </div>

                                                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                                    {installed ? (
                                                        <Button variant="outline" size="sm" className="flex-1 text-green-600 border-green-200" disabled>
                                                            <Check className="h-3.5 w-3.5 mr-1" /> 已装载
                                                        </Button>
                                                    ) : (
                                                        <Button size="sm" className="flex-1" onClick={() => handleInstall(skill)} disabled={isAdding || !selectedAgent}>
                                                            {isAdding
                                                                ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> 装载中...</>
                                                                : <><Plus className="h-3.5 w-3.5 mr-1" /> 装载到 @{selectedAgent}</>}
                                                        </Button>
                                                    )}
                                                    {skill.source !== "builtin" && (
                                                        <Button variant="ghost" size="sm" onClick={() => handleDeleteDef(skill.id)} disabled={isDeleting}>
                                                            {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
                                                        </Button>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>

                            {filtered.length === 0 && (
                                <Card>
                                    <CardContent className="text-center py-16">
                                        <Sparkles className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                                        <p className="text-sm text-muted-foreground">{searchQuery ? "没有匹配的技能" : "暂无技能定义"}</p>
                                        <p className="text-xs text-muted-foreground/60 mt-1">
                                            {searchQuery ? "尝试不同的关键词" : "点击「导入内置」加载预设技能，或点击「创建 Skill」添加自定义技能"}
                                        </p>
                                        {!searchQuery && (
                                            <Button variant="outline" size="sm" className="mt-4" onClick={handleImport} disabled={actionLoading === "import"}>
                                                <Download className="h-3.5 w-3.5 mr-1" /> 导入内置技能
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    ) : (
                        /* ═══ CLI 全局技能 ═══ */
                        <div className="space-y-4">
                            <p className="text-xs text-muted-foreground">
                                以下技能由各 CLI 工具自带，存储在系统全局目录中，仅可查看。
                            </p>
                            {cliLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : cliSkills.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {cliSkills.map(skill => {
                                        const cliColorMap: Record<string, string> = {
                                            codex: "from-green-500 to-emerald-400",
                                            claude: "from-orange-500 to-amber-400",
                                            opencode: "from-cyan-500 to-teal-400",
                                            gemini: "from-blue-500 to-indigo-400",
                                        };
                                        return (
                                            <Card
                                                key={`${skill.source}-${skill.name}`}
                                                className="group border-dashed bg-muted/20 hover:border-primary/30 transition-all hover:shadow-md cursor-pointer"
                                                onClick={() => setCliDetailSkill(skill)}
                                            >
                                                <CardContent className="p-4">
                                                    <div className="flex items-start gap-3 mb-2">
                                                        <div className={`flex h-10 w-10 items-center justify-center bg-gradient-to-br ${cliColorMap[skill.source] || "from-slate-500 to-slate-400"} text-white shrink-0 shadow-sm`}>
                                                            <Globe className="h-4 w-4" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <p className="font-semibold text-sm">{skill.name}</p>
                                                                <Badge variant="outline" className="text-[9px]">
                                                                    {skill.source} CLI
                                                                </Badge>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                                                                {skill.description || "暂无描述"}
                                                            </p>
                                                        </div>
                                                        <Eye className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/60 transition-colors shrink-0 mt-1" />
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground/60 font-mono truncate" title={skill.file_path}>
                                                        {skill.file_path}
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            ) : (
                                <Card>
                                    <CardContent className="text-center py-16">
                                        <Globe className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                                        <p className="text-sm text-muted-foreground">未检测到 CLI 全局技能</p>
                                        <p className="text-xs text-muted-foreground/60 mt-1">请确认已安装 Codex / Claude / OpenCode CLI</p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ===== Skill 详情抽屉 ===== */}
            <Sheet open={!!detailSkill} onClose={() => { setDetailSkill(null); setEditing(false); }} width="max-w-lg">
                {detailSkill && (
                    <>
                        <SheetHeader onClose={() => setDetailSkill(null)}>
                            <div className="flex items-center gap-3">
                                <div className={`flex h-10 w-10 items-center justify-center bg-gradient-to-br ${getSkillGradient(detailSkill.name)} text-white shadow-sm shrink-0`}>
                                    <Sparkles className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-base">{detailSkill.name}</h2>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <Badge variant={detailSkill.source === "builtin" ? "secondary" : "outline"} className="text-[9px]">
                                            {detailSkill.source === "builtin" ? "内置" : "自定义"}
                                        </Badge>
                                        {detailSkill.category && <Badge variant="outline" className="text-[9px]">{detailSkill.category}</Badge>}
                                    </div>
                                </div>
                            </div>
                        </SheetHeader>

                        <SheetBody>
                            {editing ? (
                                /* ═══ 编辑模式 ═══ */
                                <div className="flex flex-col gap-4 h-full">
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">描述</label>
                                        <textarea
                                            value={editForm.description}
                                            onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                            rows={2}
                                            className="w-full text-sm border bg-card px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">分类</label>
                                            <CustomSelect
                                                value={editForm.category}
                                                onChange={v => setEditForm({ ...editForm, category: v })}
                                                options={[
                                                    { value: "工具", label: "🔧 工具" },
                                                    { value: "自动化", label: "⚡ 自动化" },
                                                    { value: "分析", label: "📊 分析" },
                                                    { value: "通信", label: "💬 通信" },
                                                    { value: "开发", label: "💻 开发" },
                                                    { value: "其他", label: "📦 其他" },
                                                ]}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">版本</label>
                                            <input
                                                value={editForm.version}
                                                onChange={e => setEditForm({ ...editForm, version: e.target.value })}
                                                className="w-full text-sm border bg-card px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">允许的工具</label>
                                        <input
                                            value={editForm.allowed_tools}
                                            onChange={e => setEditForm({ ...editForm, allowed_tools: e.target.value })}
                                            placeholder="留空表示不限制"
                                            className="w-full text-sm border bg-card px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        />
                                    </div>
                                    <div className="flex-1 flex flex-col min-h-0">
                                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block shrink-0">SKILL.md 内容</label>
                                        <textarea
                                            value={editForm.content}
                                            onChange={e => setEditForm({ ...editForm, content: e.target.value })}
                                            className="flex-1 w-full text-[11px] font-mono border bg-zinc-900 text-zinc-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none leading-relaxed min-h-[200px]"
                                        />
                                    </div>
                                </div>
                            ) : (
                                /* ═══ 查看模式 ═══ */
                                <div className="space-y-5">
                                    {/* 元信息 */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-muted/30 border px-3 py-2.5">
                                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                                                <Tag className="h-3 w-3" /> 版本
                                            </div>
                                            <p className="text-sm font-medium">{detailSkill.version || "1.0.0"}</p>
                                        </div>
                                        <div className="bg-muted/30 border px-3 py-2.5">
                                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                                                <Layers className="h-3 w-3" /> 来源
                                            </div>
                                            <p className="text-sm font-medium">{detailSkill.source === "builtin" ? "系统内置" : "自定义创建"}</p>
                                        </div>
                                        <div className="bg-muted/30 border px-3 py-2.5">
                                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                                                <BookOpen className="h-3 w-3" /> 内容大小
                                            </div>
                                            <p className="text-sm font-medium">{detailSkill.content ? `${detailSkill.content.length} 字符` : "无"}</p>
                                        </div>
                                        <div className="bg-muted/30 border px-3 py-2.5">
                                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                                                <Clock className="h-3 w-3" /> 创建时间
                                            </div>
                                            <p className="text-sm font-medium">{detailSkill.created_at ? new Date(detailSkill.created_at).toLocaleDateString() : "—"}</p>
                                        </div>
                                    </div>

                                    {/* 描述 */}
                                    <div>
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <FileText className="h-3 w-3" /> 描述
                                        </h4>
                                        <p className="text-sm text-foreground/80 leading-relaxed bg-muted/20 border px-3 py-2.5">
                                            {detailSkill.description || "暂无描述"}
                                        </p>
                                    </div>

                                    {/* 允许的工具 */}
                                    {detailSkill.allowed_tools && (
                                        <div>
                                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <Terminal className="h-3 w-3" /> 允许的工具
                                            </h4>
                                            <div className="flex flex-wrap gap-1.5">
                                                {detailSkill.allowed_tools.split(",").map((tool, i) => (
                                                    <Badge key={i} variant="outline" className="text-[10px] font-mono">{tool.trim()}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* SKILL.md 内容 */}
                                    {detailSkill.content && (
                                        <div>
                                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <Code className="h-3 w-3" /> SKILL.md 内容
                                            </h4>
                                            <div className="border bg-card p-4 overflow-y-auto">
                                                <SkillMarkdown content={detailSkill.content} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </SheetBody>

                        <SheetFooter>
                            {editing ? (
                                /* 编辑模式 Footer */
                                <>
                                    <Button variant="ghost" onClick={() => setEditing(false)} disabled={editSaving}>
                                        <X className="h-3.5 w-3.5 mr-1" /> 取消
                                    </Button>
                                    <Button onClick={handleSaveEdit} disabled={editSaving}>
                                        {editSaving
                                            ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> 保存中</>
                                            : <><Save className="h-3.5 w-3.5 mr-1" /> 保存</>}
                                    </Button>
                                </>
                            ) : (
                                /* 查看模式 Footer */
                                <>
                                    {detailSkill.source !== "builtin" && (
                                        <Button variant="outline" onClick={() => startEditing(detailSkill)}>
                                            <Pencil className="h-3.5 w-3.5 mr-1" /> 编辑
                                        </Button>
                                    )}
                                    {isInstalled(detailSkill.name) ? (
                                        <Button variant="outline" className="text-green-600 border-green-200" disabled>
                                            <Check className="h-3.5 w-3.5 mr-1" /> 已装载到 @{selectedAgent}
                                        </Button>
                                    ) : (
                                        <Button onClick={() => { handleInstall(detailSkill); }} disabled={actionLoading === `install-${detailSkill.id}` || !selectedAgent}>
                                            {actionLoading === `install-${detailSkill.id}`
                                                ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> 装载中</>
                                                : <><Plus className="h-3.5 w-3.5 mr-1" /> 装载到 @{selectedAgent}</>}
                                        </Button>
                                    )}
                                </>
                            )}
                        </SheetFooter>
                    </>
                )}
            </Sheet>

            {/* ===== CLI 全局技能详情抽屉 ===== */}
            <Sheet open={!!cliDetailSkill} onClose={() => setCliDetailSkill(null)} width="max-w-lg">
                {cliDetailSkill && (
                    <>
                        <SheetHeader onClose={() => setCliDetailSkill(null)}>
                            <div className="flex items-center gap-3">
                                <div className={`flex h-10 w-10 items-center justify-center bg-gradient-to-br ${({ codex: "from-green-500 to-emerald-400", claude: "from-orange-500 to-amber-400", opencode: "from-cyan-500 to-teal-400", gemini: "from-blue-500 to-indigo-400" } as Record<string, string>)[cliDetailSkill.source] || "from-slate-500 to-slate-400"
                                    } text-white shadow-sm shrink-0`}>
                                    <Globe className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-base">{cliDetailSkill.name}</h2>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <Badge variant="outline" className="text-[9px]">{cliDetailSkill.source} CLI</Badge>
                                        <Badge variant="secondary" className="text-[9px]">全局技能</Badge>
                                    </div>
                                </div>
                            </div>
                        </SheetHeader>

                        <SheetBody>
                            <div className="space-y-5">
                                <div>
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <FileText className="h-3 w-3" /> 描述
                                    </h4>
                                    <p className="text-sm text-foreground/80 leading-relaxed bg-muted/20 border px-3 py-2.5">
                                        {cliDetailSkill.description || "暂无描述"}
                                    </p>
                                </div>
                                <div>
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <Layers className="h-3 w-3" /> 文件路径
                                    </h4>
                                    <p className="text-[11px] font-mono text-muted-foreground bg-muted/20 border px-3 py-2 break-all">
                                        {cliDetailSkill.file_path}
                                    </p>
                                </div>
                                {cliDetailSkill.content && (
                                    <div>
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <Code className="h-3 w-3" /> SKILL.md 内容
                                        </h4>
                                        <div className="border bg-card p-4 overflow-y-auto">
                                            <SkillMarkdown content={cliDetailSkill.content} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </SheetBody>

                        <SheetFooter>
                            <p className="text-xs text-muted-foreground">CLI 全局技能由 {cliDetailSkill.source} CLI 管理，仅可查看</p>
                        </SheetFooter>
                    </>
                )}
            </Sheet>
        </div>
    );
}
