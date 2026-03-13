import React, { useEffect, useRef } from 'react'

const FACE_PATHS = [
  [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10],
  [70, 63, 105, 66, 107],
  [336, 296, 334, 293, 300],
  [33, 160, 158, 133, 153, 144, 33],
  [362, 385, 387, 263, 373, 380, 362],
  [168, 197, 195, 5, 4, 1, 19, 94],
  [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291],
  [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308],
  [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291],
  [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308],
]

const ZOOM_X = 1.36
const ZOOM_Y = 1.42
const CENTER_X = 0.5
const CENTER_Y = 0.46
const FOLLOW_STRENGTH = 0.18
const SETTLE_EPSILON = 0.0008

function toCanvasPoint(point, width, height) {
  const mirroredX = 1 - point.x
  const x = ((mirroredX - CENTER_X) * ZOOM_X + CENTER_X) * width
  const y = ((point.y - CENTER_Y) * ZOOM_Y + CENTER_Y) * height
  return { x, y }
}

function drawPath(ctx, landmarks, indices, width, height, strokeStyle, lineWidth) {
  if (!indices.length) return
  ctx.beginPath()
  indices.forEach((index, pointIndex) => {
    const point = landmarks[index]
    if (!point) return
    const canvasPoint = toCanvasPoint(point, width, height)
    if (pointIndex === 0) {
      ctx.moveTo(canvasPoint.x, canvasPoint.y)
    } else {
      ctx.lineTo(canvasPoint.x, canvasPoint.y)
    }
  })
  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = lineWidth
  ctx.stroke()
}

function drawIdleFrame(ctx, width, height, label) {
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = 'rgba(4, 9, 7, 0.94)'
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
  ctx.lineWidth = 1
  ctx.strokeRect(12, 12, width - 24, height - 24)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.64)'
  ctx.font = '600 18px Montserrat, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(label, width / 2, height / 2)
}

export default function FaceDiagnostics({ faceAnalysis }) {
  const canvasRef = useRef(null)
  const targetLandmarksRef = useRef(null)
  const smoothedLandmarksRef = useRef(null)

  useEffect(() => {
    targetLandmarksRef.current = faceAnalysis?.landmarks ?? null
  }, [faceAnalysis?.landmarks])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    let animationFrameId = null

    const tick = () => {
      const targetLandmarks = targetLandmarksRef.current

      if (!targetLandmarks?.length) {
        smoothedLandmarksRef.current = null
        const label = faceAnalysis?.status === 'error'
          ? 'Camera unavailable'
          : faceAnalysis?.status === 'requesting'
            ? 'Requesting camera access'
            : 'Awaiting face'
        drawIdleFrame(ctx, width, height, label)
        animationFrameId = requestAnimationFrame(tick)
        return
      }

      if (!smoothedLandmarksRef.current || smoothedLandmarksRef.current.length !== targetLandmarks.length) {
        smoothedLandmarksRef.current = targetLandmarks.map((point) => ({ ...point }))
      } else {
        let totalDelta = 0
        smoothedLandmarksRef.current = smoothedLandmarksRef.current.map((point, index) => {
          const targetPoint = targetLandmarks[index]
          const nextPoint = {
            x: point.x + (targetPoint.x - point.x) * FOLLOW_STRENGTH,
            y: point.y + (targetPoint.y - point.y) * FOLLOW_STRENGTH,
            z: point.z + ((targetPoint.z ?? 0) - (point.z ?? 0)) * FOLLOW_STRENGTH,
          }
          totalDelta += Math.abs(targetPoint.x - nextPoint.x) + Math.abs(targetPoint.y - nextPoint.y)
          return nextPoint
        })

        if (totalDelta < SETTLE_EPSILON) {
          smoothedLandmarksRef.current = targetLandmarks.map((point) => ({ ...point }))
        }
      }

      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = 'rgba(4, 9, 7, 0.98)'
      ctx.fillRect(0, 0, width, height)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      FACE_PATHS.forEach((path, index) => {
        drawPath(
          ctx,
          smoothedLandmarksRef.current,
          path,
          width,
          height,
          index === 0 ? 'rgba(255, 255, 255, 0.58)' : 'rgba(255, 255, 255, 0.88)',
          index === 0 ? 1.5 : 1.15,
        )
      })

      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)'
      ctx.font = '600 12px Montserrat, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(faceAnalysis?.moodLabel ?? 'Neutral', 14, height - 16)
      animationFrameId = requestAnimationFrame(tick)
    }

    animationFrameId = requestAnimationFrame(tick)
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
    }
  }, [faceAnalysis?.moodLabel, faceAnalysis?.status])

  const metrics = faceAnalysis?.metrics ?? {}

  return (
    <div className="console-face">
      <div className="console-face-visual">
        <canvas
          ref={canvasRef}
          className="console-face-canvas"
          width={280}
          height={160}
          aria-label="Live face landmark visualization"
        />
      </div>

      <div className="console-face-readout">
        <div className="console-face-readout-grid">
          <div className="console-face-chip">
            <span>Status</span>
            <strong>{faceAnalysis?.statusLabel ?? 'Offline'}</strong>
          </div>
          <div className="console-face-chip">
            <span>Face</span>
            <strong>{faceAnalysis?.hasFace ? 'Tracked' : 'Searching'}</strong>
          </div>
          <div className="console-face-chip">
            <span>Mood</span>
            <strong>{faceAnalysis?.moodLabel ?? 'Neutral'}</strong>
          </div>
          <div className="console-face-chip">
            <span>Tilt</span>
            <strong>{Math.round(metrics.headTilt ?? 0)}deg</strong>
          </div>
        </div>

        <div className="console-face-scales">
          {[
            ['Smile', metrics.smile],
            ['Focus', metrics.focus],
            ['Energy', metrics.energy],
            ['Jaw Open', metrics.jawOpen],
          ].map(([label, value]) => (
            <div key={label} className="console-face-scale">
              <span>{label}</span>
              <div className="console-face-scale-track">
                <div className="console-face-scale-fill" style={{ width: `${Math.round((value ?? 0) * 100)}%` }} />
              </div>
              <strong>{Math.round((value ?? 0) * 100)}%</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
