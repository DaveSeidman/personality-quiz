import React, { useEffect, useMemo, useState } from 'react'
import { renderSuperscriptMarks, triggerActivePress } from '../../utils'
import './index.scss'
import {
  clamp,
  buildPersonalityColorMap,
  buildQuestionCards,
  buildRadarData,
  getPersonalityLegend,
  toAlphaColor,
} from '../behavioralAnalytics'

function getDominantColor(vector = {}, colorMap = {}, alpha = 0.92) {
  const dominantId = Object.entries(vector)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]?.[0]

  return dominantId ? toAlphaColor(colorMap[dominantId], alpha) : `rgba(255, 255, 255, ${alpha})`
}

const QUESTION_POLYGON_STYLES = [
  { dash: [], fillAlpha: 0.18, strokeAlpha: 0.9 },
  { dash: [8, 5], fillAlpha: 0.15, strokeAlpha: 0.82 },
  { dash: [3, 5], fillAlpha: 0.13, strokeAlpha: 0.76 },
  { dash: [14, 5, 3, 5], fillAlpha: 0.11, strokeAlpha: 0.7 },
]

function RadarCanvas({ composite, byQuestion, legend, colorMap, showData = true }) {
  const [canvasId] = useState(() => `radar-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    if (!legend?.length) return

    const canvas = document.getElementById(canvasId)
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    const cx = width / 2
    const isTriangleRadar = legend.length === 3
    const cy = isTriangleRadar ? height * 0.56 : height / 2
    const radius = Math.min(width, height) * (isTriangleRadar ? 0.4 : 0.37)
    const isLightMode = getComputedStyle(canvas).getPropertyValue('--quiz-mode').trim() === 'light'
    const radarInk = isLightMode ? '5,5,5' : '255,255,255'

    const axes = legend.map((entry, index) => ({
      ...entry,
      angle: (-Math.PI / 2) + ((index / legend.length) * Math.PI * 2),
    }))

    let raf = null
    const start = performance.now()

    const polygonPoints = (vector, progress) =>
      axes.map((axis, i) => {
        const delay = i * 0.12
        const localP = clamp((progress - delay) / 0.55)
        const eased = 1 - Math.pow(1 - localP, 3)
        const val = clamp((vector?.[axis.id] || 0) * eased)
        return { axis, x: cx + Math.cos(axis.angle) * radius * val, y: cy + Math.sin(axis.angle) * radius * val, val }
      })

    const drawRadarPath = (r) => {
      axes.forEach((axis, i) => {
        const x = cx + Math.cos(axis.angle) * r
        const y = cy + Math.sin(axis.angle) * r
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.closePath()
    }

    const draw = (now) => {
      const elapsed = (now - start) / 1000
      ctx.clearRect(0, 0, width, height)

      ctx.save()
      ctx.beginPath()
      drawRadarPath(radius)
      ctx.clip()

      const tile = 22
      for (let y = cy - radius - tile; y < cy + radius + tile; y += tile) {
        for (let x = cx - radius - tile; x < cx + radius + tile; x += tile) {
          const isEven = ((Math.floor((x - (cx - radius)) / tile) + Math.floor((y - (cy - radius)) / tile)) % 2) === 0
          ctx.fillStyle = isEven ? `rgba(${radarInk},0.08)` : `rgba(${radarInk},0.14)`
          ctx.fillRect(x, y, tile, tile)
        }
      }
      ctx.restore()

      // concentric grid polygons
      ctx.strokeStyle = `rgba(${radarInk},0.38)`
      ctx.lineWidth = 1
      for (let level = 1; level <= 4; level++) {
        const r = (radius * level) / 4
        ctx.beginPath()
        drawRadarPath(r)
        ctx.stroke()
      }

      // axis lines + labels
      axes.forEach((axis) => {
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(axis.angle) * radius, cy + Math.sin(axis.angle) * radius)
        ctx.strokeStyle = `rgba(${radarInk},0.5)`
        ctx.lineWidth = 1
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(cx + Math.cos(axis.angle) * (radius + 8), cy + Math.sin(axis.angle) * (radius + 8), 4, 0, Math.PI * 2)
        ctx.fillStyle = colorMap[axis.id] || `rgba(${radarInk},0.9)`
        ctx.fill()
      })

      if (showData) {
        // per-question polygons (staggered animation)
        ; (byQuestion || []).forEach((entry, qi) => {
          const progress = clamp(elapsed - qi * 0.18)
          const pts = polygonPoints(entry.vector, progress)
          const style = QUESTION_POLYGON_STYLES[qi % QUESTION_POLYGON_STYLES.length]

          ctx.beginPath()
          pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
          ctx.closePath()
          ctx.fillStyle = `rgba(${radarInk},${style.fillAlpha})`
          ctx.fill()
          ctx.setLineDash(style.dash)
          ctx.strokeStyle = `rgba(${radarInk},${style.strokeAlpha})`
          ctx.lineWidth = 1.8
          ctx.stroke()
          ctx.setLineDash([])

          pts.forEach((p) => {
            ctx.beginPath()
            ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(${radarInk},0.88)`
            ctx.fill()
          })
        })

        // composite polygon (delayed until after per-question)
        const compDelay = (byQuestion?.length || 0) * 0.18 + 0.2
        const compProgress = clamp(elapsed - compDelay)
        const compPts = polygonPoints(composite, compProgress)

        compPts.forEach((p) => {
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(p.x, p.y)
          ctx.strokeStyle = colorMap[p.axis.id] || `rgba(${radarInk},0.9)`
          ctx.lineWidth = 2.2
          ctx.stroke()
        })

        ctx.beginPath()
        compPts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
        ctx.closePath()
        ctx.fillStyle = getDominantColor(composite, colorMap, 0.42)
        ctx.fill()
        ctx.strokeStyle = getDominantColor(composite, colorMap, 0.96)
        ctx.lineWidth = 2.8
        ctx.stroke()

        compPts.forEach((p) => {
          ctx.beginPath()
          ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
          ctx.fillStyle = colorMap[p.axis.id] || `rgba(${radarInk},0.9)`
          ctx.fill()
        })
      }

      ctx.save()
      ctx.font = '700 20px sans-serif'
      ctx.fillStyle = `rgba(${radarInk},0.98)`
      ctx.textBaseline = 'middle'
      axes.forEach((axis) => {
        const labelRadius = radius + (isTriangleRadar ? 38 : 28)
        const x = cx + Math.cos(axis.angle) * labelRadius
        const y = cy + Math.sin(axis.angle) * labelRadius
        const cos = Math.cos(axis.angle)
        const isTriangleBottomAxis = isTriangleRadar && Math.sin(axis.angle) > 0.28
        ctx.textAlign = isTriangleBottomAxis || Math.abs(cos) < 0.28 ? 'center' : cos > 0 ? 'right' : 'left'
        ctx.fillText(axis.label, x, y)
      })
      ctx.restore()

      const totalDuration = showData ? ((byQuestion?.length || 0) * 0.18 + 1) : 0
      if (elapsed < totalDuration) raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => { if (raf) cancelAnimationFrame(raf) }
  }, [canvasId, colorMap, composite, byQuestion, legend, showData])

  return (
    <div className="results-status-radar">
      <p className="results-status-radar-title">Composite Signal Radar</p>
      <canvas id={canvasId} width={680} height={480} />
    </div>
  )
}

function renderStatement(text, highlights) {
  if (!text) return null
  const valid = highlights.filter(({ value }) => Boolean(value))
  if (!valid.length) return <>{text}</>
  const escaped = valid.map(({ value }) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) => {
    const highlight = valid.find(({ value }) => value.toLowerCase() === part.toLowerCase())
    return highlight
      ? <span key={i} className={`results-status-statement-highlight results-status-statement-highlight--${highlight.kind}`}>{part}</span>
      : <span key={i}>{part}</span>
  })
}

export default function Results({ brand, result, status = 'idle', analytics, questions, personalities, answers, onSubmit, onStartOver, onExit }) {
  const cards = useMemo(() => buildQuestionCards(analytics, questions, answers), [analytics, questions, answers])
  const legend = useMemo(() => getPersonalityLegend(personalities || []), [personalities])
  const colorMap = useMemo(() => buildPersonalityColorMap(personalities || [], 1), [personalities])
  const radarData = useMemo(() => buildRadarData(cards, personalities || []), [cards, personalities])
  const copy = brand?.copy || {}
  const isSubmitted = status === 'submitted'
  const isSubmitting = status === 'submitting'
  const isError = status === 'error'

  return (
    <div className="results">
      <div className="results-content">

        {/* ── Cross-fading screens ── */}
        <div className="results-screens">

          {/* Screen A: idle + submitting */}
          <div className={`results-screen ${!isSubmitted ? 'in' : 'out'}`}>
            <h2 className="results-title">{renderSuperscriptMarks(copy.resultsTitle || 'Analyzing your answers...')}</h2>
            <p className="results-instruction">{renderSuperscriptMarks(copy.resultsInstruction || 'Hang tight while we process your responses.')}</p>
            <RadarCanvas composite={{}} byQuestion={[]} legend={radarData.legend} colorMap={colorMap} showData={false} />
          </div>

          {/* Screen B: submitted */}
          <div className={`results-screen ${isSubmitted ? 'in' : 'out'}`}>
            <div className={`results-status ${result?.result?.personalityId ? `personality-${result.result.personalityId}` : ''}`}>
              <div className="results-status-summary">
                {result?.result ? (
                  <>
                    <p className="results-status-match">
                      <strong>{renderSuperscriptMarks(result.result.personalityName)}</strong>
                      <span className="results-status-confidence">{Math.round((result.result.confidence || 0) * 100)}% Match</span>
                    </p>
                    <p className="results-status-statement">
	                      {renderStatement(
	                        result.result.statement || result.result.reasoning || 'No AI statement returned yet.',
	                        [
	                          { value: result.result.personalityName, kind: 'persona' },
	                          { value: result.result.drinkRecommendation, kind: 'drink' },
	                        ]
	                      )}
                    </p>
                    <RadarCanvas composite={radarData.composite} byQuestion={radarData.byQuestion} legend={radarData.legend} colorMap={colorMap} showData={isSubmitted} />
                  </>
                ) : null}
              </div>
            </div>
          </div>

        </div>

        {isError && <p className="results-error">Submit failed. Try again.</p>}
      </div>

      {(isSubmitted || isError) ? (
        <div className="question-navigation results-navigation">
          <div className="question-navigation-prev">
            <button
              className="question-navigation-prev-button question-navigation-exit-button"
              onClick={(event) => { event.stopPropagation(); onExit?.(); }}
              onPointerDown={triggerActivePress}
              data-exit-button="true"
            >
              Exit
            </button>
          </div>
          <div className="question-navigation-next">
            <button
              className="question-navigation-next-button"
              onClick={isError ? onSubmit : onStartOver}
              onPointerDown={triggerActivePress}
              disabled={isSubmitting}
            >
              {isError ? 'Retry' : (copy.startOverLabel || 'Start Over')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
