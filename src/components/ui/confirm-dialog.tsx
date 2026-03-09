"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "./button";

// ═══════════════════════════════════════════════════════════════════
// ConfirmDialog — 自定义确认对话框，替代浏览器原生 confirm()
// ═══════════════════════════════════════════════════════════════════

interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "default";
    loading?: boolean;
}

export function ConfirmDialog({
    open, onClose, onConfirm, title, message,
    confirmText = "确认", cancelText = "取消",
    variant = "default", loading = false,
}: ConfirmDialogProps) {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    React.useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [open, onClose]);

    if (!mounted || !open) return null;

    return createPortal(
        <>
            {/* 遮罩 */}
            <div
                className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm animate-in fade-in-0"
                onClick={onClose}
            />
            {/* 对话框 */}
            <div className="fixed z-[201] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm animate-in fade-in-0 zoom-in-95">
                <div className="bg-background border shadow-xl p-0 overflow-hidden">
                    {/* 头部 */}
                    <div className="flex items-center gap-3 px-5 pt-5 pb-3">
                        <div className={cn(
                            "flex h-9 w-9 items-center justify-center shrink-0",
                            variant === "danger" ? "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400" : "bg-primary/10 text-primary"
                        )}>
                            <AlertTriangle className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold">{title || "确认操作"}</h3>
                        </div>
                        <button onClick={onClose} className="p-1 hover:bg-secondary rounded-md transition-colors text-muted-foreground hover:text-foreground cursor-pointer">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    {/* 内容 */}
                    <div className="px-5 pb-4">
                        <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
                    </div>
                    {/* 操作栏 */}
                    <div className="flex items-center justify-end gap-2 px-5 py-3 bg-muted/30 border-t">
                        <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
                            {cancelText}
                        </Button>
                        <Button
                            size="sm"
                            variant={variant === "danger" ? "destructive" : "default"}
                            onClick={onConfirm}
                            disabled={loading}
                        >
                            {confirmText}
                        </Button>
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}

// ═══════════════════════════════════════════════════════════════════
// useConfirm — Hook 方式调用确认对话框（替代 confirm()）
// ═══════════════════════════════════════════════════════════════════

interface ConfirmOptions {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "default";
}

/**
 * 使用方式：
 * const { confirm, ConfirmUI } = useConfirm();
 * // 在 JSX 中渲染 <ConfirmUI />
 * // 调用 const ok = await confirm({ message: "确定删除？", variant: "danger" });
 */
export function useConfirm() {
    const [state, setState] = React.useState<{
        open: boolean;
        options: ConfirmOptions;
        resolve: ((v: boolean) => void) | null;
    }>({ open: false, options: { message: "" }, resolve: null });

    const confirm = React.useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setState({ open: true, options, resolve });
        });
    }, []);

    const handleClose = React.useCallback(() => {
        state.resolve?.(false);
        setState(s => ({ ...s, open: false }));
    }, [state.resolve]);

    const handleConfirm = React.useCallback(() => {
        state.resolve?.(true);
        setState(s => ({ ...s, open: false }));
    }, [state.resolve]);

    const ConfirmUI = React.useCallback(() => (
        <ConfirmDialog
            open={state.open}
            onClose={handleClose}
            onConfirm={handleConfirm}
            {...state.options}
        />
    ), [state.open, state.options, handleClose, handleConfirm]);

    return { confirm, ConfirmUI };
}
