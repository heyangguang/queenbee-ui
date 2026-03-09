"use client";

import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ChevronDown, Sparkles } from "lucide-react";

export interface ModelOption {
    id: string;
    name: string;
    full_id: string;
}

/**
 * 模型选择器 — 支持下拉选择 + 手动输入自定义模型
 * 使用 Portal 渲染下拉面板，避免被父容器 overflow-hidden 裁剪
 */
export function ModelCombobox({
    value,
    onChange,
    models,
    className,
}: {
    value: string;
    onChange: (value: string) => void;
    models: ModelOption[];
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

    // 同步外部 value 变化
    useEffect(() => {
        setInputValue(value);
    }, [value]);

    // 计算下拉面板位置（相对于 viewport）
    const updatePosition = useCallback(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        setDropdownStyle({
            position: "fixed",
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
            zIndex: 9999,
        });
    }, []);

    // 打开时计算位置
    useLayoutEffect(() => {
        if (open) updatePosition();
    }, [open, updatePosition]);

    // 滚动时更新位置
    useEffect(() => {
        if (!open) return;
        const handler = () => updatePosition();
        window.addEventListener("scroll", handler, true);
        window.addEventListener("resize", handler);
        return () => {
            window.removeEventListener("scroll", handler, true);
            window.removeEventListener("resize", handler);
        };
    }, [open, updatePosition]);

    // 点击外部关闭
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (containerRef.current?.contains(target)) return;
            if (dropdownRef.current?.contains(target)) return;
            setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const handleSelect = useCallback((id: string) => {
        onChange(id);
        setInputValue(id);
        setOpen(false);
    }, [onChange]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        setInputValue(v);
        onChange(v);
        setOpen(true);
    }, [onChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
        }
    }, []);

    // 显示文本
    const displayLabel = value === "" ? "自动（默认）" : undefined;

    // 过滤模型列表
    const filteredModels = inputValue && inputValue !== value
        ? models.filter(m => m.id.toLowerCase().includes(inputValue.toLowerCase()) || m.name.toLowerCase().includes(inputValue.toLowerCase()))
        : models;

    const isCustomValue = value !== "" && !models.some(m => m.id === value);

    // 下拉面板内容
    const dropdown = open && (
        <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="max-h-[280px] overflow-y-auto border bg-popover shadow-xl rounded-md"
        >
            {/* 自动（默认）选项 */}
            <button
                type="button"
                onClick={() => handleSelect("")}
                className={cn(
                    "w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent transition-colors cursor-pointer",
                    value === "" && "bg-accent/50 font-medium"
                )}
            >
                <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <div>
                    <span className="text-foreground">自动（默认）</span>
                    <span className="text-[10px] text-muted-foreground ml-2">使用 CLI 默认模型</span>
                </div>
            </button>

            {filteredModels.length > 0 && (
                <div className="border-t">
                    {filteredModels.map(m => (
                        <button
                            key={m.id}
                            type="button"
                            onClick={() => handleSelect(m.id)}
                            className={cn(
                                "w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors cursor-pointer flex items-center justify-between",
                                value === m.id && "bg-accent/50 font-medium"
                            )}
                        >
                            <span>{m.name}</span>
                            {m.id !== m.name && (
                                <span className="text-[10px] text-muted-foreground font-mono ml-2">{m.id}</span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* 自定义值提示 */}
            {inputValue && !models.some(m => m.id === inputValue) && inputValue !== "" && (
                <div className="border-t px-3 py-1.5">
                    <button
                        type="button"
                        onClick={() => handleSelect(inputValue)}
                        className="w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                        使用自定义: <span className="font-mono text-foreground">{inputValue}</span>
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <div ref={containerRef} className={cn("relative flex-1", className)}>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={displayLabel || inputValue}
                    onChange={handleInputChange}
                    onFocus={(e) => {
                        setOpen(true);
                        if (value === "") {
                            setInputValue("");
                            e.target.select();
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="输入模型 ID 或从下拉选择"
                    className={cn(
                        "flex h-9 w-full border bg-background px-3 py-2 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors",
                        value === "" && "text-muted-foreground italic",
                    )}
                />
                <button
                    type="button"
                    onClick={() => { setOpen(o => !o); inputRef.current?.focus(); }}
                    className="absolute right-0 top-0 h-9 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
                </button>
            </div>

            {/* Portal 渲染下拉面板到 body，避免被 overflow-hidden 裁剪 */}
            {typeof document !== "undefined" && createPortal(dropdown, document.body)}

            {isCustomValue && (
                <p className="text-[10px] text-amber-500/70 mt-1">⚡ 使用自定义模型 ID</p>
            )}
        </div>
    );
}

