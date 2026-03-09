"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { subscribeToEvents, type EventData } from "./api";

// ── 全局轮询失效广播（跨组件即时刷新） ──

const pollingBus = typeof window !== "undefined" ? new EventTarget() : null;

/** 通知所有使用指定 key 的 usePolling 实例立即刷新 */
export function invalidatePolling(key: string) {
    pollingBus?.dispatchEvent(new CustomEvent("invalidate", { detail: key }));
}

// ── usePolling：定期轮询 API ──

export function usePolling<T>(
    fetcher: () => Promise<T>,
    intervalMs: number,
    /** 可选 key，用于 invalidatePolling 跨组件通知刷新 */
    key?: string
): { data: T | null; loading: boolean; error: string; refresh: () => void } {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;

    const refresh = useCallback(() => {
        fetcherRef
            .current()
            .then((d) => {
                setData(d);
                setError("");
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        refresh();
        const id = setInterval(refresh, intervalMs);
        return () => clearInterval(id);
    }, [intervalMs, refresh]);

    // 监听全局 invalidate 事件
    useEffect(() => {
        if (!key || !pollingBus) return;
        const handler = (e: Event) => {
            if ((e as CustomEvent).detail === key) refresh();
        };
        pollingBus.addEventListener("invalidate", handler);
        return () => pollingBus.removeEventListener("invalidate", handler);
    }, [key, refresh]);

    return { data, loading, error, refresh };
}

// ── useSSE：实时事件流 ──

export function useSSE(maxEvents = 50) {
    const [events, setEvents] = useState<EventData[]>([]);

    useEffect(() => {
        const unsub = subscribeToEvents((event) => {
            setEvents((prev) => [event, ...prev].slice(0, maxEvents));
        });
        return unsub;
    }, [maxEvents]);

    return { events };
}

// ── timeAgo：相对时间格式化 ──

export function timeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 0) return "刚刚";
    if (diff < 5000) return "刚刚";
    if (diff < 60000) return `${Math.floor(diff / 1000)}秒前`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return `${Math.floor(diff / 86400000)}天前`;
}

// ── formatDuration：格式化持续时间 ──

export function formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
