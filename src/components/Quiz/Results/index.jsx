import React, { useEffect, useMemo, useState } from 'react'
import { triggerActivePress } from '../../utils'
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
  { dash: [], fillAlpha: 0.08, strokeAlpha: 0.82 },
  { dash: [8, 5], fillAlpha: 0.06, strokeAlpha: 0.7 },
  { dash: [3, 5], fillAlpha: 0.05, strokeAlpha: 0.62 },
  { dash: [14, 5, 3, 5], fillAlpha: 0.04, strokeAlpha: 0.54 },
]

function RadarCanvas({ composite, byQuestion, legend, colorMap }) {
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
    const cy = height / 2
    const radius = Math.min(width, height) * 0.36

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
          ctx.fillStyle = isEven ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.05)'
          ctx.fillRect(x, y, tile, tile)
        }
      }
      ctx.restore()

      // concentric grid polygons
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'
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
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'
        ctx.lineWidth = 1
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(cx + Math.cos(axis.angle) * (radius + 8), cy + Math.sin(axis.angle) * (radius + 8), 4, 0, Math.PI * 2)
        ctx.fillStyle = colorMap[axis.id] || 'rgba(255,255,255,0.8)'
        ctx.fill()
      })

        // per-question polygons (staggered animation)
        ; (byQuestion || []).forEach((entry, qi) => {
          const progress = clamp(elapsed - qi * 0.18)
          const pts = polygonPoints(entry.vector, progress)
          const style = QUESTION_POLYGON_STYLES[qi % QUESTION_POLYGON_STYLES.length]

          ctx.beginPath()
          pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
          ctx.closePath()
          ctx.fillStyle = `rgba(255,255,255,${style.fillAlpha})`
          ctx.fill()
          ctx.setLineDash(style.dash)
          ctx.strokeStyle = `rgba(255,255,255,${style.strokeAlpha})`
          ctx.lineWidth = 1.35
          ctx.stroke()
          ctx.setLineDash([])

          pts.forEach((p) => {
            ctx.beginPath()
            ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2)
            ctx.fillStyle = 'rgba(255,255,255,0.78)'
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
        ctx.strokeStyle = colorMap[p.axis.id] || 'rgba(255,255,255,0.8)'
        ctx.lineWidth = 1.5
        ctx.stroke()
      })

      ctx.beginPath()
      compPts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
      ctx.closePath()
      ctx.fillStyle = getDominantColor(composite, colorMap, 0.22)
      ctx.fill()
      ctx.strokeStyle = getDominantColor(composite, colorMap, 0.96)
      ctx.lineWidth = 2
      ctx.stroke()

      compPts.forEach((p) => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
        ctx.fillStyle = colorMap[p.axis.id] || 'rgba(255,255,255,0.8)'
        ctx.fill()
      })

      const totalDuration = compDelay + 0.8
      if (elapsed < totalDuration) raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => { if (raf) cancelAnimationFrame(raf) }
  }, [canvasId, colorMap, composite, byQuestion, legend])

  return (
    <div className="results-status-radar">
      <p className="results-status-radar-title">Composite Signal Radar</p>
      <canvas id={canvasId} width={560} height={480} />
    </div>
  )
}

function renderStatement(text, highlights) {
  if (!text) return null
  const valid = highlights.filter(Boolean)
  if (!valid.length) return <>{text}</>
  const escaped = valid.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) => {
    const isHighlight = valid.some(h => h.toLowerCase() === part.toLowerCase())
    return isHighlight
      ? <span key={i} className="results-status-statement-highlight">{part}</span>
      : <span key={i}>{part}</span>
  })
}

export default function Results({ brand, result, analytics, questions, personalities, answers, sessionKey, onPrevious, onSubmit, onStartOver }) {
  const [status, setStatus] = useState('idle')
  const cards = useMemo(() => buildQuestionCards(analytics, questions, answers), [analytics, questions, answers])
  const legend = useMemo(() => getPersonalityLegend(personalities || []), [personalities])
  const colorMap = useMemo(() => buildPersonalityColorMap(personalities || [], 1), [personalities])
  const radarData = useMemo(() => buildRadarData(cards, personalities || []), [cards, personalities])
  const copy = brand?.copy || {}

  useEffect(() => {
    setStatus('idle')
  }, [sessionKey])

  useEffect(() => {
    if (!result) {
      setStatus('idle')
    }
  }, [result])

  const handleSubmit = async () => {
    try {
      setStatus('submitting')
      await onSubmit()
      setStatus('submitted')
    } catch (error) {
      setStatus('error')
      console.error(error)
    }
  }

  const isSubmitted = status === 'submitted'
  const isSubmitting = status === 'submitting'

  return (
    <div className="results">
      <div className="results-content">

        {/* ── Cross-fading screens ── */}
        <div className="results-screens">

          {/* Screen A: idle + submitting */}
          <div className={`results-screen ${!isSubmitted ? 'in' : 'out'}`}>
            <h2 className="results-title">{copy.resultsTitle || 'Start AI analysis of your answers and behavioral signals...'}</h2>
            <p className="results-instruction">{copy.resultsInstruction || 'You can review before submitting.'}</p>
            <div className="results-blob-placeholder">
              <video
                className={`results-blob-video ${isSubmitting ? 'blob-active' : 'blob-idle'}`}
                src={brand?.assets?.loadingVideo}
                autoPlay muted loop playsInline
              />
              <div className={`results-blob-overlay ${isSubmitting ? 'visible' : ''}`}>
                <p>{copy.loadingTitle || 'Translating your signals...'}</p>
                <span>{copy.loadingBody || 'Syncing with the cocktail oracle. This usually takes a beat.'}</span>
              </div>
            </div>
          </div>

          {/* Screen B: submitted */}
          <div className={`results-screen ${isSubmitted ? 'in' : 'out'}`}>
            <div className={`results-status ${result?.result?.personalityId ? `personality-${result.result.personalityId}` : ''}`}>
              <div className="results-status-summary">
                {result?.result ? (
                  <>
                    <p className="results-status-match">
                      Top match: <strong>{result.result.personalityName}</strong>
                      <span className="results-status-confidence">{Math.round((result.result.confidence || 0) * 100)}% Confidence</span>
                    </p>
                    <p className="results-status-statement">
                      {renderStatement(
                        result.result.statement || result.result.reasoning || 'No AI statement returned yet.',
                        [result.result.personalityName, result.result.drinkRecommendation]
                      )}
                    </p>
                    <RadarCanvas composite={radarData.composite} byQuestion={radarData.byQuestion} legend={radarData.legend} colorMap={colorMap} />
                  </>
                ) : null}
              </div>
              <div className="results-status-legend">
                {legend.map((entry) => (
                  <div key={entry.id} className="results-status-legend-item">
                    <span className="results-status-legend-swatch" style={{ background: colorMap[entry.id] || '#9fb4dc' }} />
                    <span>{entry.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* ── Nav (always visible) ── */}
        {status === 'error' && <p className="results-error">Submit failed. Try again.</p>}
        <div className="results-content-nav">
          {!isSubmitted ? (
            <>
              <button className="question-navigation-prev-button" onClick={onPrevious} onPointerDown={triggerActivePress}>
                {copy.reviewLabel || 'Review'}
              </button>
              <button className="question-navigation-next-button" onClick={handleSubmit} onPointerDown={triggerActivePress} disabled={isSubmitting}>
                {isSubmitting ? (copy.submittingLabel || 'Submitting...') : (copy.submitLabel || 'Submit')}
              </button>
            </>
          ) : (
            <button className="question-navigation-prev-button" onClick={onStartOver} onPointerDown={triggerActivePress}>
              {copy.startOverLabel || 'Start Over'}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
