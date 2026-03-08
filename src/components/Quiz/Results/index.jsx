import React, { useEffect, useMemo, useState } from 'react'
import { triggerActivePress } from '../../utils'
import loadingVideo from '../../../assets/videos/blobs.webm'
import './index.scss'

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value))

const PERSONALITY_LEGEND = [
  { id: 'strategist', label: 'The Strategist' },
  { id: 'pioneer', label: 'The Pioneer' },
  { id: 'catalyst', label: 'The Catalyst' },
  { id: 'architect', label: 'The Architect' },
]

const PERSONALITY_COLORS = {
  strategist: 'rgba(77, 187, 137, 0.72)',
  pioneer: 'rgba(76, 120, 255, 0.72)',
  catalyst: 'rgba(214, 107, 186, 0.72)',
  architect: 'rgba(255, 98, 0, 0.72)',
}

const PERSONALITY_AREA_COLORS = {
  strategist: 'rgba(77, 187, 137, 0.16)',
  pioneer: 'rgba(76, 120, 255, 0.16)',
  catalyst: 'rgba(214, 107, 186, 0.16)',
  architect: 'rgba(255, 98, 0, 0.16)',
}

const QUESTION_TYPE_COLORS = {
  'multiple-choice': 'rgba(98, 170, 255, 0.22)',
  'ranked-choice': 'rgba(255, 155, 98, 0.22)',
  'range-sliders': 'rgba(130, 225, 170, 0.22)',
  'slide-select': 'rgba(220, 142, 235, 0.22)',
}

function normalizeType(type = '') {
  if (type === 'multiple-choice-text' || type === 'multiple-choice-image') return 'multiple-choice'
  if (type === 'ranked-choice') return 'ranked-choice'
  if (type === 'range-sliders') return 'range-sliders'
  if (type === 'slide-select' || type === 'SlideSelect') return 'slide-select'
  return type
}

function humanizePersonality(personalityId) {
  if (!personalityId) return 'mixed signal'
  return personalityId.replace(/-/g, ' ')
}

function titleCase(text = '') {
  return text
    .split(' ')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ')
}

function BarChart({ label, value, tone = 'pioneer' }) {
  return (
    <div className={`results-status-chart results-status-chart-bar personality-${tone}`}>
      <p className="results-status-chart-label">{label}</p>
      <div className="results-status-chart-track">
        <div className="results-status-chart-fill" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <p className="results-status-chart-value">{Math.round(value * 100)}%</p>
    </div>
  )
}

function DotChart({ label, count, tone = 'pioneer' }) {
  const capped = Math.min(8, count)
  return (
    <div className={`results-status-chart results-status-chart-dots personality-${tone}`}>
      <p className="results-status-chart-label">{label}</p>
      <div className="results-status-dot-row">
        {Array.from({ length: 8 }).map((_, index) => (
          <span key={index} className={`results-status-dot ${index < capped ? 'active' : ''}`} />
        ))}
      </div>
      <p className="results-status-chart-value">{count}</p>
    </div>
  )
}

function RingChart({ label, value, tone = 'pioneer' }) {
  const degrees = `${Math.round(clamp(value) * 360)}deg`
  return (
    <div className={`results-status-chart results-status-chart-ring personality-${tone}`}>
      <p className="results-status-chart-label">{label}</p>
      <div className="results-status-ring" style={{ '--degrees': degrees }}>
        <span>{Math.round(value * 100)}%</span>
      </div>
    </div>
  )
}

function NeedleChart({ label, value, tone = 'pioneer' }) {
  const degrees = -90 + Math.round(clamp(value) * 180)
  return (
    <div className={`results-status-chart results-status-chart-needle personality-${tone}`}>
      <p className="results-status-chart-label">{label}</p>
      <div className="results-status-needle-gauge">
        <div className="results-status-needle-arc" />
        <div className="results-status-needle" style={{ transform: `rotate(${degrees}deg)` }} />
      </div>
      <p className="results-status-chart-value">{Math.round(value * 100)}%</p>
    </div>
  )
}

function PillChart({ label, value, tone = 'pioneer' }) {
  const count = 10
  const active = Math.round(clamp(value) * count)
  return (
    <div className={`results-status-chart results-status-chart-pill personality-${tone}`}>
      <p className="results-status-chart-label">{label}</p>
      <div className="results-status-pill-row">
        {Array.from({ length: count }).map((_, idx) => (
          <span key={idx} className={`results-status-pill ${idx < active ? 'active' : ''}`} />
        ))}
      </div>
      <p className="results-status-chart-value">{Math.round(value * 100)}%</p>
    </div>
  )
}

function inferQuestionPersonality(question, answer) {
  if (!question) return null

  if (question.type === 'multiple-choice-text' || question.type === 'multiple-choice-image' || question.type === 'slide-select' || question.type === 'SlideSelect') {
    const selectedIds = Array.isArray(answer) ? answer : (answer ? [answer] : [])
    if (!selectedIds.length) return null

    const counts = {}
    selectedIds.forEach((optionId) => {
      const option = (question.answers || []).find((entry) => entry.id === optionId)
      if (!option?.personalityId) return
      counts[option.personalityId] = (counts[option.personalityId] || 0) + 1
    })

    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null
  }

  if (question.type === 'ranked-choice' && Array.isArray(answer) && answer.length) {
    const top = (question.answers || []).find((entry) => entry.id === answer[0])
    return top?.personalityId || null
  }

  if (question.type === 'range-sliders' && answer && typeof answer === 'object') {
    let maxEntry = null
    Object.entries(answer).forEach(([optionId, value]) => {
      if (!maxEntry || Number(value) > Number(maxEntry.value)) {
        maxEntry = { optionId, value }
      }
    })
    const option = (question.answers || []).find((entry) => entry.id === maxEntry?.optionId)
    return option?.personalityId || null
  }

  return null
}

function buildQuestionCards(analytics = {}, questions = [], answers = {}) {
  const byId = Object.fromEntries((questions || []).map((q) => [String(q.id), q]))

  return Object.entries(analytics).map(([questionId, entry]) => {
    const events = entry?.data?.events ?? []
    const question = byId[questionId]
    const answer = answers?.[questionId]
    const type = normalizeType(entry?.data?.questionType || question?.type)
    const personalityId = inferQuestionPersonality(question, answer)
    const components = entry?.data?.confidenceComponents || {}

    const pressureSamples = events
      .map((event) => event?.payload?.pressure)
      .filter((value) => typeof value === 'number' && Number.isFinite(value) && value > 0)
    const avgPressure = pressureSamples.length
      ? pressureSamples.reduce((sum, value) => sum + value, 0) / pressureSamples.length
      : 0

    const blockedNext = events.filter((event) => event.type === 'next_clicked_blocked').length
    const changeCount = events.filter((event) => event.type === 'answer_changed').length

    const reorderCount = events.filter(
      (event) => event.type === 'answer_changed' && event.payload?.interaction === 'reorder'
    ).length

    const sliderChanges = events.filter(
      (event) => event.type === 'answer_changed' && event.payload?.interaction === 'slider_change'
    ).length

    const slideConfirms = events.filter(
      (event) => event.type === 'answer_changed' && event.payload?.interaction === 'slide_confirmed'
    ).length

    const slideRejects = events.filter(
      (event) => event.type === 'answer_changed' && event.payload?.interaction === 'slide_rejected'
    ).length

    const touchedOptions = new Set(
      events.filter((event) => event.type === 'pointer_down').map((event) => event.payload?.optionId).filter(Boolean)
    ).size

    const optionCount = question?.answers?.length || 1
    const coverage = clamp(touchedOptions / optionCount)
    const hesitation = clamp(blockedNext * 0.25 + changeCount * 0.07)

    return {
      questionId,
      type,
      personalityId,
      confidence: entry?.confidence || 0,
      metrics: {
        avgPressure: clamp(avgPressure),
        speed: clamp(components.answerSpeed ?? (1 - (components.answerMs || 0) / 12000)),
        nextDecisiveness: clamp(components.nextDecisiveness ?? 0),
        hesitation,
        coverage,
        reorderDensity: clamp(reorderCount / 8),
        sliderDensity: clamp(sliderChanges / 16),
        slidePrecision: clamp(slideConfirms / Math.max(1, slideConfirms + slideRejects)),
        blockedNext,
        changeCount,
      },
    }
  })
}

function buildVectorFromCard(card) {
  const vector = { strategist: 0.08, pioneer: 0.08, catalyst: 0.08, architect: 0.08 }

  if (card.type === 'multiple-choice') {
    vector.pioneer += card.metrics.speed * 0.55
    vector.strategist += card.metrics.nextDecisiveness * 0.45
    vector.architect += clamp(card.metrics.changeCount / 8) * 0.35
    vector.catalyst += (1 - card.metrics.hesitation) * 0.3
  }

  if (card.type === 'ranked-choice') {
    vector.architect += card.metrics.reorderDensity * 0.6
    vector.catalyst += card.metrics.coverage * 0.4
    vector.strategist += card.metrics.avgPressure * 0.45
    vector.pioneer += card.confidence * 0.35
  }

  if (card.type === 'range-sliders') {
    vector.strategist += (1 - card.metrics.hesitation) * 0.55
    vector.catalyst += card.metrics.coverage * 0.4
    vector.architect += card.metrics.sliderDensity * 0.45
    vector.pioneer += card.confidence * 0.3
  }

  if (card.type === 'slide-select') {
    vector.pioneer += card.metrics.slidePrecision * 0.55
    vector.strategist += card.metrics.avgPressure * 0.45
    vector.architect += card.metrics.speed * 0.35
    vector.catalyst += card.confidence * 0.25
  }

  if (card.personalityId && card.personalityId in vector) {
    vector[card.personalityId] += 0.35
  }

  const max = Math.max(...Object.values(vector), 0.0001)
  return {
    strategist: clamp(vector.strategist / max),
    pioneer: clamp(vector.pioneer / max),
    catalyst: clamp(vector.catalyst / max),
    architect: clamp(vector.architect / max),
  }
}

function buildRadarData(cards = []) {
  const compositeTotals = { strategist: 0, pioneer: 0, catalyst: 0, architect: 0 }

  const byQuestion = cards.map((card) => {
    const vector = buildVectorFromCard(card)
    Object.keys(compositeTotals).forEach((key) => {
      compositeTotals[key] += vector[key]
    })

    return {
      questionId: card.questionId,
      type: card.type,
      vector,
    }
  })

  const max = Math.max(...Object.values(compositeTotals), 0.0001)
  const composite = {
    strategist: clamp(compositeTotals.strategist / max),
    pioneer: clamp(compositeTotals.pioneer / max),
    catalyst: clamp(compositeTotals.catalyst / max),
    architect: clamp(compositeTotals.architect / max),
  }

  return { composite, byQuestion }
}

function RadarCanvas({ composite, byQuestion }) {
  const [canvasId] = useState(() => `radar-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    const canvas = document.getElementById(canvasId)
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = null
    const width = canvas.width
    const height = canvas.height
    const cx = width / 2
    const cy = height / 2
    const radius = Math.min(width, height) * 0.34

    const axes = [
      { id: 'pioneer', angle: -Math.PI / 2, label: 'Pioneer' },
      { id: 'architect', angle: 0, label: 'Architect' },
      { id: 'catalyst', angle: Math.PI / 2, label: 'Catalyst' },
      { id: 'strategist', angle: Math.PI, label: 'Strategist' },
    ]

    const start = performance.now()

    const draw = (now) => {
      const elapsed = now - start

      ctx.clearRect(0, 0, width, height)

      ctx.strokeStyle = 'rgba(255,255,255,0.16)'
      ctx.lineWidth = 1

      // faint personality quadrants
      axes.forEach((axis, index) => {
        const next = axes[(index + 1) % axes.length]
        const x1 = cx + Math.cos(axis.angle) * radius
        const y1 = cy + Math.sin(axis.angle) * radius
        const x2 = cx + Math.cos(next.angle) * radius
        const y2 = cy + Math.sin(next.angle) * radius

        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.closePath()
        ctx.fillStyle = PERSONALITY_AREA_COLORS[axis.id]
        ctx.fill()
      })

      for (let level = 1; level <= 4; level += 1) {
        const r = (radius * level) / 4
        ctx.beginPath()
        axes.forEach((axis, index) => {
          const x = cx + Math.cos(axis.angle) * r
          const y = cy + Math.sin(axis.angle) * r
          if (index === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.closePath()
        ctx.stroke()
      }

      axes.forEach((axis) => {
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(axis.angle) * radius, cy + Math.sin(axis.angle) * radius)
        ctx.stroke()
      })

      const polygonForVector = (sourceVector, elapsedMs, extraDelay = 0) => {
        return axes.map((axis, index) => {
          const delay = extraDelay + index * 200
          const localProgress = clamp((elapsedMs - delay) / 520)
          const eased = 1 - Math.pow(1 - localProgress, 3)
          const value = clamp((sourceVector?.[axis.id] || 0) * eased)

          return {
            axis,
            x: cx + Math.cos(axis.angle) * radius * value,
            y: cy + Math.sin(axis.angle) * radius * value,
            value,
          }
        })
      }

      const questionPolygons = (byQuestion || []).map((entry, index) => ({
        ...entry,
        points: polygonForVector(entry.vector, elapsed, index * 140),
      }))

      questionPolygons.forEach((poly) => {
        ctx.beginPath()
        poly.points.forEach((point, index) => {
          if (index === 0) ctx.moveTo(point.x, point.y)
          else ctx.lineTo(point.x, point.y)
        })
        ctx.closePath()
        ctx.fillStyle = QUESTION_TYPE_COLORS[poly.type] || 'rgba(200, 220, 255, 0.18)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'
        ctx.lineWidth = 1
        ctx.stroke()

        poly.points.forEach((point) => {
          ctx.beginPath()
          ctx.arc(point.x, point.y, 2.4, 0, Math.PI * 2)
          ctx.fillStyle = PERSONALITY_COLORS[point.axis.id]
          ctx.fill()
        })
      })

      const points = polygonForVector(composite, elapsed, 200)

      points.forEach((point) => {
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(point.x, point.y)
        ctx.strokeStyle = PERSONALITY_COLORS[point.axis.id]
        ctx.lineWidth = 2
        ctx.stroke()
      })

      ctx.beginPath()
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y)
        else ctx.lineTo(point.x, point.y)
      })
      ctx.closePath()
      ctx.fillStyle = 'rgba(220, 235, 255, 0.22)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(245, 250, 255, 0.95)'
      ctx.lineWidth = 1.8
      ctx.stroke()

      points.forEach((point) => {
        ctx.beginPath()
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = PERSONALITY_COLORS[point.axis.id]
        ctx.fill()
      })

      // corner personality labels + anchor dots
      axes.forEach((axis) => {
        const ox = cx + Math.cos(axis.angle) * (radius + 16)
        const oy = cy + Math.sin(axis.angle) * (radius + 16)

        ctx.beginPath()
        ctx.arc(ox, oy, 3.5, 0, Math.PI * 2)
        ctx.fillStyle = PERSONALITY_COLORS[axis.id]
        ctx.fill()

        ctx.fillStyle = 'rgba(230, 240, 255, 0.95)'
        ctx.font = '11px Montserrat, sans-serif'
        ctx.textAlign = axis.id === 'strategist' ? 'right' : axis.id === 'architect' ? 'left' : 'center'
        ctx.textBaseline = axis.id === 'pioneer' ? 'bottom' : axis.id === 'catalyst' ? 'top' : 'middle'

        const lx = cx + Math.cos(axis.angle) * (radius + 30)
        const ly = cy + Math.sin(axis.angle) * (radius + 30)
        ctx.fillText(axis.label, lx, ly)
      })

      if (elapsed < 2200) {
        raf = requestAnimationFrame(draw)
      }
    }

    raf = requestAnimationFrame(draw)

    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
  }, [canvasId, composite, byQuestion])

  return (
    <div className="results-status-radar">
      <p className="results-status-radar-title">Composite Personality Radar</p>
      <canvas id={canvasId} width={320} height={280} />
    </div>
  )
}

export default function Results({ result, analytics, questions, answers, sessionKey, onPrevious, onSubmit, onStartOver }) {
  const [status, setStatus] = useState('idle')
  const [analyticsExpanded, setAnalyticsExpanded] = useState(false)
  const cards = useMemo(() => buildQuestionCards(analytics, questions, answers), [analytics, questions, answers])
  const radarData = useMemo(() => buildRadarData(cards), [cards])

  useEffect(() => {
    setStatus('idle')
  }, [sessionKey])

  useEffect(() => {
    if (!result) {
      setStatus('idle')
      setAnalyticsExpanded(false)
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

  return (
    <div className="results">
      <div className="results-content">
        <h2 className="results-title">Review & Submit</h2>
        <p className="results-instruction">You can go back to change anything before submitting.</p>

        {status === 'submitted' && (
          <div className={`results-status ${result?.result?.personalityId ? `personality-${result.result.personalityId}` : ''}`}>
            <div className="results-status-summary">
              {result?.result ? (
                <>
                  <p className="results-status-match">
                    Top match: <strong>{result.result.personalityName}</strong> ({Math.round((result.result.confidence || 0) * 100)}%)
                  </p>
                  <p className="results-status-statement">
                    {result.result.statement || result.result.reasoning || 'No AI statement returned yet. If backend is in local mode, restart it with OPENAI_API_KEY set.'}
                  </p>
                  <RadarCanvas composite={radarData.composite} byQuestion={radarData.byQuestion} />
                </>
              ) : null}

            </div>

            <div className="results-status-analytics">
              <button
                type="button"
                className="results-status-analytics-toggle"
                onClick={() => setAnalyticsExpanded(prev => !prev)}
              >
                {analyticsExpanded ? 'Hide behavioral breakdown' : 'Show behavioral breakdown'}
              </button>

              <div className={`results-status-analytics-panel ${analyticsExpanded ? 'expanded' : 'collapsed'}`}>
                <p className="results-status-analytics-title">Behavioral Indicators by Question Type</p>
                <p className="results-status-analytics-subtitle">
                  Each metric can map toward different personality signals. Mixed colors in one question indicate blended tendencies.
                </p>

                {cards.map((card) => (
                  <div
                    key={card.questionId}
                    className={`results-status-question ${card.type} ${card.personalityId ? `personality-${card.personalityId}` : ''}`}
                  >
                    <p className="results-status-question-title">
                      Question {card.questionId} · {card.type} · <strong>Personality Result: {titleCase(humanizePersonality(card.personalityId))}</strong>
                    </p>

                    <div className="results-status-question-charts">
                      {(card.type === 'multiple-choice') && (
                        <>
                          <NeedleChart label="Decision Speed" value={card.metrics.speed} tone="pioneer" />
                          <DotChart label="Selection Churn" count={card.metrics.changeCount} tone="architect" />
                          <RingChart label="Next Decisiveness" value={card.metrics.nextDecisiveness} tone="strategist" />
                          <BarChart label="Confidence Signal" value={card.confidence} tone="catalyst" />
                        </>
                      )}

                      {(card.type === 'ranked-choice') && (
                        <>
                          <PillChart label="Reorder Activity" value={card.metrics.reorderDensity} tone="architect" />
                          <RingChart label="Touch Coverage" value={card.metrics.coverage} tone="catalyst" />
                          <NeedleChart label="Pressure Index" value={card.metrics.avgPressure} tone="strategist" />
                          <BarChart label="Confidence Signal" value={card.confidence} tone="pioneer" />
                        </>
                      )}

                      {(card.type === 'range-sliders') && (
                        <>
                          <BarChart label="Slider Adjustment Density" value={card.metrics.sliderDensity} tone="architect" />
                          <PillChart label="Question Coverage" value={card.metrics.coverage} tone="catalyst" />
                          <NeedleChart label="Hesitation Coefficient" value={card.metrics.hesitation} tone="strategist" />
                          <RingChart label="Confidence Signal" value={card.confidence} tone="pioneer" />
                        </>
                      )}

                      {(card.type === 'slide-select') && (
                        <>
                          <RingChart label="Slide Precision" value={card.metrics.slidePrecision} tone="pioneer" />
                          <NeedleChart label="Touch Pressure" value={card.metrics.avgPressure} tone="strategist" />
                          <PillChart label="Decision Speed" value={card.metrics.speed} tone="architect" />
                          <BarChart label="Confidence Signal" value={card.confidence} tone="catalyst" />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="results-status-legend">
              {PERSONALITY_LEGEND.map((entry) => (
                <div key={entry.id} className={`results-status-legend-item personality-${entry.id}`}>
                  <span className="results-status-legend-swatch" />
                  <span>{entry.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="results-navigation">
        {status !== 'submitted' ? (
          <>
            <button onClick={onPrevious} onPointerDown={triggerActivePress}>Previous</button>
            <button onClick={handleSubmit} onPointerDown={triggerActivePress} disabled={status === 'submitting'}>
              {status === 'submitting' ? 'Submitting…' : 'Submit'}
            </button>
          </>
        ) : (
          <button onClick={onStartOver} onPointerDown={triggerActivePress}>Start Over</button>
        )}
      </div>

      {status === 'error' && <p className="results-status error">Submit failed. Try again.</p>}

      {status === 'submitting' && (
        <div className="results-loading">
          <video className="results-loading-video" src={loadingVideo} autoPlay muted loop playsInline />
          <div className="results-loading-copy">
            <p>Translating your signals…</p>
            <span>We’re syncing with the cocktail oracle. This usually takes a beat.</span>
          </div>
        </div>
      )}
    </div>
  )
}
