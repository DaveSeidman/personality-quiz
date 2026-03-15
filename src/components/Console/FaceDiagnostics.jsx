import React, { useEffect, useRef } from 'react'

const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10]
const LEFT_BROW = [70, 63, 105, 66, 107]
const RIGHT_BROW = [336, 296, 334, 293, 300]
const LEFT_EYE = [33, 160, 158, 133, 153, 144, 33]
const RIGHT_EYE = [362, 385, 387, 263, 373, 380, 362]
const UPPER_LIP = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291]
const LOWER_LIP = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308]
const OUTER_MOUTH = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291]
const INNER_MOUTH = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308]

const DISPLAY_WIDTH = 280
const DISPLAY_HEIGHT = 240
const RENDER_WIDTH = 320
const RENDER_HEIGHT = 276
const PIXEL_WIDTH = 22
const PIXEL_HEIGHT = 19
const ZOOM_X = 1.36
const ZOOM_Y = 1.42
const CENTER_X = 0.5
const CENTER_Y = 0.46
const FOLLOW_STRENGTH = 0.18
const SETTLE_EPSILON = 0.0008

function toCanvasPoint(point, width, height) {
  const mirroredX = 1 - point.x
  return {
    x: ((mirroredX - CENTER_X) * ZOOM_X + CENTER_X) * width,
    y: ((point.y - CENTER_Y) * ZOOM_Y + CENTER_Y) * height,
  }
}

function tracePath(ctx, landmarks, indices, width, height, close = false) {
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
  if (close) ctx.closePath()
}

function getFeaturePoint(landmarks, index, width, height) {
  const point = landmarks[index]
  return point ? toCanvasPoint(point, width, height) : null
}

function drawIdleFrame(ctx, width, height, label) {
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
  ctx.lineWidth = 1
  ctx.strokeRect(10, 10, width - 20, height - 20)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.64)'
  ctx.font = '600 16px Montserrat, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(label, width / 2, height / 2)
}

function presentFrame(sourceCanvas, pixelCanvas, destinationCtx, width, height) {
  const pixelCtx = pixelCanvas.getContext('2d')
  if (!pixelCtx) return

  pixelCtx.clearRect(0, 0, pixelCanvas.width, pixelCanvas.height)
  pixelCtx.filter = 'blur(1.8px)'
  pixelCtx.drawImage(sourceCanvas, 0, 0, pixelCanvas.width, pixelCanvas.height)
  pixelCtx.filter = 'none'

  destinationCtx.clearRect(0, 0, width, height)
  destinationCtx.fillStyle = '#181818'
  destinationCtx.fillRect(0, 0, width, height)

  const cellWidth = width / pixelCanvas.width
  const cellHeight = height / pixelCanvas.height
  const gap = Math.max(1.2, Math.min(cellWidth, cellHeight) * 0.18)
  const imageData = pixelCtx.getImageData(0, 0, pixelCanvas.width, pixelCanvas.height)
  const { data } = imageData

  for (let y = 0; y < pixelCanvas.height; y += 1) {
    for (let x = 0; x < pixelCanvas.width; x += 1) {
      const index = (y * pixelCanvas.width + x) * 4
      const alpha = data[index + 3] / 255
      if (alpha <= 0) continue

      const red = data[index]
      const green = data[index + 1]
      const blue = data[index + 2]
      const drawX = x * cellWidth + gap
      const drawY = y * cellHeight + gap
      const drawWidth = Math.max(0, cellWidth - (gap * 2))
      const drawHeight = Math.max(0, cellHeight - (gap * 2))
      const radius = Math.min(drawWidth, drawHeight) * 0.22

      destinationCtx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`
      destinationCtx.beginPath()
      destinationCtx.roundRect(drawX, drawY, drawWidth, drawHeight, radius)
      destinationCtx.fill()
    }
  }
}

function renderFace(sourceCtx, landmarks) {
  const { width, height } = sourceCtx.canvas
  sourceCtx.clearRect(0, 0, width, height)
  sourceCtx.fillStyle = '#000'
  sourceCtx.fillRect(0, 0, width, height)

  tracePath(sourceCtx, landmarks, FACE_OVAL, width, height, true)
  const faceGradient = sourceCtx.createLinearGradient(0, height * 0.18, 0, height * 0.9)
  faceGradient.addColorStop(0, 'rgba(242, 242, 242, 0.98)')
  faceGradient.addColorStop(1, 'rgba(188, 188, 188, 0.94)')
  sourceCtx.fillStyle = faceGradient
  sourceCtx.fill()

  const faceHighlight = sourceCtx.createRadialGradient(
    width * 0.5,
    height * 0.38,
    width * 0.06,
    width * 0.5,
    height * 0.44,
    width * 0.34,
  )
  faceHighlight.addColorStop(0, 'rgba(255, 255, 255, 0.28)')
  faceHighlight.addColorStop(0.45, 'rgba(255, 255, 255, 0.12)')
  faceHighlight.addColorStop(1, 'rgba(255, 255, 255, 0)')
  tracePath(sourceCtx, landmarks, FACE_OVAL, width, height, true)
  sourceCtx.fillStyle = faceHighlight
  sourceCtx.fill()

  const lowerShade = sourceCtx.createRadialGradient(
    width * 0.5,
    height * 0.78,
    width * 0.08,
    width * 0.5,
    height * 0.82,
    width * 0.28,
  )
  lowerShade.addColorStop(0, 'rgba(0, 0, 0, 0.16)')
  lowerShade.addColorStop(1, 'rgba(0, 0, 0, 0)')
  tracePath(sourceCtx, landmarks, FACE_OVAL, width, height, true)
  sourceCtx.fillStyle = lowerShade
  sourceCtx.fill()

  const edgeVignette = sourceCtx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    width * 0.18,
    width * 0.5,
    height * 0.5,
    width * 0.52,
  )
  edgeVignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
  edgeVignette.addColorStop(0.72, 'rgba(0, 0, 0, 0.05)')
  edgeVignette.addColorStop(1, 'rgba(0, 0, 0, 0.24)')
  tracePath(sourceCtx, landmarks, FACE_OVAL, width, height, true)
  sourceCtx.fillStyle = edgeVignette
  sourceCtx.fill()

  sourceCtx.save()
  tracePath(sourceCtx, landmarks, FACE_OVAL, width, height, true)
  sourceCtx.clip()

  sourceCtx.globalCompositeOperation = 'destination-out'
  ;[LEFT_EYE, RIGHT_EYE, OUTER_MOUTH, INNER_MOUTH, UPPER_LIP].forEach((path) => {
    tracePath(sourceCtx, landmarks, path, width, height, true)
    sourceCtx.fill()
    sourceCtx.lineWidth = 6.8
    sourceCtx.lineJoin = 'round'
    sourceCtx.lineCap = 'round'
    sourceCtx.stroke()
  })
  sourceCtx.restore()

  sourceCtx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
  sourceCtx.lineWidth = 1.1
  ;[LEFT_BROW, RIGHT_BROW].forEach((path) => {
    tracePath(sourceCtx, landmarks, path, width, height)
    sourceCtx.stroke()
  })

  sourceCtx.strokeStyle = 'rgba(255, 255, 255, 0.62)'
  sourceCtx.lineWidth = 1.4
  tracePath(sourceCtx, landmarks, FACE_OVAL, width, height, true)
  sourceCtx.stroke()

  sourceCtx.strokeStyle = 'rgba(0, 0, 0, 0.9)'
  sourceCtx.lineWidth = 2.4
  ;[LEFT_EYE, RIGHT_EYE, UPPER_LIP, LOWER_LIP].forEach((path) => {
    tracePath(sourceCtx, landmarks, path, width, height)
    sourceCtx.stroke()
  })

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
    if (!canvas) return undefined

    const displayCtx = canvas.getContext('2d')
    if (!displayCtx) return undefined

    const sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = RENDER_WIDTH
    sourceCanvas.height = RENDER_HEIGHT
    const sourceCtx = sourceCanvas.getContext('2d')
    if (!sourceCtx) return undefined

    const pixelCanvas = document.createElement('canvas')
    pixelCanvas.width = PIXEL_WIDTH
    pixelCanvas.height = PIXEL_HEIGHT

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
        drawIdleFrame(sourceCtx, sourceCanvas.width, sourceCanvas.height, label)
        presentFrame(sourceCanvas, pixelCanvas, displayCtx, DISPLAY_WIDTH, DISPLAY_HEIGHT)
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

      renderFace(sourceCtx, smoothedLandmarksRef.current)
      presentFrame(sourceCanvas, pixelCanvas, displayCtx, DISPLAY_WIDTH, DISPLAY_HEIGHT)
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
      <div className="console-face-mood">
        <span>Mood</span>
        <strong>{faceAnalysis?.moodLabel ?? 'Neutral'}</strong>
      </div>

      <div className="console-face-visual">
        <canvas
          ref={canvasRef}
          className="console-face-canvas"
          width={DISPLAY_WIDTH}
          height={DISPLAY_HEIGHT}
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
            <span>Tilt</span>
            <strong>{Math.round(metrics.headTilt ?? 0)}deg</strong>
          </div>
        </div>

        <div className="console-face-scales">
          {[
            ['Smile', metrics.smile],
            ['Focus', metrics.focus],
            ['Energy', metrics.energy],
            ['Gaze', metrics.gazeAlignment],
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
