import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getAdminSecret, setAdminSecret, clearAdminSecret, verifyAdminSecret } from '@/api'

export const useAdminStore = defineStore('admin', () => {
  const secret = ref<string>(getAdminSecret())

  const isLoggedIn = computed(() => !!secret.value)

  /**
   * 校验密钥，只有后端确认有效时才保存并登录。
   * 返回 true=登录成功 / false=密钥错误；网络等请求异常会向上抛出，交由调用方提示。
   */
  async function login(s: string): Promise<boolean> {
    const ok = await verifyAdminSecret(s)
    if (ok) {
      setAdminSecret(s)
      secret.value = s
    }
    return ok
  }

  function logout() {
    clearAdminSecret()
    secret.value = ''
  }

  return { secret, isLoggedIn, login, logout }
})
