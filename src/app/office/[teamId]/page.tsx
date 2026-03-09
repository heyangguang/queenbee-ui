"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { OfficeState } from "@/lib/pixel-office/engine/officeState";
import { renderFrame, renderPhotoComments } from "@/lib/pixel-office/engine/renderer";
import { syncAgentsToOffice, type AgentActivity } from "@/lib/pixel-office/agentBridge";
import { TILE_SIZE } from "@/lib/pixel-office/constants";
import { createTeamLayout } from "@/lib/pixel-office/layout/layoutSerializer";
import { loadCharacterPNGs, loadWallPNG } from "@/lib/pixel-office/sprites/pngLoader";
import { usePolling, timeAgo } from "@/lib/hooks";
import { getAgents, getTeams, getConversationHistory, getConversationTimeline, getSessions, type AgentConfig, type TeamConfig } from "@/lib/api";
import {
    useAgentStates, useOfficeSSE, useSessionsPolling, useIdleActionSwitch,
    COLORS, type AgentSt, type ChatEntry,
} from "../components/shared-hooks";

// 精灵资源缓存
let spriteAssetsPromise: Promise<void> | null = null;

export default function TeamOfficePage() {
    const params = useParams();
    const teamId = params.teamId as string;
    const { data: allAgents } = usePolling<Record<string, AgentConfig>>(getAgents, 5000);
    const { data: allTeams } = usePolling<Record<string, TeamConfig>>(getTeams, 5000);
    const { states, setStates, upd, toIdle } = useAgentStates();
    const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
    const [connected, setConnected] = useState(false);
    const [officeReady, setOfficeReady] = useState(false);
    const [panelOpen, setPanelOpen] = useState(true);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const officeRef = useRef<OfficeState | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const agentIdMapRef = useRef<Map<string, number>>(new Map());
    const nextIdRef = useRef<{ current: number }>({ current: 1 });
    const chatHistoryRef = useRef<ChatEntry[]>([]);
    const pushedBubbleIdsRef = useRef<Set<string>>(new Set());

    // 获取当前团队信息
    const team = allTeams?.[teamId];
    const isUnassigned = teamId === "_unassigned";

    // 计算团队的 agents
    const teamAgentIds = useMemo(() => {
        if (isUnassigned && allTeams && allAgents) {
            const assigned = new Set<string>();
            for (const t of Object.values(allTeams)) {
                for (const aid of (t.agents || [])) assigned.add(aid);
            }
            return Object.keys(allAgents).filter(id => !assigned.has(id));
        }
        return team?.agents || [];
    }, [isUnassigned, allTeams, allAgents, team]);

    const agentList = useMemo(() => {
        if (!allAgents) return [] as [string, AgentConfig][];
        return teamAgentIds.map(id => [id, allAgents[id]] as [string, AgentConfig]).filter(([, a]) => a);
    }, [allAgents, teamAgentIds]);

    const metaMap = useMemo(() => {
        const m = new Map<string, { color: string }>();
        agentList.forEach(([id], i) => m.set(id, { color: COLORS[i % COLORS.length].h }));
        return m;
    }, [agentList]);

    // 初始化像素引擎
    useEffect(() => {
        const init = async () => {
            // 创建单房间布局（团队私有空间）
            const container = containerRef.current;
            const cw = container?.clientWidth || 1200;
            const ch = container?.clientHeight || 800;
            // 团队专属三区域布局（20×16 建筑）
            const minZoom = Math.min(cw / (22 * TILE_SIZE), ch / (18 * TILE_SIZE));
            const neededCols = Math.ceil(cw / (TILE_SIZE * minZoom)) + 2;
            const neededRows = Math.ceil(ch / (TILE_SIZE * minZoom)) + 2;
            const layout = createTeamLayout(neededCols, neededRows, isUnassigned ? '自由区' : (team?.name || teamId));
            officeRef.current = new OfficeState(layout);

            if (!spriteAssetsPromise) {
                spriteAssetsPromise = Promise.all([
                    loadCharacterPNGs(), loadWallPNG()
                ]).then(() => undefined);
            }
            await spriteAssetsPromise;
            setOfficeReady(true);
        };
        init();
        return () => {
            if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
        };
    }, []);

    // 同步 agents
    useEffect(() => {
        const office = officeRef.current;
        if (!office || !officeReady || !agentList.length) return;

        const activities: AgentActivity[] = agentList.map(([id, cfg]) => {
            const agentState = states.get(id);
            let pixelState: AgentActivity["state"] = "idle";
            if (agentState) {
                if (agentState.status === "thinking" || agentState.status === "receiving") pixelState = "working";
                else if (agentState.status === "talking") pixelState = "working";
            }
            return { agentId: id, name: cfg.name || id, emoji: "🤖", state: pixelState, lastActive: Date.now() };
        });

        // 推断交流关系 — 使用 SSE 的 target 字段（比 status 更精准）
        const talkingAgents = agentList.filter(([id]) => {
            const st = states.get(id);
            return st?.status === "talking" && st?.target;
        });
        for (const [talkId] of talkingAgents) {
            const st = states.get(talkId);
            if (st?.target) {
                const act = activities.find(a => a.agentId === talkId);
                if (act) act.talkingTo = st.target;
            }
        }

        // 将最新的 chatHistory 对话推送到角色 photoComments 气泡（每条消息只推一次）
        const recentChats = chatHistoryRef.current;
        const now = Date.now();
        for (const act of activities) {
            const latest = recentChats.filter(c =>
                c.agentId === act.agentId && c.type === "talk" && (now - c.ts) < 15000
            ).pop();
            if (latest && !pushedBubbleIdsRef.current.has(latest.id)) {
                pushedBubbleIdsRef.current.add(latest.id);
                // 清理旧 ID 防止内存泄漏
                if (pushedBubbleIdsRef.current.size > 200) {
                    const arr = [...pushedBubbleIdsRef.current];
                    pushedBubbleIdsRef.current = new Set(arr.slice(-100));
                }
                const charId = agentIdMapRef.current.get(act.agentId);
                if (charId !== undefined) {
                    const ch = office.characters.get(charId);
                    if (ch) {
                        ch.photoComments = [{ text: latest.text.slice(0, 60), age: 0, x: 0, fromSSE: true }];
                    }
                }
            }
        }

        syncAgentsToOffice(activities, office, agentIdMapRef.current, nextIdRef.current);
    }, [agentList.length, states, officeReady]); // eslint-disable-line

    // Canvas 渲染循环
    useEffect(() => {
        if (!canvasRef.current || !containerRef.current || !officeRef.current || !officeReady) return;
        const canvas = canvasRef.current;
        const office = officeRef.current;
        const container = containerRef.current;
        let lastTime = 0;

        const render = (time: number) => {
            const dt = lastTime === 0 ? 0 : Math.min((time - lastTime) / 1000, 0.1);
            lastTime = time;

            const width = container.clientWidth;
            const height = container.clientHeight;
            const dpr = window.devicePixelRatio || 1;

            const mapPixelW = office.layout.cols * TILE_SIZE;
            const mapPixelH = office.layout.rows * TILE_SIZE;
            const zoomX = width / mapPixelW;
            const zoomY = height / mapPixelH;
            const autoZoom = Math.max(zoomX, zoomY);

            office.update(dt);

            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;

            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.imageSmoothingEnabled = false;
                ctx.scale(dpr, dpr);

                ctx.fillStyle = "#5a7a4a";
                ctx.fillRect(0, 0, width, height);

                renderFrame(
                    ctx, width, height,
                    office.tileMap, office.furniture, office.getCharacters(),
                    autoZoom, 0, 0,
                    { selectedAgentId: null, hoveredAgentId: null, hoveredTile: null, seats: office.seats, characters: office.characters },
                    undefined,
                    office.layout.tileColors,
                    office.layout.cols,
                    office.layout.rows,
                    undefined, // bugs
                    undefined, // contributions
                    undefined, // photograph
                    office.commLinks, // 交流连线
                );

                // 渲染角色头顶气泡
                const chars = office.getCharacters();
                renderPhotoComments(ctx, chars, 0, 0, autoZoom);

                // 绘制团队名称标签
                const mapW = office.layout.cols * TILE_SIZE * autoZoom;
                const mapH = office.layout.rows * TILE_SIZE * autoZoom;
                const ox = (width - mapW) / 2;
                const oy = (height - mapH) / 2;
                const s = TILE_SIZE * autoZoom;
                // 团队布局建筑 20×16
                const buildingX = Math.floor((office.layout.cols - 20) / 2);
                const buildingY = Math.floor((office.layout.rows - 16) / 2);

                const labels = [
                    { text: "⌨️ 工作区", col: buildingX + 10, row: buildingY + 0.5, color: "#fff" },
                    { text: "💬 交流区", col: buildingX + 5, row: buildingY + 8.5, color: "#fff" },
                    { text: "☕ 休息区", col: buildingX + 15, row: buildingY + 8.5, color: "#fff" },
                ];
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                for (const l of labels) {
                    const lx = ox + l.col * s;
                    const ly = oy + l.row * s;
                    const fontSize = Math.max(10, Math.min(14, s * 0.7));
                    ctx.font = `bold ${fontSize}px 'Courier New', monospace`;
                    const tm = ctx.measureText(l.text);
                    const px = 6, py = 3;
                    ctx.fillStyle = "rgba(0,0,0,0.55)";
                    ctx.beginPath();
                    ctx.roundRect(lx - tm.width / 2 - px, ly - fontSize / 2 - py, tm.width + px * 2, fontSize + py * 2, 4);
                    ctx.fill();
                    ctx.fillStyle = l.color;
                    ctx.fillText(l.text, lx, ly);
                }
            }
            animFrameRef.current = requestAnimationFrame(render);
        };

        animFrameRef.current = requestAnimationFrame(render);
        return () => {
            if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
        };
    }, [officeReady]);

    // 对话回调
    const addChat = useCallback((aid: string, text: string, type: ChatEntry["type"]) => {
        // 过滤路由消息 @xxx → @yyy
        const trimText = text.trim();
        if (/^@\S+\s*→\s*@\S+$/.test(trimText) || /^@\S+\s*->\s*@\S+$/.test(trimText)) return;
        const m = metaMap.get(aid);
        const agentName = agentList.find(([id]) => id === aid)?.[1]?.name || aid;
        const color = m?.color || "#64748b";
        setChatHistory(p => {
            const next = [...p, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, agentId: aid, agentName, color, text, ts: Date.now(), type }].slice(-200);
            chatHistoryRef.current = next;
            return next;
        });
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }, [metaMap, agentList]);

    // 路由消息检测函数
    const isRoutingText = useCallback((text: string) => {
        const t = text.trim();
        return t.startsWith("@") && t.length < 60 && /[\u2192\u21d2\u279c]|->/.test(t) && /^@\S+\s*.{1,3}\s*@\S+$/.test(t);
    }, []);

    // 加载历史对话
    useEffect(() => {
        if (!teamId || teamId === "_unassigned") return;
        let cancelled = false;
        (async () => {
            try {
                const { conversations } = await getConversationHistory(teamId, 3, 0);
                if (cancelled) return;
                const entries: ChatEntry[] = [];

                if (conversations && conversations.length > 0) {
                    for (const conv of conversations) {
                        try {
                            const { timeline } = await getConversationTimeline(conv.id);
                            if (!timeline) continue;
                            const filteredTL = timeline.filter((item) => {
                                if (item.type !== "step") return true;
                                const step = item.data as unknown as Record<string, unknown>;
                                return String(step.message_type) !== "handoff";
                            });
                            for (const item of filteredTL) {
                                if (item.type !== "step") continue;
                                const step = item.data as unknown as Record<string, unknown>;
                                const fromAgent = String(step.from_agent || "");
                                const msg = String(step.message || "");
                                if (!msg || !fromAgent) continue;
                                const msgType = String(step.message_type || "");
                                const m = metaMap.get(fromAgent);
                                entries.push({
                                    id: `hist_${conv.id}_${item.timestamp}_${entries.length}`,
                                    agentId: fromAgent,
                                    agentName: agentList.find(([id]) => id === fromAgent)?.[1]?.name || fromAgent,
                                    color: m?.color || "#64748b",
                                    text: msg.substring(0, 500),
                                    ts: item.timestamp * 1000,
                                    type: msgType === "user_message" ? "event" : "talk",
                                });
                            }
                        } catch { /* skip */ }
                    }
                }

                // 加载活跃会话步骤
                if (!cancelled) {
                    try {
                        const { sessions } = await getSessions();
                        const completedIds = new Set((conversations || []).map(c => c.id));
                        for (const s of sessions) {
                            if (completedIds.has(s.id)) continue;
                            try {
                                const { timeline } = await getConversationTimeline(s.id);
                                if (!timeline) continue;
                                for (const item of timeline) {
                                    if (item.type !== "step") continue;
                                    const step = item.data as unknown as Record<string, unknown>;
                                    const fromAgent = String(step.from_agent || "");
                                    const msg = String(step.message || "");
                                    if (!msg || !fromAgent) continue;
                                    const m = metaMap.get(fromAgent);
                                    entries.push({
                                        id: `active_${s.id}_${item.timestamp}_${entries.length}`,
                                        agentId: fromAgent,
                                        agentName: agentList.find(([id]) => id === fromAgent)?.[1]?.name || fromAgent,
                                        color: m?.color || "#64748b",
                                        text: msg.substring(0, 500),
                                        ts: item.timestamp * 1000,
                                        type: "talk",
                                    });
                                }
                            } catch { /* skip */ }
                        }
                    } catch { /* skip */ }
                }

                if (!cancelled && entries.length > 0) {
                    entries.sort((a, b) => a.ts - b.ts);
                    setChatHistory(prev => {
                        const existingTexts = new Set(prev.map(p => p.text));
                        const newEntries = entries.filter(e => !existingTexts.has(e.text));
                        return [...newEntries, ...prev].sort((a, b) => a.ts - b.ts).slice(-200);
                    });
                    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "instant" }), 200);
                }
            } catch { /* silent */ }
        })();
        return () => { cancelled = true; };
    }, [teamId, metaMap]); // eslint-disable-line

    // SSE + 轮询
    useOfficeSSE(upd, addChat, states, toIdle, setConnected);
    useSessionsPolling(setStates);
    useIdleActionSwitch(setStates);

    // 统计
    const totalStats = useMemo(() => {
        let w = 0, t = 0, idle = 0;
        for (const [, s] of states) {
            if (s.status === "thinking" || s.status === "receiving") w++;
            else if (s.status === "talking") t++;
            else idle++;
        }
        return { working: w, talking: t, idle };
    }, [states]);

    return (
        <div style={{ width: "100%", height: "100vh", overflow: "hidden", background: "#5a7a4a", position: "relative" }}>
            {/* ──── 顶栏 ──── */}
            <div style={{
                position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, height: 40,
                background: "linear-gradient(180deg, rgba(15,15,25,0.92) 0%, rgba(10,10,20,0.96) 100%)",
                backdropFilter: "blur(12px)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0 16px", fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
                boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Link href="/office" style={{
                        padding: "3px 10px", borderRadius: 12,
                        background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)",
                        fontSize: 10, textDecoration: "none",
                        border: "1px solid rgba(255,255,255,0.08)",
                        transition: "all 0.2s",
                    }}>← 返回总部</Link>
                    <span style={{ fontSize: 14 }}>🐝</span>
                    <span style={{
                        background: "linear-gradient(135deg, #f6d365, #fda085)",
                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                        fontSize: 13, fontWeight: 700,
                    }}>
                        {isUnassigned ? "自由区" : (team?.name || teamId)}
                    </span>
                    <span style={{
                        background: "rgba(255,255,255,0.06)", borderRadius: 10,
                        padding: "1px 8px", fontSize: 10, color: "rgba(255,255,255,0.45)",
                    }}>👤 {agentList.length}</span>
                    {team?.leader_agent && (
                        <span style={{
                            fontSize: 10, color: "#ffd54f",
                            background: "rgba(255,213,79,0.1)", padding: "2px 8px", borderRadius: 10,
                            border: "1px solid rgba(255,213,79,0.15)",
                        }}>🏅 {team.leader_agent}</span>
                    )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 10 }}>
                    <span style={{ color: "#81c784", display: "flex", alignItems: "center", gap: 2 }}>⚡ {totalStats.working}</span>
                    <span style={{ color: "#90caf9", display: "flex", alignItems: "center", gap: 2 }}>💬 {totalStats.talking}</span>
                    <span style={{ color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", gap: 2 }}>😴 {totalStats.idle}</span>
                    <span style={{
                        width: 6, height: 6, borderRadius: "50%", display: "inline-block",
                        background: connected ? "#66bb6a" : "#ef5350",
                        boxShadow: connected ? "0 0 6px rgba(102,187,106,0.5)" : "0 0 6px rgba(239,83,80,0.5)",
                    }} />
                    <button
                        onClick={() => setPanelOpen(p => !p)}
                        style={{
                            padding: "3px 8px", borderRadius: 8,
                            background: panelOpen ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)",
                            color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.06)",
                            fontSize: 10, cursor: "pointer", transition: "all 0.2s",
                        }}
                    >
                        {panelOpen ? "✕" : "📜"}
                    </button>
                </div>
            </div>

            {/* ──── Canvas 全屏渲染 ──── */}
            <div ref={containerRef} style={{ position: "absolute", top: 40, left: 0, right: 0, bottom: 0 }}>
                <canvas ref={canvasRef} style={{ width: "100%", height: "100%", imageRendering: "pixelated", display: "block" }} />
                {!officeReady && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: 13, fontFamily: "monospace" }}>
                        ⏳ 加载像素资源中...
                    </div>
                )}
            </div>

            {/* ──── 底部通知条 ──── */}
            <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20,
                fontFamily: "'Courier New', monospace",
            }}>
                {panelOpen && chatHistory.length > 0 && (
                    <div style={{
                        position: "absolute", bottom: 30, left: 8, width: 340,
                        maxHeight: 200, overflow: "auto",
                        background: "rgba(10,10,20,0.8)",
                        backdropFilter: "blur(8px)",
                        borderRadius: "8px 8px 0 0",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderBottom: "none",
                        padding: "6px 8px",
                    }}>
                        {chatHistory.filter(c => c.type !== "event" && !isRoutingText(c.text)).slice(-8).map(c => (
                            <div key={c.id} style={{
                                marginBottom: 3, padding: "4px 8px",
                                background: "rgba(255,255,255,0.04)",
                                borderRadius: 4,
                                borderLeft: `2px solid ${c.color}`,
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: 9, color: c.color, fontWeight: "bold" }}>{c.agentName}</span>
                                    <span style={{ fontSize: 8, color: "rgba(255,255,255,0.2)" }}>{timeAgo(c.ts)}</span>
                                </div>
                                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", lineHeight: 1.3, marginTop: 1 }}>
                                    {c.type === "think" && "💭 "}{c.type === "talk" && "💬 "}
                                    {c.text.slice(0, 80)}{c.text.length > 80 ? "…" : ""}
                                </div>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                )}
                <div
                    onClick={() => setPanelOpen(p => !p)}
                    style={{
                        height: 28, display: "flex", alignItems: "center",
                        padding: "0 12px", gap: 8, cursor: "pointer",
                        background: "rgba(0,0,0,0.45)",
                        backdropFilter: "blur(4px)",
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                    }}
                >
                    <span style={{ fontSize: 10, color: panelOpen ? "#81c784" : "#fdd835" }}>
                        {panelOpen ? "▼" : "▲"} 📜
                    </span>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
                        {chatHistory.length} 条
                    </span>
                    {chatHistory.length > 0 && (
                        <div style={{ flex: 1, overflow: "hidden", display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: 9, color: chatHistory[chatHistory.length - 1].color, fontWeight: "bold", whiteSpace: "nowrap" }}>
                                {chatHistory[chatHistory.length - 1].agentName}
                            </span>
                            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {(() => { const last = chatHistory.filter(c => c.type !== "event" && !isRoutingText(c.text)).pop(); return last ? (last.type === "think" ? "💭 " : "💬 ") + last.text.slice(0, 60) : ""; })()}
                            </span>
                        </div>
                    )}
                    {chatHistory.length === 0 && (
                        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>等待活动...</span>
                    )}
                </div>
            </div>
        </div>
    );
}
