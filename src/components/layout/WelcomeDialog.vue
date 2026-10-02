<script lang="ts">
// 更新版本号后，已读访客也会看到新版公告。
export const WELCOME_VERSION = '1.3'
export const WELCOME_LS_KEY = 'welcome_shown_version'
</script>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ArrowUpRight, MousePointer2, Radio, Sparkles } from 'lucide-vue-next'
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const open = ref(false)
onMounted(() => {
  try {
    open.value = localStorage.getItem(WELCOME_LS_KEY) !== WELCOME_VERSION
  } catch {
    // 禁用本地存储时仍可阅读和关闭，不阻塞访问。
    open.value = true
  }
})

function onOpenChange(value: boolean) {
  if (value) return
  try { localStorage.setItem(WELCOME_LS_KEY, WELCOME_VERSION) } catch { /* 本次关闭仍有效 */ }
}
</script>

<template>
  <Dialog v-model:open="open" @update:open="onOpenChange">
    <DialogContent class="welcome-note w-[calc(100%-2rem)] max-w-[660px] max-h-[85dvh] overflow-y-auto rounded-2xl p-0 gap-0">
      <header class="note-header">
        <span class="note-register"> 公告 <span>NO. {{ WELCOME_VERSION }}</span></span>
        <div class="note-intro">
          <img class="note-avatar" src="/assets/avatar.jpg" alt="Tonks 的头像" width="64" height="64" />
          <div>
            <p class="note-eyebrow">欢迎来访！</p>
            <DialogTitle class="note-title">很高兴遇见你</DialogTitle>
            <DialogDescription class="sr-only">本站功能、桌宠互动与来访提示。</DialogDescription>
          </div>
        </div>
      </header>

      <div class="note-body">
        <aside class="note-postcard" aria-label="桌宠合影">
          <span class="note-tape" aria-hidden="true"></span>
          <img src="/assets/pet/happy.png" alt="普瑞赛斯向你打招呼" width="130" height="195" />
          <span class="postcard-caption">HELLO, FRIEND.</span>
          <p>请多指教。</p>
        </aside>
        <div class="note-guide">
          <section>
            <Radio aria-hidden="true" />
            <div><h3>我最近在做什么</h3><p>动态会自动更新来自博客的文章与项目，不定时安利最近听过的歌。</p></div>
          </section>
          <section>
            <MousePointer2 aria-hidden="true" />
            <div><h3>和老普打个招呼</h3><p>左键戳一戳，右键打开互动菜单，偶尔能看到她们在回忆和表演才艺～</p></div>
          </section>
          <section>
            <Sparkles aria-hidden="true" />
            <div><h3>小提示</h3><p>可以打开终端、曲库，或在群聊里评论/留言。右下角可启用手势控制。</p></div>
          </section>
        </div>
      </div>

      <div class="note-details">
        <p><b>关于 AI</b>部分桌宠回答由大模型生成，仅供娱乐；可能答错，也可能受额度与频率限制暂时无法回复。</p>
        <p><b>关于天气</b>通过访客 IP 查询当地天气，结果缓存在本地，仅用于天气播报。</p>
      </div>
      <footer class="note-footer">
        <a href="https://blog.tonks.top" target="_blank" rel="noopener noreferrer">逛逛博客 <ArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" /></a>
        <DialogClose as-child><Button class="rounded-full px-6">我知道了</Button></DialogClose>
      </footer>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.welcome-note { background: hsl(var(--background)); color: hsl(var(--foreground)); }
.note-header { padding: 26px 30px 23px; border-bottom: 1px solid hsl(var(--border)); }
.note-register { display: flex; gap: 12px; padding-right: 30px; color: hsl(var(--muted-foreground)); font: 10px/1.5 ui-monospace, monospace; letter-spacing: .15em; }
.note-register span { opacity: .65; }
.note-intro { display: flex; align-items: center; gap: 18px; margin-top: 22px; }
.note-avatar { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 3px solid hsl(var(--background)); box-shadow: 0 0 0 1px hsl(var(--border)); flex-shrink: 0; }
.note-eyebrow { margin-bottom: 8px; color: hsl(var(--color-amber)); font-size: 11px; letter-spacing: .12em; }
.note-title { font-size: 25px; font-weight: 750; line-height: 1.3; letter-spacing: -.035em; }
.note-body { display: grid; grid-template-columns: 142px 1fr; gap: 28px; padding: 28px 30px 24px; align-items: center; }
.note-postcard { position: relative; padding: 12px 10px 14px; text-align: center; transform: rotate(-4deg); background: #f1ecdf; color: #45433c; border: 1px solid #d7d0bd; box-shadow: 5px 6px 0 rgb(0 0 0 / .12); }
.note-tape { position: absolute; width: 52px; height: 17px; top: -9px; left: 45px; transform: rotate(8deg); background: #c9c3b0; opacity: .8; }
.note-postcard img { height: 142px; width: 100%; object-fit: contain; }
.postcard-caption { font: 8px/2 ui-monospace, monospace; letter-spacing: .12em; color: #756e5b; }
.note-postcard p { font-size: 14px; font-weight: 600; margin-top: 4px; }
.note-guide { display: grid; gap: 18px; }
.note-guide section { display: flex; align-items: flex-start; gap: 10px; }
.note-guide svg { width: 16px; height: 16px; margin-top: 2px; color: hsl(var(--color-amber)); flex-shrink: 0; }
.note-guide h3 { font-size: 13px; font-weight: 650; margin-bottom: 5px; }
.note-guide p { font-size: 12px; color: hsl(var(--muted-foreground)); line-height: 1.8; }
.note-details { margin: 0 30px; padding: 15px 0; border-top: 1px dashed hsl(var(--border)); display: grid; gap: 8px; }
.note-details p { font-size: 11px; line-height: 1.75; color: hsl(var(--muted-foreground)); }
.note-details b { color: hsl(var(--foreground)); margin-right: 8px; font-weight: 550; }
.note-footer { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 12px 30px 24px; }
.note-footer a { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: hsl(var(--muted-foreground)); }
.note-footer a:hover { color: hsl(var(--foreground)); }
@media (max-width: 520px) {
  .note-header { padding: 22px 20px 18px; }
  .note-intro { gap: 12px; }
  .note-avatar { width: 46px; height: 46px; }
  .note-title { font-size: 21px; }
  .note-body { grid-template-columns: 90px 1fr; padding: 22px 20px 20px; gap: 18px; }
  .note-postcard { padding: 10px 5px; }
  .note-postcard img { height: 105px; }
  .note-tape { left: 20px; width: 40px; }
  .postcard-caption { font-size: 6px; }
  .note-guide { gap: 14px; }
  .note-guide svg { display: none; }
  .note-details { margin: 0 20px; }
  .note-footer { padding: 12px 20px 22px; gap: 8px; }
}
</style>
