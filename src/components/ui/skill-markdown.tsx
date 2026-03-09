"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * 渲染 SKILL.md 内容为格式化的 Markdown
 * 自动去除 YAML frontmatter (--- ... ---)
 */
export function SkillMarkdown({ content, className }: { content: string; className?: string }) {
    // 去除 YAML frontmatter
    const cleanContent = content.replace(/^---\n[\s\S]*?\n---\n*/, "").trim();

    return (
        <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ children }) => <h1 className="text-base font-bold mt-4 mb-2 pb-1 border-b">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-sm font-semibold mt-3 mb-1.5">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-xs font-semibold mt-2 mb-1">{children}</h3>,
                    p: ({ children }) => <p className="text-xs leading-relaxed mb-2 text-foreground/80">{children}</p>,
                    ul: ({ children }) => <ul className="text-xs space-y-1 mb-2 pl-4 list-disc text-foreground/80">{children}</ul>,
                    ol: ({ children }) => <ol className="text-xs space-y-1 mb-2 pl-4 list-decimal text-foreground/80">{children}</ol>,
                    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                    code: ({ children, className: codeClass }) => {
                        // 行内代码 vs 代码块
                        const isBlock = codeClass?.startsWith("language-");
                        if (isBlock) {
                            return <code className="block text-[11px] font-mono bg-zinc-900 text-zinc-100 p-3 my-2 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">{children}</code>;
                        }
                        return <code className="text-[11px] font-mono bg-muted px-1 py-0.5 rounded">{children}</code>;
                    },
                    pre: ({ children }) => <>{children}</>,
                    hr: () => <hr className="my-3 border-border/50" />,
                    blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/30 pl-3 my-2 text-xs italic text-muted-foreground">{children}</blockquote>,
                    table: ({ children }) => <table className="text-xs border-collapse w-full my-2">{children}</table>,
                    th: ({ children }) => <th className="border px-2 py-1 bg-muted/50 text-left font-semibold">{children}</th>,
                    td: ({ children }) => <td className="border px-2 py-1">{children}</td>,
                }}
            >
                {cleanContent}
            </ReactMarkdown>
        </div>
    );
}
