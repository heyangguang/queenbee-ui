"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSessions, subscribeToEvents, type EventData } from "@/lib/api";

// ═══════════════════════════════════════════════
// 共享类型
// ═══════════════════════════════════════════════

export type Pose = "coffee" | "read" | "music" | "think" | "water" | "phone" | "meditate" | "write" | "game" | "donut" | "stretch" | "wave" | "pingpong";
export type Status = "idle" | "receiving" | "thinking" | "talking" | "returning";

export interface IdleAction { emoji: string; text: string; pose: Pose; }
export interface AgentSt {
    status: Status; target?: string; bubble?: string; bubbleTs?: number;
    fading?: boolean; changedAt: number; idleAction: number; nextActionAt: number;
    talkReady?: boolean; talkUntil?: number; pingpongPair?: string;
}
export interface ChatEntry { id: string; agentId: string; agentName: string; color: string; text: string; ts: number; type: "talk" | "think" | "event"; }
export interface AgentMeta {
    id: string;
    agent: { name: string;[k: string]: unknown };
    color: typeof COLORS[number];
    desk: { x: number; y: number };
    meet: { x: number; y: number };
}

// ═══════════════════════════════════════════════
// 共享常量
// ═══════════════════════════════════════════════

export const BUBBLE_LIFE = 30000;
export const FADE_TIME = 1000;
export const RETURN_TIME = 3000;
export const MOVE_TRANSITION = "left 2.5s cubic-bezier(0.25,0.1,0.25,1), top 2.5s cubic-bezier(0.25,0.1,0.25,1)";

export const COLORS = [
    { h: "#e53935", g: "rgba(229,57,53,0.4)", skin: "#fcd5b4", hair: "#3b2314", headW: 24, bodyW: 26, bodyH: 18, legH: 10, hairStyle: "flat" as const },     // 火系红
    { h: "#1e88e5", g: "rgba(30,136,229,0.4)", skin: "#f5d6b8", hair: "#1a1a2e", headW: 26, bodyW: 30, bodyH: 20, legH: 12, hairStyle: "spiky" as const },    // 水系蓝
    { h: "#43a047", g: "rgba(67,160,71,0.4)", skin: "#ffe0bd", hair: "#4a0e0e", headW: 22, bodyW: 24, bodyH: 16, legH: 11, hairStyle: "curly" as const },     // 草系绿
    { h: "#fdd835", g: "rgba(253,216,53,0.4)", skin: "#f9d5a7", hair: "#2d1b69", headW: 25, bodyW: 28, bodyH: 19, legH: 10, hairStyle: "tall" as const },     // 电系黄
    { h: "#8e24aa", g: "rgba(142,36,170,0.4)", skin: "#ffe4c4", hair: "#0f172a", headW: 23, bodyW: 25, bodyH: 17, legH: 13, hairStyle: "flat" as const },     // 超能紫
    { h: "#f06292", g: "rgba(240,98,146,0.4)", skin: "#fcd5c0", hair: "#3d0c02", headW: 22, bodyW: 22, bodyH: 15, legH: 9, hairStyle: "curly" as const },     // 仙系粉
];

export const IDLE_ACTIONS: IdleAction[] = [
    { emoji: "🍓", text: "品尝树果中...", pose: "coffee" },
    { emoji: "📱", text: "查看图鉴...", pose: "read" },
    { emoji: "🎵", text: "听宝可梦叫声...", pose: "music" },
    { emoji: "🤔", text: "构思战术...", pose: "think" },
    { emoji: "🌱", text: "照顾草系宝可梦...", pose: "water" },
    { emoji: "🎯", text: "瞄准训练...", pose: "phone" },
    { emoji: "🧘", text: "与超能系宝可梦冥想...", pose: "meditate" },
    { emoji: "✏️", text: "记录图鉴...", pose: "write" },
    { emoji: "⚔️", text: "模拟对战...", pose: "game" },
    { emoji: "🍬", text: "吃稀有糖果...", pose: "donut" },
    { emoji: "🙆", text: "做准备体操...", pose: "stretch" },
    { emoji: "👋", text: "训练师问候...", pose: "wave" },
    { emoji: "⚡", text: "精灵球投掷赛...", pose: "pingpong" },
];

export const ACTIVITY_SPOTS: Record<Pose, { x: number; y: number }[]> = {
    coffee: [{ x: 0.93, y: 0.88 }],
    donut: [{ x: 0.86, y: 0.88 }],
    read: [{ x: 0.55, y: 0.52 }],
    music: [{ x: 0.72, y: 0.52 }],
    think: [{ x: 0.62, y: 0.68 }],
    water: [{ x: 0.56, y: 0.88 }],
    phone: [{ x: 0.78, y: 0.52 }],
    meditate: [{ x: 0.62, y: 0.88 }],
    write: [{ x: 0.60, y: 0.56 }],
    game: [{ x: 0.82, y: 0.68 }],
    stretch: [{ x: 0.72, y: 0.78 }],
    wave: [{ x: 0.66, y: 0.64 }],
    pingpong: [{ x: 0.54, y: 0.82 }, { x: 0.60, y: 0.82 }],
};

export const ARM_ANIM: Record<Pose, { left?: string; right?: string }> = {
    coffee: { right: "office-sip 2s ease-in-out infinite" },
    donut: { right: "office-sip 2.5s ease-in-out infinite" },
    read: { left: "office-read 3s ease-in-out infinite", right: "office-read 3s ease-in-out infinite" },
    music: {},
    think: { right: "office-phone 4s ease-in-out infinite" },
    water: { right: "office-water 2s ease-in-out infinite" },
    phone: { right: "office-phone 3s ease-in-out infinite" },
    meditate: {},
    write: { right: "office-write 1.5s ease-in-out infinite" },
    game: { left: "office-write 1s ease-in-out infinite", right: "office-write 1s ease-in-out infinite reverse" },
    stretch: { left: "office-stretch-arm 4s ease-in-out infinite", right: "office-stretch-arm 4s ease-in-out infinite" },
    wave: { right: "office-wave 1s ease-in-out infinite" },
    pingpong: { right: "office-swing 0.5s ease-in-out infinite" },
};

export function randAct(): number { return Math.floor(Math.random() * IDLE_ACTIONS.length); }
export function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
export function extractTargets(msg: string): string[] {
    const t: string[] = [];
    for (const m of msg.matchAll(/\[@(\w[\w-]*?):/g)) if (!t.includes(m[1])) t.push(m[1]);
    if (!t.length) { const m = msg.match(/^@(\w[\w-]*)/); if (m) t.push(m[1]); }
    return t;
}

// ═══════════════════════════════════════════════
// 共享 Hooks
// ═══════════════════════════════════════════════

// 昼夜系统
export function useTimeOfDay() {
    const [hour, setHour] = useState(new Date().getHours());
    const [min, setMin] = useState(new Date().getMinutes());
    useEffect(() => {
        const iv = setInterval(() => { const d = new Date(); setHour(d.getHours()); setMin(d.getMinutes()); }, 60000);
        return () => clearInterval(iv);
    }, []);
    const t = hour + min / 60;
    let skyTop: string, skyBot: string, ambient: string, sunY: number, showSun: boolean, showMoon: boolean, starOpacity: number;
    if (t >= 6 && t < 8) {
        const p = (t - 6) / 2;
        skyTop = `hsl(220, ${60 - p * 30}%, ${15 + p * 35}%)`;
        skyBot = `hsl(30, ${70 + p * 20}%, ${30 + p * 40}%)`;
        ambient = `rgba(255,180,100,${0.03 + p * 0.02})`;
        sunY = 80 - p * 40; showSun = true; showMoon = false; starOpacity = 1 - p;
    } else if (t >= 8 && t < 12) {
        skyTop = "hsl(205, 55%, 52%)"; skyBot = "hsl(195, 50%, 70%)";
        ambient = "rgba(251,191,36,0.04)"; sunY = 40 - ((t - 8) / 4) * 25; showSun = true; showMoon = false; starOpacity = 0;
    } else if (t >= 12 && t < 14) {
        skyTop = "hsl(210, 60%, 55%)"; skyBot = "hsl(200, 50%, 75%)";
        ambient = "rgba(251,191,36,0.05)"; sunY = 12; showSun = true; showMoon = false; starOpacity = 0;
    } else if (t >= 14 && t < 17) {
        skyTop = "hsl(210, 50%, 50%)"; skyBot = "hsl(200, 45%, 65%)";
        ambient = "rgba(251,191,36,0.03)"; sunY = 12 + ((t - 14) / 3) * 40; showSun = true; showMoon = false; starOpacity = 0;
    } else if (t >= 17 && t < 19.5) {
        const p = (t - 17) / 2.5;
        skyTop = `hsl(${220 + p * 20}, ${50 + p * 10}%, ${50 - p * 25}%)`;
        skyBot = `hsl(${20 - p * 10}, ${80 - p * 20}%, ${55 - p * 25}%)`;
        ambient = `rgba(255,${Math.round(140 - p * 80)},${Math.round(60 - p * 40)},${0.04 - p * 0.02})`;
        sunY = 55 + p * 30; showSun = true; showMoon = false; starOpacity = p * 0.5;
    } else {
        skyTop = "hsl(230, 50%, 10%)"; skyBot = "hsl(225, 40%, 18%)";
        ambient = "rgba(30,50,100,0.04)"; sunY = 30; showSun = false; showMoon = true; starOpacity = 1;
    }
    const isNight = t < 6 || t >= 19.5;
    const sceneBg = isNight
        ? "linear-gradient(180deg, #080c14 0%, #0d1220 50%, #111828 100%)"
        : t >= 17 ? "linear-gradient(180deg, #0d1117 0%, #15192a 50%, #1a1e2e 100%)"
            : t >= 8 && t < 16 ? "linear-gradient(180deg, #162540 0%, #1a3050 50%, #1e3555 100%)"
                : "linear-gradient(180deg, #121e35 0%, #162848 50%, #1a2e4a 100%)";
    const gridOpacity = isNight ? 0.015 : t >= 8 && t < 16 ? 0.05 : 0.035;
    const isDaytime = t >= 7 && t < 17;
    return { skyTop, skyBot, ambient, sunY, showSun, showMoon, starOpacity, sceneBg, gridOpacity, hour, isNight, isDaytime };
}

// Agent 状态管理 Hook
export function useAgentStates() {
    const [states, setStates] = useState<Map<string, AgentSt>>(new Map());

    const mkSt = useCallback((offset = 0): AgentSt => ({
        status: "idle", changedAt: Date.now(), idleAction: randAct(),
        nextActionAt: Date.now() + 3000 + offset + Math.random() * 5000,
    }), []);

    const getSt = useCallback((id: string): AgentSt => states.get(id) || mkSt(), [states, mkSt]);

    const upd = useCallback((id: string, u: Partial<AgentSt>) => {
        setStates(p => { const n = new Map(p); const c = p.get(id) || mkSt(); n.set(id, { ...c, ...u, changedAt: Date.now() }); return n; });
    }, [mkSt]);

    const toIdle = useCallback((id: string) => {
        upd(id, { status: "returning", target: undefined, bubble: undefined, fading: false, talkReady: false });
        setTimeout(() => setStates(p => { const n = new Map(p); const c = p.get(id); if (c?.status === "returning") n.set(id, mkSt()); return n; }), RETURN_TIME);
    }, [upd, mkSt]);

    return { states, setStates, mkSt, getSt, upd, toIdle };
}

// SSE 事件处理 Hook
export function useOfficeSSE(
    upd: (id: string, u: Partial<AgentSt>) => void,
    addChat: (aid: string, text: string, type: ChatEntry["type"]) => void,
    states: Map<string, AgentSt>,
    toIdle: (id: string) => void,
    setConnected: (v: boolean) => void,
) {
    // 用 ref 保存回调和 states，避免 useEffect 依赖变化导致 SSE 反复重连
    const updRef = useRef(upd);
    const addChatRef = useRef(addChat);
    const statesRef = useRef(states);
    const toIdleRef = useRef(toIdle);
    const setConnectedRef = useRef(setConnected);
    updRef.current = upd;
    addChatRef.current = addChat;
    statesRef.current = states;
    toIdleRef.current = toIdle;
    setConnectedRef.current = setConnected;

    useEffect(() => {
        const seen = new Set<string>();
        const unsub = subscribeToEvents((event: EventData) => {
            setConnectedRef.current(true);
            const e = event as Record<string, unknown>;
            const fp = `${event.type}:${event.timestamp}:${e.agentId ?? ""}`;
            if (seen.has(fp)) return;
            seen.add(fp);
            if (seen.size > 500) { const arr = [...seen]; seen.clear(); arr.slice(-300).forEach(x => seen.add(x)); }
            const aid = e.agentId ? String(e.agentId) : undefined;

            const clearBubbleLater = (agentId: string) => {
                setTimeout(() => {
                    updRef.current(agentId, { bubble: undefined, fading: false });
                }, BUBBLE_LIFE);
            };

            switch (event.type) {
                case "message_received": {
                    const sender = e.sender ? String(e.sender) : "用户";
                    const msg = (e.message as string) || "";
                    // 用户消息 → 加入聊天流（用 "system" 作为 agentId，标记为 event 类型）
                    addChatRef.current("user", `💬 ${sender}: ${msg.substring(0, 500)}`, "event");
                    break;
                }
                case "agent_routed":
                    if (aid) { updRef.current(aid, { status: "receiving", target: undefined, bubble: undefined, fading: false, talkReady: false }); addChatRef.current(aid, "收到新挑战，前往道馆...", "event"); }
                    break;
                case "chain_step_start":
                    if (aid) { updRef.current(aid, { status: "thinking", target: e.fromAgent ? String(e.fromAgent) : undefined, bubble: undefined, fading: false, talkReady: false }); addChatRef.current(aid, "开始制定作战策略...", "think"); }
                    break;
                case "chain_step_done":
                    if (aid) {
                        const msg = (e.responseText as string) || "";
                        // 过滤路由消息 — 短消息且以@开头并包含箭头符号
                        const trimMsg = msg.trim();
                        const isRouting = trimMsg.startsWith("@") && trimMsg.length < 50 && (trimMsg.includes("→") || trimMsg.includes("->") || trimMsg.includes("⇒") || trimMsg.includes("➜"));
                        const targets = extractTargets(msg);
                        const talkDuration = Math.max(3000, Math.min(msg.length * 30, 12000));
                        updRef.current(aid, { status: "talking", target: targets[0], bubble: isRouting ? undefined : msg, bubbleTs: Date.now(), fading: false, talkReady: true, talkUntil: Date.now() + talkDuration });
                        for (const tid of targets) {
                            updRef.current(tid, { status: "receiving" });
                        }
                        if (!isRouting) {
                            addChatRef.current(aid, msg, "talk");
                        }
                        clearBubbleLater(aid);
                    }
                    break;
                case "chain_handoff": {
                    const from = e.fromAgent ? String(e.fromAgent) : undefined;
                    const to = e.toAgent ? String(e.toAgent) : undefined;
                    if (from && to) {
                        // from agent 保持 talking 一段时间（连线可见），然后回休息区
                        const fromSt = statesRef.current.get(from);
                        const talkRemain = Math.max(3000, (fromSt?.talkUntil || 0) - Date.now());
                        setTimeout(() => { toIdleRef.current(from); }, talkRemain);
                        updRef.current(to, { status: "receiving" });
                        addChatRef.current(from, `传球给 @${to}`, "event");
                    }
                    break;
                }
                case "response_ready":
                    if (aid) {
                        const msg = (e.responseText as string) || "";
                        const talkDur = Math.max(3000, Math.min(msg.length * 30, 12000));
                        updRef.current(aid, { status: "talking", bubble: msg, bubbleTs: Date.now(), fading: false, talkReady: true, talkUntil: Date.now() + talkDur });
                        clearBubbleLater(aid);
                        // 最终回复说完后回休息区
                        setTimeout(() => { toIdleRef.current(aid); }, talkDur);
                    }
                    break;
                case "team_chain_end": {
                    const agents = (e.agents as string[]) || [];
                    const convId = (e.conversationId as string) || "";
                    addChatRef.current("system", `✅ 会话 ${convId.slice(0, 8)} 完成`, "event");
                    for (const pid of agents) { toIdleRef.current(pid); }
                    if (agents.length === 0 && aid) toIdleRef.current(aid);
                    break;
                }
                case "chain_step_waiting":
                    if (aid) {
                        const waitingFor = (e.waitingFor as string[]) || [];
                        const waitText = `⏳ 等待 ${waitingFor.map(a => `@${a}`).join(", ")} 完成...`;
                        updRef.current(aid, { status: "receiving", bubble: waitText, bubbleTs: Date.now(), fading: false, talkReady: false });
                        addChatRef.current(aid, waitText, "event");
                    }
                    break;
                case "agent_timeout":
                case "agent_error":
                    if (aid) {
                        const err = (e.error as string) || "未知错误";
                        addChatRef.current(aid, `${event.type === "agent_timeout" ? "⚠️ 执行超时" : "❌ 出错"}：${err}`, "event");
                        updRef.current(aid, { status: "idle", target: undefined, bubble: undefined, fading: false, talkReady: false });
                    }
                    break;
                case "conversation_timeout": {
                    const pending = (e.pendingAgents as string[]) || [];
                    const mins = (e.elapsedMinutes as number) || 0;
                    addChatRef.current(pending[0] || "system", `⏰ 会话超时（${mins}分钟），强制完成`, "event");
                    for (const pid of pending) { updRef.current(pid, { status: "idle", target: undefined, bubble: undefined, fading: false, talkReady: false }); }
                    break;
                }
            }
        }, () => setConnectedRef.current(false), () => setConnectedRef.current(true));
        return unsub;
    }, []); // eslint-disable-line -- 用 ref 确保稳定，只建立一次 SSE 连接
}

// Sessions 轮询 Hook — 精确判断 agent 工作状态
export function useSessionsPolling(setStates: React.Dispatch<React.SetStateAction<Map<string, AgentSt>>>) {
    useEffect(() => {
        const iv = setInterval(async () => {
            try {
                const { sessions } = await getSessions();
                const now = Date.now();
                const busyAgents = new Set<string>();
                for (const s of sessions) { if (s.pending_agents) s.pending_agents.forEach(a => busyAgents.add(a)); }
                setStates(p => {
                    let ch = false; const n = new Map(p);
                    for (const [id, s] of p) {
                        if (busyAgents.has(id)) {
                            if (s.status === "idle" || s.status === "returning") { n.set(id, { ...s, status: "receiving", changedAt: now }); ch = true; }
                        } else {
                            // sessions 轮询确认 agent 不在 pending 中，直接清除 thinking/receiving 状态
                            if (s.status === "thinking" || s.status === "receiving") {
                                n.set(id, { ...s, status: "idle", target: undefined, bubble: undefined, fading: false, talkReady: false, changedAt: now, nextActionAt: now + 3000 + Math.random() * 5000, idleAction: randAct() });
                                ch = true;
                            }
                        }
                    }
                    return ch ? n : p;
                });
            } catch { /* 忽略 */ }
        }, 10000);
        return () => clearInterval(iv);
    }, [setStates]);
}

// Idle 动作切换 Hook
export function useIdleActionSwitch(setStates: React.Dispatch<React.SetStateAction<Map<string, AgentSt>>>) {
    useEffect(() => {
        const iv = setInterval(() => {
            const now = Date.now();
            setStates(p => {
                const n = new Map(p); let ch = false;
                for (const [id, s] of p) {
                    if (s.status === "idle" && now >= s.nextActionAt) {
                        const dur = 6000 + Math.random() * 12000;
                        n.set(id, { ...s, idleAction: randAct(), nextActionAt: now + dur });
                        ch = true;
                    }
                }
                return ch ? n : p;
            });
        }, 1000);
        return () => clearInterval(iv);
    }, [setStates]);
}
