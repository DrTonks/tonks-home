import { ref, onBeforeUnmount, type Ref } from 'vue'

export type GestureType = 'palm' | 'fist' | 'none'

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
 * - 张开手掌判定：四指尖到手腕平均距离 > 0.4
 * - 3 帧防抖（连续 3 帧才触发）
 * - visibilitychange 暂停
 */
export function useHandGesture(
  videoRef: Ref<HTMLVideoElement | null>,
  onPalm: () => void,
) {
  const isActive = ref(false)
  const isLoading = ref(false)
  const error = ref('')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handLandmarker: any = null
  let stream: MediaStream | null = null
  let rafId: number | null = null
  let lastVideoTime = -1
  let palmFrameCount = 0
  let lastGesture: GestureType = 'none'

  async function start() {
    if (isActive.value || isLoading.value) return
    isLoading.value = true
    error.value = ''

    try {
      // 1. 摄像头
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      })
      if (videoRef.value) {
        videoRef.value.srcObject = stream
        await videoRef.value.play()
      }

      // 2. 按需加载 MediaPipe
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

      isActive.value = true
      isLoading.value = false
      rafId = requestAnimationFrame(detect)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '摄像头启动失败'
      error.value = msg
      isLoading.value = false
      stop()
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
          const gesture = detectGesture(result.landmarks[0] as Landmark[])
          // 防抖：连续 3 帧检测到 palm 才触发
          if (gesture === 'palm') {
            palmFrameCount++
            if (palmFrameCount >= 3 && lastGesture !== 'palm') {
              lastGesture = 'palm'
              onPalm()
            }
          } else {
            palmFrameCount = 0
            if (gesture === 'none' || gesture === 'fist') {
              lastGesture = gesture
            }
          }
        } else {
          palmFrameCount = 0
          lastGesture = 'none'
        }
      } catch {
        // detectForVideo 偶尔会抛错（视频未就绪），忽略
      }
    }
    if (isActive.value) {
      rafId = requestAnimationFrame(detect)
    }
  }

  function detectGesture(landmarks: Landmark[]): GestureType {
    // 关键点：0=手腕，4=拇指尖，8=食指尖，12=中指尖，16=无名指尖，20=小指尖
    const wrist = landmarks[0]
    if (!wrist) return 'none'
    const tips = [landmarks[8], landmarks[12], landmarks[16], landmarks[20]]
    if (tips.some((t) => !t)) return 'none'
    // 四指尖到手腕平均距离（归一化坐标）
    let totalDist = 0
    for (const tip of tips) {
      totalDist += Math.hypot(tip.x - wrist.x, tip.y - wrist.y)
    }
    const avgDist = totalDist / tips.length
    if (avgDist > 0.4) return 'palm'
    if (avgDist < 0.25) return 'fist'
    return 'none'
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
    lastGesture = 'none'
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
