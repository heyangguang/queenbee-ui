"use client";

import { type Status } from "./shared-hooks";

// 缩略小人组件 — 约 12×18 px，用于全办公室俯瞰视角
// 保留：彩色圆头 + 身体色块 + 状态发光 + 简单动画

export function MiniCharacter({ shirt, status, initial, glow }: {
    shirt: string; status: Status; initial: string; glow: string;
}) {
    const active = status === "thinking" || status === "receiving";
    const talking = status === "talking";
    const isMoving = status === "receiving" || status === "returning";

    return (
        <div className="flex flex-col items-center" style={{
            filter: active ? `drop-shadow(0 0 4px ${glow})` : talking ? `drop-shadow(0 0 3px ${glow})` : "none",
            animation: isMoving ? "office-mini-walk 0.6s ease-in-out infinite" : undefined,
        }}>
            {/* 训练师帽子 */}
            <div style={{
                width: 10, height: 3, borderRadius: "2px 2px 0 0",
                background: `linear-gradient(180deg, ${shirt}, ${shirt}cc)`,
                border: active ? `0.5px solid ${shirt}` : "none",
                marginBottom: -1, zIndex: 1,
            }} />
            {/* 头 */}
            <div style={{
                width: 8, height: 7, borderRadius: "50%",
                background: "#fcd5b4",
                border: active ? `1px solid ${shirt}` : "none",
                boxShadow: active ? `0 0 4px ${glow}` : "none",
            }} />
            {/* 身体（训练师背心） */}
            <div style={{
                width: 7, height: 6, marginTop: -1,
                background: `linear-gradient(180deg, ${shirt}cc, ${shirt}88)`,
                borderRadius: "1px 1px 2px 2px",
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative",
            }}>
                <span style={{ color: "#fff", fontSize: 4, fontWeight: "bold", lineHeight: 1 }}>{initial}</span>
                {/* 背包暗示 */}
                <div style={{ position: "absolute", right: -1.5, top: 1, width: 2, height: 4, background: `${shirt}60`, borderRadius: "0 1px 1px 0" }} />
            </div>
            {/* 腿 */}
            <div style={{ display: "flex", gap: 1, marginTop: 0 }}>
                <div style={{
                    width: 2.5, height: 4, background: "#455a64", borderRadius: "0 0 1px 1px",
                    animation: isMoving ? "office-walk-leg-l 0.5s ease-in-out infinite" : undefined,
                    transformOrigin: "top center",
                }} />
                <div style={{
                    width: 2.5, height: 4, background: "#455a64", borderRadius: "0 0 1px 1px",
                    animation: isMoving ? "office-walk-leg-r 0.5s ease-in-out infinite" : undefined,
                    transformOrigin: "top center",
                }} />
            </div>
        </div>
    );
}

// Mini 状态指示器（只显示名称标签）
export function MiniNameTag({ name, color }: { name: string; color: string }) {
    return (
        <div className="text-center mt-px">
            <div className="text-[5px] font-bold font-mono px-1" style={{
                color, background: `${color}10`, border: `0.5px solid ${color}30`,
                whiteSpace: "nowrap", lineHeight: 1.2,
            }}>{name}</div>
        </div>
    );
}
