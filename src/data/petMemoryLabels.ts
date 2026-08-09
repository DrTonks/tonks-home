export const PET_MEMORY_LABELS: Record<string, string> = {
  user_name: '称呼',
  birthday: '生日',
  favorite_color: '喜欢的颜色',
  favorite_food: '喜欢的食物',
  latest_mood: '最近的心情',
  recent_song: '最近听的歌',
  recent_game: '最近玩的游戏',
  recent_food: '最近吃到的美食',
  recent_book: '最近读的书',
  recent_anime: '最近看的番剧',
  city_life: '最近的城市生活',
}

export function getPetMemoryLabel(key: string): string {
  return PET_MEMORY_LABELS[key] ?? '其他记忆'
}
