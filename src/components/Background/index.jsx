import React, { useEffect, useMemo, useRef } from 'react'
import './index.scss'

const GRID_COLUMNS = 34
const GRID_ROWS = 64
const FRAME_INTERVAL_MS = 50
const RIPPLE_LIFETIME_MS = 1800
const POINTER_MOVE_INTERVAL_MS = 60
const DEPTH_BUCKETS = 8
const TRACER_STEP_INTERVAL_MS = 140
const TRACER_MAX_STEPS = 42
const TRACER_MIN_COUNT = 1
const TRACER_MAX_COUNT = 6
const TRACER_TARGET_INTERVAL_MS = 6000
const PORTAL_MIN_DURATION_MS = 900
const PORTAL_MAX_DURATION_MS = 1500
const TRACER_MIN_RUN_STEPS = 5
const TRACER_MAX_RUN_STEPS = 11
const TRACER_BURST_STEPS = 3
const TRACER_ENTRY_DELAY_MS = 360

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))

const createGrid = () => (
  Array.from({ length: GRID_COLUMNS * GRID_ROWS }, (_, index) => {
    const column = index % GRID_COLUMNS
    const row = Math.floor(index / GRID_COLUMNS)

    return {
      column,
      row,
      offsetX: 0,
      offsetY: 0,
      depthBias: (Math.cos(index * 0.11) + 1) * 0.08,
      phase: index * 0.031,
    }
  })
)

const neighborOffsets = [
  { column: 1, row: 0 },
  { column: -1, row: 0 },
  { column: 0, row: 1 },
  { column: 0, row: -1 },
]

function randomGridIndex() {
  return Math.floor(Math.random() * GRID_COLUMNS * GRID_ROWS)
}

function randomRunLength() {
  return TRACER_MIN_RUN_STEPS + Math.floor(Math.random() * (TRACER_MAX_RUN_STEPS - TRACER_MIN_RUN_STEPS + 1))
}

function getPerpendicularDirections(direction) {
  return direction < 2 ? [2, 3] : [0, 1]
}

function createPortal(column, row, mode, now) {
  return {
    x: column / Math.max(GRID_COLUMNS - 1, 1),
    y: row / Math.max(GRID_ROWS - 1, 1),
    mode,
    createdAt: now,
    duration: PORTAL_MIN_DURATION_MS + (Math.random() * (PORTAL_MAX_DURATION_MS - PORTAL_MIN_DURATION_MS)),
    ringCount: 3 + (Math.random() > 0.7 ? 1 : 0),
  }
}

function createTracer(now, column = null, row = null) {
  const index = randomGridIndex()
  const initialColumn = column ?? (index % GRID_COLUMNS)
  const initialRow = row ?? Math.floor(index / GRID_COLUMNS)

  return {
    column: initialColumn,
    row: initialRow,
    direction: Math.floor(Math.random() * neighborOffsets.length),
    nextStepAt: now + TRACER_ENTRY_DELAY_MS + (Math.random() * 120),
    stepsRemaining: 14 + Math.floor(Math.random() * TRACER_MAX_STEPS),
    runStepsRemaining: randomRunLength(),
    burstStepsRemaining: 0,
  }
}

function applyTrailImpulse(trailTarget, column, row) {
  const write = (targetColumn, targetRow, strength) => {
    if (targetColumn < 0 || targetColumn >= GRID_COLUMNS || targetRow < 0 || targetRow >= GRID_ROWS) return
    const index = (targetRow * GRID_COLUMNS) + targetColumn
    trailTarget[index] = Math.max(trailTarget[index], strength)
  }

  write(column, row, 1)
  write(column + 1, row, 0.5)
  write(column - 1, row, 0.5)
  write(column, row + 1, 0.5)
  write(column, row - 1, 0.5)
  write(column + 1, row + 1, 0.3)
  write(column - 1, row - 1, 0.3)
  write(column + 1, row - 1, 0.3)
  write(column - 1, row + 1, 0.3)
}

function syncTracerPopulation(tracers, desiredCount, now, portals) {
  while (tracers.length < desiredCount) {
    const tracer = createTracer(now)
    portals.push(createPortal(tracer.column, tracer.row, 'in', now))
    tracers.push(tracer)
  }

  while (tracers.length > desiredCount) {
    tracers.pop()
  }
}

function stepTracer(tracer, now, trailTarget, portals) {
  if (now < tracer.nextStepAt) return

  if (tracer.stepsRemaining <= 0) {
    portals.push(createPortal(tracer.column, tracer.row, 'out', now))
    tracer.finished = true
    return
  }

  tracer.runStepsRemaining -= 1

  if (tracer.runStepsRemaining <= 0) {
    const perpendicularDirections = getPerpendicularDirections(tracer.direction)
    tracer.direction = perpendicularDirections[Math.floor(Math.random() * perpendicularDirections.length)]
    tracer.runStepsRemaining = randomRunLength()
    tracer.burstStepsRemaining = TRACER_BURST_STEPS
  }

  const neighbor = neighborOffsets[tracer.direction]
  const nextColumn = tracer.column + neighbor.column
  const nextRow = tracer.row + neighbor.row

  tracer.column = nextColumn
  tracer.row = nextRow
  tracer.stepsRemaining -= 1
  const burstFactor = tracer.burstStepsRemaining > 0 ? 0.52 : 1
  tracer.nextStepAt = now + (TRACER_STEP_INTERVAL_MS * burstFactor * (0.92 + (Math.random() * 0.3)))
  tracer.burstStepsRemaining = Math.max(0, tracer.burstStepsRemaining - 1)

  if (tracer.column < -2 || tracer.column > GRID_COLUMNS + 1 || tracer.row < -2 || tracer.row > GRID_ROWS + 1) {
    portals.push(createPortal(tracer.column, tracer.row, 'out', now))
    tracer.finished = true
    return
  }

  if (tracer.column >= 0 && tracer.column < GRID_COLUMNS && tracer.row >= 0 && tracer.row < GRID_ROWS) {
    applyTrailImpulse(trailTarget, tracer.column, tracer.row)
  }
}

function computeRippleInfluence(cellX, cellY, ripples, now) {
  let rippleValue = 0
  const aspect = window.innerWidth / Math.max(window.innerHeight, 1)

  for (let index = ripples.length - 1; index >= 0; index -= 1) {
    const ripple = ripples[index]
    const age = now - ripple.createdAt
    if (age >= RIPPLE_LIFETIME_MS) continue

    const life = age / RIPPLE_LIFETIME_MS
    const dxRaw = (cellX - ripple.x) * aspect
    const dyRaw = cellY - ripple.y
    const angle = ripple.angle ?? 0
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const rotatedX = (dxRaw * cos) + (dyRaw * sin)
    const rotatedY = (-dxRaw * sin) + (dyRaw * cos)
    const axisX = ripple.type === 'drag' ? 0.58 : 1
    const axisY = ripple.type === 'drag' ? 1.55 : 1
    const dx = rotatedX / axisX
    const dy = rotatedY / axisY
    const distance = Math.sqrt((dx * dx) + (dy * dy))
    const radius = life * 0.46
    const ring = Math.exp(-Math.pow((distance - radius) / 0.05, 2))
    rippleValue += ring * (1 - life) * ripple.strength
  }

  return clamp(rippleValue, 0, 1.4)
}

export default function Background() {
  const canvasRef = useRef(null)
  const gridRef = useRef(createGrid())
  const ripplesRef = useRef([])
  const tracersRef = useRef([])
  const portalsRef = useRef([])
  const desiredTracerCountRef = useRef(4)
  const trailMapRef = useRef(new Float32Array(GRID_COLUMNS * GRID_ROWS))
  const trailTargetRef = useRef(new Float32Array(GRID_COLUMNS * GRID_ROWS))
  const xPositionsRef = useRef(new Float32Array(GRID_COLUMNS * GRID_ROWS))
  const yPositionsRef = useRef(new Float32Array(GRID_COLUMNS * GRID_ROWS))
  const bucketRef = useRef(new Uint8Array(GRID_COLUMNS * GRID_ROWS))
  const opacitiesRef = useRef(new Float32Array(GRID_COLUMNS * GRID_ROWS))
  const glyphCanvasRef = useRef([])
  const lastFrameAtRef = useRef(0)
  const lastPointerMoveAtRef = useRef(0)
  const lastTracerTargetChangeRef = useRef(0)
  const pointerDownRef = useRef(false)
  const lastPointerPositionRef = useRef(null)
  const glyphSpecs = useMemo(() => (
    Array.from({ length: DEPTH_BUCKETS }, (_, bucket) => {
      const depth = bucket / (DEPTH_BUCKETS - 1)
      return {
        size: 21 + (depth * 9),
        blur: depth < 0.25 ? 1.2 : depth < 0.6 ? 0.45 : 0,
        alpha: 0.46 + (depth * 0.4),
      }
    })
  ), [])

  useEffect(() => {
    const now = performance.now()
    desiredTracerCountRef.current = 3 + Math.round(Math.random())
    syncTracerPopulation(tracersRef.current, desiredTracerCountRef.current, now, portalsRef.current)
  }, [])

  useEffect(() => {
    glyphCanvasRef.current = glyphSpecs.map((spec) => {
      const canvas = document.createElement('canvas')
      const size = Math.ceil(spec.size * 2.5)
      canvas.width = size
      canvas.height = size
      const context = canvas.getContext('2d')
      if (!context) return canvas

      context.clearRect(0, 0, size, size)
      context.filter = spec.blur ? `blur(${spec.blur}px)` : 'none'
      context.fillStyle = `rgba(255, 255, 255, ${spec.alpha})`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.font = `${spec.size}px "Montserrat", sans-serif`
      context.fillText('x', size / 2, size / 2)
      return canvas
    })
  }, [glyphSpecs])

  useEffect(() => {
    const pushRipple = (event, type) => {
      if (type === 'drag' && performance.now() - lastPointerMoveAtRef.current < POINTER_MOVE_INTERVAL_MS) {
        return
      }

      const now = performance.now()
      lastPointerMoveAtRef.current = now
      const x = clamp(event.clientX / window.innerWidth)
      const y = clamp(event.clientY / window.innerHeight)
      const last = lastPointerPositionRef.current
      const angle = last ? Math.atan2(y - last.y, x - last.x) : 0

      ripplesRef.current.push({
        x,
        y,
        angle,
        type,
        createdAt: now,
        strength: type === 'drag' ? 0.55 : 1,
      })

      lastPointerPositionRef.current = { x, y }

      if (ripplesRef.current.length > 18) {
        ripplesRef.current.splice(0, ripplesRef.current.length - 18)
      }
    }

    const handlePointerDown = (event) => {
      pointerDownRef.current = true
      pushRipple(event, 'tap')
    }

    const handlePointerMove = (event) => {
      if (!pointerDownRef.current) return
      pushRipple(event, 'drag')
    }

    const handlePointerEnd = () => {
      pointerDownRef.current = false
      lastPointerPositionRef.current = null
    }

    window.addEventListener('pointerdown', handlePointerDown, { passive: true })
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerup', handlePointerEnd, { passive: true })
    window.addEventListener('pointercancel', handlePointerEnd, { passive: true })

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const context = canvas.getContext('2d')
    if (!context) return undefined

    let animationFrameId = null

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.25)
      canvas.width = Math.floor(window.innerWidth * ratio)
      canvas.height = Math.floor(window.innerHeight * ratio)
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    resize()
    window.addEventListener('resize', resize)

    const render = (now) => {
      if (now - lastFrameAtRef.current < FRAME_INTERVAL_MS) {
        animationFrameId = requestAnimationFrame(render)
        return
      }
      lastFrameAtRef.current = now

      const width = window.innerWidth
      const height = window.innerHeight
      const cellWidth = width / (GRID_COLUMNS - 1)
      const cellHeight = height / (GRID_ROWS - 1)
      const centerX = width / 2
      const centerY = height / 2

      if (now - lastTracerTargetChangeRef.current >= TRACER_TARGET_INTERVAL_MS) {
        desiredTracerCountRef.current = TRACER_MIN_COUNT + Math.floor(Math.random() * (TRACER_MAX_COUNT - TRACER_MIN_COUNT + 1))
        lastTracerTargetChangeRef.current = now
      }

      for (let index = 0; index < trailMapRef.current.length; index += 1) {
        trailTargetRef.current[index] *= 0.9
        const target = trailTargetRef.current[index]
        const current = trailMapRef.current[index]
        const easing = target > current ? 0.42 : 0.08
        trailMapRef.current[index] = current + ((target - current) * easing)
        trailTargetRef.current[index] *= 0.9
      }

      ripplesRef.current = ripplesRef.current.filter((ripple) => now - ripple.createdAt < RIPPLE_LIFETIME_MS)
      portalsRef.current = portalsRef.current.filter((portal) => now - portal.createdAt < portal.duration)
      syncTracerPopulation(tracersRef.current, desiredTracerCountRef.current, now, portalsRef.current)
      tracersRef.current.forEach((tracer) => {
        stepTracer(tracer, now, trailTargetRef.current, portalsRef.current)
      })
      tracersRef.current = tracersRef.current.filter((tracer) => !tracer.finished)

      gridRef.current.forEach((cell, index) => {
        const baseX = cell.column * cellWidth
        const baseY = cell.row * cellHeight
        const xNorm = baseX / width
        const yNorm = baseY / height
        const rippleInfluence = computeRippleInfluence(xNorm, yNorm, ripplesRef.current, now)
        const tracerInfluence = trailMapRef.current[index] ?? 0
        const pulse = (Math.sin(now * 0.0012 + cell.phase) + 1) * 0.5
        const z = clamp(cell.depthBias + (rippleInfluence * 0.82) + (tracerInfluence * 1.05) + (pulse * 0.08), 0, 1.6)
        const depth = z - 0.45
        const perspective = 1 + (depth * 0.035)
        xPositionsRef.current[index] = centerX + (((baseX + (cell.offsetX * cellWidth)) - centerX) * perspective)
        yPositionsRef.current[index] = centerY + (((baseY + (cell.offsetY * cellHeight)) - centerY) * perspective)
        opacitiesRef.current[index] = clamp(0.26 + (rippleInfluence * 0.22) + (tracerInfluence * 0.7) + (z * 0.12), 0.22, 1)
        bucketRef.current[index] = Math.max(0, Math.min(DEPTH_BUCKETS - 1, Math.round((z / 1.6) * (DEPTH_BUCKETS - 1))))
      })

      context.clearRect(0, 0, width, height)
      context.fillStyle = '#000'
      context.fillRect(0, 0, width, height)
      context.textAlign = 'center'
      context.textBaseline = 'middle'

      portalsRef.current.forEach((portal) => {
        const progress = clamp((now - portal.createdAt) / portal.duration)
        const portalX = portal.x * width
        const portalY = portal.y * height
        const ringCount = portal.ringCount

        for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
          const ringOffset = ringIndex / ringCount
          const ringProgress = clamp(progress - (ringOffset * 0.08))
          const radiusProgress = portal.mode === 'in' ? 1 - ringProgress : ringProgress
          const baseRadius = 4 + ((Math.pow(2, ringIndex) - 1) * 14)
          const radius = baseRadius + (radiusProgress * 90)
          const alpha = clamp((1 - ringProgress) * (0.22 - (ringIndex * 0.03)), 0, 0.22)

          context.beginPath()
          context.arc(portalX, portalY, radius, 0, Math.PI * 2)
          context.strokeStyle = `rgba(255, 255, 255, ${alpha})`
          context.lineWidth = 1
          context.stroke()
        }
      })

      const drawLayer = (bucketStart, bucketEnd) => {
        for (let index = 0; index < gridRef.current.length; index += 1) {
          const bucket = bucketRef.current[index]
          if (bucket < bucketStart || bucket > bucketEnd) continue
          const sprite = glyphCanvasRef.current[bucket]
          if (!sprite) continue
          context.globalAlpha = opacitiesRef.current[index]
          context.drawImage(
            sprite,
            xPositionsRef.current[index] - (sprite.width / 2),
            yPositionsRef.current[index] - (sprite.height / 2),
          )
        }
      }

      drawLayer(0, 2)
      drawLayer(3, 5)
      drawLayer(6, DEPTH_BUCKETS - 1)
      context.globalAlpha = 1

      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)

    return () => {
      window.removeEventListener('resize', resize)
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <div className="background-matrix">
      <canvas ref={canvasRef} className="background-matrix-canvas" />
    </div>
  )
}
