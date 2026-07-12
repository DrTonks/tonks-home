/**
 * LRC 歌词解析 + 当前行匹配。
 * 支持：多时间标签一行、毫秒 1~3 位、[mm:ss.xxx] 或 [mm:ss:xxx]；
 * 合并同时间戳（差 <50ms）的相邻行为双语 texts:[原文, 译文?]；
 * 忽略 [ti:]/[ar:] 等元数据行。
 */
export interface LyricLine {
  time: number // 秒
  texts: string[] // [原文, 译文?]
}

const TIME_TAG = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g

export function parseLRC(raw: string): LyricLine[] {
  if (!raw) return []
  const entries: { time: number; text: string }[] = []

  for (const line of raw.split(/\r?\n/)) {
    TIME_TAG.lastIndex = 0
    const text = line.replace(TIME_TAG, '').trim()
    const tags: number[] = []
    let m: RegExpExecArray | null
    while ((m = TIME_TAG.exec(line)) !== null) {
      const min = parseInt(m[1], 10)
      const sec = parseInt(m[2], 10)
      const ms = m[3] ? parseInt(m[3].padEnd(3, '0'), 10) : 0
      tags.push(min * 60 + sec + ms / 1000)
    }
    if (!tags.length) continue // 无时间标签（元数据/空行）
    for (const t of tags) entries.push({ time: t, text })
  }

  entries.sort((a, b) => a.time - b.time)

  // 合并同时间戳相邻行为双语
  const merged: LyricLine[] = []
  for (const e of entries) {
    const last = merged[merged.length - 1]
    if (last && Math.abs(last.time - e.time) < 0.05) {
      if (e.text) last.texts.push(e.text)
    } else {
      merged.push({ time: e.time, texts: e.text ? [e.text] : [] })
    }
  }
  return merged.filter((l) => l.texts.length > 0)
}

const GAP = 5 // 间奏/尾奏阈值（秒）：当前行展示超过此值且未到下一行 → 空白时段

/**
 * 按播放进度取当前应显示的歌词行；返回 null 表示无歌词时段（前奏/间奏/尾奏），应显示音符。
 */
export function currentLyric(lyrics: LyricLine[], t: number): LyricLine | null {
  if (!lyrics.length) return null
  // 前奏：早于第一句
  if (t < lyrics[0].time) return null

  let idx = 0
  for (let i = 0; i < lyrics.length; i++) {
    if (lyrics[i].time <= t) idx = i
    else break
  }
  const cur = lyrics[idx]
  const next = lyrics[idx + 1]
  const showDur = next ? next.time - cur.time : Infinity

  // 正常换行（间隔小）：显示到下一句
  if (showDur <= GAP) return cur
  // 长间隔（间奏）或最后一句（尾奏）：只展示 GAP 秒，之后切音符
  return t - cur.time < GAP ? cur : null
}
