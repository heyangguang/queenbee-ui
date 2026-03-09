"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// Sheet / 右侧抽屉组件
// ═══════════════════════════════════════════════════════════════════

interface SheetProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
    className?: string;
    width?: string;
}

export function Sheet({ open, onClose, children, className, width = "max-w-md" }: SheetProps) {
    // 客户端挂载状态 — 解决 SSR hydration mismatch
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    // ESC 键关闭
    React.useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, onClose]);

    // 禁止背景滚动
    React.useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    // 服务端和客户端首次渲染都返回 null，mount 后再 portal
    if (!mounted) return null;

    return createPortal(
        <>
            {/* 遮罩 */}
            <div
                className={cn(
                    "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
                    open ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />
            {/* 抽屉面板 */}
            <div
                className={cn(
                    "fixed top-0 bottom-0 right-0 z-50 w-full bg-background border-l shadow-2xl transition-transform duration-300 ease-out flex flex-col overflow-hidden",
                    width,
                    open ? "translate-x-0" : "translate-x-full",
                    className
                )}
            >
                {children}
            </div>
        </>,
        document.body
    );
}

export function SheetHeader({ children, className, onClose }: { children: React.ReactNode; className?: string; onClose?: () => void }) {
    return (
        <div className={cn("flex items-center justify-between px-6 py-4 border-b shrink-0 bg-background", className)}>
            <div className="flex-1 min-w-0">{children}</div>
            {onClose && (
                <button onClick={onClose} className="ml-3 p-1.5 hover:bg-secondary rounded-md transition-colors text-muted-foreground hover:text-foreground cursor-pointer">
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}

export function SheetBody({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn("flex-1 overflow-y-auto px-6 py-4 min-h-0", className)}>
            {children}
        </div>
    );
}

export function SheetFooter({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn("px-6 py-4 border-t bg-muted/30 shrink-0 flex items-center gap-2 justify-end", className)}>
            {children}
        </div>
    );
}

