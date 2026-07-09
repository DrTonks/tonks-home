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
 */
export function useHandGesture(
  videoRef: Ref<HTMLVideoElement | null>,
  onPalm: () => void,
  onPinch?: () => void,
  onSnap?: () => void,
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
  let lastPalm = false
  let lastPinch = false

  // 打响指状态机：追踪拇指尖(4) ↔ 中指尖(12) 距离
  let snapPinching = false

  async function start() {
    if (isActive.value || isLoading.value) return
    isLoading.value = true
    error.value = ''

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      })

      isActive.value = true
      await nextTick()

      if (videoRef.value) {
        videoRef.value.srcObject = stream
        await videoRef.value.play()
      }

      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision')
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
      )
      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
      })

      isLoading.value = false
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

  function detect() {
    if (!isActive.value || !handLandmarker || !videoRef.value) return
    const video = videoRef.value
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime
      try {
        const result = handLandmarker.detectForVideo(video, performance.now())
        if (result.landmarks && result.landmarks.length > 0) {
          const landmarks = result.landmarks[0] as Landmark[]

          // 打响指（独立检测）
          detectSnap(landmarks)

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
        } else {
          palmFrameCount = 0
          pinchFrameCount = 0
          lastPalm = false
          lastPinch = false
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
    palmFrameCount = 0
    pinchFrameCount = 0
    lastPalm = false
    lastPinch = false
    snapPinching = false
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
  document.addEventListener('visibilitychange', onVisibilityChange)

  onBeforeUnmount(() => {
    stop()
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return { isActive, isLoading, error, start, stop }
}
