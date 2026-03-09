"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Code, Eye, Maximize2, Minimize2 } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// Markdown / 代码编辑器组件
// 支持行号、语法高亮预览、全屏编辑
// ═══════════════════════════════════════════════════════════════════

interface CodeEditorProps {
    value: string;
    onChange: (value: string) => void;
    language?: "markdown" | "json" | "yaml";
    placeholder?: string;
    minRows?: number;
    maxHeight?: string;
    className?: string;
}

export function CodeEditor({
    value, onChange, language = "markdown",
    placeholder, minRows = 12, maxHeight = "500px", className,
}: CodeEditorProps) {
    const [mode, setMode] = useState<"edit" | "preview">("edit");
    const [fullscreen, setFullscreen] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const lines = value.split("\n");
    const lineCount = Math.max(lines.length, minRows);

    // Tab 键支持
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Tab") {
            e.preventDefault();
            const ta = e.currentTarget;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const newValue = value.substring(0, start) + "  " + value.substring(end);
            onChange(newValue);
            requestAnimationFrame(() => {
                ta.selectionStart = ta.selectionEnd = start + 2;
            });
        }
    }, [value, onChange]);

    // ESC 退出全屏
    useEffect(() => {
        if (!fullscreen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [fullscreen]);

    // 简易 Markdown 预览函数
    const renderPreview = (text: string) => {
        return text
            .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold mt-3 mb-1">$1</h3>')
            .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-4 mb-1.5">$1</h2>')
            .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>')
            .replace(/^---$/gm, '<hr class="my-3 border-border"/>')
            .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-muted text-xs font-mono rounded">$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
            .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-sm">$2</li>')
            .replace(/\n/g, '<br/>');
    };

    const wrapperClass = fullscreen
        ? "fixed inset-0 z-[100] bg-background flex flex-col"
        : cn("border overflow-hidden flex flex-col", className);

    return (
        <div className={wrapperClass}>
            {/* 工具栏 */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-700 shrink-0">
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setMode("edit")}
                        className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium transition-colors",
                            mode === "edit" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"
                        )}
                    >
                        <Code className="h-3 w-3" /> 编辑
                    </button>
                    <button
                        onClick={() => setMode("preview")}
                        className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium transition-colors",
                            mode === "preview" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"
                        )}
                    >
                        <Eye className="h-3 w-3" /> 预览
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 font-mono">{language.toUpperCase()} · {lines.length} 行</span>
                    <button
                        onClick={() => setFullscreen(!fullscreen)}
                        className="text-zinc-400 hover:text-zinc-200 transition-colors p-1"
                    >
                        {fullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                    </button>
                </div>
            </div>

            {/* 编辑区域 */}
            {mode === "edit" ? (
                <div className="flex flex-1 overflow-auto bg-zinc-950" style={{ maxHeight: fullscreen ? undefined : maxHeight }}>
                    {/* 行号 */}
                    <div className="select-none py-3 px-2 text-right bg-zinc-900/50 border-r border-zinc-800 shrink-0 sticky left-0">
                        {Array.from({ length: lineCount }, (_, i) => (
                            <div key={i} className="text-[11px] font-mono text-zinc-600 leading-[1.6] h-[18.4px]">
                                {i + 1}
                            </div>
                        ))}
                    </div>
                    {/* 编辑器 */}
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        spellCheck={false}
                        className="flex-1 bg-transparent text-zinc-100 font-mono text-xs leading-[1.6] py-3 px-3 resize-none focus:outline-none placeholder:text-zinc-600 min-h-[200px]"
                        style={{
                            minHeight: fullscreen ? "100%" : `${minRows * 18.4 + 24}px`,
                        }}
                    />
                </div>
            ) : (
                <div
                    className="flex-1 overflow-auto p-4 bg-background text-sm leading-relaxed prose prose-sm max-w-none"
                    style={{ maxHeight: fullscreen ? undefined : maxHeight }}
                    dangerouslySetInnerHTML={{ __html: renderPreview(value) || '<span class="text-muted-foreground text-xs">暂无内容</span>' }}
                />
            )}
        </div>
    );
}
