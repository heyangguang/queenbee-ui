// QueenBee Office API 客户端
// 通过 Next.js rewrites 代理转发到后端（默认 http://localhost:3777）
// 如需客户端直连后端（绕过代理），可设置 NEXT_PUBLIC_API_URL

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", ...options?.headers },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || res.statusText);
    }
    return res.json();
}

// ── 类型定义 ──

export interface AgentConfig {
    name: string;
    provider: string;
    model: string;
    fallback_provider?: string;
    fallback_model?: string;
    working_directory: string;
    system_prompt?: string;
    prompt_file?: string;
}

export interface TeamConfig {
    name: string;
    agents: string[];
    leader_agent: string;
}

export interface Settings {
    workspace?: { path?: string; name?: string };
    models?: {
        provider?: string;
        anthropic?: { model?: string };
        openai?: { model?: string };
        opencode?: { model?: string };
    };
    agents?: Record<string, AgentConfig>;
    teams?: Record<string, TeamConfig>;
    monitoring?: { heartbeat_interval?: number };
    env?: Record<string, string>;
    max_messages?: number;
    agent_timeout?: number;
    agent_idle_timeout?: number;
    conversation_timeout?: number;
}

export interface QueueStatus {
    pending: number;
    processing: number;
    completed: number;
    dead: number;
    responses_pending: number;
    active_conversations: number;
}

export interface EventData {
    type: string;
    timestamp: number;
    [key: string]: unknown;
}

export interface DeadMessage {
    id: number;
    message_id: string;
    channel: string;
    sender: string;
    sender_id: string | null;
    message: string;
    agent: string | null;
    files: string | null;
    conversation_id: string | null;
    from_agent: string | null;
    status: string;
    retry_count: number;
    last_error: string | null;
    created_at: number;
    updated_at: number;
}

export interface SessionInfo {
    id: string;
    team: string;
    sender: string;
    original_message: string;
    pending: number;
    pending_agents: string[];
    total_messages: number;
    elapsed_seconds: number;
}

// ── API 函数 ──

export async function sendMessage(payload: {
    message: string; agent?: string; sender?: string; channel?: string; project_id?: string;
}): Promise<{ ok: boolean; id: number; message_id: string }> {
    return apiFetch("/api/messages", { method: "POST", body: JSON.stringify(payload) });
}

export async function getAgents(): Promise<Record<string, AgentConfig>> { return apiFetch("/api/agents"); }
export async function getAgent(id: string): Promise<AgentConfig> { return apiFetch(`/api/agents/${encodeURIComponent(id)}`); }
export async function createAgent(id: string, agent: AgentConfig): Promise<{ ok: boolean }> { return apiFetch("/api/agents", { method: "POST", body: JSON.stringify({ id, agent }) }); }
export async function updateAgent(id: string, agent: AgentConfig): Promise<{ ok: boolean }> { return apiFetch(`/api/agents/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(agent) }); }
export async function deleteAgent(id: string): Promise<{ ok: boolean }> { return apiFetch(`/api/agents/${encodeURIComponent(id)}`, { method: "DELETE" }); }

export async function getTeams(): Promise<Record<string, TeamConfig>> { return apiFetch("/api/teams"); }
export async function getTeam(id: string): Promise<TeamConfig> { return apiFetch(`/api/teams/${encodeURIComponent(id)}`); }
export async function createTeam(id: string, team: TeamConfig): Promise<{ ok: boolean }> { return apiFetch("/api/teams", { method: "POST", body: JSON.stringify({ id, team }) }); }
export async function updateTeam(id: string, team: TeamConfig): Promise<{ ok: boolean }> { return apiFetch(`/api/teams/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(team) }); }
export async function deleteTeam(id: string): Promise<{ ok: boolean }> { return apiFetch(`/api/teams/${encodeURIComponent(id)}`, { method: "DELETE" }); }

export async function getSettings(): Promise<Settings> { return apiFetch("/api/settings"); }
export async function updateSettings(settings: Partial<Settings>): Promise<{ ok: boolean }> { return apiFetch("/api/settings", { method: "PUT", body: JSON.stringify(settings) }); }

export async function getQueueStatus(): Promise<QueueStatus> { return apiFetch("/api/queue/status"); }
export async function getDeadMessages(): Promise<DeadMessage[]> { return apiFetch("/api/queue/dead"); }
export async function retryDeadMessage(id: number): Promise<{ ok: boolean }> { return apiFetch(`/api/queue/dead/${id}/retry`, { method: "POST" }); }
export async function deleteDeadMessage(id: number): Promise<{ ok: boolean }> { return apiFetch(`/api/queue/dead/${id}`, { method: "DELETE" }); }
export async function recoverStaleMessages(options?: { kill?: boolean }): Promise<{ ok: boolean; recovered: number; killed: string[] | null }> { return apiFetch("/api/queue/recover", { method: "POST", body: JSON.stringify(options || {}) }); }

// Processing 消息单条操作
export interface ProcessingMessage {
    id: number;
    message_id: string;
    channel: string;
    sender: string;
    message: string;
    agent: string | null;
    conversation_id: string | null;
    from_agent: string | null;
    created_at: number;
    updated_at: number;
}
export async function getProcessingMessages(): Promise<ProcessingMessage[]> { return apiFetch("/api/queue/processing"); }
export async function recoverProcessingMessage(id: number): Promise<{ ok: boolean }> { return apiFetch(`/api/queue/processing/${id}/recover`, { method: "POST" }); }
export async function discardProcessingMessage(id: number): Promise<{ ok: boolean }> { return apiFetch(`/api/queue/processing/${id}/discard`, { method: "POST" }); }

export async function getLogs(type = "queue", limit = 200): Promise<{ lines: string[] }> { return apiFetch(`/api/logs/${type}?limit=${limit}`); }
export async function getSessions(): Promise<{ sessions: SessionInfo[]; count: number }> { return apiFetch("/api/sessions"); }
export async function getChats(): Promise<string[]> { return apiFetch("/api/chats"); }
export async function getTeamChats(team: string): Promise<string[]> { return apiFetch(`/api/chats/${encodeURIComponent(team)}`); }
export async function getChatFile(team: string, filename: string): Promise<{ content: string; filename: string; team: string }> { return apiFetch(`/api/chats/${encodeURIComponent(team)}/${encodeURIComponent(filename)}`); }

// 会话历史（结构化）— 对齐 db.ConvHistory
export interface ConversationHistory {
    id: string;
    team_id: string;
    team_name: string;
    channel: string;
    sender: string;
    original_message: string;
    agents: string;         // JSON string，例如 '["pm","architect"]'
    total_messages: number;
    started_at: number;
    ended_at: number;
    chat_file: string;
    duration_sec: number;
    total_rounds: number;
}

// 对齐 db.ConvStep
export interface ConversationStep {
    id: number;
    conversation_id: string;
    seq: number;
    from_agent: string;
    to_agent: string;
    message: string;
    message_type: string;   // "user_message" | "agent_response" | "handoff"
    timestamp: number;
}

// 对齐 db.ConvEvent
export interface ConversationEvent {
    id: number;
    conversation_id: string;
    event_type: string;
    event_data: string;     // JSON string
    timestamp: number;
}

export interface TimelineItem {
    type: "step" | "event";
    timestamp: number;
    data: ConversationStep | ConversationEvent;
}

export async function getConversationHistory(team?: string, limit = 20, offset = 0): Promise<{ conversations: ConversationHistory[]; count: number }> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (team) params.set("team", team);
    return apiFetch(`/api/conversations/history?${params}`);
}

export async function getConversationDetail(id: string): Promise<{ history: ConversationHistory; steps: ConversationStep[]; events: ConversationEvent[] }> {
    return apiFetch(`/api/conversations/history/${encodeURIComponent(id)}`);
}

export async function getConversationTimeline(id: string): Promise<{ history: ConversationHistory; timeline: TimelineItem[]; count: number }> {
    return apiFetch(`/api/conversations/history/${encodeURIComponent(id)}/timeline`);
}

// ── 执行统计 ──

export interface AgentStats {
    agent_id: string;
    total_sessions: number;
    total_duration_sec: number;
    avg_duration_sec: number;
    total_stdout_bytes: number;
    last_active_at: number;
}

export async function getAgentStats(): Promise<AgentStats[]> { return apiFetch("/api/stats/agents"); }
export async function getStatsTimeline(limit = 20): Promise<ConversationHistory[]> { return apiFetch(`/api/stats/timeline?limit=${limit}`); }

// ── SSE 事件订阅 ──

export function subscribeToEvents(
    onEvent: (event: EventData) => void,
    onError?: (err: Event) => void,
    onOpen?: () => void
): () => void {
    const es = new EventSource(`${API_BASE}/api/events/stream`);

    // 连接打开 + 后端 connected 确认
    es.onopen = () => { if (onOpen) onOpen(); };
    es.addEventListener("connected", () => { if (onOpen) onOpen(); });

    const handler = (e: MessageEvent) => {
        try { onEvent(JSON.parse(e.data)); } catch { /* skip */ }
    };

    for (const type of [
        "message_received", "agent_routed", "chain_step_start", "chain_step_done",
        "chain_step_waiting", "chain_handoff", "team_chain_start", "team_chain_end",
        "response_ready", "processor_start", "message_enqueued",
        "agent_timeout", "agent_error", "conversation_timeout",
    ]) {
        es.addEventListener(type, handler);
    }

    if (onError) es.onerror = onError;
    return () => es.close();
}

// ── Agent 活跃度 ──

export interface AgentActivity {
    agentId: string;
    status: "active" | "idle_warning" | "done" | "idle_killed" | "timeout_killed";
    lastActivityMs: number;
    idleSec: number;
    stdoutBytes: number;
    startedAt: number;
    elapsedSec: number;
}

export function subscribeToActivity(
    onEvent: (activity: AgentActivity) => void,
    onError?: (err: Event) => void,
    onOpen?: () => void
): () => void {
    const es = new EventSource(`${API_BASE}/api/activity/stream`);
    es.onopen = () => { if (onOpen) onOpen(); };
    es.addEventListener("agent_activity", (e: MessageEvent) => {
        try { onEvent(JSON.parse(e.data)); } catch { /* skip */ }
    });
    if (onError) es.onerror = onError;
    return () => es.close();
}

// ── Phase 2: 新增 API ──

// --- 系统 ---

export async function getHealth(): Promise<{ status: string; timestamp: number; version: string; uptime: number }> {
    return apiFetch("/api/health");
}

export async function setupSystem(config: {
    workspace_path?: string;
    default_provider?: string;
    default_model?: string;
    default_agent_name?: string;
    heartbeat_interval?: number;
}): Promise<{ ok: boolean; message: string; settings: Settings }> {
    return apiFetch("/api/setup", { method: "POST", body: JSON.stringify(config) });
}

export async function getSystemStatus(): Promise<{
    status: string;
    uptime_sec: number;
    pid: number;
    go_version: string;
    queue: QueueStatus;
    agents: Array<{ id: string; name: string; provider: string; model: string; working_directory: string }>;
    teams: Array<{ id: string; name: string; agents: string[]; leader_agent: string }>;
    active_conversations: number;
    config: Record<string, unknown>;
}> {
    return apiFetch("/api/system/status");
}

// --- Provider & Model ---

export interface ProviderModel {
    id: string;
    name: string;
    full_id: string;
}

export interface ProviderInfo {
    id: string;
    name: string;
    cli: string;
    models: ProviderModel[];
}

export async function getProviders(): Promise<{ providers: ProviderInfo[] }> {
    return apiFetch("/api/providers");
}

export async function getProviderModels(providerId: string): Promise<{ provider: string; models: ProviderModel[] }> {
    return apiFetch(`/api/providers/${encodeURIComponent(providerId)}/models`);
}

// --- Agent Skills ---

export interface AgentSkill {
    id: number;
    agent_id: string;
    skill_name: string;
    skill_path: string;
    description: string;
    source: "builtin" | "custom";
    enabled: boolean;
    created_at: number;
}

export async function getAgentSkills(agentId: string): Promise<{ skills: AgentSkill[]; count: number }> {
    return apiFetch(`/api/agents/${encodeURIComponent(agentId)}/skills`);
}

export async function addAgentSkill(agentId: string, skill: {
    skill_name: string;
    skill_path?: string;
    description?: string;
    source?: string;
    enabled?: boolean;
}): Promise<{ ok: boolean; skill: AgentSkill }> {
    return apiFetch(`/api/agents/${encodeURIComponent(agentId)}/skills`, {
        method: "POST", body: JSON.stringify(skill),
    });
}

export async function removeAgentSkill(agentId: string, skillId: number): Promise<{ ok: boolean }> {
    return apiFetch(`/api/agents/${encodeURIComponent(agentId)}/skills/${skillId}`, { method: "DELETE" });
}

// --- Agent Prompt ---

export async function getAgentPrompt(agentId: string): Promise<{
    agent_id: string;
    system_prompt: string;
    prompt_file: string;
    prompt_file_content: string;
}> {
    return apiFetch(`/api/agents/${encodeURIComponent(agentId)}/prompt`);
}

export async function updateAgentPrompt(agentId: string, prompt: {
    system_prompt?: string;
    prompt_file?: string;
}): Promise<{ ok: boolean }> {
    return apiFetch(`/api/agents/${encodeURIComponent(agentId)}/prompt`, {
        method: "PUT", body: JSON.stringify(prompt),
    });
}

// --- Agent Soul ---

export async function getAgentSoul(agentId: string): Promise<{
    agent_id: string;
    soul_content: string;
    exists: boolean;
}> {
    return apiFetch(`/api/agents/${encodeURIComponent(agentId)}/soul`);
}

// --- Agent Reset ---

export async function resetAgent(agentId: string): Promise<{ ok: boolean; message: string }> {
    return apiFetch(`/api/agents/${encodeURIComponent(agentId)}/reset`, { method: "POST" });
}

export async function killAgent(agentId: string): Promise<{ ok: boolean; killed: boolean; recovered: number }> {
    return apiFetch(`/api/agents/${encodeURIComponent(agentId)}/kill`, { method: "POST" });
}

export async function killSession(sessionId: string): Promise<{ ok: boolean; session_id: string; killed_agents: string[]; recovered: number }> {
    return apiFetch(`/api/sessions/${encodeURIComponent(sessionId)}/kill`, { method: "POST" });
}

// --- Skill Definitions CRUD ---

export interface SkillDefinition {
    id: number;
    name: string;
    description: string;
    content: string;        // SKILL.md 完整内容
    allowed_tools: string;
    source: "builtin" | "custom" | "community";
    category: string;
    version: string;
    created_at: number;
    updated_at: number;
}

export async function getSkillDefinitions(): Promise<{ skills: SkillDefinition[]; count: number }> {
    return apiFetch("/api/skills");
}

export async function createSkillDefinition(skill: {
    name: string;
    description?: string;
    content?: string;
    allowed_tools?: string;
    source?: string;
    category?: string;
    version?: string;
}): Promise<{ ok: boolean; skill: SkillDefinition }> {
    return apiFetch("/api/skills", { method: "POST", body: JSON.stringify(skill) });
}

export async function getSkillDefinition(id: number): Promise<{ skill: SkillDefinition }> {
    return apiFetch(`/api/skills/${id}`);
}

export async function updateSkillDefinition(id: number, updates: {
    name?: string;
    description?: string;
    content?: string;
    allowed_tools?: string;
    category?: string;
    version?: string;
}): Promise<{ ok: boolean; skill: SkillDefinition }> {
    return apiFetch(`/api/skills/${id}`, { method: "PUT", body: JSON.stringify(updates) });
}

export async function deleteSkillDefinition(id: number): Promise<{ ok: boolean }> {
    return apiFetch(`/api/skills/${id}`, { method: "DELETE" });
}

export async function importBuiltinSkills(): Promise<{ ok: boolean; skills: SkillDefinition[]; count: number }> {
    return apiFetch("/api/skills/import-builtin", { method: "POST" });
}

// --- CLI 全局技能（各 CLI 自带的）---

export interface CLIGlobalSkill {
    name: string;
    description: string;
    source: string;        // "codex" / "claude" / "opencode" / "gemini"
    file_path: string;
    content: string;
}

export async function getCLIGlobalSkills(): Promise<{ skills: CLIGlobalSkill[]; count: number }> {
    return apiFetch("/api/skills/cli-global");
}

// ── Memory（Agent 长期记忆）──

export interface MemoryItem {
    id: number;
    agent_id: string;
    content: string;
    category: string;
    source: string;
    conv_id: string;
    created_at: number;
}

export async function listMemories(agentId: string, limit = 20, offset = 0): Promise<{ memories: MemoryItem[]; count: number }> {
    return apiFetch(`/api/agents/${agentId}/memories?limit=${limit}&offset=${offset}`);
}

export async function searchMemories(agentId: string, query: string, topK = 5): Promise<{ memories: MemoryItem[]; count: number }> {
    return apiFetch(`/api/agents/${agentId}/memories/search?q=${encodeURIComponent(query)}&top_k=${topK}`);
}

export async function storeMemory(agentId: string, content: string, category = "fact"): Promise<{ ok: boolean; memory: MemoryItem }> {
    return apiFetch(`/api/agents/${agentId}/memories`, { method: "POST", body: JSON.stringify({ content, category }) });
}

export async function forgetMemory(agentId: string, memoryId: number): Promise<{ ok: boolean }> {
    return apiFetch(`/api/agents/${agentId}/memories/${memoryId}`, { method: "DELETE" });
}

export async function forgetAllMemories(agentId: string): Promise<{ ok: boolean; deleted: number }> {
    return apiFetch(`/api/agents/${agentId}/memories`, { method: "DELETE" });
}

// ── Project API ──

export interface Project {
    id: string;
    name: string;
    description: string;
    repo_path: string;
    teams: string[];
    created_at: number;
    updated_at: number;
}

export async function listProjects(): Promise<{ projects: Project[] }> {
    return apiFetch("/api/projects");
}

export async function getProject(id: string): Promise<Project> {
    return apiFetch(`/api/projects/${id}`);
}

export async function createProject(data: { id: string; name: string; description?: string; repo_path?: string; teams?: string[] }): Promise<{ ok: boolean; project: Project }> {
    return apiFetch("/api/projects", { method: "POST", body: JSON.stringify(data) });
}

export async function updateProject(id: string, data: { name: string; description?: string; repo_path?: string; teams?: string[] }): Promise<{ ok: boolean; project: Project }> {
    return apiFetch(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteProject(id: string): Promise<{ ok: boolean }> {
    return apiFetch(`/api/projects/${id}`, { method: "DELETE" });
}

// ── 通用 Memory API（按 scope） ──

export async function listMemoriesByScope(scope: string, scopeId: string, limit = 50): Promise<{ memories: MemoryItem[]; count: number }> {
    return apiFetch(`/api/memories?scope=${scope}&scope_id=${scopeId}&limit=${limit}`);
}

export async function storeMemoryByScope(scope: string, scopeId: string, content: string, category = "fact"): Promise<{ ok: boolean; memory: MemoryItem }> {
    return apiFetch("/api/memories", { method: "POST", body: JSON.stringify({ scope, scope_id: scopeId, content, category }) });
}

export async function forgetMemoriesByScope(scope: string, scopeId: string): Promise<{ ok: boolean; deleted: number }> {
    return apiFetch(`/api/memories?scope=${scope}&scope_id=${scopeId}`, { method: "DELETE" });
}

export async function deleteMemoryById(memoryId: number): Promise<{ ok: boolean }> {
    return apiFetch(`/api/memories/${memoryId}`, { method: "DELETE" });
}
