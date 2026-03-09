"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { usePolling } from "@/lib/hooks";
import { getTeams, type TeamConfig } from "@/lib/api";
import {
    LayoutDashboard, MessageSquare, Bot, Users,
    ScrollText, Settings, Building2, Zap, Skull, Activity,
    ChevronRight, Clock, Sparkles, FolderKanban, BookOpen,
} from "lucide-react";
import { useState } from "react";

interface NavItem { href: string; label: string; icon: React.ReactNode; }

export function Sidebar() {
    const pathname = usePathname();
    const { data: teams } = usePolling<Record<string, TeamConfig>>(getTeams, 10000, "teams");
    const [expandTeams, setExpandTeams] = useState(true);

    const navItems: NavItem[] = [
        { href: "/", label: "仪表盘", icon: <LayoutDashboard className="h-4 w-4" /> },
        { href: "/agents", label: "Agent 管理", icon: <Bot className="h-4 w-4" /> },
        { href: "/skills", label: "Skills 管理", icon: <Sparkles className="h-4 w-4" /> },
        { href: "/teams", label: "Team 管理", icon: <Users className="h-4 w-4" /> },
        { href: "/projects", label: "项目管理", icon: <FolderKanban className="h-4 w-4" /> },
        { href: "/monitor", label: "运行监控", icon: <Activity className="h-4 w-4" /> },
        { href: "/conversations", label: "会话回放", icon: <MessageSquare className="h-4 w-4" /> },
        { href: "/dead-letters", label: "死信队列", icon: <Skull className="h-4 w-4" /> },
        { href: "/logs", label: "系统日志", icon: <ScrollText className="h-4 w-4" /> },
        { href: "/chat/history", label: "聊天历史", icon: <Clock className="h-4 w-4" /> },
        { href: "/settings", label: "设置", icon: <Settings className="h-4 w-4" /> },
        { href: "/settings/knowledge", label: "个人知识", icon: <BookOpen className="h-4 w-4" /> },
        { href: "/office", label: "办公室", icon: <Building2 className="h-4 w-4" /> },
    ];

    const isActive = (href: string) => {
        if (href === "/") return pathname === "/";
        if (href === "/chat") return pathname === "/chat";
        if (href === "/settings") return pathname === "/settings";
        return pathname.startsWith(href);
    };

    return (
        <aside className="flex h-screen w-56 flex-col border-r bg-card shrink-0">
            {/* Logo */}
            <div className="flex items-center gap-2.5 px-4 py-4 border-b">
                <div className="flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground">
                    <Zap className="h-4 w-4" />
                </div>
                <div>
                    <h1 className="text-sm font-bold text-foreground">QueenBee</h1>
                    <p className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">Office</p>
                </div>
            </div>

            {/* 主导航 */}
            <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-px">
                {navItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors",
                            isActive(item.href)
                                ? "bg-accent text-primary border-l-2 border-primary"
                                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        )}
                    >
                        {item.icon}
                        {item.label}
                    </Link>
                ))}

                {/* Team 快捷聊天列表 */}
                {teams && Object.keys(teams).length > 0 && (
                    <div className="pt-2">
                        <button
                            onClick={() => setExpandTeams(!expandTeams)}
                            className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                            <ChevronRight className={cn("h-3 w-3 transition-transform", expandTeams && "rotate-90")} />
                            Teams ({Object.keys(teams).length})
                        </button>
                        {expandTeams && (
                            <div className="mt-0.5 space-y-px">
                                {Object.entries(teams).map(([id, team]) => (
                                    <Link
                                        key={id}
                                        href={`/chat/team/${id}`}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-1.5 text-xs transition-colors",
                                            pathname === `/chat/team/${id}` ? "bg-accent text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                        )}
                                    >
                                        <span className="flex h-5 w-5 items-center justify-center bg-blue-50 text-[10px] font-bold text-primary">{team.name.charAt(0)}</span>
                                        <span className="truncate">{team.name}</span>
                                        <span className="ml-auto text-[9px] text-muted-foreground">{team.agents.length}人</span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </nav>

            <div className="border-t px-4 py-2.5">
                <p className="text-[10px] text-muted-foreground font-mono">QueenBee Office v0.7.0</p>
            </div>
        </aside>
    );
}
