import { ref, onBeforeUnmount, nextTick, type Ref } from 'vue'

interface Landmark {
  x: number
  y: number
  z: number
}

/**
 * 手势识别 composable
 * - 按需加载 MediaPipe（dynamic import）
 * - 复用 stream，避免重复 getUserMedia
 * - 跳帧检测（仅新帧才 detectForVideo）
 * - 3 帧防抖
 * - visibilitychange 暂停
 *
 * 支持手势：
 *   palm  — 张开手掌（四指尖到手腕平均距离 > 0.4）
 *   pinch — 拇指食指捏合（指尖距离 < 0.05）
 *   snap  — 打响指   （拇指与中指先捏紧→快速分离，上升沿触发）
 *   middleFinger — 竖中指（中指伸展、其余三指弯曲）→ 激怒桌宠
 *   swipe — 竖食指横扫（食指伸展、其余弯曲，快速水平位移）→ 切主题
 */
export function useHandGesture(
  videoRef: Ref<HTMLVideoElement | null>,
  onPalm: () => void,
  onPinch?: () => void,
  onSnap?: () => void,
  onMiddleFinger?: () => void,
  onSwipe?: (dir: 'left' | 'right') => void,
) {
  const isActive = ref(false)
  const isLoading = ref(false)
  const error = ref('')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handLandmarker: any = null
  let stream: MediaStream | null = null
  let rafId: number | null = null
  let lastVideoTime = -1

  // 各手势防抖计数器
  let palmFrameCount = 0
  let pinchFrameCount = 0
  let middleFrameCount = 0
  let lastPalm = false
  let lastPinch = false
  let lastMiddle = false

  // 打响指状态机：追踪拇指尖(4) ↔ 中指尖(12) 距离
  let snapPinching = false
  // 竖食指横扫状态机：追踪食指尖 x 的水平位移
  let swipeStartX: number | null = null
  let swipeStartT = 0
  let cancelled = false

  async function start() {
    if (isActive.value || isLoading.value) return
    isLoading.value = true
    error.value = ''
    cancelled = false

    try {
      // 1. 摄像头 + 模型并行准备
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      })
      if (cancelled) { stop(); return }

      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision')
      if (cancelled) { stop(); return }
      // wasm 优先本地（public/mediapipe/wasm，避免从 CDN 下载 ~11MB 拖慢加载）；失败退回 CDN
      const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm').catch(() =>
        FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
        ),
      )

      const modelPaths = [
        '/models/hand_landmarker.task',
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      ]
      let lastErr: unknown = null
      for (const modelPath of modelPaths) {
        try {
          handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: modelPath, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numHands: 1,
          })
          break
        } catch (e) {
          lastErr = e
        }
      }
      if (!handLandmarker) throw lastErr

      // 2. 一切就绪后才显示摄像头预览
      if (cancelled) { stop(); return }
      isActive.value = true
      await nextTick()

      if (videoRef.value) {
        videoRef.value.srcObject = stream
        await videoRef.value.play()
      }

      isLoading.value = false
      document.addEventListener('visibilitychange', onVisibilityChange)
      rafId = requestAnimationFrame(detect)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '摄像头启动失败'
      error.value = msg
      isLoading.value = false
      stop()
    }
  }

  /** 打响指：拇指(4)与中指(12)先贴近→快速分离 */
  function detectSnap(landmarks: Landmark[]) {
    if (!onSnap) return
    const thumb = landmarks[4]
    const middle = landmarks[12]
    if (!thumb || !middle) return

    const d = Math.hypot(thumb.x - middle.x, thumb.y - middle.y)
    const isPinching = d < 0.06

    if (snapPinching && !isPinching && d > 0.12) {
      onSnap()
    }
    snapPinching = isPinching
  }

  /** 拇指食指捏合：拇指(4)与食指(8)指尖距离 < 0.05 */
  function isPinching(landmarks: Landmark[]): boolean {
    const thumb = landmarks[4]
    const index = landmarks[8]
    if (!thumb || !index) return false
    return Math.hypot(thumb.x - index.x, thumb.y - index.y) < 0.05
  }

  /** 张开手掌：四指尖到手腕平均距离 > 0.4 */
  function isPalmOpen(landmarks: Landmark[]): boolean {
    const wrist = landmarks[0]
    if (!wrist) return false
    const tips = [landmarks[8], landmarks[12], landmarks[16], landmarks[20]]
    if (tips.some((t) => !t)) return false

    let totalDist = 0
    for (const tip of tips) {
      totalDist += Math.hypot(tip.x - wrist.x, tip.y - wrist.y)
    }
    return totalDist / tips.length > 0.4
  }

  /** 竖中指：中指伸展、其余三指（食指/无名指/小指）弯曲，且中指为最长伸展指 */
  function isMiddleFinger(landmarks: Landmark[]): boolean {
    const wrist = landmarks[0]
    const midTip = landmarks[12]
    const midPip = landmarks[10]
    const idxTip = landmarks[8]
    const idxPip = landmarks[6]
    const ringTip = landmarks[16]
    const ringPip = landmarks[14]
    const pinkyTip = landmarks[20]
    const pinkyPip = landmarks[18]
    if (
      [wrist, midTip, midPip, idxTip, idxPip, ringTip, ringPip, pinkyTip, pinkyPip].some((p) => !p)
    ) {
      return false
    }
    const dw = (p: Landmark) => Math.hypot(p.x - wrist.x, p.y - wrist.y)
    const midExtended = dw(midTip) > dw(midPip) * 1.15 // 中指伸展（指尖比 PIP 明显更远）
    const idxCurled = dw(idxTip) < dw(idxPip) // 食指弯曲（指尖比 PIP 更近手腕）
    const ringCurled = dw(ringTip) < dw(ringPip)
    const pinkyCurled = dw(pinkyTip) < dw(pinkyPip)
    const midLongest =
      dw(midTip) > dw(idxTip) && dw(midTip) > dw(ringTip) && dw(midTip) > dw(pinkyTip)
    return midExtended && idxCurled && ringCurled && pinkyCurled && midLongest
  }

  /** 竖食指：食指伸展、中指/无名指/小指弯曲 */
  function isIndexPointing(landmarks: Landmark[]): boolean {
    const wrist = landmarks[0]
    const idxTip = landmarks[8]
    const idxPip = landmarks[6]
    const midTip = landmarks[12]
    const midPip = landmarks[10]
    const ringTip = landmarks[16]
    const ringPip = landmarks[14]
    const pinkyTip = landmarks[20]
    const pinkyPip = landmarks[18]
    if (
      [wrist, idxTip, idxPip, midTip, midPip, ringTip, ringPip, pinkyTip, pinkyPip].some((p) => !p)
    ) {
      return false
    }
    const dw = (p: Landmark) => Math.hypot(p.x - wrist.x, p.y - wrist.y)
    return (
      dw(idxTip) > dw(idxPip) * 1.15 &&
      dw(midTip) < dw(midPip) &&
      dw(ringTip) < dw(ringPip) &&
      dw(pinkyTip) < dw(pinkyPip)
    )
  }

  /** 竖食指横扫：食指尖 x 在 ~0.7s 内快速水平位移 → 触发方向（非食指指向时重置） */
  function detectSwipe(landmarks: Landmark[]) {
    if (!onSwipe) return
    if (!isIndexPointing(landmarks)) {
      swipeStartX = null
      return
    }
    const tip = landmarks[8]
    if (!tip) return
    const now = performance.now()
    if (swipeStartX === null || now - swipeStartT > 700) {
      swipeStartX = tip.x
      swipeStartT = now
      return
    }
    const dx = tip.x - swipeStartX
    if (Math.abs(dx) > 0.22) {
      // landmarks.x 为摄像头原始坐标（视频镜像显示）；x 减小≈用户视角向右。方向若反了在 HomeView 调换即可
      onSwipe(dx < 0 ? 'right' : 'left')
      swipeStartX = null
    }
  }

  function detect() {
    if (!isActive.value || !handLandmarker || !videoRef.value) return
    const video = videoRef.value
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime
      try {
        const result = handLandmarker.detectForVideo(video, performance.now())
        if (result.landmarks && result.landmarks.length > 0) {
          const landmarks = result.landmarks[0] as Landmark[]

          // 打响指 + 竖食指横扫（独立检测）
          detectSnap(landmarks)
          detectSwipe(landmarks)

          // 张开手掌（3 帧防抖）
          const palm = isPalmOpen(landmarks)
          if (palm) {
            palmFrameCount++
            if (palmFrameCount >= 3 && !lastPalm) {
              lastPalm = true
              onPalm()
            }
          } else {
            palmFrameCount = 0
            lastPalm = false
          }

          // 拇指食指捏合（3 帧防抖，与 palm 互斥：捏合时不触发 palm）
          if (onPinch) {
            const pinch = isPinching(landmarks)
            if (pinch) {
              pinchFrameCount++
              if (pinchFrameCount >= 5 && !lastPinch) {
                lastPinch = true
                onPinch()
              }
            } else {
              pinchFrameCount = 0
              lastPinch = false
            }
          }

          // 竖中指（3 帧防抖）→ 激怒桌宠
          if (onMiddleFinger) {
            const mid = isMiddleFinger(landmarks)
            if (mid) {
              middleFrameCount++
              if (middleFrameCount >= 3 && !lastMiddle) {
                lastMiddle = true
                onMiddleFinger()
              }
            } else {
              middleFrameCount = 0
              lastMiddle = false
            }
          }
        } else {
          palmFrameCount = 0
          pinchFrameCount = 0
          middleFrameCount = 0
          lastPalm = false
          lastPinch = false
          lastMiddle = false
        }
      } catch {
        // detectForVideo 偶尔会抛错（视频未就绪），忽略
      }
    }
    if (isActive.value) {
      rafId = requestAnimationFrame(detect)
    }
  }

  function stop() {
    cancelled = true
    isActive.value = false
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      stream = null
    }
    if (videoRef.value) {
      videoRef.value.srcObject = null
    }
    if (handLandmarker) {
      try {
        handLandmarker.close()
      } catch {
        // ignore
      }
      handLandmarker = null
    }
    document.removeEventListener('visibilitychange', onVisibilityChange)
    palmFrameCount = 0
    pinchFrameCount = 0
    middleFrameCount = 0
    lastPalm = false
    lastPinch = false
    lastMiddle = false
    snapPinching = false
    swipeStartX = null
  }

  function onVisibilityChange() {
    if (document.hidden) {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    } else if (isActive.value) {
      rafId = requestAnimationFrame(detect)
    }
  }
  onBeforeUnmount(() => {
    stop()
  })

  return { isActive, isLoading, error, start, stop }
}
