"use client";

import { useState, useCallback } from "react";
import { usePolling } from "@/lib/hooks";
import { listProjects, getTeams, deleteProject, type Project, type TeamConfig } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, Plus, Trash2, Loader2, GitBranch, Users, Pencil, BookOpen } from "lucide-react";
import Link from "next/link";

export default function ProjectsPage() {
    const { data: projectsData, refresh } = usePolling<{ projects: Project[] }>(() => listProjects(), 5000);
    const { data: teams } = usePolling<Record<string, TeamConfig>>(getTeams, 10000);
    const projects = projectsData?.projects || [];

    const [deleting, setDeleting] = useState("");

    const handleDelete = useCallback(async (id: string) => {
        setDeleting(id);
        try { await deleteProject(id); refresh(); } finally { setDeleting(""); }
    }, [refresh]);

    return (
        <div className="p-6 space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold tracking-tight flex items-center gap-2"><FolderKanban className="h-5 w-5 text-emerald-600" /> 项目管理</h1>
                    <p className="text-sm text-muted-foreground mt-1">管理项目、关联 Team，项目级记忆在关联的所有 Agent 间共享</p>
                </div>
                <Link href="/projects/new"><Button><Plus className="h-4 w-4" /> 新建项目</Button></Link>
            </div>

            {/* 项目列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {projects.map((project) => (
                    <Card key={project.id} className="hover:border-emerald-400/30 transition-colors group">
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center bg-emerald-100 text-sm font-bold text-emerald-700 rounded">{project.name.charAt(0).toUpperCase()}</div>
                                    <div>
                                        <p className="font-semibold text-sm">{project.name}</p>
                                        <p className="text-xs text-muted-foreground">@{project.id}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Link href={`/projects/${project.id}/knowledge`}><Button variant="ghost" size="icon"><BookOpen className="h-3.5 w-3.5 text-emerald-600" /></Button></Link>
                                    <Link href={`/projects/${project.id}/edit`}><Button variant="ghost" size="icon"><Pencil className="h-3.5 w-3.5" /></Button></Link>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(project.id)} disabled={deleting === project.id}>
                                        {deleting === project.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
                                    </Button>
                                </div>
                            </div>
                            {project.description && <p className="text-xs text-muted-foreground mb-2">{project.description}</p>}
                            <div className="space-y-2">
                                {project.repo_path && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <GitBranch className="h-3.5 w-3.5" /> <span className="truncate">{project.repo_path}</span>
                                    </div>
                                )}
                                {project.teams.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {project.teams.map((teamId) => (
                                            <Badge key={teamId} variant="secondary" className="text-[10px]">
                                                <Users className="h-2.5 w-2.5 mr-0.5" /> {teams?.[teamId]?.name || teamId}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                                {project.teams.length === 0 && (
                                    <p className="text-xs text-muted-foreground/50">未关联任何 Team</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {projects.length === 0 && (
                <Card><CardContent className="text-center py-16"><FolderKanban className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" /><p className="text-sm text-muted-foreground">暂无项目，点击上方按钮创建</p></CardContent></Card>
            )}
        </div>
    );
}
