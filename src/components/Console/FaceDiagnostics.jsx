import React, { useEffect, useRef } from 'react'
import { getCanvasFontFamily } from '../../branding'

const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10]
const LEFT_BROW = [70, 63, 105, 66, 107]
const RIGHT_BROW = [336, 296, 334, 293, 300]
const LEFT_EYE = [33, 160, 158, 133, 153, 144, 33]
const RIGHT_EYE = [362, 385, 387, 263, 373, 380, 362]
const NOSE_BRIDGE = [168, 197, 195, 5, 4, 1, 19, 94]
const UPPER_LIP = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291]
const LOWER_LIP = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308]
const OUTER_MOUTH = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291]

const DISPLAY_WIDTH = 280
const DISPLAY_HEIGHT = 240
const RENDER_WIDTH = 320
const RENDER_HEIGHT = 276
const ZOOM_X = 1.36
const ZOOM_Y = 1.42
const CENTER_X = 0.5
const CENTER_Y = 0.46
const FOLLOW_STRENGTH = 0.18
const SETTLE_EPSILON = 0.0008
const AMBIENT_POINT_COUNT = 74
const AMBIENT_CONNECTION_DISTANCE = 34
const FACE_PARTICLE_TARGET = 60
const PARTICLE_LIFE_MIN_MS = 5000
const PARTICLE_LIFE_MAX_MS = 10000

const IMPORTANT_POINTS = new Set([
  ...FACE_OVAL,
  ...LEFT_BROW,
  ...RIGHT_BROW,
  ...LEFT_EYE,
  ...RIGHT_EYE,
  ...NOSE_BRIDGE,
  ...UPPER_LIP,
  ...LOWER_LIP,
  ...OUTER_MOUTH,
])

function toCanvasPoint(point, width, height) {
  const mirroredX = 1 - point.x
  return {
    x: ((mirroredX - CENTER_X) * ZOOM_X + CENTER_X) * width,
    y: ((point.y - CENTER_Y) * ZOOM_Y + CENTER_Y) * height,
  }
}

function drawIdleFrame(ctx, width, height, label) {
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#050505'
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
  ctx.lineWidth = 1
  ctx.strokeRect(10, 10, width - 20, height - 20)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.64)'
  ctx.font = `600 16px ${getCanvasFontFamily()}`
  ctx.textAlign = 'center'
  ctx.fillText(label, width / 2, height / 2)
}

function easeOutBack(t) {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + (c3 * Math.pow(t - 1, 3)) + (c1 * Math.pow(t - 1, 2))
}

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function lerp(start, end, amount) {
  return start + ((end - start) * amount)
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function presentFrame(sourceCanvas, destinationCtx, width, height, scale = 1) {
  destinationCtx.clearRect(0, 0, width, height)
  const drawWidth = width * scale
  const drawHeight = height * scale
  const offsetX = (width - drawWidth) * 0.5
  const offsetY = (height - drawHeight) * 0.5
  destinationCtx.drawImage(sourceCanvas, offsetX, offsetY, drawWidth, drawHeight)
}

function createAmbientPoints() {
  return Array.from({ length: AMBIENT_POINT_COUNT }, (_, index) => ({
    index,
    baseX: ((Math.sin(index * 12.9898) * 43758.5453) % 1 + 1) % 1,
    baseY: ((Math.sin((index + 17) * 9.4217) * 24634.6345) % 1 + 1) % 1,
    startX: 0,
    startY: 0,
    targetX: 0,
    targetY: 0,
    driftX: 5 + (((index * 17.7) % 9) * 1.1),
    driftY: 4 + (((index * 11.3) % 7) * 1),
    phase: index * 0.73,
    amplitude: 4.4 + ((index % 5) * 1.25),
    opacity: 0.42 + ((index % 6) * 0.045),
    startOpacity: 0,
    targetOpacity: 0,
    bornAt: 0,
    lifeMs: PARTICLE_LIFE_MIN_MS + ((index * 673) % (PARTICLE_LIFE_MAX_MS - PARTICLE_LIFE_MIN_MS)),
    transitionStart: 0,
    transitionMs: 0,
  }))
}

function randomUnit(seed) {
  return ((Math.sin(seed) * 43758.5453) % 1 + 1) % 1
}

function updateAmbientPoints(now, points) {
  points.forEach((point, index) => {
    if (!point.bornAt) {
      point.bornAt = now - ((index * 97) % point.lifeMs)
      point.startX = point.baseX
      point.startY = point.baseY
      point.targetX = point.baseX
      point.targetY = point.baseY
      point.startOpacity = point.opacity
      point.targetOpacity = point.opacity
    }

    if (point.transitionStart) {
      const progress = Math.min(1, (now - point.transitionStart) / point.transitionMs)
      const eased = easeInOutCubic(progress)
      point.baseX = lerp(point.startX, point.targetX, eased)
      point.baseY = lerp(point.startY, point.targetY, eased)
      point.opacity = lerp(point.startOpacity, point.targetOpacity, eased)

      if (progress >= 1) {
        point.transitionStart = 0
        point.baseX = point.targetX
        point.baseY = point.targetY
        point.opacity = point.targetOpacity
      }
    }

    if (now - point.bornAt <= point.lifeMs || point.transitionStart) return

    point.startX = point.baseX
    point.startY = point.baseY
    point.targetX = clamp(
      point.baseX + ((randomUnit(now * 0.001 + index * 1.17) - 0.5) * 0.16),
      0.04,
      0.96,
    )
    point.targetY = clamp(
      point.baseY + ((randomUnit(now * 0.0013 + index * 2.31) - 0.5) * 0.14),
      0.04,
      0.96,
    )
    point.phase = randomUnit(now * 0.0007 + index * 3.91) * Math.PI * 2
    point.amplitude = 4 + randomUnit(now * 0.0009 + index * 4.73) * 4.6
    point.startOpacity = point.opacity
    point.targetOpacity = 0.38 + randomUnit(now * 0.0011 + index * 5.19) * 0.28
    point.transitionStart = now
    point.transitionMs = 2600 + (randomUnit(now * 0.0018 + index * 4.19) * 2200)
    point.lifeMs = PARTICLE_LIFE_MIN_MS + randomUnit(now * 0.0015 + index * 6.11) * (PARTICLE_LIFE_MAX_MS - PARTICLE_LIFE_MIN_MS)
    point.bornAt = now
  })
}

function getParticleLifeMs(seed) {
  return PARTICLE_LIFE_MIN_MS + (randomUnit(seed) * (PARTICLE_LIFE_MAX_MS - PARTICLE_LIFE_MIN_MS))
}

function getFaceCandidatePool(landmarks) {
  return landmarks
    .map((_, index) => index)
    .filter((index) => IMPORTANT_POINTS.has(index) || index % 2 === 0)
}

function pickRandomFaceIndex(now, pool, usedIndices, salt = 0) {
  if (!pool.length) return null

  const available = pool.filter((index) => !usedIndices.has(index))
  const source = available.length ? available : pool
  const pickIndex = Math.floor(randomUnit(now * 0.0017 + salt * 11.37) * source.length)
  return source[pickIndex]
}

function pickNearbyFaceIndex(now, pool, usedIndices, landmarks, width, height, currentX, currentY, salt = 0) {
  const available = pool.filter((index) => !usedIndices.has(index))
  const source = available.length ? available : pool
  if (!source.length) return null

  const ranked = source
    .map((index) => {
      const point = landmarks[index]
      if (!point) return null
      const canvasPoint = toCanvasPoint(point, width, height)
      const distance = Math.hypot(canvasPoint.x - currentX, canvasPoint.y - currentY)
      return { index, distance }
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance)

  const nearbyCount = Math.max(8, Math.min(18, Math.floor(ranked.length * 0.18)))
  const nearby = ranked.slice(0, nearbyCount)
  const pickIndex = Math.floor(randomUnit(now * 0.0017 + salt * 13.11) * nearby.length)
  return nearby[pickIndex]?.index ?? ranked[0]?.index ?? null
}

function buildAmbientParticles(now, width, height, points) {
  return points
    .map((point, index) => {
      return {
        type: 'ambient',
        x: (point.baseX * width) + Math.sin(now * 0.00018 * point.driftX + point.phase) * point.amplitude,
        y: (point.baseY * height) + Math.cos(now * 0.00016 * point.driftY + point.phase) * point.amplitude,
        opacity: point.opacity,
        radius: 0.9 + (Math.max(0, Math.sin(now * 0.0009 + index)) * 0.45),
      }
    })
    .filter(Boolean)
}

function getFaceAmbientLinks(particles, neighborCount = 2) {
  const faceParticles = particles.filter((particle) => particle.type === 'face')
  const ambientParticles = particles.filter((particle) => particle.type === 'ambient')
  const maxDistance = AMBIENT_CONNECTION_DISTANCE * 2.35

  return faceParticles.flatMap((faceParticle) => {
    return ambientParticles
      .map((ambientParticle) => {
        const dx = faceParticle.x - ambientParticle.x
        const dy = faceParticle.y - ambientParticle.y
        const distance = Math.hypot(dx, dy)
        return { faceParticle, ambientParticle, distance }
      })
      .filter((link) => link.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, neighborCount)
  })
}

function updateFaceParticles(now, width, height, landmarks, faceParticlesRef) {
  if (!landmarks?.length) {
    faceParticlesRef.current = []
    return []
  }

  const pool = getFaceCandidatePool(landmarks)
  const nextParticles = [...faceParticlesRef.current]
  const usedIndices = new Set(nextParticles.flatMap((particle) => {
    const indices = [particle.landmarkIndex]
    if (typeof particle.nextLandmarkIndex === 'number') indices.push(particle.nextLandmarkIndex)
    return indices
  }))

  while (nextParticles.length < Math.min(FACE_PARTICLE_TARGET, pool.length)) {
    const landmarkIndex = pickRandomFaceIndex(now, pool, usedIndices, nextParticles.length + now)
    if (landmarkIndex == null) break
    usedIndices.add(landmarkIndex)
    const anchor = toCanvasPoint(landmarks[landmarkIndex], width, height)
    nextParticles.push({
      landmarkIndex,
      nextLandmarkIndex: null,
      transitionStart: 0,
      transitionMs: 0,
      startX: anchor.x,
      startY: anchor.y,
      x: anchor.x,
      y: anchor.y,
      bornAt: now,
      lifeMs: getParticleLifeMs(now + (nextParticles.length * 19.7)),
    })
  }

  nextParticles.forEach((particle, order) => {
    const shouldRetarget = !particle.transitionStart && (now - particle.bornAt > particle.lifeMs)

    if (shouldRetarget) {
      usedIndices.delete(particle.landmarkIndex)
      const nextLandmarkIndex = pickNearbyFaceIndex(
        now,
        pool,
        usedIndices,
        landmarks,
        width,
        height,
        particle.x,
        particle.y,
        order + now,
      )
      if (typeof nextLandmarkIndex === 'number') {
        particle.nextLandmarkIndex = nextLandmarkIndex
        particle.transitionStart = now
        particle.transitionMs = 2600 + (randomUnit(now * 0.0019 + order * 0.73) * 1800)
        particle.startX = particle.x
        particle.startY = particle.y
        usedIndices.add(nextLandmarkIndex)
      } else {
        usedIndices.add(particle.landmarkIndex)
      }
      particle.bornAt = now
      particle.lifeMs = getParticleLifeMs(now + (order * 31.1))
    }

    if (particle.transitionStart && typeof particle.nextLandmarkIndex === 'number') {
      const progress = Math.min(1, (now - particle.transitionStart) / particle.transitionMs)
      const eased = easeInOutCubic(progress)
      const targetPoint = landmarks[particle.nextLandmarkIndex]
      if (targetPoint) {
        const target = toCanvasPoint(targetPoint, width, height)
        particle.x = lerp(particle.startX, target.x, eased)
        particle.y = lerp(particle.startY, target.y, eased)
      }

      if (progress >= 1) {
        particle.landmarkIndex = particle.nextLandmarkIndex
        particle.nextLandmarkIndex = null
        particle.transitionStart = 0
      }
      return
    }

    const point = landmarks[particle.landmarkIndex]
    if (!point) return
    const target = toCanvasPoint(point, width, height)
    particle.x += (target.x - particle.x) * 0.14
    particle.y += (target.y - particle.y) * 0.14
  })

  faceParticlesRef.current = nextParticles

  return nextParticles
    .map((particle, order) => {
      return {
        type: 'face',
        x: particle.x,
        y: particle.y,
        opacity: 0.72,
        radius: 1.25 + (Math.max(0, Math.sin(now * 0.001 + order)) * 0.4),
      }
    })
    .filter(Boolean)
}

function drawParticleField(ctx, now, particles) {
  const faceAmbientLinks = getFaceAmbientLinks(particles, 3)

  faceAmbientLinks.forEach(({ faceParticle, ambientParticle, distance }) => {
    const maxDistance = AMBIENT_CONNECTION_DISTANCE * 2.35
    const alpha = (1 - (distance / maxDistance)) * 0.34 * Math.max(faceParticle.opacity, ambientParticle.opacity)
    ctx.beginPath()
    ctx.moveTo(faceParticle.x, faceParticle.y)
    ctx.lineTo(ambientParticle.x, ambientParticle.y)
    ctx.strokeStyle = `rgba(243, 239, 230, ${alpha})`
    ctx.lineWidth = 0.88
    ctx.stroke()
  })

  for (let i = 0; i < particles.length; i += 1) {
    const a = particles[i]
    for (let j = i + 1; j < particles.length; j += 1) {
      const b = particles[j]
      const dx = a.x - b.x
      const dy = a.y - b.y
      const distance = Math.hypot(dx, dy)
      const isFaceAmbient = a.type !== b.type
      const isFaceFace = a.type === 'face' && b.type === 'face'
      if (isFaceFace) continue
      const maxDistance = isFaceAmbient
        ? AMBIENT_CONNECTION_DISTANCE * 1.7
        : AMBIENT_CONNECTION_DISTANCE
      if (distance > maxDistance) continue

      const alphaBoost = isFaceAmbient ? 0.05 : 0.12
      const alpha = (1 - (distance / maxDistance)) * alphaBoost * Math.max(a.opacity, b.opacity)
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.strokeStyle = `rgba(243, 239, 230, ${alpha})`
      ctx.lineWidth = isFaceAmbient ? 0.34 : 0.52
      ctx.stroke()
    }
  }

  particles.forEach((point) => {
    ctx.beginPath()
    ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(243, 239, 230, ${point.opacity})`
    ctx.fill()
  })
}

function drawFaceParticleDebug(ctx, particles) {
  const faceParticles = particles.filter((particle) => particle.type === 'face')
  const faceAmbientLinks = getFaceAmbientLinks(particles, 3)

  faceAmbientLinks.forEach(({ faceParticle, ambientParticle, distance }) => {
    const maxDistance = AMBIENT_CONNECTION_DISTANCE * 2.35
    const alpha = (1 - (distance / maxDistance)) * 0.42 * Math.max(faceParticle.opacity, ambientParticle.opacity)
    ctx.beginPath()
    ctx.moveTo(faceParticle.x, faceParticle.y)
    ctx.lineTo(ambientParticle.x, ambientParticle.y)
    ctx.strokeStyle = `rgba(243, 239, 230, ${alpha})`
    ctx.lineWidth = 1.1
    ctx.stroke()
  })

  faceParticles.forEach((point) => {
    ctx.beginPath()
    ctx.arc(point.x, point.y, Math.max(2.2, point.radius * 1.8), 0, Math.PI * 2)
    ctx.fillStyle = `rgba(243, 239, 230, ${Math.min(1, point.opacity + 0.28)})`
    ctx.fill()
  })
}

export default function FaceDiagnostics({ faceAnalysis }) {
  const canvasRef = useRef(null)
  const targetLandmarksRef = useRef(null)
  const smoothedLandmarksRef = useRef(null)
  const ambientPointsRef = useRef(createAmbientPoints())
  const faceParticlesRef = useRef([])
  const pulseRef = useRef({
    activeSince: 0,
    duration: 0,
    nextPulseAt: 0,
  })

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

    const getPulseScale = (now) => {
      const pulse = pulseRef.current

      if (!pulse.nextPulseAt) {
        pulse.nextPulseAt = now + 2200 + (randomUnit(now * 0.0011) * 2200)
      }

      if (pulse.duration && now < pulse.activeSince + pulse.duration) {
        const progress = Math.min(1, (now - pulse.activeSince) / pulse.duration)

        if (progress < 0.38) {
          return lerp(1, 1.024, easeOutBack(progress / 0.38))
        }

        return lerp(1.024, 1, easeOutBack((progress - 0.38) / 0.62))
      }

      if (pulse.duration && now >= pulse.activeSince + pulse.duration) {
        pulse.duration = 0
        pulse.nextPulseAt = now + 1800 + (randomUnit(now * 0.0017) * 2600)
        return 1
      }

      if (now >= pulse.nextPulseAt) {
        pulse.activeSince = now
        pulse.duration = 1200 + (randomUnit(now * 0.0019) * 700)
      }

      return 1
    }

    const tick = (now) => {
      const targetLandmarks = targetLandmarksRef.current
      const pulseScale = getPulseScale(now)

      if (!targetLandmarks?.length) {
        smoothedLandmarksRef.current = null
        faceParticlesRef.current = []
        const label = faceAnalysis?.status === 'error'
          ? 'Camera unavailable'
          : faceAnalysis?.status === 'requesting'
            ? 'Requesting camera access'
            : 'Awaiting face'
        drawIdleFrame(sourceCtx, sourceCanvas.width, sourceCanvas.height, label)
        updateAmbientPoints(now, ambientPointsRef.current)
        const ambientParticles = buildAmbientParticles(now, sourceCanvas.width, sourceCanvas.height, ambientPointsRef.current)
        drawParticleField(sourceCtx, now, ambientParticles)
        presentFrame(sourceCanvas, displayCtx, DISPLAY_WIDTH, DISPLAY_HEIGHT, pulseScale)
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

      updateAmbientPoints(now, ambientPointsRef.current)
      sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height)
      sourceCtx.fillStyle = '#050505'
      sourceCtx.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height)
      const ambientParticles = buildAmbientParticles(now, sourceCanvas.width, sourceCanvas.height, ambientPointsRef.current)
      const faceParticles = updateFaceParticles(
        now,
        sourceCanvas.width,
        sourceCanvas.height,
        smoothedLandmarksRef.current,
        faceParticlesRef,
      )
      const particles = [...ambientParticles, ...faceParticles]
      drawParticleField(sourceCtx, now, particles)
      drawFaceParticleDebug(sourceCtx, particles)
      presentFrame(sourceCanvas, displayCtx, DISPLAY_WIDTH, DISPLAY_HEIGHT, pulseScale)
      animationFrameId = requestAnimationFrame(tick)
    }

    animationFrameId = requestAnimationFrame(tick)
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
    }
  }, [faceAnalysis?.status])

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
        <div className="console-face-mood">
          <span>Mood</span>
          <strong>{faceAnalysis?.moodLabel ?? 'Neutral'}</strong>
        </div>
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
