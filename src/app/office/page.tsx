"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { OfficeState } from "@/lib/pixel-office/engine/officeState";
import { renderFrame, renderPhotoComments } from "@/lib/pixel-office/engine/renderer";
import { syncAgentsToOffice, type AgentActivity } from "@/lib/pixel-office/agentBridge";
import { TILE_SIZE } from "@/lib/pixel-office/constants";
import { createDefaultLayout } from "@/lib/pixel-office/layout/layoutSerializer";
import { loadCharacterPNGs, loadWallPNG } from "@/lib/pixel-office/sprites/pngLoader";
import { usePolling, timeAgo } from "@/lib/hooks";
import { getAgents, getTeams, type AgentConfig, type TeamConfig } from "@/lib/api";
import Link from "next/link";
import {
    useAgentStates, useOfficeSSE, useSessionsPolling, useIdleActionSwitch,
    COLORS, type AgentSt, type ChatEntry,
} from "./components/shared-hooks";

// ═══════════════════════════════════════════════════════════
// 像素办公室 — 基于 OpenClaw Canvas 2D 渲染引擎
// ═══════════════════════════════════════════════════════════

// 自适应缩放 — 地图填满可用区域
let cachedOfficeState: OfficeState | null = null;
let spriteAssetsPromise: Promise<void> | null = null;

export default function OfficeOverview() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const officeRef = useRef<OfficeState | null>(null);
    const agentIdMapRef = useRef<Map<string, number>>(new Map());
    const nextIdRef = useRef<{ current: number }>({ current: 1 });
    const chatHistoryRef = useRef<ChatEntry[]>([]);
    const animFrameRef = useRef<number | null>(null);

    const { data: agents } = usePolling<Record<string, AgentConfig>>(getAgents, 5000);
    const { data: teams } = usePolling<Record<string, TeamConfig>>(getTeams, 5000);
    const { states, setStates, mkSt, upd, toIdle } = useAgentStates();
    const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
    const [connected, setConnected] = useState(false);
    const [panelOpen, setPanelOpen] = useState(true);
    const [officeReady, setOfficeReady] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const agentList = agents ? Object.entries(agents) : [];
    const teamList = teams ? Object.entries(teams) : [];

    // Ref 镜像 — 供定时器/渲染闭包读取最新值，不触发 effect 依赖
    const statesRef = useRef(states);
    statesRef.current = states;
    const agentListRef = useRef(agentList);
    agentListRef.current = agentList;

    const agentColorMap = useMemo(() => {
        const m = new Map<string, typeof COLORS[number]>();
        agentList.forEach(([id], i) => m.set(id, COLORS[i % COLORS.length]));
        return m;
    }, [agentList.map(([id]) => id).join(",")]); // eslint-disable-line

    // 初始化 agent 状态
    useEffect(() => {
        if (!agentList.length) return;
        setStates(p => {
            if (p.size > 0) return p;
            const n = new Map<string, AgentSt>();
            agentList.forEach(([id], i) => n.set(id, mkSt(i * 2000)));
            return n;
        });
    }, [agentList.map(([id]) => id).join(","), mkSt, setStates]); // eslint-disable-line

    // 聊天日志
    const addChat = useCallback((aid: string, text: string, type: ChatEntry["type"]) => {
        const a = agents?.[aid]; const c = agentColorMap.get(aid);
        if (!a || !c) return;
        setChatHistory(p => {
            const next = [...p, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, agentId: aid, agentName: a.name, color: c.h, text, ts: Date.now(), type }].slice(-200);
            chatHistoryRef.current = next;
            return next;
        });
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }, [agents, agentColorMap]);

    useOfficeSSE(upd, addChat, states, toIdle, setConnected);
    useSessionsPolling(setStates);
    useIdleActionSwitch(setStates);

    const totalStats = useMemo(() => {
        let w = 0, t = 0, idle = 0;
        for (const [, s] of states) {
            if (s.status === "thinking" || s.status === "receiving") w++;
            else if (s.status === "talking") t++;
            else idle++;
        }
        return { working: w, talking: t, idle };
    }, [states]);

    // ── 初始化 OfficeState + 加载精灵资源 ──
    useEffect(() => {
        const init = async () => {
            if (cachedOfficeState) {
                officeRef.current = cachedOfficeState;
            } else {
                // 使用原始办公室布局（36×20 六房间）+ 草坪自动填充
                const container = containerRef.current;
                const cw = container?.clientWidth || 1920;
                const ch = container?.clientHeight || 900;
                const minZoom = Math.min(cw / (38 * TILE_SIZE), ch / (22 * TILE_SIZE));
                const neededCols = Math.ceil(cw / (TILE_SIZE * minZoom)) + 2;
                const neededRows = Math.ceil(ch / (TILE_SIZE * minZoom)) + 2;
                const layout = createDefaultLayout(neededCols, neededRows);
                officeRef.current = new OfficeState(layout);
                cachedOfficeState = officeRef.current;
            }
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
            cachedOfficeState = officeRef.current;
            if (animFrameRef.current !== null) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, []);

    // ── 定时同步 agents 到像素引擎（不依赖 states 变化，避免重渲染打断动画）──
    useEffect(() => {
        if (!officeReady) return;
        const sync = () => {
            const office = officeRef.current;
            const list = agentListRef.current;
            const st = statesRef.current;
            if (!office || !list.length) return;

            const activities: AgentActivity[] = list.map(([id, cfg]) => {
                const agentState = st.get(id);
                let pixelState: AgentActivity["state"] = "idle";
                if (agentState) {
                    if (agentState.status === "thinking" || agentState.status === "receiving") pixelState = "working";
                    else if (agentState.status === "talking") pixelState = "working";
                }
                return { agentId: id, name: cfg.name || id, emoji: "🤖", state: pixelState, lastActive: Date.now() };
            });
            // 推断交流关系 — 使用 SSE 的 target 字段（比 status 更精准）
            const talkingAgents = list.filter(([id]) => {
                const agentState = st.get(id);
                return agentState?.status === "talking" && agentState?.target;
            });
            for (const [talkId] of talkingAgents) {
                const agentState = st.get(talkId);
                if (agentState?.target) {
                    const act = activities.find(a => a.agentId === talkId);
                    if (act) act.talkingTo = agentState.target;
                }
            }

            // 将最新的 chatHistory 对话推送到角色 photoComments 气泡
            const recentChats = chatHistoryRef.current;
            const now = Date.now();
            for (const act of activities) {
                // 找该 agent 最近 15 秒内的 talk 消息，忽略含有箭头 → ➔ -> 的路由消息
                const latest = recentChats.filter(c =>
                    c.agentId === act.agentId &&
                    c.type === "talk" &&
                    (now - c.ts) < 15000 &&
                    !/^@[\w-]+\s*[→\->➔]\s*@[\w-]+$/.test(c.text.trim())
                ).pop();

                if (latest) {
                    const charId = agentIdMapRef.current.get(act.agentId);
                    if (charId !== undefined) {
                        const ch = office.characters.get(charId);
                        if (ch && (!ch.photoComments || ch.photoComments.length === 0 || ch.photoComments[0]?.text !== latest.text.slice(0, 60))) {
                            ch.photoComments = [{ text: latest.text.slice(0, 60), age: 0, x: 0 }];
                            ch.interactionTarget = null;
                        }
                    }
                }
            }

            syncAgentsToOffice(activities, office, agentIdMapRef.current, nextIdRef.current);
        };
        sync();
        const timer = setInterval(sync, 2000);
        return () => clearInterval(timer);
    }, [officeReady]); // eslint-disable-line

    // ── Canvas 游戏渲染循环 ──
    useEffect(() => {
        if (!canvasRef.current || !containerRef.current || !officeRef.current || !officeReady) return;
        const canvas = canvasRef.current;
        const office = officeRef.current;
        const container = containerRef.current;
        const ctx = canvas.getContext("2d")!;
        let lastTime = 0;
        let lastW = 0, lastH = 0, lastDpr = 0;

        const render = (time: number) => {
            const dt = lastTime === 0 ? 0 : Math.min((time - lastTime) / 1000, 0.1);
            lastTime = time;

            const width = container.clientWidth;
            const height = container.clientHeight;
            const dpr = window.devicePixelRatio || 1;

            // 仅在尺寸变化时重设 canvas — 避免每帧清空 GPU 缓冲区
            if (width !== lastW || height !== lastH || dpr !== lastDpr) {
                canvas.width = Math.round(width * dpr);
                canvas.height = Math.round(height * dpr);
                canvas.style.width = `${width}px`;
                canvas.style.height = `${height}px`;
                lastW = width; lastH = height; lastDpr = dpr;
            }

            const mapPixelW = office.layout.cols * TILE_SIZE;
            const mapPixelH = office.layout.rows * TILE_SIZE;
            const autoZoom = Math.max(width / mapPixelW, height / mapPixelH);

            office.update(dt);

            ctx.save();
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.imageSmoothingEnabled = false;
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

            // 渲染活动对话气泡
            const chars = office.getCharacters();
            renderPhotoComments(ctx, chars, 0, 0, autoZoom);

            // 房间标签
            const mapW = office.layout.cols * TILE_SIZE * autoZoom;
            const mapH = office.layout.rows * TILE_SIZE * autoZoom;
            const ox = (width - mapW) / 2;
            const oy = (height - mapH) / 2;
            const s = TILE_SIZE * autoZoom;
            const bx = Math.floor((office.layout.cols - 36) / 2);
            const by = Math.floor((office.layout.rows - 20) / 2);

            const tl = agentListRef.current.length > 0 ? agentListRef.current : [];
            const tNames = (teams ? Object.values(teams) : []).map(t => t.name || '团队');
            const top = [tNames[0] || "开发组", tNames[1] || "大厅", tNames[2] || "运维组"];
            const labels = [
                { text: `💻 ${top[0]}`, col: bx + 5, row: by + 0.5 },
                { text: `🏢 ${top[1]}`, col: bx + 17, row: by + 0.5 },
                { text: `🔧 ${top[2]}`, col: bx + 29, row: by + 0.5 },
                { text: "☕ 休息室", col: bx + 5, row: by + 10.3 },
                { text: "📋 会议室", col: bx + 17, row: by + 10.3 },
                { text: "🖥️ 服务器间", col: bx + 29, row: by + 10.3 },
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
                ctx.fillStyle = "#fff";
                ctx.fillText(l.text, lx, ly);
            }

            ctx.restore();
            animFrameRef.current = requestAnimationFrame(render);
        };

        animFrameRef.current = requestAnimationFrame(render);
        return () => {
            if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
        };
    }, [officeReady, teams]);

    // 团队列表
    const teamGroups = useMemo(() => {
        const g: { teamId: string; team: TeamConfig; agents: { id: string; config: AgentConfig }[] }[] = [];
        const assigned = new Set<string>();
        for (const [tid, t] of teamList) {
            const ta = (t.agents || []).map(aid => { assigned.add(aid); return { id: aid, config: agents?.[aid] || { name: aid, provider: "", model: "" } as AgentConfig }; });
            g.push({ teamId: tid, team: t, agents: ta });
        }
        const un = agentList.filter(([id]) => !assigned.has(id));
        if (un.length > 0) g.push({ teamId: "_unassigned", team: { name: "自由区", agents: un.map(([id]) => id), leader_agent: "" } as TeamConfig, agents: un.map(([id, c]) => ({ id, config: c })) });
        return g;
    }, [teamList, agentList, agents]);

    return (
        <div style={{ width: "100%", height: "100vh", overflow: "hidden", background: "#5a7a4a", position: "relative" }}>
            {/* ──── 顶栏（logo + 团队导航 + 状态） ──── */}
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
                    <span style={{ fontSize: 16 }}>🐝</span>
                    <span style={{
                        background: "linear-gradient(135deg, #f6d365, #fda085)",
                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                        fontSize: 13, fontWeight: 700, letterSpacing: 0.5,
                    }}>QueenBee Office</span>
                    <span style={{
                        background: "rgba(255,255,255,0.06)", borderRadius: 10,
                        padding: "1px 8px", fontSize: 10, color: "rgba(255,255,255,0.45)",
                    }}>👤 {agentList.length}</span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {teamGroups.map(g => (
                        <Link key={g.teamId} href={`/office/${g.teamId}`} style={{
                            padding: "3px 10px", borderRadius: 12,
                            background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)",
                            fontSize: 10, fontWeight: 500, textDecoration: "none",
                            border: "1px solid rgba(255,255,255,0.08)",
                            transition: "all 0.2s",
                        }}>
                            {g.team.name} <span style={{ color: "rgba(255,255,255,0.35)" }}>({g.agents.length})</span>
                        </Link>
                    ))}
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
                {/* 展开的历史记录（向上弹出） */}
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
                        {chatHistory
                            .filter(c => c.type !== "event" && !/^@[\w-]+\s*[→\->➔]\s*@[\w-]+$/.test(c.text.trim()))
                            .slice(-8).map(c => (
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
                {/* 常驻通知条 */}
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
                                {(() => { const last = chatHistory.filter(c => c.type !== "event" && !/^@[\w-]+\s*[→\->➔]\s*@[\w-]+$/.test(c.text.trim())).pop(); return last ? (last.type === "think" ? "💭 " : "💬 ") + last.text.slice(0, 60) : ""; })()}
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
