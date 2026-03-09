
import React, { useEffect, useMemo, useRef } from 'react'
import { computeQuestionConfidence } from '../Quiz/analytics'
import { buildQuestionCards, PERSONALITY_LEGEND, clamp } from '../Quiz/behavioralAnalytics'
import './index.scss'

const PASSIVE_EVENTS = new Set(['question_presented', 'question_revisited', 'answers_presented_order'])

const formatSeconds = (ms) => {
  if (typeof ms !== 'number' || Number.isNaN(ms) || ms <= 0) return 'a beat'
  if (ms < 600) return 'almost instantly'
  return `${(ms / 1000).toFixed(1)}s`
}

const describeAnswer = (question, answerId) => {
  if (!question?.answers) return null
  return question.answers.find((option) => option.id === answerId) ?? null
}

const buildSummary = ({ entry, personality }) => {
  const hasSignals = Array.isArray(entry?.data?.events) && entry.data.events.some((event) => !PASSIVE_EVENTS.has(event.type))

  if (!hasSignals) {
    return 'Awaiting signals…'
  }

  const data = entry?.data ?? {}
  const latencyMs = data.answerCommittedAt && data.firstInteractionAt
    ? data.answerCommittedAt - data.firstInteractionAt
    : null
  const revisitCount = data.revisitCount ?? 0

  const parts = []
  parts.push(`Spent ${formatSeconds(latencyMs)} reflecting`)

  if (revisitCount > 0) {
    parts.push(`revisited ${revisitCount}× before locking it in`)
  }

  const personaDescriptor = personality ? personality.name : 'their preferred signal'
  parts.push(`aligned with ${personaDescriptor}`)

  return parts.join(' · ')
}

const buildMetrics = (entry, confidenceOverride = null, eventCount = 0) => {
  if (!entry) return []

  const data = entry.data || {}
  const latencyMs = data.answerCommittedAt && data.firstInteractionAt
    ? data.answerCommittedAt - data.firstInteractionAt
    : null
  const revisitCount = data.revisitCount ?? 0
  const confidence = typeof confidenceOverride === 'number'
    ? confidenceOverride
    : (typeof entry.confidence === 'number' ? entry.confidence : null)

  const metrics = []

  metrics.push({
    label: 'Commit Time',
    value: latencyMs ? formatSeconds(latencyMs) : '—'
  })

  metrics.push({
    label: 'Confidence',
    value: confidence !== null ? `${Math.round(confidence * 100)}%` : '—'
  })

  metrics.push({
    label: 'Revisits',
    value: revisitCount > 0 ? `${revisitCount}×` : 'None'
  })

  metrics.push({
    label: 'Interactions',
    value: eventCount
  })

  return metrics
}

function AggregateBarChart({ label, value, tone = 'pioneer' }) {
  return (
    <div className={`console-aggregate-chart console-aggregate-chart-bar personality-${tone}`}>
      <p className="console-aggregate-chart-label">{label}</p>
      <div className="console-aggregate-chart-track">
        <div className="console-aggregate-chart-fill" style={{ width: `${Math.round(clamp(value) * 100)}%` }} />
      </div>
      <p className="console-aggregate-chart-value">{Math.round(clamp(value) * 100)}%</p>
    </div>
  )
}

function AggregateRingChart({ label, value, tone = 'pioneer' }) {
  const degrees = `${Math.round(clamp(value) * 360)}deg`
  return (
    <div className={`console-aggregate-chart console-aggregate-chart-ring personality-${tone}`}>
      <p className="console-aggregate-chart-label">{label}</p>
      <div className="console-aggregate-ring" style={{ '--degrees': degrees }}>
        <span>{Math.round(clamp(value) * 100)}%</span>
      </div>
    </div>
  )
}

export default function Console({ attract = false, analytics, questions, answers, personalities, activeQuestionId, analysisComplete = false }) {
  const personalityMap = useMemo(() => (
    personalities?.reduce((acc, persona) => {
      acc[persona.id] = persona
      return acc
    }, {}) ?? {}
  ), [personalities])

  const rowRefs = useRef({})
  const questionCards = useMemo(() => buildQuestionCards(analytics, questions, answers), [analytics, questions, answers])

  const showAggregate = analysisComplete && !attract
  const showFeed = !analysisComplete && !attract
  const indicatorState = attract ? 'waiting' : analysisComplete ? 'complete' : 'analyzing'
  const indicatorLabel = indicatorState === 'waiting' ? 'Waiting' : indicatorState === 'complete' ? 'Complete' : 'Analyzing'

  useEffect(() => {
    if (!activeQuestionId) return
    const target = rowRefs.current[activeQuestionId]
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' })
    }
  }, [activeQuestionId])

  const rows = useMemo(() => (
    questions.map((question) => {
      const questionId = String(question.id)
      const entry = analytics[questionId]
      const committedAnswerId = answers[question.id]
      const answerMeta = describeAnswer(question, committedAnswerId)
      const personality = answerMeta ? personalityMap[answerMeta.personalityId] : null
      const isActive = questionId === activeQuestionId

      const entryEvents = Array.isArray(entry?.data?.events) ? entry.data.events : []
      const activityEvents = entryEvents.filter((event) => !PASSIVE_EVENTS.has(event.type))
      const eventCount = entryEvents.filter((event) => event.type === 'pointer_down').length
      const hasMeaningfulSignals = eventCount > 0 || (entry?.data?.revisitCount ?? 0) > 0 || Boolean(entry?.data?.answerCommittedAt)

      let liveConfidence = null
      if (hasMeaningfulSignals && entry?.data) {
        const score = computeQuestionConfidence(entry.data)
        liveConfidence = score?.confidence ?? null
      }

      const baseConfidence = hasMeaningfulSignals && typeof entry?.confidence === 'number' ? entry.confidence : null
      const confidenceValue = typeof liveConfidence === 'number'
        ? liveConfidence
        : (typeof baseConfidence === 'number' ? baseConfidence : 0.5)

      return {
        id: questionId,
        label: question.label ?? `Question ${question.id}`,
        summary: buildSummary({ entry, personality }),
        metrics: buildMetrics(entry, confidenceValue, eventCount),
        confidence: confidenceValue,
        interactions: eventCount,
        isActive,
      }
    })
  ), [activeQuestionId, analytics, answers, personalityMap, questions])

  const aggregateStats = useMemo(() => {
    const baseDistribution = PERSONALITY_LEGEND.reduce((acc, persona) => {
      acc[persona.id] = 0
      return acc
    }, {})

    if (!questionCards.length) {
      return {
        total: 0,
        distribution: baseDistribution,
        avgConfidence: 0,
        avgSpeed: 0,
        avgHesitation: 0,
      }
    }

    const distribution = { ...baseDistribution }
    let weightSum = 0
    let confidenceSum = 0
    let confidenceCount = 0
    let speedSum = 0
    let speedCount = 0
    let hesitationSum = 0
    let hesitationCount = 0

    questionCards.forEach((card) => {
      const confidenceWeight = typeof card.confidence === 'number' ? card.confidence : 0.5
      if (card.personalityId && distribution[card.personalityId] !== undefined) {
        distribution[card.personalityId] += confidenceWeight
        weightSum += confidenceWeight
      }

      if (typeof card.confidence === 'number') {
        confidenceSum += card.confidence
        confidenceCount += 1
      }

      if (typeof card.metrics?.speed === 'number') {
        speedSum += card.metrics.speed
        speedCount += 1
      }

      if (typeof card.metrics?.hesitation === 'number') {
        hesitationSum += card.metrics.hesitation
        hesitationCount += 1
      }
    })

    const total = questionCards.length
    Object.keys(distribution).forEach((key) => {
      distribution[key] = weightSum ? distribution[key] / weightSum : 0
    })

    return {
      total,
      distribution,
      avgConfidence: confidenceCount ? confidenceSum / confidenceCount : 0,
      avgSpeed: speedCount ? speedSum / speedCount : 0,
      avgHesitation: hesitationCount ? hesitationSum / hesitationCount : 0,
    }
  }, [questionCards])

  const setRowRef = (id, node) => {
    if (node) {
      rowRefs.current[id] = node
    } else {
      delete rowRefs.current[id]
    }
  }

  return (
    <div className="console">
      <div className="console-header">
        <div>
          <p className="console-header-label">Signal Console</p>
        </div>
        <div className={`console-header-indicator ${indicatorState}`}>
          <span className="pulse" />
          <span>{indicatorLabel}</span>
        </div>
      </div>

      <div className="console-body">
        <div className={`console-feed ${showFeed ? '' : 'hidden'}`}>
          {rows.map((row) => (
            <div
              key={row.id}
              ref={(node) => setRowRef(row.id, node)}
              className={`console-feed-row ${row.isActive ? 'active' : ''}`}
            >
              <div className="console-feed-row-label">
                <span>{row.label}</span>
                {row.isActive ? <span className="console-feed-row-live">Current</span> : null}
              </div>
              <div className={`console-feed-row-summary ${!row.summary.trim() ? 'blank' : ''}`}>
                {row.summary.trim() ? row.summary : ' '}
              </div>

              {row.metrics && row.metrics.length ? (
                <div className="console-feed-row-metrics">
                  {row.metrics.map((metric, idx) => (
                    <div key={`${row.id}-metric-${idx}`} className="console-feed-row-metric">
                      <span className="console-feed-row-metric-label">{metric.label}</span>
                      <span className="console-feed-row-metric-value">{metric.value}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="console-feed-row-graphs">
                <div className="console-feed-row-graph confidence">
                  <span>Confidence</span>
                  {(() => {
                    const confidenceValue = typeof row.confidence === 'number' ? row.confidence : 0.5
                    const delta = (confidenceValue - 0.5) * 100
                    return (
                      <div className="confidence-horizontal">
                        <div className="confidence-horizontal-track">
                          <div className="confidence-horizontal-baseline" />
                          <div
                            className="confidence-horizontal-indicator"
                            style={{ left: `calc(50% + ${delta}%)` }}
                          />
                        </div>
                        <div className="confidence-label">{typeof row.confidence === 'number' ? `${Math.round(row.confidence * 100)}%` : '—'}</div>
                      </div>
                    )
                  })()}
                </div>

                <div className="console-feed-row-graph interactions">
                  <span>Interactions</span>
                  {(() => {
                    const dotsPerRow = 30
                    const rowCount = Math.max(3, Math.ceil(row.interactions / dotsPerRow))
                    const totalDots = rowCount * dotsPerRow
                    return (
                      <div className="interaction-dot-grid" style={{ '--rows': rowCount }}>
                        {Array.from({ length: totalDots }).map((_, idx) => (
                          <span
                            key={`${row.id}-dot-${idx}`}
                            className={`interaction-dot ${idx < row.interactions ? 'active' : ''}`}
                          />
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={`console-aggregate ${showAggregate ? 'visible' : ''}`}>
          {aggregateStats.total ? (
            <>
              <p className="console-aggregate-title">Aggregate behavioral signals</p>
              <p className="console-aggregate-subtitle">Synthesized from all answered questions.</p>

              <div className="console-aggregate-distribution">
                {PERSONALITY_LEGEND.map((entry) => (
                  <div key={entry.id} className={`console-aggregate-distribution-row personality-${entry.id}`}>
                    <span className="console-aggregate-distribution-label">{entry.label}</span>
                    <div className="console-aggregate-distribution-track">
                      <div
                        className="console-aggregate-distribution-fill"
                        style={{ width: `${Math.round((aggregateStats.distribution[entry.id] || 0) * 100)}%` }}
                      />
                    </div>
                    <span className="console-aggregate-distribution-value">
                      {Math.round((aggregateStats.distribution[entry.id] || 0) * 100)}%
                    </span>
                  </div>
                ))}
              </div>

              <div className="console-aggregate-metrics">
                <AggregateBarChart label="Signal Confidence" value={aggregateStats.avgConfidence} tone="catalyst" />
                <AggregateBarChart label="Decision Momentum" value={aggregateStats.avgSpeed} tone="pioneer" />
                <AggregateRingChart label="Hesitation Signature" value={aggregateStats.avgHesitation} tone="strategist" />
              </div>
            </>
          ) : (
            <p className="console-aggregate-empty">Signals will populate here once responses have been recorded.</p>
          )}
        </div>

        <div className={`console-attract-message ${attract ? 'visible' : ''}`}>
          <p>This app uses behavioral analysis to enhace it's prediction of your personalty. Metrics like touch pressure, speed, hesitation, and returning to previous questions are tracked and used for analysis. Your metrics are not saved after each session.</p>
        </div>
      </div>
    </div>
  )
}
