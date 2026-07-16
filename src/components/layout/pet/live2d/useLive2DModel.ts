/**
 * Live2D 模型加载/管理 composable
 * - 动态加载 Cubism Core 脚本（本地优先 → CDN fallback）
 * - 动态 import PIXI + pixi-live2d-display/cubism4
 * - 创建透明 PIXI.Application → 加载模型 → 启动 idle loop + 自然运动
 * - 暴露 model ref 供 interaction/emotion composable 操作参数
 */
import { ref, type Ref } from 'vue'

/** 容器尺寸（比原桌宠大一圈） */
export const LIVE2D_W = 280
export const LIVE2D_H = 320

let cubismCoreScript: HTMLScriptElement | null = null

export function useLive2DModel(containerRef: Ref<HTMLElement | null>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pixiApp = ref<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = ref<any>(null)
  const loading = ref(false)
  const error = ref('')

  async function loadCubismCore(): Promise<void> {
    if ((window as unknown as Record<string, unknown>).Live2DCubismCore) return

    const urls = [
      '/assets/live2d/live2dcubismcore.min.js',
      'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
    ]

    for (const url of urls) {
      try {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = url
          script.onload = () => {
            cubismCoreScript = script
            resolve()
          }
          script.onerror = () => reject(new Error(`Cubism Core load failed: ${url}`))
          document.head.appendChild(script)
        })
        return
      } catch {
        // try next URL
      }
    }
    throw new Error('无法加载 Cubism Core 运行时，请检查网络连接')
  }

  async function loadModel() {
    if (loading.value) return
    loading.value = true
    error.value = ''

    try {
      await loadCubismCore()

      const [PIXI, cubismModule] = await Promise.all([
        import('pixi.js'),
        import('pixi-live2d-display/cubism4'),
      ])
      const { Live2DModel, MotionPriority } = cubismModule
      console.log('[Live2D] PIXI + Cubism4 modules loaded')

      // 关键：注册 PIXI Ticker，否则模型 motion/物理/眨眼全部不更新
      Live2DModel.registerTicker(PIXI.Ticker)

      const app = new PIXI.Application({
        width: LIVE2D_W,
        height: LIVE2D_H,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })

      if (containerRef.value) {
        containerRef.value.appendChild(app.view as HTMLCanvasElement)
        console.log('[Live2D] Canvas appended, size:', LIVE2D_W, 'x', LIVE2D_H)
      } else {
        throw new Error('Live2D 容器不存在')
      }

      console.log('[Live2D] Loading model from /assets/live2d/ug/ugofficial.model3.json')
      const live2dModel = await Live2DModel.from(
        '/assets/live2d/ug/ugofficial.model3.json',
        { autoInteract: false },
      )

      // 模型坐标系居中 + 缩放到适配容器
      live2dModel.anchor.set(0.5, 0.5)
      live2dModel.scale.set(0.22)
      live2dModel.x = LIVE2D_W / 2
      live2dModel.y = LIVE2D_H / 2

      app.stage.addChild(live2dModel)
      console.log('[Live2D] Model added to stage')

      // 启动 idle loop motion（使用 IDLE 优先级以保证自动循环）
      live2dModel.motion('', 0, MotionPriority.IDLE)

      // 检查核心模型结构
      const im = live2dModel.internalModel
      if (im) {
        console.log('[Live2D] internalModel keys:', Object.keys(im).slice(0, 10))
        if (im.coreModel) {
          const cm = im.coreModel as Record<string, unknown>
          console.log('[Live2D] coreModel has setParameterValueById:', typeof cm.setParameterValueById)
          console.log('[Live2D] coreModel has getParameterValueById:', typeof cm.getParameterValueById)
        }
        if (im.eyeBlink) console.log('[Live2D] eyeBlink supported')
      }

      pixiApp.value = app
      model.value = live2dModel
      loading.value = false
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Live2D 模型加载失败'
      error.value = msg
      loading.value = false
      destroy()
    }
  }

  function destroy() {
    if (cubismCoreScript?.parentNode) {
      cubismCoreScript.parentNode.removeChild(cubismCoreScript)
      cubismCoreScript = null
    }
    try { model.value = null } catch { /* ignore */ }
    try {
      if (pixiApp.value) {
        const view = pixiApp.value.view as HTMLCanvasElement
        if (view?.parentNode) view.parentNode.removeChild(view)
        pixiApp.value.destroy(false, { children: true })
        pixiApp.value = null
      }
    } catch { /* ignore */ }
    loading.value = false
  }

  return { pixiApp, model, loading, error, loadModel, destroy }
}
