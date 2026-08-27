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
    id: 'goals',
    label: 'Goals',
    eyebrow: '保留方向与下一步',
    title: '目标可以停下，也可以从一个小步骤继续',
    description: '创建一个目标和可直接开始的下一步；暂停或结束时，已有上下文与历史仍会保留。'
  },
  {
    id: 'routines',
    label: 'Routines',
    eyebrow: '按星期形成节奏',
    title: '让重复行动有清晰、可调整的节奏',
    description: '用星期安排例行事项；暂停、恢复或结束都保留历史，结束后不再恢复。'
  },
  {
    id: 'today',
    label: 'Today',
    eyebrow: '轻量开始',
    title: '今天，从一个真实动作开始',
    description: '这里显示你明确选入的行动，以及今天匹配的活跃 Routine；不会预生成记录或搬运历史。'
  },
  {
    id: 'progress',
    label: 'Progress',
    eyebrow: '只看事实',
    title: '进展会来自已经记录的事实',
    description: '查看已经记录的投入、行动次数、确认理解和开放困惑；不会推断得分、掌握度或失败。'
  },
  {
    id: 'data',
    label: 'Data',
    eyebrow: '历史事实与数据控制',
    title: '修正事实，并在删除前看清影响',
    description: '补记或修改历史记录；永久删除会先生成一次性影响预览，再由你明确确认。'
  },
  {
    id: 'review',
    label: 'Review',
    eyebrow: '温和复盘',
    title: '复盘将帮助你选择下一次调整',
    description: '后续切片会复用已有事实形成周期摘要；当前不会要求配置 AI。'
  }
]
