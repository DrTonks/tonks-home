import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getAdminSecret, setAdminSecret, clearAdminSecret } from '@/api'

export const useAdminStore = defineStore('admin', () => {
  const secret = ref<string>(getAdminSecret())

  const isLoggedIn = computed(() => !!secret.value)

  function login(s: string) {
    setAdminSecret(s)
    secret.value = s
  }

  function logout() {
    clearAdminSecret()
    secret.value = ''
  }

  return { secret, isLoggedIn, login, logout }
})
