export type AdvisorName =
  | 'drucker' | 'jobs' | 'hara-kenya' | 'munger'
  | 'buffett' | 'musk' | 'welch' | 'bezos'
  | 'reality'

export type Stage = '感知期' | '定义期' | '决策期'
export type EmotionWeight = '轻' | '中' | '重'

export interface Advisor {
  name: AdvisorName
  displayName: string
  role: string    // 短标签：卡片副标题，说"他帮你做什么"
  detail: string  // 详细介绍：思维维度、擅长场景
  color: string
  avatar?: string // 头像路径，放入 public/advisors/ 后自动生效
}

export const ADVISORS: Record<AdvisorName, Advisor> = {
  drucker: {
    name: 'drucker', displayName: '德鲁克', color: '#4A5568',
    avatar: '/advisors/drucker.jpg',
    role: '帮你想清楚目的本身',
    detail: '他不在乎你怎么做，只在乎你为什么做。当你陷入执行细节时，他会把你拉回来问：这件事真正的目的是什么？适合任何感觉"越做越偏"、忘了初衷的时刻。',
  },
  jobs: {
    name: 'jobs', displayName: 'Jobs', color: '#1A1A1A',
    avatar: '/advisors/jobs.jpg',
    role: '感受比逻辑先到',
    detail: '他相信感受比逻辑更诚实。不管你的问题是事业还是关系，他会问：如果你是对方，你会有什么感受？这件事做出来，别人会怎么体验它？适合需要跳出自己视角的决策。',
  },
  'hara-kenya': {
    name: 'hara-kenya', displayName: '原研哉', color: '#A0998F',
    avatar: '/advisors/hara-kenya.jpg',
    role: '减到最核心那层',
    detail: '他的工作方法是做减法。当问题变得复杂混乱时，他会帮你剥掉所有次要的东西，只留下那个最核心的矛盾。适合感觉"越想越乱"、需要有人帮你断舍离的时刻。',
  },
  munger: {
    name: 'munger', displayName: '芒格', color: '#6B4C3B',
    avatar: '/advisors/munger.jpg',
    role: '看见你没看见的',
    detail: '他收集人类容易犯的认知错误，然后在对话里帮你找出你正在犯哪一个。他不会只说你想听的。适合需要有人泼冷水、替你检查盲区的时刻。',
  },
  buffett: {
    name: 'buffett', displayName: '巴菲特', color: '#5C6B4F',
    avatar: '/advisors/buffett.jpg',
    role: '值不值你的时间',
    detail: '他只做一件事：判断这件事值不值得。不值得的，他会直接说不——无论理由听起来多充分。适合面临选择时需要有人帮你做取舍、拒绝诱惑的时刻。',
  },
  musk: {
    name: 'musk', displayName: '马斯克', color: '#4A5462',
    avatar: '/advisors/musk.jpg',
    role: '你为什么还没动',
    detail: '他对"还没准备好"没有耐心。当你在等待某个条件成熟时，他会直接问：你到底在等什么？适合感觉自己一直在拖延、需要有人逼你往前走的时刻。',
  },
  welch: {
    name: 'welch', displayName: '韦尔奇', color: '#2B4162',
    avatar: '/advisors/welch.jpg',
    role: '身边的人帮没帮你',
    detail: '他认为大多数问题的根源是人的问题。他会帮你审视：在这件事里，谁在真正支持你，谁在消耗你，谁需要被正视？适合任何涉及关系、团队、合作的决策。',
  },
  bezos: {
    name: 'bezos', displayName: '贝索斯', color: '#8B5E3C',
    avatar: '/advisors/bezos.jpg',
    role: '最坏情况撑得住吗',
    detail: '他发明了"后悔最小化框架"——站在未来回头看，你会后悔没有做这件事吗？同时他会帮你测试：最坏的情况真的来了，你能不能承受？适合需要评估长期代价的决策。',
  },
  reality: {
    name: 'reality', displayName: '现实校准', color: '#374151',
    role: '数据说话，不说废话',
    detail: '不给你安慰，只给你概率。从历史规律、失败案例、现实约束出发，告诉你这个决定真实的胜率、风险点、最坏情况。冷静而精准，是所有顾问里唯一不在乎你感受的那个。',
  },
}

// ─── User Settings ─────────────────────────────────────────────────────────

export type ConcernTag = '财务风险' | '职业发展' | '人际关系' | '家庭' | '健康' | '创业' | '投资' | '时间精力'
export type HistoryRetention = '30d' | '90d' | '1y' | 'forever'
export type AnalysisDepth = 'brief' | 'standard' | 'deep'
export type DefaultAdvisorCount = 3 | 5 | 8

export interface UserSettings {
  // 档案
  name: string
  occupation: string
  concerns: ConcernTag[]
  // 记忆与隐私
  saveHistory: boolean
  advisorsReferenceHistory: boolean
  historyRetention: HistoryRetention
  // 顾问偏好
  defaultAdvisorCount: DefaultAdvisorCount
  pinnedAdvisors: AdvisorName[]
  // 分析方式
  showProbeQuestions: boolean
  analysisDepth: AnalysisDepth
  // 引擎档位（内测用，公开后由付费状态控制）
  engineTier: 'free' | 'pro'
}

export const DEFAULT_SETTINGS: UserSettings = {
  name: '',
  occupation: '',
  concerns: [],
  saveHistory: true,
  advisorsReferenceHistory: true,
  historyRetention: 'forever',
  defaultAdvisorCount: 5,
  pinnedAdvisors: [],
  showProbeQuestions: true,
  analysisDepth: 'standard',
  engineTier: 'free',
}

export function loadSettings(): UserSettings {
  try {
    const stored = localStorage.getItem('user-settings')
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(s: UserSettings) {
  try { localStorage.setItem('user-settings', JSON.stringify(s)) } catch { /* ignore */ }
}

// ─── Diagnosis ─────────────────────────────────────────────────────────────

export interface Diagnosis {
  stage: Stage
  emotion: EmotionWeight
  trapDetected: boolean
  trapDescription?: string
  coreQuestion: string
  seenMoment?: string
  activatedAdvisors: AdvisorName[]
  contextSummary: string[]
  probes: string[]
  probeOptions: string[][]
  urgency?: '高' | '中' | '低' // Issue 15: Urgency dimension
}
