// 3D 家具组件 —— 每个物品单独使用 CSS 3D transform 呈现立体感
// 画布本身不旋转，物品自身带有轻微倾斜+可见侧面和阴影

import React from "react";

// ── 通用 3D 盒子：顶面 + 前面 + 右侧面 ──
function Box3D({ w, h, depth, topColor, frontColor, sideColor, className = "", style = {}, children }: {
    w: number; h: number; depth: number;
    topColor: string; frontColor: string; sideColor: string;
    className?: string; style?: React.CSSProperties; children?: React.ReactNode;
}) {
    return (
        <div className={className} style={{ width: w, height: h + depth, position: "relative", ...style }}>
            {/* 顶面（梯形变换模拟透视） */}
            <div style={{
                position: "absolute", top: 0, left: 0, width: w, height: h,
                background: topColor,
                transform: "perspective(300px) rotateX(8deg)",
                transformOrigin: "bottom center",
                borderRadius: "2px 2px 0 0",
            }} />
            {/* 前面 */}
            <div style={{
                position: "absolute", bottom: 0, left: 0, width: w, height: depth,
                background: frontColor,
                borderRadius: "0 0 2px 2px",
            }}>
                {children}
            </div>
            {/* 右侧面 */}
            <div style={{
                position: "absolute", top: 0, right: -depth * 0.35, width: depth * 0.35, height: h + depth,
                background: sideColor,
                clipPath: "polygon(0 8%, 100% 0, 100% 100%, 0 100%)",
                borderRadius: "0 2px 2px 0",
            }} />
        </div>
    );
}

// ── 办公桌 3D ──
export function Desk3D({ active, color, id }: { active: boolean; color: { h: string; g: string }; id: string }) {
    const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const items = hash % 5;
    return (
        <div style={{ position: "relative" }}>
            {/* 木色桌面 */}
            <Box3D
                w={58} h={20} depth={3}
                topColor={active ? `linear-gradient(135deg, #c4a87a, ${color.h}40)` : "linear-gradient(135deg, #c4a87a, #b8976a)"}
                frontColor={active ? "#a08050" : "#907040"}
                sideColor={active ? "#8b6914" : "#7a5a10"}
            >
                {active && <div style={{ display: "flex", gap: 2, padding: "2px 4px", justifyContent: "center" }}>
                    <div style={{ width: 3, height: 3, borderRadius: "50%", background: color.h, opacity: 0.8 }} className="animate-pulse" />
                </div>}
            </Box3D>
            {/* 显示器 */}
            <div style={{ position: "absolute", left: 6, top: -20, width: 22, height: 18 }}>
                <Box3D w={22} h={14} depth={4}
                    topColor="#e0e0e0"
                    frontColor={active ? `linear-gradient(180deg, ${color.h}80, ${color.h}30)` : "#d0d0d0"}
                    sideColor="#bdbdbd"
                >
                    {active && <div style={{ padding: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                        <div style={{ width: "80%", height: 1.5, background: color.h, opacity: 0.7 }} className="animate-pulse" />
                        <div style={{ width: "50%", height: 1.5, background: color.h, opacity: 0.4 }} />
                    </div>}
                </Box3D>
                <div style={{ width: 4, height: 4, background: "#9e9e9e", margin: "0 auto" }} />
                <div style={{ width: 14, height: 2, background: "#9e9e9e", margin: "0 auto", borderRadius: 1 }} />
            </div>
            {/* 键盘 */}
            <div style={{ position: "absolute", left: 20, top: -6, width: 18, height: 6, background: "#e0e0e0", border: "1px solid #bdbdbd", borderRadius: 2 }} />
            {/* 桌面小物品 */}
            {(items === 0 || items === 2 || items === 4) && (
                <div style={{ position: "absolute", right: 4, top: -8 }}>
                    <div style={{ width: 5, height: 6, background: items === 2 ? "#e65100" : "#cc3333", borderRadius: "1px 1px 2px 2px", position: "relative" }}>
                        <div style={{ position: "absolute", right: -2, top: 1, width: 3, height: 3, border: `1px solid ${items === 2 ? "#e65100" : "#cc3333"}`, borderRadius: "50%" }} />
                    </div>
                </div>
            )}
            {(items === 1 || items === 3) && (
                <div style={{ position: "absolute", right: 6, top: -6, width: 8, height: 6, background: items === 1 ? "#fff59d" : "#a5d6a7", borderRadius: 1, opacity: 0.8, transform: `rotate(${items === 1 ? -5 : 8}deg)` }} />
            )}
            {(items === 0 || items === 3 || items === 4) && (
                <div style={{ position: "absolute", right: items === 0 ? 14 : 2, top: -9 }}>
                    <div style={{ width: 4, height: 7, background: "#8d6e63", borderRadius: "1px 1px 0 0" }}>
                        <div style={{ position: "absolute", top: -2, left: 1, width: 1, height: 3, background: "#1e88e5", transform: "rotate(-10deg)" }} />
                        <div style={{ position: "absolute", top: -1, left: 2, width: 1, height: 2, background: "#e53935", transform: "rotate(5deg)" }} />
                    </div>
                </div>
            )}
            {(items === 2) && (
                <div style={{ position: "absolute", right: 2, top: -10 }}>
                    <div style={{ fontSize: 6 }}>🌱</div>
                </div>
            )}
            {/* 鼠标 */}
            <div style={{ position: "absolute", left: 42, top: -5, width: 4, height: 6, background: "#e0e0e0", borderRadius: "2px 2px 3px 3px", border: "0.5px solid #bdbdbd" }} />
            {/* 木色桌腿 */}
            <div style={{ position: "absolute", bottom: -10, left: 3, width: 4, height: 10, background: "#a08050" }} />
            <div style={{ position: "absolute", bottom: -10, right: 3, width: 4, height: 10, background: "#907040" }} />
            <div className="text-center" style={{ marginTop: 12 }}>
                <div className="text-[7px] font-mono" style={{ color: "#8b6914" }}>@{id}</div>
            </div>
            {active && <div style={{ position: "absolute", inset: -6, boxShadow: `0 0 20px ${color.g}`, pointerEvents: "none", borderRadius: 4 }} />}
        </div>
    );
}

// ── 会议桌 3D ──
export function MeetingTable3D({ label }: { label: string }) {
    return (
        <div style={{ position: "relative" }}>
            <Box3D w={60} h={14} depth={3}
                topColor="linear-gradient(135deg, #c4a87a, #b8976a)"
                frontColor="#907040"
                sideColor="#7a5a10"
            />
            {/* 红色椅子 */}
            {[-8, 64].map((x, i) => (
                <div key={i} style={{ position: "absolute", left: x, top: 2, width: 6, height: 14, background: "#cc3333", border: "1px solid #8b1a1a", borderRadius: 2 }} />
            ))}
            <div style={{ position: "absolute", bottom: -6, left: 5, width: 3, height: 6, background: "#907040" }} />
            <div style={{ position: "absolute", bottom: -6, right: 5, width: 3, height: 6, background: "#7a5a10" }} />
            <div className="absolute flex items-center justify-center" style={{ inset: 0, top: 0, height: 12 }}>
                <span className="text-[6px] font-mono" style={{ color: "#8b6914" }}>{label}</span>
            </div>
        </div>
    );
}

// ── L型沙发 3D ──
export function Sofa3D() {
    return (
        <div style={{ position: "relative" }}>
            <Box3D w={44} h={10} depth={10}
                topColor="linear-gradient(135deg, #cc3333, #b52a2a)"
                frontColor="#8b1a1a"
                sideColor="#701010"
            >
                <div style={{ display: "flex", gap: 3, padding: "1px 4px", alignItems: "center", justifyContent: "center", height: "100%" }}>
                    <div style={{ width: 8, height: 7, background: "#e57373", borderRadius: 2 }} />
                    <div style={{ width: 8, height: 7, background: "#ef9a9a", borderRadius: 2 }} />
                </div>
            </Box3D>
            <div style={{ position: "absolute", top: -6, left: 0, width: 44, height: 6, background: "linear-gradient(180deg, #b52a2a, #cc3333)", borderRadius: "3px 3px 0 0" }} />
            <div style={{ position: "absolute", left: 38, top: -6 }}>
                <Box3D w={18} h={10} depth={22}
                    topColor="linear-gradient(135deg, #cc3333, #b52a2a)"
                    frontColor="#8b1a1a"
                    sideColor="#701010"
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: 2 }}>
                        <div style={{ width: 8, height: 7, background: "#e57373", borderRadius: 2 }} />
                    </div>
                </Box3D>
            </div>
            <div className="text-[5px] text-center font-mono mt-1" style={{ color: "#8b4513" }}>沙发 SOFA</div>
        </div>
    );
}

// ── 书架 3D ──
export function Bookshelf3D() {
    const books = [
        [["#cc3333", 6, 9], ["#1e88e5", 5, 8], ["#43a047", 7, 9], ["#fdd835", 5, 7]],
        [["#8e24aa", 8, 7], ["#e65100", 6, 7], ["#f06292", 5, 7]],
        [["#5c6bc0", 7, 6], ["#26a69a", 5, 5]],
    ];
    return (
        <div style={{ position: "relative" }}>
            <Box3D w={36} h={14} depth={40}
                topColor="linear-gradient(135deg, #c4a87a, #b8976a)"
                frontColor="#907040"
                sideColor="#7a5a10"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 1, padding: "2px 3px" }}>
                    {books.map((row, ri) => (
                        <React.Fragment key={ri}>
                            <div style={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
                                {row.map(([c, w, h], bi) => (
                                    <div key={bi} style={{ width: w as number, height: h as number, background: c as string, borderRadius: 1 }} />
                                ))}
                            </div>
                            {ri < 2 && <div style={{ width: "100%", height: 1, background: "#b8976a" }} />}
                        </React.Fragment>
                    ))}
                </div>
            </Box3D>
            <div className="text-[5px] text-center font-mono mt-0.5" style={{ color: "#8b4513" }}>书架 SHELF</div>
        </div>
    );
}

// ── 咖啡机 3D ──
export function CoffeeMachine3D() {
    return (
        <div style={{ position: "relative" }}>
            <Box3D w={28} h={10} depth={24}
                topColor="linear-gradient(135deg, #e0e0e0, #bdbdbd)"
                frontColor="#9e9e9e"
                sideColor="#757575"
            >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "3px 0" }}>
                    <div style={{ width: 16, height: 3, background: "#616161", borderRadius: 1 }} />
                    <div style={{ width: 8, height: 8, background: "#424242", borderRadius: "50%", border: "1px solid #757575" }} />
                    <div style={{ width: 12, height: 4, background: "#616161", borderRadius: "0 0 3px 3px" }} />
                </div>
            </Box3D>
            <span className="text-[5px] font-mono block text-center mt-0.5" style={{ color: "#8b4513" }}>COFFEE ☕</span>
        </div>
    );
}

// ── 乒乓台 3D ──
export function PingPongTable3D() {
    return (
        <div style={{ position: "relative" }}>
            <Box3D w={52} h={14} depth={8}
                topColor="linear-gradient(135deg, #43a047, #388e3c)"
                frontColor="#2e7d32"
                sideColor="#1b5e20"
            >
                <div style={{ position: "absolute", left: "50%", top: -4, width: 1, height: 12, background: "rgba(255,255,255,0.5)", transform: "translateX(-50%)" }} />
            </Box3D>
            <div style={{ position: "absolute", top: 0, left: "50%", width: 1, height: 14, background: "rgba(255,255,255,0.3)", transform: "translateX(-50%)" }} />
            <div style={{ position: "absolute", bottom: -10, left: 5, width: 3, height: 10, background: "#907040" }} />
            <div style={{ position: "absolute", bottom: -10, right: 5, width: 3, height: 10, background: "#7a5a10" }} />
            <div className="text-[5px] text-center font-mono mt-1" style={{ color: "#8b4513" }}>🏓 PING PONG</div>
        </div>
    );
}

// ── PS5 区域 3D（电视+主机） ──
export function PS5Area3D() {
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            {/* 电视 */}
            <Box3D w={36} h={6} depth={18}
                topColor="#0a0a1e"
                frontColor="linear-gradient(180deg, #1e3a5f 0%, #0f172a 100%)"
                sideColor="#0a0a18"
            >
                {/* 屏幕画面 */}
                <div style={{ margin: "2px", height: "calc(100% - 4px)", background: "linear-gradient(135deg, #1e3a5f, #0f172a)", border: "1px solid rgba(236,72,153,0.2)", borderRadius: 1 }} />
            </Box3D>
            {/* 主机+手柄 */}
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <div style={{ width: 14, height: 6, background: "#1a1a2e", borderRadius: 2, border: "1px solid rgba(236,72,153,0.15)" }} />
                <Box3D w={10} h={3} depth={8} topColor="#1a1a2e" frontColor="#141428" sideColor="#10101e" />
            </div>
            <div className="text-[5px] text-center font-mono" style={{ color: "#ec4899" }}>🎮 PS5 GAME</div>
        </div>
    );
}

// ── 盆栽 3D ──
export function Plant3D({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
    const s = size === "sm" ? 0.7 : size === "lg" ? 1.2 : 1;
    return (
        <div style={{ transform: `scale(${s})`, transformOrigin: "bottom center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 1, marginBottom: -2 }}>
                    <div style={{ width: 4, height: 12, background: "#43a047", borderRadius: "3px 3px 0 0", transform: "rotate(-15deg)" }} />
                    <div style={{ width: 5, height: 14, background: "#66bb6a", borderRadius: "3px 3px 0 0" }} />
                    <div style={{ width: 4, height: 12, background: "#43a047", borderRadius: "3px 3px 0 0", transform: "rotate(15deg)" }} />
                </div>
                <Box3D w={14} h={4} depth={8} topColor="#a0522d" frontColor="#8b4513" sideColor="#6d3210" />
            </div>
        </div>
    );
}

// ── 白板 3D ──
export function Whiteboard3D() {
    return (
        <div>
            <Box3D w={32} h={6} depth={36}
                topColor="#f5f5f5"
                frontColor="#e0e0e0"
                sideColor="#bdbdbd"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "4px 4px" }}>
                    <div style={{ width: "80%", height: 1, background: "#cc3333" }} />
                    <div style={{ width: "60%", height: 1, background: "#1e88e5" }} />
                    <div style={{ width: "90%", height: 1, background: "#43a047" }} />
                </div>
            </Box3D>
            <div className="text-[6px] text-center mt-0.5 font-mono" style={{ color: "#8b4513" }}>白板</div>
        </div>
    );
}

// ── 饮水机 3D ──
export function WaterDispenser3D() {
    return (
        <div>
            <Box3D w={18} h={6} depth={24}
                topColor="#e0e0e0"
                frontColor="#bdbdbd"
                sideColor="#9e9e9e"
            >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "3px 0" }}>
                    <div style={{ width: 10, height: 4, background: "#90caf9", borderRadius: 1 }} />
                    <div style={{ width: 6, height: 8, background: "#64b5f6", borderRadius: "0 0 2px 2px" }} />
                </div>
            </Box3D>
            <div className="text-[5px] text-center font-mono" style={{ color: "#1565c0" }}>WATER</div>
        </div>
    );
}

// ── 零食台 3D ──
export function SnackTable3D() {
    return (
        <div>
            <Box3D w={24} h={6} depth={14}
                topColor="linear-gradient(135deg, #c4a87a, #b8976a)"
                frontColor="#907040"
                sideColor="#7a5a10"
            >
                <div style={{ display: "flex", gap: 2, padding: "2px 4px", alignItems: "center" }}>
                    <div style={{ width: 5, height: 6, background: "#e65100", borderRadius: "2px 2px 0 0" }} />
                    <div style={{ width: 6, height: 5, background: "#d4a574", borderRadius: "50%" }} />
                </div>
            </Box3D>
            <span className="text-[5px] font-mono block text-center" style={{ color: "#8b4513" }}>🍩 SNACK</span>
        </div>
    );
}

// ── 冥想垫 3D ──
export function MeditationPad3D() {
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: 20, height: 6, background: "#8bc34a", borderRadius: "50%", border: "1px solid #689f38" }} />
            <div style={{ width: 28, height: 8, background: "#aed581", borderRadius: 14, border: "1px solid #8bc34a", marginTop: -2 }} />
            <div className="text-[5px] text-center font-mono" style={{ color: "#558b2f" }}>蒲团 ZEN</div>
        </div>
    );
}
