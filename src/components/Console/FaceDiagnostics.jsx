import React, { useEffect, useRef } from 'react'

const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10]
const LEFT_BROW = [70, 63, 105, 66, 107]
const RIGHT_BROW = [336, 296, 334, 293, 300]
const LEFT_EYE = [33, 160, 158, 133, 153, 144, 33]
const RIGHT_EYE = [362, 385, 387, 263, 373, 380, 362]
const NOSE = [168, 197, 195, 5, 4, 1, 19, 94]
const UPPER_LIP = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291]
const LOWER_LIP = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308]
const OUTER_MOUTH = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291]
const INNER_MOUTH = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308]

const DISPLAY_WIDTH = 280
const DISPLAY_HEIGHT = 160
const RENDER_WIDTH = 320
const RENDER_HEIGHT = 180
const BLOCK_COLUMNS = 20
const BLOCK_ROWS = 10
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

function applyGlassBlocks(sourceCanvas, destinationCtx, width, height) {
  destinationCtx.clearRect(0, 0, width, height)
  destinationCtx.fillStyle = '#000'
  destinationCtx.fillRect(0, 0, width, height)

  const blockWidth = width / BLOCK_COLUMNS
  const blockHeight = height / BLOCK_ROWS

  for (let row = 0; row < BLOCK_ROWS; row += 1) {
    for (let column = 0; column < BLOCK_COLUMNS; column += 1) {
      const dx = column * blockWidth
      const dy = row * blockHeight
      const offsetX = Math.sin((column + 1) * 0.9) * 2.6
      const offsetY = Math.cos((row + 1) * 0.85) * 1.8
      const sourceX = (dx / width) * sourceCanvas.width + offsetX
      const sourceY = (dy / height) * sourceCanvas.height + offsetY
      const sourceWidth = (blockWidth / width) * sourceCanvas.width * 1.06
      const sourceHeight = (blockHeight / height) * sourceCanvas.height * 1.06

      destinationCtx.drawImage(
        sourceCanvas,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        dx,
        dy,
        blockWidth,
        blockHeight,
      )

      destinationCtx.strokeStyle = 'rgba(255, 255, 255, 0.09)'
      destinationCtx.lineWidth = 1
      destinationCtx.strokeRect(dx + 0.5, dy + 0.5, blockWidth - 1, blockHeight - 1)
    }
  }
}

function renderFace(sourceCtx, landmarks, moodLabel) {
  const { width, height } = sourceCtx.canvas
  sourceCtx.clearRect(0, 0, width, height)
  sourceCtx.fillStyle = '#000'
  sourceCtx.fillRect(0, 0, width, height)

  const noseTip = getFeaturePoint(landmarks, 1, width, height) ?? { x: width / 2, y: height / 2 }
  const leftCheek = getFeaturePoint(landmarks, 234, width, height) ?? { x: width * 0.24, y: height * 0.52 }
  const rightCheek = getFeaturePoint(landmarks, 454, width, height) ?? { x: width * 0.76, y: height * 0.52 }

  tracePath(sourceCtx, landmarks, FACE_OVAL, width, height, true)
  sourceCtx.fillStyle = 'rgba(172, 172, 172, 0.92)'
  sourceCtx.fill()

  tracePath(sourceCtx, landmarks, FACE_OVAL, width, height, true)
  const sideShade = sourceCtx.createLinearGradient(leftCheek.x, noseTip.y, rightCheek.x, noseTip.y)
  sideShade.addColorStop(0, 'rgba(0, 0, 0, 0.22)')
  sideShade.addColorStop(0.22, 'rgba(255, 255, 255, 0.04)')
  sideShade.addColorStop(0.5, 'rgba(255, 255, 255, 0.12)')
  sideShade.addColorStop(0.78, 'rgba(255, 255, 255, 0.04)')
  sideShade.addColorStop(1, 'rgba(0, 0, 0, 0.22)')
  sourceCtx.fillStyle = sideShade
  sourceCtx.fill()

  sourceCtx.save()
  tracePath(sourceCtx, landmarks, FACE_OVAL, width, height, true)
  sourceCtx.clip()

  sourceCtx.fillStyle = 'rgba(255, 255, 255, 0.08)'
  sourceCtx.fillRect(width * 0.24, height * 0.18, width * 0.52, height * 0.56)

  sourceCtx.strokeStyle = 'rgba(255, 255, 255, 0.22)'
  sourceCtx.lineWidth = 8
  tracePath(sourceCtx, landmarks, NOSE, width, height)
  sourceCtx.stroke()

  sourceCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  sourceCtx.lineWidth = 1.1
  ;[LEFT_BROW, RIGHT_BROW, LEFT_EYE, RIGHT_EYE, NOSE, UPPER_LIP, LOWER_LIP, OUTER_MOUTH, INNER_MOUTH].forEach((path) => {
    tracePath(sourceCtx, landmarks, path, width, height)
    sourceCtx.stroke()
  })

  sourceCtx.strokeStyle = 'rgba(255, 255, 255, 0.62)'
  sourceCtx.lineWidth = 1.4
  tracePath(sourceCtx, landmarks, FACE_OVAL, width, height, true)
  sourceCtx.stroke()
  sourceCtx.restore()

  sourceCtx.fillStyle = 'rgba(255, 255, 255, 0.72)'
  sourceCtx.font = '600 12px Montserrat, sans-serif'
  sourceCtx.textAlign = 'left'
  sourceCtx.fillText(moodLabel ?? 'Neutral', 14, height - 14)
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
        applyGlassBlocks(sourceCanvas, displayCtx, DISPLAY_WIDTH, DISPLAY_HEIGHT)
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

      renderFace(sourceCtx, smoothedLandmarksRef.current, faceAnalysis?.moodLabel)
      applyGlassBlocks(sourceCanvas, displayCtx, DISPLAY_WIDTH, DISPLAY_HEIGHT)
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
