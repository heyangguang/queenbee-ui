import { OfficeState } from './engine/officeState'

export interface SubagentInfo {
  toolId: string
  label: string
}

export interface AgentActivity {
  agentId: string
  name: string
  emoji: string
  state: 'idle' | 'working' | 'waiting' | 'offline'
  currentTool?: string
  toolStatus?: string
  lastActive: number
  subagents?: SubagentInfo[]
  /** 正在和哪个 agent 交流（agentId），用于画连线 */
  talkingTo?: string
}

/** Track which subagent toolIds were active last sync, per parent agent */
const prevSubagentKeys = new Map<string, Set<string>>()

/** Track previous agent states to detect offline→working transitions */
const prevAgentStates = new Map<string, string>()

/** 收到任务时的对话 */
const TASK_RECEIVED_SPEECHES = [
  '📋 收到任务了！',
  '💪 马上开始！',
  '✅ 了解，这就去做',
  '🚀 开干！',
  '👨‍💻 收到，开始工作',
  '📝 好的，我来处理',
]

const PALETTE_COUNT = 6

/** 根据 agentId 字符串确定性地生成外观参数（djb2 哈希） */
function agentAppearance(agentId: string): { palette: number; hueShift: number } {
  let hash = 5381
  for (let i = 0; i < agentId.length; i++) {
    hash = ((hash << 5) + hash + agentId.charCodeAt(i)) >>> 0
  }
  const palette = hash % PALETTE_COUNT
  // 用高位再算一个 hueShift（-30 ~ +30 度微调，让同 palette 的人也有细微差别）
  const hueShift = ((hash >>> 8) % 61) - 30
  return { palette, hueShift }
}

export function syncAgentsToOffice(
  activities: AgentActivity[],
  office: OfficeState,
  agentIdMap: Map<string, number>,
  nextIdRef: { current: number },
): void {
  const currentAgentIds = new Set(activities.map(a => a.agentId))

  // Remove agents that are no longer present
  for (const [agentId, charId] of agentIdMap) {
    if (!currentAgentIds.has(agentId)) {
      office.removeAllSubagents(charId)
      office.removeAgent(charId)
      agentIdMap.delete(agentId)
      prevSubagentKeys.delete(agentId)
    }
  }

  // 收集当前交流关系，用于渲染连线
  const commLinks: Array<[number, number]> = []

  for (const activity of activities) {
    if (activity.state === 'offline') {
      if (agentIdMap.has(activity.agentId)) {
        const charId = agentIdMap.get(activity.agentId)!
        office.removeAllSubagents(charId)
        office.removeAgent(charId)
        agentIdMap.delete(activity.agentId)
        prevSubagentKeys.delete(activity.agentId)
      }
      prevAgentStates.set(activity.agentId, 'offline')
      continue
    }

    let charId = agentIdMap.get(activity.agentId)
    if (charId === undefined) {
      charId = nextIdRef.current++
      agentIdMap.set(activity.agentId, charId)
      // 根据 agentId 确定性分配外观
      const { palette, hueShift } = agentAppearance(activity.agentId)
      // Spawn at door if agent was previously offline or is brand new
      const wasOffline = prevAgentStates.get(activity.agentId) === 'offline'
      const isNew = !prevAgentStates.has(activity.agentId)
      office.addAgent(charId, palette, hueShift, undefined, undefined, wasOffline || isNew)
    }

    // Set label (agent name or id)
    const ch = office.characters.get(charId)
    if (ch) {
      ch.label = activity.name || activity.agentId
    }

    // 检测 idle→working 转换，显示"收到任务"气泡
    const prevState = prevAgentStates.get(activity.agentId)

    switch (activity.state) {
      case 'working':
        if (!ch?.isActive) {
          office.setAgentActive(charId, true)
          // 从 idle 或首次进入 working — 显示收到任务的对话
          if (prevState === 'idle' || prevState === undefined || prevState === 'offline') {
            office.showTaskBubble(charId, TASK_RECEIVED_SPEECHES[Math.floor(Math.random() * TASK_RECEIVED_SPEECHES.length)])
          }
        }
        office.setAgentTool(charId, activity.currentTool || null)
        break
      case 'idle':
        if (ch?.isActive) office.setAgentActive(charId, false)
        if (ch?.currentTool) office.setAgentTool(charId, null)
        break
      case 'waiting':
        if (!ch?.isActive) office.setAgentActive(charId, true)
        office.showWaitingBubble(charId)
        break
    }

    // 追踪交流连线
    if (activity.talkingTo && agentIdMap.has(activity.talkingTo)) {
      const targetCharId = agentIdMap.get(activity.talkingTo)!
      commLinks.push([charId, targetCharId])
    }

    // Sync subagents
    const currentSubKeys = new Set<string>()
    if (activity.subagents) {
      for (const sub of activity.subagents) {
        currentSubKeys.add(sub.toolId)
        const existingSubId = office.getSubagentId(charId, sub.toolId)
        if (existingSubId === null) {
          const subId = office.addSubagent(charId, sub.toolId)
          office.setAgentActive(subId, true)
        }
      }
    }

    // Remove subagents that are no longer active
    const prevKeys = prevSubagentKeys.get(activity.agentId)
    if (prevKeys) {
      for (const toolId of prevKeys) {
        if (!currentSubKeys.has(toolId)) {
          office.removeSubagent(charId, toolId)
        }
      }
    }
    prevSubagentKeys.set(activity.agentId, currentSubKeys)
    prevAgentStates.set(activity.agentId, activity.state)
  }

  // 更新交流连线
  office.commLinks = commLinks
}

