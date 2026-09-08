export type AppSectionId = 'goals' | 'routines' | 'today' | 'progress' | 'data' | 'review'

export interface AppSection {
  readonly id: AppSectionId
  readonly label: string
  readonly eyebrow: string
  readonly title: string
  readonly description: string
}

export const appSections: readonly AppSection[] = [
  {
    id: 'today',
    label: '今天',
    eyebrow: '轻量开始',
    title: '今天',
    description: '找到一件可以继续的事，记录一点真实行动。'
  },
  {
    id: 'goals',
    label: '目标',
    eyebrow: '保留方向与下一步',
    title: '目标',
    description: '保留方向、下一步与已经积累的记录。'
  },
  {
    id: 'routines',
    label: '例行',
    eyebrow: '按星期形成节奏',
    title: '例行',
    description: '安排重复行动的节奏，记录实际发生的事。'
  },

  {
    id: 'progress',
    label: '进展',
    eyebrow: '只看事实',
    title: '进展',
    description: '查看已记录的投入、理解与困惑。'
  },
  {
    id: 'data',
    label: '数据',
    eyebrow: '历史事实与数据控制',
    title: '数据',
    description: '补记、修正历史记录，管理和导出本地数据。'
  },
  {
    id: 'review',
    label: '复盘',
    eyebrow: '温和复盘',
    title: '复盘',
    description: '回顾近期事实，决定下一次调整。'
  }
]
