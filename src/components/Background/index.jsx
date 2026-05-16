import React, { useEffect, useMemo, useRef } from 'react'
import { getCanvasFontFamily } from '../../branding'
import './index.scss'

const DEFAULT_GRID_COLUMNS = 34
const DEFAULT_GRID_ROWS = 64
const DESHAW_GRID_COLUMNS = 22
const DESHAW_GRID_ROWS = 26
const FRAME_INTERVAL_MS = 50
const DESHAW_FRAME_INTERVAL_MS = 16
const RIPPLE_LIFETIME_MS = 1800
const DESHAW_RIPPLE_LIFETIME_MS = 950
const POINTER_MOVE_INTERVAL_MS = 60
const DESHAW_POINTER_MOVE_INTERVAL_MS = 8
const DEFAULT_DEPTH_BUCKETS = 8
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
const DESHAW_CIRCLE_COLOR = '#2050e0'
const DESHAW_BACKGROUND_COLOR = '#2b2b2b'
const DESHAW_MIN_WIDTH_SCALE = 0.035
const DESHAW_NOISE_TIME_SCALE = 0.00022

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const easeInOutQuint = (value) => (
  value < 0.5
    ? 16 * Math.pow(value, 5)
    : 1 - (Math.pow(-2 * value + 2, 5) / 2)
)
const smoothstep = (edge0, edge1, value) => {
  const normalized = clamp((value - edge0) / Math.max(edge1 - edge0, Number.EPSILON))
  return normalized * normalized * (3 - (2 * normalized))
}

const SIMPLEX_GRAD3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
]

function createSeededPermutation(seed = 1337) {
  const values = Array.from({ length: 256 }, (_, index) => index)
  let state = seed >>> 0

  const nextRandom = () => {
    state = ((state * 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }

  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextRandom() * (index + 1))
    ;[values[index], values[swapIndex]] = [values[swapIndex], values[index]]
  }

  return Array.from({ length: 512 }, (_, index) => values[index & 255])
}

const DESHAW_SIMPLEX_PERM = createSeededPermutation(20502024)

function dot3(gradient, x, y, z) {
  return (gradient[0] * x) + (gradient[1] * y) + (gradient[2] * z)
}

function simplexNoise3D(xin, yin, zin, perm = DESHAW_SIMPLEX_PERM) {
  const F3 = 1 / 3
  const G3 = 1 / 6
  let n0 = 0
  let n1 = 0
  let n2 = 0
  let n3 = 0

  const skew = (xin + yin + zin) * F3
  const i = Math.floor(xin + skew)
  const j = Math.floor(yin + skew)
  const k = Math.floor(zin + skew)
  const unskew = (i + j + k) * G3
  const x0 = xin - (i - unskew)
  const y0 = yin - (j - unskew)
  const z0 = zin - (k - unskew)

  let i1 = 0
  let j1 = 0
  let k1 = 0
  let i2 = 0
  let j2 = 0
  let k2 = 0

  if (x0 >= y0) {
    if (y0 >= z0) {
      i1 = 1; i2 = 1; j2 = 1
    } else if (x0 >= z0) {
      i1 = 1; i2 = 1; k2 = 1
    } else {
      k1 = 1; i2 = 1; k2 = 1
    }
  } else if (y0 < z0) {
    k1 = 1; j2 = 1; k2 = 1
  } else if (x0 < z0) {
    j1 = 1; j2 = 1; k2 = 1
  } else {
    j1 = 1; i2 = 1; j2 = 1
  }

  const x1 = x0 - i1 + G3
  const y1 = y0 - j1 + G3
  const z1 = z0 - k1 + G3
  const x2 = x0 - i2 + (2 * G3)
  const y2 = y0 - j2 + (2 * G3)
  const z2 = z0 - k2 + (2 * G3)
  const x3 = x0 - 1 + (3 * G3)
  const y3 = y0 - 1 + (3 * G3)
  const z3 = z0 - 1 + (3 * G3)

  const ii = i & 255
  const jj = j & 255
  const kk = k & 255
  const gi0 = perm[ii + perm[jj + perm[kk]]] % 12
  const gi1 = perm[ii + i1 + perm[jj + j1 + perm[kk + k1]]] % 12
  const gi2 = perm[ii + i2 + perm[jj + j2 + perm[kk + k2]]] % 12
  const gi3 = perm[ii + 1 + perm[jj + 1 + perm[kk + 1]]] % 12

  let t0 = 0.6 - (x0 * x0) - (y0 * y0) - (z0 * z0)
  if (t0 > 0) {
    t0 *= t0
    n0 = t0 * t0 * dot3(SIMPLEX_GRAD3[gi0], x0, y0, z0)
  }

  let t1 = 0.6 - (x1 * x1) - (y1 * y1) - (z1 * z1)
  if (t1 > 0) {
    t1 *= t1
    n1 = t1 * t1 * dot3(SIMPLEX_GRAD3[gi1], x1, y1, z1)
  }

  let t2 = 0.6 - (x2 * x2) - (y2 * y2) - (z2 * z2)
  if (t2 > 0) {
    t2 *= t2
    n2 = t2 * t2 * dot3(SIMPLEX_GRAD3[gi2], x2, y2, z2)
  }

  let t3 = 0.6 - (x3 * x3) - (y3 * y3) - (z3 * z3)
  if (t3 > 0) {
    t3 *= t3
    n3 = t3 * t3 * dot3(SIMPLEX_GRAD3[gi3], x3, y3, z3)
  }

  return 32 * (n0 + n1 + n2 + n3)
}

function getDeshawNoiseState(xNorm, yNorm, now) {
  const time = now * DESHAW_NOISE_TIME_SCALE
  const primary = simplexNoise3D((xNorm * 3.2) + 0.17, (yNorm * 4.1) - 0.31, time)
  const detail = simplexNoise3D((xNorm * 7.1) + 9.4, (yNorm * 8.3) - 4.6, (time * 1.22) + 2.7) * 0.28
  const drift = simplexNoise3D((xNorm * 1.9) - 3.8, (yNorm * 2.6) + 5.2, (time * 0.72) - 6.4) * 0.16
  const normalizedNoise = clamp((((primary + detail + drift) + 1) / 2), 0, 1)
  return normalizedNoise >= 0.5 ? 1 : 0
}

const createGrid = (gridColumns, gridRows) => (
  Array.from({ length: gridColumns * gridRows }, (_, index) => {
    const column = index % gridColumns
    const row = Math.floor(index / gridColumns)

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

function randomGridIndex(gridColumns, gridRows) {
  return Math.floor(Math.random() * gridColumns * gridRows)
}

function randomRunLength() {
  return TRACER_MIN_RUN_STEPS + Math.floor(Math.random() * (TRACER_MAX_RUN_STEPS - TRACER_MIN_RUN_STEPS + 1))
}

function getPerpendicularDirections(direction) {
  return direction < 2 ? [2, 3] : [0, 1]
}

function createPortal(column, row, mode, now, gridColumns, gridRows) {
  return {
    x: column / Math.max(gridColumns - 1, 1),
    y: row / Math.max(gridRows - 1, 1),
    mode,
    createdAt: now,
    duration: PORTAL_MIN_DURATION_MS + (Math.random() * (PORTAL_MAX_DURATION_MS - PORTAL_MIN_DURATION_MS)),
    ringCount: 3 + (Math.random() > 0.7 ? 1 : 0),
  }
}

function createTracer(now, gridColumns, gridRows, column = null, row = null) {
  const index = randomGridIndex(gridColumns, gridRows)
  const initialColumn = column ?? (index % gridColumns)
  const initialRow = row ?? Math.floor(index / gridColumns)

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

function applyTrailImpulse(trailTarget, column, row, gridColumns, gridRows) {
  const write = (targetColumn, targetRow, strength) => {
    if (targetColumn < 0 || targetColumn >= gridColumns || targetRow < 0 || targetRow >= gridRows) return
    const index = (targetRow * gridColumns) + targetColumn
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

function syncTracerPopulation(tracers, desiredCount, now, portals, gridColumns, gridRows) {
  while (tracers.length < desiredCount) {
    const tracer = createTracer(now, gridColumns, gridRows)
    portals.push(createPortal(tracer.column, tracer.row, 'in', now, gridColumns, gridRows))
    tracers.push(tracer)
  }

  while (tracers.length > desiredCount) {
    tracers.pop()
  }
}

function stepTracer(tracer, now, trailTarget, portals, gridColumns, gridRows) {
  if (now < tracer.nextStepAt) return

  if (tracer.stepsRemaining <= 0) {
    portals.push(createPortal(tracer.column, tracer.row, 'out', now, gridColumns, gridRows))
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

  if (tracer.column < -2 || tracer.column > gridColumns + 1 || tracer.row < -2 || tracer.row > gridRows + 1) {
    portals.push(createPortal(tracer.column, tracer.row, 'out', now, gridColumns, gridRows))
    tracer.finished = true
    return
  }

  if (tracer.column >= 0 && tracer.column < gridColumns && tracer.row >= 0 && tracer.row < gridRows) {
    applyTrailImpulse(trailTarget, tracer.column, tracer.row, gridColumns, gridRows)
  }
}

function computeRippleInfluence(cellX, cellY, ripples, now, rippleLifetimeMs = RIPPLE_LIFETIME_MS) {
  let rippleValue = 0
  const aspect = window.innerWidth / Math.max(window.innerHeight, 1)

  for (let index = ripples.length - 1; index >= 0; index -= 1) {
    const ripple = ripples[index]
    const age = now - ripple.createdAt
    if (age >= rippleLifetimeMs) continue

    const life = age / rippleLifetimeMs
    const dxRaw = (cellX - ripple.x) * aspect
    const dyRaw = cellY - ripple.y
    const angle = ripple.angle ?? 0
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const rotatedX = (dxRaw * cos) + (dyRaw * sin)
    const rotatedY = (-dxRaw * sin) + (dyRaw * cos)
    const isPointerTrail = ripple.type === 'drag' || ripple.type === 'hover'
    const axisX = isPointerTrail ? 0.58 : 1
    const axisY = isPointerTrail ? 1.55 : 1
    const dx = rotatedX / axisX
    const dy = rotatedY / axisY
    const distance = Math.sqrt((dx * dx) + (dy * dy))
    const radius = life * 0.46
    const ring = Math.exp(-Math.pow((distance - radius) / 0.05, 2))
    rippleValue += ring * (1 - life) * ripple.strength
  }

  return clamp(rippleValue, 0, 1.4)
}

export default function Background({ brand }) {
  const isDeshawVariant = brand?.id === 'deshaw'
  const matrixEnabled = brand?.theme?.backgroundMatrix !== false
  const backgroundConfig = useMemo(() => (
    isDeshawVariant
      ? {
        gridColumns: DESHAW_GRID_COLUMNS,
        gridRows: DESHAW_GRID_ROWS,
        depthBuckets: 1,
      }
      : {
        gridColumns: DEFAULT_GRID_COLUMNS,
        gridRows: DEFAULT_GRID_ROWS,
        depthBuckets: DEFAULT_DEPTH_BUCKETS,
      }
  ), [isDeshawVariant])
  const { gridColumns, gridRows, depthBuckets } = backgroundConfig
  const totalCells = gridColumns * gridRows
  const canvasRef = useRef(null)
  const gridRef = useRef(createGrid(gridColumns, gridRows))
  const ripplesRef = useRef([])
  const tracersRef = useRef([])
  const portalsRef = useRef([])
  const desiredTracerCountRef = useRef(4)
  const trailMapRef = useRef(new Float32Array(totalCells))
  const trailTargetRef = useRef(new Float32Array(totalCells))
  const xPositionsRef = useRef(new Float32Array(totalCells))
  const yPositionsRef = useRef(new Float32Array(totalCells))
  const bucketRef = useRef(new Uint8Array(totalCells))
  const opacitiesRef = useRef(new Float32Array(totalCells))
  const widthScaleRef = useRef(new Float32Array(totalCells))
  const glyphCanvasRef = useRef([])
  const lastFrameAtRef = useRef(0)
  const lastPointerMoveAtRef = useRef(0)
  const lastTracerTargetChangeRef = useRef(0)
  const pointerDownRef = useRef(false)
  const lastPointerPositionRef = useRef(null)
  const glyphSpecs = useMemo(() => (
    Array.from({ length: depthBuckets }, (_, bucket) => {
      const depth = depthBuckets > 1 ? bucket / (depthBuckets - 1) : 0
      if (isDeshawVariant) {
        return {
          size: 128,
          blur: 0,
          alpha: 1,
        }
      }

      return {
        size: 21 + (depth * 9),
        blur: depth < 0.25 ? 1.2 : depth < 0.6 ? 0.45 : 0,
        alpha: 0.46 + (depth * 0.4),
      }
    })
  ), [depthBuckets, isDeshawVariant])

  useEffect(() => {
    gridRef.current = createGrid(gridColumns, gridRows)
    trailMapRef.current = new Float32Array(totalCells)
    trailTargetRef.current = new Float32Array(totalCells)
    xPositionsRef.current = new Float32Array(totalCells)
    yPositionsRef.current = new Float32Array(totalCells)
    bucketRef.current = new Uint8Array(totalCells)
    opacitiesRef.current = new Float32Array(totalCells)
    widthScaleRef.current = new Float32Array(totalCells).fill(isDeshawVariant ? 0 : 1)
    ripplesRef.current = []
    tracersRef.current = []
    portalsRef.current = []
    lastFrameAtRef.current = 0
    lastPointerMoveAtRef.current = 0
    lastTracerTargetChangeRef.current = 0
  }, [gridColumns, gridRows, isDeshawVariant, totalCells])

  useEffect(() => {
    if (isDeshawVariant) {
      desiredTracerCountRef.current = 0
      return
    }
    const now = performance.now()
    desiredTracerCountRef.current = 3 + Math.round(Math.random())
    syncTracerPopulation(tracersRef.current, desiredTracerCountRef.current, now, portalsRef.current, gridColumns, gridRows)
  }, [gridColumns, gridRows, isDeshawVariant])

  useEffect(() => {
    if (!matrixEnabled) {
      glyphCanvasRef.current = []
      return undefined
    }

    glyphCanvasRef.current = glyphSpecs.map((spec) => {
      const canvas = document.createElement('canvas')
      const size = Math.ceil(spec.size * 2.5)
      canvas.width = size
      canvas.height = size
      const context = canvas.getContext('2d')
      if (!context) return canvas

      context.clearRect(0, 0, size, size)
      if (isDeshawVariant) {
        context.fillStyle = DESHAW_CIRCLE_COLOR
        context.beginPath()
        context.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2)
        context.fill()
      } else {
        context.filter = spec.blur ? `blur(${spec.blur}px)` : 'none'
        context.fillStyle = `rgba(255, 255, 255, ${spec.alpha})`
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.font = `${spec.size}px ${getCanvasFontFamily()}`
        context.fillText('x', size / 2, size / 2)
      }
      return canvas
    })
  }, [glyphSpecs, isDeshawVariant, matrixEnabled])

  useEffect(() => {
    if (!matrixEnabled) return undefined

    const pushRipple = (event, type) => {
      const pointerMoveIntervalMs = isDeshawVariant ? DESHAW_POINTER_MOVE_INTERVAL_MS : POINTER_MOVE_INTERVAL_MS
      if ((type === 'drag' || type === 'hover') && performance.now() - lastPointerMoveAtRef.current < pointerMoveIntervalMs) {
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
        strength: (
          type === 'tap'
            ? (isDeshawVariant ? 1.2 : 1)
            : type === 'hover'
              ? (isDeshawVariant ? 1.05 : 0.55)
              : (isDeshawVariant ? 1.15 : 0.55)
        ),
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
      if (!pointerDownRef.current && !isDeshawVariant) return
      pushRipple(event, pointerDownRef.current ? 'drag' : 'hover')
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
  }, [isDeshawVariant, matrixEnabled])

  useEffect(() => {
    if (!matrixEnabled) return undefined

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
      const frameIntervalMs = isDeshawVariant ? DESHAW_FRAME_INTERVAL_MS : FRAME_INTERVAL_MS
      if (now - lastFrameAtRef.current < frameIntervalMs) {
        animationFrameId = requestAnimationFrame(render)
        return
      }
      lastFrameAtRef.current = now

      const width = window.innerWidth
      const height = window.innerHeight
      const cellWidth = width / Math.max(gridColumns - 1, 1)
      const cellHeight = height / Math.max(gridRows - 1, 1)
      const centerX = width / 2
      const centerY = height / 2
      const circleDiameter = isDeshawVariant
        ? Math.max(10, Math.min(cellWidth, cellHeight) * 0.58)
        : Math.max(18, Math.min(cellWidth, cellHeight) * 1.04)
      const circleWidth = circleDiameter

      if (!isDeshawVariant) {
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
      }

      const rippleLifetimeMs = isDeshawVariant ? DESHAW_RIPPLE_LIFETIME_MS : RIPPLE_LIFETIME_MS
      ripplesRef.current = ripplesRef.current.filter((ripple) => now - ripple.createdAt < rippleLifetimeMs)
      if (!isDeshawVariant) {
        portalsRef.current = portalsRef.current.filter((portal) => now - portal.createdAt < portal.duration)
        syncTracerPopulation(tracersRef.current, desiredTracerCountRef.current, now, portalsRef.current, gridColumns, gridRows)
        tracersRef.current.forEach((tracer) => {
          stepTracer(tracer, now, trailTargetRef.current, portalsRef.current, gridColumns, gridRows)
        })
        tracersRef.current = tracersRef.current.filter((tracer) => !tracer.finished)
      }

      gridRef.current.forEach((cell, index) => {
        const baseX = cell.column * cellWidth
        const baseY = cell.row * cellHeight
        const xNorm = baseX / width
        const yNorm = baseY / height
        const rippleInfluence = computeRippleInfluence(xNorm, yNorm, ripplesRef.current, now, rippleLifetimeMs)
        const tracerInfluence = trailMapRef.current[index] ?? 0
        if (isDeshawVariant) {
          const baseState = getDeshawNoiseState(xNorm, yNorm, now)
          const rippleFlip = rippleInfluence >= 0.14 ? 1 : 0
          const targetVisibility = rippleFlip ? (1 - baseState) : baseState
          const progress = widthScaleRef.current[index] ?? 0
          const nextProgress = progress + ((targetVisibility - progress) * (targetVisibility > progress ? 0.42 : 0.3))
          xPositionsRef.current[index] = baseX
          yPositionsRef.current[index] = baseY
          widthScaleRef.current[index] = clamp(nextProgress, 0, 1)
          opacitiesRef.current[index] = 1
          bucketRef.current[index] = 0
          return
        }

        const pulse = (Math.sin(now * 0.0012 + cell.phase) + 1) * 0.5
        const z = clamp(cell.depthBias + (rippleInfluence * 0.82) + (tracerInfluence * 1.05) + (pulse * 0.08), 0, 1.6)
        const depth = z - 0.45
        const perspective = 1 + (depth * 0.035)
        xPositionsRef.current[index] = centerX + (((baseX + (cell.offsetX * cellWidth)) - centerX) * perspective)
        yPositionsRef.current[index] = centerY + (((baseY + (cell.offsetY * cellHeight)) - centerY) * perspective)
        opacitiesRef.current[index] = clamp(0.26 + (rippleInfluence * 0.22) + (tracerInfluence * 0.7) + (z * 0.12), 0.22, 1)
        bucketRef.current[index] = Math.max(0, Math.min(depthBuckets - 1, Math.round((z / 1.6) * (depthBuckets - 1))))
      })

      context.clearRect(0, 0, width, height)
      context.fillStyle = isDeshawVariant ? DESHAW_BACKGROUND_COLOR : '#000'
      context.fillRect(0, 0, width, height)
      context.textAlign = 'center'
      context.textBaseline = 'middle'

      if (!isDeshawVariant) {
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
      }

      if (isDeshawVariant) {
        const sprite = glyphCanvasRef.current[0]
        if (sprite) {
          context.globalAlpha = 1
          for (let index = 0; index < gridRef.current.length; index += 1) {
            const widthProgress = easeInOutQuint(widthScaleRef.current[index] ?? 0)
            const drawWidth = Math.max(
              circleWidth * (DESHAW_MIN_WIDTH_SCALE + (widthProgress * (1 - DESHAW_MIN_WIDTH_SCALE))),
              2.5,
            )
            context.drawImage(
              sprite,
              xPositionsRef.current[index] - (drawWidth / 2),
              yPositionsRef.current[index] - (circleDiameter / 2),
              drawWidth,
              circleDiameter,
            )
          }
        }
        context.globalAlpha = 1
        animationFrameId = requestAnimationFrame(render)
        return
      }

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
      drawLayer(6, depthBuckets - 1)
      context.globalAlpha = 1

      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)

    return () => {
      window.removeEventListener('resize', resize)
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
    }
  }, [depthBuckets, gridColumns, gridRows, isDeshawVariant, matrixEnabled])

  return (
    <div className={`background-matrix${isDeshawVariant ? ' background-matrix--deshaw' : ''}`}>
      {matrixEnabled ? (
        <canvas ref={canvasRef} className="background-matrix-canvas" />
      ) : null}
      {brand?.assets?.backgroundImage ? (
        <img
          className="background-matrix-image"
          src={brand.assets.backgroundImage}
          alt=""
          aria-hidden="true"
        />
      ) : null}
      {brand?.assets?.backgroundVideo ? (
        <video
          className="background-matrix-video"
          src={brand.assets.backgroundVideo}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
      ) : null}
    </div>
  )
}
