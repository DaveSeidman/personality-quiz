import { useEffect, useRef, useState } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'
const MODEL_ASSET = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const FRAME_INTERVAL_MS = 120
const STATUS_LABELS = {
  idle: 'Standby',
  requesting: 'Camera Request',
  live: 'Live',
  error: 'Error',
}

const average = (...values) => {
  const valid = values.filter((value) => typeof value === 'number' && !Number.isNaN(value))
  if (!valid.length) return 0
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))

const getBlendshapeScore = (blendshapes, name) => {
  const category = blendshapes?.find((entry) => entry.categoryName === name)
  return category?.score ?? 0
}

function computeGazeAlignment(landmarks) {
  const leftFace = landmarks?.[234]
  const rightFace = landmarks?.[454]
  const leftEye = landmarks?.[33]
  const rightEye = landmarks?.[263]
  const noseTip = landmarks?.[1]
  const upperLip = landmarks?.[13]
  const lowerLip = landmarks?.[14]

  if (!leftFace || !rightFace || !leftEye || !rightEye || !noseTip || !upperLip || !lowerLip) {
    return 0.5
  }

  const faceWidth = Math.max(0.001, Math.abs(rightFace.x - leftFace.x))
  const eyeMidY = (leftEye.y + rightEye.y) / 2
  const mouthMidY = (upperLip.y + lowerLip.y) / 2
  const lowerFaceHeight = Math.max(0.001, mouthMidY - eyeMidY)

  const normalizedX = (noseTip.x - leftFace.x) / faceWidth
  const horizontalAlignment = clamp(1 - Math.abs(normalizedX - 0.5) / 0.24)

  const normalizedY = (noseTip.y - eyeMidY) / lowerFaceHeight
  const verticalAlignment = clamp(1 - Math.abs(normalizedY - 0.63) / 0.32)

  return clamp((horizontalAlignment * 0.68) + (verticalAlignment * 0.32))
}

function deriveMood(blendshapes, headTilt, gazeAlignment) {
  const smile = average(
    getBlendshapeScore(blendshapes, 'mouthSmileLeft'),
    getBlendshapeScore(blendshapes, 'mouthSmileRight'),
  )
  const jawOpen = Math.max(
    getBlendshapeScore(blendshapes, 'jawOpen'),
    getBlendshapeScore(blendshapes, 'mouthOpen'),
  )
  const browLift = Math.max(
    getBlendshapeScore(blendshapes, 'browOuterUpLeft'),
    getBlendshapeScore(blendshapes, 'browOuterUpRight'),
    getBlendshapeScore(blendshapes, 'innerBrowUp'),
  )
  const eyeWide = average(
    getBlendshapeScore(blendshapes, 'eyeWideLeft'),
    getBlendshapeScore(blendshapes, 'eyeWideRight'),
  )
  const blink = average(
    getBlendshapeScore(blendshapes, 'eyeBlinkLeft'),
    getBlendshapeScore(blendshapes, 'eyeBlinkRight'),
  )
  const browDown = average(
    getBlendshapeScore(blendshapes, 'browDownLeft'),
    getBlendshapeScore(blendshapes, 'browDownRight'),
  )

  const focus = clamp(0.45 + browDown * 0.42 + (1 - blink) * 0.24 - jawOpen * 0.15 + gazeAlignment * 0.24)
  const energy = clamp(eyeWide * 0.45 + browLift * 0.25 + smile * 0.3)

  let moodLabel = 'Neutral'
  if (smile > 0.52) moodLabel = jawOpen > 0.28 ? 'Delighted' : 'Warm'
  else if (jawOpen > 0.45 && browLift > 0.32) moodLabel = 'Surprised'
  else if (focus > 0.74) moodLabel = 'Focused'
  else if (Math.abs(headTilt) > 14) moodLabel = 'Curious'
  else if (blink > 0.56 && smile < 0.18) moodLabel = 'Pensive'

  return {
    moodLabel,
    metrics: {
      smile: clamp(smile),
      jawOpen: clamp(jawOpen),
      focus,
      energy,
      eyeWide: clamp(eyeWide),
      browLift: clamp(browLift),
      blink: clamp(blink),
      gazeAlignment: clamp(gazeAlignment),
      headTilt,
    },
  }
}

function computeHeadTilt(landmarks) {
  const leftEyeOuter = landmarks?.[33]
  const rightEyeOuter = landmarks?.[263]
  if (!leftEyeOuter || !rightEyeOuter) return 0
  return Math.atan2(rightEyeOuter.y - leftEyeOuter.y, rightEyeOuter.x - leftEyeOuter.x) * (180 / Math.PI)
}

export default function useFaceAnalysis({ active = false } = {}) {
  const videoRef = useRef(null)
  const landmarkerRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const lastVideoTimeRef = useRef(-1)
  const lastEmitAtRef = useRef(0)
  const aliveRef = useRef(true)
  const [faceAnalysis, setFaceAnalysis] = useState({
    status: 'idle',
    statusLabel: STATUS_LABELS.idle,
    error: null,
    hasFace: false,
    moodLabel: 'Neutral',
    landmarks: null,
    metrics: {
      smile: 0,
      jawOpen: 0,
      focus: 0,
      energy: 0,
      gazeAlignment: 0.5,
      headTilt: 0,
    },
  })

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!active) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      lastVideoTimeRef.current = -1

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }

      const video = videoRef.current
      if (video) {
        video.pause()
        video.srcObject = null
      }

      setFaceAnalysis((prev) => ({
        ...prev,
        status: 'idle',
        statusLabel: STATUS_LABELS.idle,
        hasFace: false,
        landmarks: null,
        error: null,
      }))
      return undefined
    }

    let cancelled = false

    const ensureLandmarker = async () => {
      if (landmarkerRef.current) return landmarkerRef.current
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE)
      landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_ASSET,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        outputFaceBlendshapes: true,
        numFaces: 1,
      })
      return landmarkerRef.current
    }

    const loop = async () => {
      const video = videoRef.current
      const landmarker = landmarkerRef.current
      if (!video || !landmarker || cancelled) return

      const now = performance.now()
      if (video.currentTime !== lastVideoTimeRef.current && now - lastEmitAtRef.current >= FRAME_INTERVAL_MS) {
        lastVideoTimeRef.current = video.currentTime
        lastEmitAtRef.current = now

        const result = landmarker.detectForVideo(video, now)
        const landmarks = result.faceLandmarks?.[0] ?? null
        const blendshapes = result.faceBlendshapes?.[0]?.categories ?? []

        if (landmarks) {
          const headTilt = computeHeadTilt(landmarks)
          const gazeAlignment = computeGazeAlignment(landmarks)
          const mood = deriveMood(blendshapes, headTilt, gazeAlignment)

          if (aliveRef.current && !cancelled) {
            setFaceAnalysis((prev) => ({
              ...prev,
              status: 'live',
              statusLabel: STATUS_LABELS.live,
              error: null,
              hasFace: true,
              landmarks,
              moodLabel: mood.moodLabel,
              metrics: mood.metrics,
            }))
          }
        } else if (aliveRef.current && !cancelled) {
          setFaceAnalysis((prev) => ({
            ...prev,
            status: 'live',
            statusLabel: STATUS_LABELS.live,
            hasFace: false,
            landmarks: null,
            moodLabel: 'No Face',
          }))
        }
      }

      if (!cancelled) {
        rafRef.current = requestAnimationFrame(loop)
      }
    }

    const start = async () => {
      try {
        setFaceAnalysis((prev) => ({
          ...prev,
          status: 'requesting',
          statusLabel: STATUS_LABELS.requesting,
          error: null,
        }))

        await ensureLandmarker()

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        const video = videoRef.current
        if (!video) return

        video.srcObject = stream
        await video.play()
        rafRef.current = requestAnimationFrame(loop)
      } catch (error) {
        const message = error?.message || 'Unable to access camera.'
        if (aliveRef.current && !cancelled) {
          setFaceAnalysis((prev) => ({
            ...prev,
            status: 'error',
            statusLabel: STATUS_LABELS.error,
            error: message,
            hasFace: false,
            landmarks: null,
          }))
        }
      }
    }

    start()

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      const video = videoRef.current
      if (video) {
        video.pause()
        video.srcObject = null
      }
    }
  }, [active])

  useEffect(() => () => {
    if (landmarkerRef.current) {
      landmarkerRef.current.close()
      landmarkerRef.current = null
    }
  }, [])

  return {
    videoRef,
    faceAnalysis,
  }
}
