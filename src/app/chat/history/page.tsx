"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getChats, getTeamChats, getChatFile } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Clock, FileText, MessageSquare, Users,
    Bot, User, ChevronRight, Loader2, Search, X, ArrowRight,
} from "lucide-react";

// =================== 解析器 ===================
interface ChatMessage {
    role: "user" | "agent" | "system";
    agent?: string;
    agentId?: string;
    target?: string;
    content: string;
}

function parseChatContent(raw: string): ChatMessage[] {
    const messages: ChatMessage[] = [];
    // 用 6+ 个 dash（------）做分隔，消息体内的 --- 不会干扰
    const blocks = raw.split(/\n-{6,}\n/);

    for (const block of blocks) {
        const trimmed = block.trim();
        if (!trimmed) continue;

        const lines = trimmed.split("\n");
        const firstLine = lines[0].trim();

        // # Team Conversation: 元信息头 → 跳过整个块
        if (firstLine.startsWith("# Team Conversation:")) continue;
        // 独立的元信息行(**)
        if (/^\*\*(Date|Channel|Messages|Sender)\*\*/.test(firstLine)) continue;

        // ## 💬 User Message → 用户消息
        if (/^##\s*💬?\s*User Message/i.test(firstLine)) {
            const content = lines.slice(1).join("\n").trim();
            if (content) messages.push({ role: "user", content });
            continue;
        }

        // ## AgentName 角色 (@id) → Agent 消息
        const agentMatch = firstLine.match(/^##\s+(.+?)\s*\(@(\w[\w-]*)\)\s*$/);
        if (agentMatch) {
            let content = lines.slice(1).join("\n").trim();
            let target: string | undefined;

            // 解析 [@target: ...] 格式（内容被方括号整体包裹）
            const targetMatch = content.match(/^\[@([\w-]+)[：:]\s*([\s\S]*)\]$/);
            if (targetMatch) {
                target = targetMatch[1];
                content = targetMatch[2].trim();
            }

            if (content) {
                messages.push({
                    role: "agent",
                    agent: agentMatch[1],
                    agentId: agentMatch[2],
                    target,
                    content,
                });
            }
            continue;
        }

        // ⚠️ Agent @xxx 执行超时 等系统提示
        if (/^⚠️/.test(firstLine) || /超时|timeout|terminated/i.test(firstLine)) {
            messages.push({ role: "system", content: trimmed });
            continue;
        }

        // 其余未匹配的块 → 系统消息
        if (trimmed.length > 0) {
            messages.push({ role: "system", content: trimmed });
        }
    }
    return messages;
}

// =================== 工具函数 ===================
function formatFilename(f: string): string {
    // 2026-03-02T10-27-00.md → 2026-03-02 10:27
    const m = f.match(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]} ${m[2]}:${m[3]}`;
    return f.replace(/\.(md|txt)$/, "");
}

const AGENT_COLORS = [
    "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
    "bg-pink-500", "bg-cyan-500", "bg-indigo-500", "bg-rose-500",
];
function agentColor(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return AGENT_COLORS[Math.abs(h) % AGENT_COLORS.length];
}

// =================== 页面 ===================
export default function ChatHistoryPage() {
    const [teams, setTeams] = useState<string[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [files, setFiles] = useState<string[]>([]);
    const [rawContent, setRawContent] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingFile, setLoadingFile] = useState(false);
    const [fileFilter, setFileFilter] = useState("");
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        getChats().then(d => {
            const valid = (d || []).filter((t: string) => !t.startsWith("."));
            setTeams(valid);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const loadTeamFiles = useCallback(async (team: string) => {
        // 点击已选中的团队 → 折叠
        if (team === selected) {
            setSelected(null);
            setFiles([]);
            setRawContent(null);
            setSelectedFile(null);
            return;
        }
        setSelected(team);
        setRawContent(null);
        setSelectedFile(null);
        setFileFilter("");
        try { const d = await getTeamChats(team); setFiles((d || []).sort().reverse()); }
        catch { setFiles([]); }
    }, [selected]);

    const loadFile = useCallback(async (team: string, file: string) => {
        setSelectedFile(file);
        setLoadingFile(true);
        try {
            const d = await getChatFile(team, file);
            setRawContent(d.content || "[无内容]");
        } catch { setRawContent("[读取失败]"); }
        finally { setLoadingFile(false); }
    }, []);

    // 加载完自动滚到底
    useEffect(() => {
        if (rawContent && contentRef.current) {
            setTimeout(() => {
                contentRef.current?.scrollTo({ top: contentRef.current.scrollHeight, behavior: "smooth" });
            }, 100);
        }
    }, [rawContent]);

    const messages = rawContent ? parseChatContent(rawContent) : [];
    const filteredFiles = fileFilter
        ? files.filter(f => f.toLowerCase().includes(fileFilter.toLowerCase()))
        : files;

    return (
        // 整个页面固定高度，左右各自滚动
        <div className="flex h-full animate-fade-in">
            {/* ======= 左侧面板 ======= */}
            <div className="w-72 border-r bg-card flex flex-col shrink-0">
                <div className="px-4 py-3 border-b shrink-0">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-sm font-bold">聊天历史</span>
                        <Badge variant="secondary" className="text-[9px] ml-auto">{teams.length} 团队</Badge>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : teams.length === 0 ? (
                        <Card className="m-3">
                            <CardContent className="text-center py-10">
                                <MessageSquare className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
                                <p className="text-xs text-muted-foreground">暂无聊天历史</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="p-2 space-y-0.5">
                            {teams.map(team => (
                                <button key={team} onClick={() => loadTeamFiles(team)}
                                    className={`w-full text-left px-3 py-2.5 rounded-md text-sm flex items-center gap-2.5 transition-all cursor-pointer group
                                        ${selected === team ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary"}`}>
                                    <div className={`flex h-7 w-7 items-center justify-center rounded text-[11px] font-bold text-white ${agentColor(team)}`}>
                                        {team.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="flex-1 font-medium truncate">{team}</span>
                                    <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground/40 transition-transform ${selected === team ? "rotate-90" : ""}`} />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* 文件列表 */}
                    {selected && files.length > 0 && (
                        <div className="border-t">
                            <div className="px-3 pt-2.5 pb-1">
                                <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                    <input type="text" placeholder="搜索记录..." value={fileFilter} onChange={e => setFileFilter(e.target.value)}
                                        className="w-full pl-7 pr-6 py-1.5 text-[11px] bg-secondary/50 border-0 rounded focus:ring-1 focus:ring-primary focus:outline-none" />
                                    {fileFilter && <button onClick={() => setFileFilter("")} className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"><X className="h-3 w-3 text-muted-foreground" /></button>}
                                </div>
                            </div>
                            <div className="p-1.5 space-y-px">
                                {filteredFiles.map(file => (
                                    <button key={file} onClick={() => loadFile(selected, file)}
                                        className={`w-full text-left px-3 py-2 rounded text-[11px] flex items-center gap-2 transition-colors cursor-pointer
                                            ${selectedFile === file ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                                        <FileText className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{formatFilename(file)}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ======= 右侧内容 ======= */}
            <div className="flex-1 flex flex-col min-w-0 bg-card">
                {rawContent !== null ? (
                    <>
                        {/* 头部 */}
                        <div className="px-6 py-3 border-b bg-card shrink-0 flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            <span className="text-sm font-semibold">{selected}</span>
                            <Badge variant="outline" className="text-[10px] font-mono">{formatFilename(selectedFile || "")}</Badge>
                            <span className="text-[10px] text-muted-foreground ml-auto">{messages.length} 条消息</span>
                        </div>

                        {/* 消息区域 - 独立滚动 */}
                        <div ref={contentRef} className="flex-1 overflow-y-auto p-6 space-y-4">
                            {loadingFile ? (
                                <div className="flex items-center justify-center py-20">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : messages.length > 0 ? (
                                messages.map((msg, i) => {
                                    if (msg.role === "system") {
                                        return (
                                            <div key={i} className="text-center my-2">
                                                <span className="text-[10px] text-muted-foreground/60 bg-secondary px-3 py-1 rounded-full inline-block max-w-[80%] truncate">
                                                    {msg.content.trim().substring(0, 100)}
                                                </span>
                                            </div>
                                        );
                                    }
                                    const isUser = msg.role === "user";
                                    return (
                                        <div key={i} className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
                                            {/* 头像 */}
                                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-[11px] font-bold ${isUser ? "bg-slate-500" : agentColor(msg.agentId || "agent")}`}>
                                                {isUser ? <User className="h-4 w-4" /> : (msg.agentId?.charAt(0).toUpperCase() || <Bot className="h-4 w-4" />)}
                                            </div>
                                            {/* 消息体 */}
                                            <div className={`max-w-[80%] min-w-0 ${isUser ? "items-end" : "items-start"}`}>
                                                {!isUser && (msg.agent || msg.agentId) && (
                                                    <div className="flex items-center gap-1.5 mb-1 px-1">
                                                        <span className="text-[11px] font-semibold">{msg.agent}</span>
                                                        {msg.agentId && <span className="text-[10px] text-muted-foreground">@{msg.agentId}</span>}
                                                        {msg.target && (
                                                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                                                <ArrowRight className="h-2.5 w-2.5" /> @{msg.target}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                <Card className={`${isUser ? "bg-primary/5 border-primary/20" : ""}`}>
                                                    <CardContent className="p-3">
                                                        <div className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{msg.content.trim()}</div>
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <Card>
                                    <CardContent className="p-4">
                                        <pre className="text-[12px] font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed">{rawContent}</pre>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <Card>
                            <CardContent className="text-center py-16 px-12">
                                <Clock className="h-12 w-12 text-muted-foreground/15 mx-auto mb-3" />
                                <p className="text-sm text-muted-foreground font-medium">选择左侧对话查看历史记录</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">按团队分组 · 支持搜索</p>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
