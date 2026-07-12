import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  getMusicList,
  uploadMusic,
  deleteMusic,
  reorderMusic,
  getMusicStreamUrl,
  type MusicFile,
} from '@/api/music'

export type ShuffleMode = 'off' | 'on'
export type RepeatMode = 'off' | 'all' | 'one'

export const useMusicStore = defineStore('music', () => {
  const songs = ref<MusicFile[]>([])
  const currentIndex = ref(-1)
  const isPlaying = ref(false)
  const currentTime = ref(0) // 播放进度（秒），由 MusicControls 同步 —— 供 LRC 歌词等复用
  const duration = ref(0)
  const loading = ref(false)
  const shuffleMode = ref<ShuffleMode>('off')
  const repeatMode = ref<RepeatMode>('all')

  const currentSong = computed<MusicFile | null>(() =>
    currentIndex.value >= 0 && currentIndex.value < songs.value.length
      ? songs.value[currentIndex.value]
      : null,
  )

  const isEmpty = computed(() => songs.value.length === 0)

  async function fetchList() {
    loading.value = true
    try {
      const res = await getMusicList()
      if (res.success) {
        const prevFilename = currentSong.value?.filename
        songs.value = res.music
        if (prevFilename && !songs.value.some((s) => s.filename === prevFilename)) {
          currentIndex.value = -1
          isPlaying.value = false
        } else if (prevFilename) {
          currentIndex.value = songs.value.findIndex((s) => s.filename === prevFilename)
        }
        // 首次加载: 选第一首
        if (songs.value.length > 0 && currentIndex.value < 0) {
          currentIndex.value = 0
        }
      }
    } finally {
      loading.value = false
    }
  }

  function play(index: number) {
    if (index < 0 || index >= songs.value.length) return
    currentIndex.value = index
    isPlaying.value = true
  }

  function playSong(song: MusicFile) {
    const idx = songs.value.findIndex((s) => s.filename === song.filename)
    if (idx >= 0) play(idx)
  }

  function togglePlay() {
    if (currentIndex.value < 0 && songs.value.length > 0) {
      play(0)
      return
    }
    isPlaying.value = !isPlaying.value
  }

  function next() {
    if (songs.value.length === 0) return
    if (shuffleMode.value === 'on') {
      if (songs.value.length === 1) {
        currentIndex.value = 0
      } else {
        let idx = Math.floor(Math.random() * songs.value.length)
        if (idx === currentIndex.value) idx = (idx + 1) % songs.value.length
        currentIndex.value = idx
      }
    } else {
      currentIndex.value = (currentIndex.value + 1) % songs.value.length
    }
    isPlaying.value = true
  }

  function prev() {
    if (songs.value.length === 0) return
    currentIndex.value =
      (currentIndex.value - 1 + songs.value.length) % songs.value.length
    isPlaying.value = true
  }

  function toggleShuffle() {
    shuffleMode.value = shuffleMode.value === 'off' ? 'on' : 'off'
  }

  function cycleRepeat() {
    const order: RepeatMode[] = ['off', 'all', 'one']
    const idx = order.indexOf(repeatMode.value)
    repeatMode.value = order[(idx + 1) % order.length]
  }

  function stop() {
    isPlaying.value = false
    currentIndex.value = -1
  }

  // 管理员
  async function upload(file: File, title?: string, artist?: string, lyrics?: File | null) {
    const res = await uploadMusic(file, title, artist, lyrics)
    if (res.success) await fetchList()
    return res
  }

  async function remove(filename: string) {
    const res = await deleteMusic(filename)
    if (res.success) {
      const wasCurrent = currentSong.value?.filename === filename
      const wasPlaying = isPlaying.value
      await fetchList()
      if (wasCurrent) {
        if (songs.value.length === 0) {
          stop()
        } else {
          // 切到下一首（已 fetchList，currentIndex 已更新）
          const newIdx = Math.min(currentIndex.value, songs.value.length - 1)
          currentIndex.value = newIdx
          isPlaying.value = wasPlaying
        }
      }
    }
    return res
  }

  async function reorder(order: string[]) {
    const res = await reorderMusic(order)
    if (res.success) await fetchList() // fetchList 按 filename 保持当前播放曲
    return res
  }

  function getStreamUrl(filename: string) {
    return getMusicStreamUrl(filename)
  }

  return {
    songs,
    currentIndex,
    currentSong,
    isPlaying,
    currentTime,
    duration,
    loading,
    shuffleMode,
    repeatMode,
    isEmpty,
    fetchList,
    play,
    playSong,
    togglePlay,
    next,
    prev,
    toggleShuffle,
    cycleRepeat,
    stop,
    upload,
    remove,
    reorder,
    getStreamUrl,
  }
})
