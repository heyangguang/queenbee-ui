"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getLogs } from "@/lib/api";
import {
    RefreshCcw, Loader2, Search,
    X, ArrowDown, Terminal, Circle,
} from "lucide-react";

// 日志级别颜色 —— 经典终端配色，低饱和度
const LEVEL_COLORS: Record<string, string> = {
    error: "#f87171",   // 红色
    warn: "#fbbf24",    // 黄色
    info: "#60a5fa",    // 蓝色
    debug: "#6b7280",   // 灰色
};

// 日志行高亮渲染 —— 简化版，只高亮关键信息
function highlightLog(line: string) {
    const parts: { text: string; color: string }[] = [];
    // 匹配：[标签], @agent, 数字+单位
    const regex = /(\[[^\]]+\])|(@\w+)|(\d+\.?\d*\s*(?:字符|条|个|轮|秒|ms|s|次|MB|KB|B))/g;
    let lastIdx = 0;
    let match;

    while ((match = regex.exec(line)) !== null) {
        if (match.index > lastIdx) {
            parts.push({ text: line.slice(lastIdx, match.index), color: "" });
        }
        const token = match[0];
        if (match[1]) {
            // 方括号内容
            if (/ERROR/i.test(token)) parts.push({ text: token, color: "#f87171" });
            else if (/WARN/i.test(token)) parts.push({ text: token, color: "#fbbf24" });
            else if (/INFO/i.test(token)) parts.push({ text: token, color: "#60a5fa" });
            else if (/DEBUG/i.test(token)) parts.push({ text: token, color: "#6b7280" });
            else if (/^\[\d{4}-/.test(token)) parts.push({ text: token, color: "#4b5563" }); // 时间戳，更暗
            else parts.push({ text: token, color: "#a78bfa" }); // 其他方括号 紫色
        } else if (match[2]) {
            parts.push({ text: token, color: "#67e8f9" }); // @agent 青色
        } else if (match[3]) {
            parts.push({ text: token, color: "#fdba74" }); // 数字+单位 淡橙
        }
        lastIdx = match.index + token.length;
    }
    if (lastIdx < line.length) {
        parts.push({ text: line.slice(lastIdx), color: "" });
    }
    if (parts.length === 0) return <span>{line}</span>;

    return <>{parts.map((p, i) => p.color ? <span key={i} style={{ color: p.color }}>{p.text}</span> : <span key={i}>{p.text}</span>)}</>;
}

type LevelFilter = "all" | "error" | "warn" | "info" | "debug";

export default function LogsPage() {
    const [logs, setLogs] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState("");
    const [level, setLevel] = useState<LevelFilter>("all");
    const [autoScroll, setAutoScroll] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try { const r = await getLogs(); setLogs(r.lines || []); } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);
    useEffect(() => { const iv = setInterval(fetchLogs, 3000); return () => clearInterval(iv); }, [fetchLogs]);
    useEffect(() => {
        if (autoScroll && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [logs, autoScroll]);

    const getLevel = (l: string): LevelFilter => {
        if (l.includes("[ERROR]")) return "error";
        if (l.includes("[WARN]") || l.includes("[WARNING]")) return "warn";
        if (l.includes("[DEBUG]")) return "debug";
        return "info";
    };

    const filtered = logs.filter(l => {
        if (filter && !l.toLowerCase().includes(filter.toLowerCase())) return false;
        if (level !== "all" && getLevel(l) !== level) return false;
        return true;
    });

    const errCount = logs.filter(l => getLevel(l) === "error").length;
    const warnCount = logs.filter(l => getLevel(l) === "warn").length;

    const levelBtnStyle = (lv: LevelFilter, active: boolean) => ({
        padding: "4px 10px",
        fontSize: "11px",
        fontFamily: "var(--font-mono)",
        cursor: "pointer" as const,
        border: "none",
        transition: "all 0.15s",
        color: active
            ? (lv === "error" ? "#f87171" : lv === "warn" ? "#fbbf24" : lv === "info" ? "#60a5fa" : lv === "debug" ? "#9ca3af" : "#e2e8f0")
            : "#6b7280",
        background: active ? "rgba(255,255,255,0.06)" : "transparent",
        borderBottom: active ? `2px solid ${lv === "error" ? "#f87171" : lv === "warn" ? "#fbbf24" : lv === "info" ? "#60a5fa" : lv === "debug" ? "#9ca3af" : "#e2e8f0"}` : "2px solid transparent",
    });

    return (
        <div style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: "#0d1117",
            color: "#c9d1d9",
            fontFamily: "var(--font-mono)",
        }}>
            {/* 终端标题栏 */}
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 16px",
                background: "#161b22",
                borderBottom: "1px solid #21262d",
                flexShrink: 0,
            }}>
                {/* 红绿灯 + 标题 */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                        <Circle size={10} fill="#ff5f57" stroke="none" />
                        <Circle size={10} fill="#febc2e" stroke="none" />
                        <Circle size={10} fill="#28c840" stroke="none" />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Terminal size={14} style={{ color: "#7c8491" }} />
                        <span style={{ fontSize: "12px", color: "#7c8491", fontWeight: 500 }}>
                            queenbee — 系统日志
                        </span>
                    </div>
                </div>

                {/* 右侧状态信息 */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "11px" }}>
                    {errCount > 0 && (
                        <button onClick={() => setLevel(level === "error" ? "all" : "error")}
                            style={{
                                background: "rgba(248,113,113,0.1)",
                                color: "#f87171",
                                border: "1px solid rgba(248,113,113,0.2)",
                                padding: "2px 8px",
                                fontSize: "10px",
                                fontFamily: "var(--font-mono)",
                                cursor: "pointer",
                            }}>
                            {errCount} ERROR
                        </button>
                    )}
                    {warnCount > 0 && (
                        <button onClick={() => setLevel(level === "warn" ? "all" : "warn")}
                            style={{
                                background: "rgba(251,191,36,0.1)",
                                color: "#fbbf24",
                                border: "1px solid rgba(251,191,36,0.2)",
                                padding: "2px 8px",
                                fontSize: "10px",
                                fontFamily: "var(--font-mono)",
                                cursor: "pointer",
                            }}>
                            {warnCount} WARN
                        </button>
                    )}
                    <span style={{ color: "#484f58" }}>
                        {logs.length} lines
                    </span>
                    <span style={{
                        color: "#3fb950",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                    }}>
                        <span style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: "#3fb950",
                            display: "inline-block",
                            animation: "pulse-dot 2s ease-in-out infinite",
                        }} />
                        live
                    </span>
                </div>
            </div>

            {/* 工具栏 */}
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: "0",
                padding: "0 12px",
                background: "#161b22",
                borderBottom: "1px solid #21262d",
                flexShrink: 0,
            }}>
                {/* 级别过滤 */}
                <div style={{ display: "flex", alignItems: "center" }}>
                    {(["all", "error", "warn", "info", "debug"] as const).map(lv => (
                        <button key={lv} onClick={() => setLevel(lv)}
                            style={levelBtnStyle(lv, level === lv)}>
                            {lv === "all" ? "ALL" : lv.toUpperCase()}
                        </button>
                    ))}
                </div>

                {/* 分隔线 */}
                <div style={{ width: "1px", height: "20px", background: "#21262d", margin: "0 12px" }} />

                {/* 搜索 */}
                <div style={{ position: "relative", flex: 1, maxWidth: "320px" }}>
                    <Search size={12} style={{
                        position: "absolute",
                        left: "8px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#484f58",
                    }} />
                    <input
                        type="text"
                        placeholder="grep..."
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        style={{
                            width: "100%",
                            padding: "5px 28px 5px 26px",
                            fontSize: "11px",
                            fontFamily: "var(--font-mono)",
                            background: "#0d1117",
                            border: "1px solid #21262d",
                            color: "#c9d1d9",
                            outline: "none",
                        }}
                    />
                    {filter && (
                        <button onClick={() => setFilter("")}
                            style={{
                                position: "absolute",
                                right: "6px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                background: "none",
                                border: "none",
                                color: "#484f58",
                                cursor: "pointer",
                                padding: "2px",
                            }}>
                            <X size={10} />
                        </button>
                    )}
                </div>

                {/* 右侧工具按钮 */}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px" }}>
                    <button onClick={() => setAutoScroll(!autoScroll)} title="自动滚动"
                        style={{
                            padding: "5px",
                            background: autoScroll ? "rgba(56,139,253,0.15)" : "transparent",
                            border: "none",
                            color: autoScroll ? "#58a6ff" : "#484f58",
                            cursor: "pointer",
                        }}>
                        <ArrowDown size={13} />
                    </button>
                    <button onClick={fetchLogs} disabled={loading} title="刷新"
                        style={{
                            padding: "5px",
                            background: "transparent",
                            border: "none",
                            color: "#484f58",
                            cursor: "pointer",
                        }}>
                        {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
                    </button>
                </div>
            </div>

            {/* 日志输出区 */}
            <div ref={scrollRef} style={{
                flex: 1,
                overflow: "auto",
                padding: "0",
            }}>
                {filtered.length > 0 ? (
                    <div style={{ padding: "4px 0" }}>
                        {filtered.map((line, i) => {
                            const lvl = getLevel(line);
                            const isError = lvl === "error";
                            const isWarn = lvl === "warn";
                            return (
                                <div key={i} style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    padding: "1px 16px 1px 0",
                                    fontSize: "12px",
                                    lineHeight: "20px",
                                    background: isError
                                        ? "rgba(248,113,113,0.06)"
                                        : isWarn
                                            ? "rgba(251,191,36,0.04)"
                                            : "transparent",
                                    borderLeft: isError
                                        ? "2px solid #f87171"
                                        : isWarn
                                            ? "2px solid #fbbf24"
                                            : "2px solid transparent",
                                    transition: "background 0.1s",
                                }}
                                    onMouseEnter={e => {
                                        if (!isError && !isWarn) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)";
                                    }}
                                    onMouseLeave={e => {
                                        if (!isError && !isWarn) (e.currentTarget as HTMLDivElement).style.background = "transparent";
                                    }}
                                >
                                    {/* 行号 */}
                                    <span style={{
                                        display: "inline-block",
                                        width: "44px",
                                        textAlign: "right",
                                        color: "#30363d",
                                        fontSize: "11px",
                                        userSelect: "none",
                                        flexShrink: 0,
                                        paddingRight: "12px",
                                        borderRight: "1px solid #21262d",
                                        marginRight: "12px",
                                    }}>
                                        {i + 1}
                                    </span>
                                    {/* 级别指示点 */}
                                    <span style={{
                                        display: "inline-block",
                                        width: "4px",
                                        height: "4px",
                                        borderRadius: "50%",
                                        background: LEVEL_COLORS[lvl] || "#6b7280",
                                        marginTop: "8px",
                                        marginRight: "8px",
                                        flexShrink: 0,
                                        opacity: lvl === "info" ? 0.4 : lvl === "debug" ? 0.2 : 1,
                                    }} />
                                    {/* 日志内容 */}
                                    <span style={{
                                        flex: 1,
                                        whiteSpace: "pre-wrap",
                                        wordBreak: "break-all",
                                        color: lvl === "debug" ? "#484f58" : "#c9d1d9",
                                    }}>
                                        {highlightLog(line)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        color: "#30363d",
                    }}>
                        <Terminal size={40} style={{ marginBottom: "12px", opacity: 0.3 }} />
                        <span style={{ fontSize: "13px" }}>
                            {filter || level !== "all" ? "$ grep: no matches found" : "$ tail -f queenbee.log"}
                        </span>
                        <span style={{ fontSize: "11px", marginTop: "4px", opacity: 0.5 }}>
                            等待日志输出...
                        </span>
                    </div>
                )}
            </div>

            {/* 底部状态栏 */}
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "4px 16px",
                background: "#161b22",
                borderTop: "1px solid #21262d",
                fontSize: "10px",
                color: "#484f58",
                flexShrink: 0,
            }}>
                <span>
                    {filtered.length === logs.length
                        ? `${logs.length} lines`
                        : `${filtered.length}/${logs.length} lines (filtered)`
                    }
                </span>
                <span>自动刷新 3s · {autoScroll ? "⬇ auto-scroll" : "scroll paused"}</span>
            </div>
        </div>
    );
}
