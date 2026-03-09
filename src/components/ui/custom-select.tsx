"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// CustomSelect — 自定义下拉选择组件，替代浏览器原生 <select>
// ═══════════════════════════════════════════════════════════════════

export interface SelectOption {
    value: string;
    label: string;
    icon?: React.ReactNode;
}

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export function CustomSelect({ value, onChange, options, placeholder, className, disabled }: CustomSelectProps) {
    const [open, setOpen] = React.useState(false);
    const [mounted, setMounted] = React.useState(false);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const menuRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => setMounted(true), []);

    // 计算下拉菜单位置（智能方向：空间不足时向上展开）
    const [pos, setPos] = React.useState({ top: 0, left: 0, width: 0, openUp: false });

    const openMenu = React.useCallback(() => {
        if (disabled) return;
        const rect = triggerRef.current?.getBoundingClientRect();
        if (rect) {
            const spaceBelow = window.innerHeight - rect.bottom;
            const menuHeight = 240; // max-h-60 = 15rem ≈ 240px
            const openUp = spaceBelow < menuHeight && rect.top > spaceBelow;
            setPos({
                top: openUp ? rect.top - 4 : rect.bottom + 4,
                left: rect.left,
                width: rect.width,
                openUp,
            });
        }
        setOpen(true);
    }, [disabled]);

    // 点击外部关闭
    React.useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    // ESC 关闭
    React.useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [open]);

    const selected = options.find(o => o.value === value);

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => open ? setOpen(false) : openMenu()}
                disabled={disabled}
                className={cn(
                    "flex h-9 w-full items-center justify-between border bg-background px-3 py-2 text-sm transition-colors cursor-pointer",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
                    "hover:bg-accent/50",
                    disabled && "opacity-50 cursor-not-allowed",
                    className
                )}
            >
                <span className={cn("truncate", !selected && "text-muted-foreground")}>
                    {selected ? selected.label : (placeholder || "请选择")}
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2 transition-transform", open && "rotate-180")} />
            </button>

            {mounted && open && createPortal(
                <div
                    ref={menuRef}
                    className="fixed z-[100] border bg-popover shadow-lg animate-in fade-in-0 zoom-in-95 py-1 max-h-60 overflow-y-auto"
                    style={pos.openUp
                        ? { bottom: window.innerHeight - pos.top, left: pos.left, minWidth: pos.width }
                        : { top: pos.top, left: pos.left, minWidth: pos.width }
                    }
                >
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className={cn(
                                "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors cursor-pointer",
                                "hover:bg-accent",
                                opt.value === value && "bg-accent/50 font-medium"
                            )}
                        >
                            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                            <span className="flex-1 text-left truncate">{opt.label}</span>
                            {opt.value === value && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </>
    );
}
