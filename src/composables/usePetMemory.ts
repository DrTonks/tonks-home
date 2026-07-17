/**
 * 桌宠记忆系统 — localStorage CRUD + 模板替换引擎。
 *
 * localStorage keys（遵循项目 snake_case 惯例）：
 *   pet_memories          → JSON { [key]: { value, answered_at, question_id } }
 *   pet_rejected_questions → JSON string[]
 *   pet_last_question_at   → ISO timestamp string
 */
import { ref, type Ref } from 'vue'

export interface PetMemoryEntry {
  value: string
  answered_at: string
  question_id: string
}

export type PetMemories = Record<string, PetMemoryEntry>

const LS_MEMORIES = 'pet_memories'
const LS_REJECTED = 'pet_rejected_questions'
const LS_LAST_QUESTION = 'pet_last_question_at'

/** 模块级单例 —— 多个 composable 实例共享同一份响应式数据 */
let _memories: Ref<PetMemories> | null = null
let _rejected: Ref<Set<string>> | null = null
let _lastQuestionAt: Ref<string | null> | null = null
let _initialized = false

function loadMemories(): PetMemories {
  try {
    const raw = localStorage.getItem(LS_MEMORIES)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function loadRejected(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_REJECTED)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function loadLastQuestionAt(): string | null {
  try {
    return localStorage.getItem(LS_LAST_QUESTION) || null
  } catch {
    return null
  }
}

function ensureInit() {
  if (_initialized) return
  _memories = ref(loadMemories())
  _rejected = ref(loadRejected())
  _lastQuestionAt = ref(loadLastQuestionAt())
  _initialized = true
}

export function usePetMemory() {
  ensureInit()
  const memories = _memories!
  const rejectedQuestions = _rejected!
  const lastQuestionAt = _lastQuestionAt!

  // ===== 记忆 CRUD =====

  function getValue(key: string): string | null {
    return memories.value[key]?.value ?? null
  }

  function setValue(key: string, value: string, questionId: string): void {
    memories.value = {
      ...memories.value,
      [key]: { value, answered_at: new Date().toISOString(), question_id: questionId },
    }
    persistMemories()
  }

  function removeValue(key: string): void {
    const next = { ...memories.value }
    delete next[key]
    memories.value = next
    persistMemories()
  }

  function hasMemory(key: string): boolean {
    return key in memories.value && !!memories.value[key]?.value
  }

  function getFilledKeys(): string[] {
    return Object.entries(memories.value)
      .filter(([, v]) => !!v?.value)
      .map(([k]) => k)
  }

  function getAnsweredQuestionIds(): string[] {
    return Object.values(memories.value)
      .filter(v => !!v?.value)
      .map(v => v.question_id)
  }

  // ===== 模板替换 =====

  /** 对句子中的 {{key}} 进行替换；有缺失 key 则返回 null */
  function renderTemplate(sentence: string): string | null {
    const matches = sentence.match(/\{\{(\w+)\}\}/g)
    if (!matches) return sentence // 无模板占位，直接返回
    let result = sentence
    // 先去重 keys，避免同一 key 多次出现时被 replace（只替换首次）漏掉
    const seen = new Set<string>()
    for (const match of matches) {
      const key = match.slice(2, -2)
      if (seen.has(key)) continue
      seen.add(key)
      const val = getValue(key)
      if (val == null || val === '') return null
      // replaceAll 替换该 key 的所有出现
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val)
    }
    return result
  }

  /** 从句子数组中随机选一句可用模板并替换，无可用的返回 null */
  function pickMemoryLine(sentences: string[]): string | null {
    if (!sentences?.length) return null
    // 先过滤出所有模板可填充的句子
    const usable = sentences
      .map(s => renderTemplate(s))
      .filter(Boolean) as string[]
    if (!usable.length) return null
    return usable[Math.floor(Math.random() * usable.length)]
  }

  // ===== 拒绝管理 =====

  function rejectQuestion(questionId: string): void {
    const next = new Set(rejectedQuestions.value)
    next.add(questionId)
    rejectedQuestions.value = next
    persistRejected()
  }

  function isRejected(questionId: string): boolean {
    return rejectedQuestions.value.has(questionId)
  }

  function getRejectedIds(): string[] {
    return [...rejectedQuestions.value]
  }

  /** 取消拒绝（从拒绝列表中移除），通常配合 setValue 使用 */
  function unrejectQuestion(questionId: string): void {
    const next = new Set(rejectedQuestions.value)
    next.delete(questionId)
    rejectedQuestions.value = next
    persistRejected()
  }

  // ===== 提问冷却 =====

  /** 默认冷却 15 分钟 */
  function canAskQuestion(cooldownMinutes = 15): boolean {
    if (!lastQuestionAt.value) return true
    const ts = new Date(lastQuestionAt.value).getTime()
    if (isNaN(ts)) {
      // 损坏的时间戳 → 清除并允许提问
      lastQuestionAt.value = null
      try { localStorage.removeItem(LS_LAST_QUESTION) } catch { /* ignore */ }
      return true
    }
    const elapsed = Date.now() - ts
    return elapsed > cooldownMinutes * 60 * 1000
  }

  function markQuestionAsked(): void {
    const ts = new Date().toISOString()
    lastQuestionAt.value = ts
    try { localStorage.setItem(LS_LAST_QUESTION, ts) } catch { /* ignore */ }
  }

  // ===== 生日管理 =====

  function getBirthday(): string | null {
    return getValue('birthday')
  }

  /** 检查今天是否是用户生日（MM-DD 比对，兼容多种输入格式） */
  function isBirthdayToday(): boolean {
    const bday = getBirthday()
    if (!bday) return false
    // 提取所有数字：兼容 "1990-05-15"、"5月1日"、"5-1"、"05/01" 等
    const nums = bday.match(/\d+/g)
    if (!nums || nums.length < 2) return false
    // 取最后两组数字作为 month 和 day（处理 YYYY-MM-DD 和 MM-DD 格式）
    const month = parseInt(nums.length >= 3 ? nums[nums.length - 2] : nums[0], 10)
    const day = parseInt(nums[nums.length - 1], 10)
    if (month < 1 || month > 12 || day < 1 || day > 31) return false
    const today = new Date()
    return today.getMonth() + 1 === month && today.getDate() === day
  }

  // ===== 全部清除 =====

  /** 清空所有记忆、拒绝记录和冷却计时器（右键菜单"清空记忆"调用） */
  function clearAll(): void {
    memories.value = {}
    rejectedQuestions.value = new Set()
    lastQuestionAt.value = null
    try {
      localStorage.removeItem(LS_MEMORIES)
      localStorage.removeItem(LS_REJECTED)
      localStorage.removeItem(LS_LAST_QUESTION)
    } catch {
      // 静默降级
    }
  }

  // ===== 持久化 =====

  function persistMemories(): void {
    try {
      localStorage.setItem(LS_MEMORIES, JSON.stringify(memories.value))
    } catch {
      // localStorage 满或不可用，静默降级
    }
  }

  function persistRejected(): void {
    try {
      localStorage.setItem(LS_REJECTED, JSON.stringify([...rejectedQuestions.value]))
    } catch {
      // 静默降级
    }
  }

  return {
    memories,
    rejectedQuestions,
    lastQuestionAt,
    getValue,
    setValue,
    removeValue,
    hasMemory,
    getFilledKeys,
    getAnsweredQuestionIds,
    renderTemplate,
    pickMemoryLine,
    rejectQuestion,
    isRejected,
    getRejectedIds,
    unrejectQuestion,
    canAskQuestion,
    markQuestionAsked,
    getBirthday,
    isBirthdayToday,
    clearAll,
  }
}
