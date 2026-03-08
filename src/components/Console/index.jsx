import React, { useEffect, useMemo, useRef } from 'react'
import { computeQuestionConfidence } from '../Quiz/analytics'
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

export default function Console({ analytics, questions, answers, personalities, activeQuestionId }) {
  const personalityMap = useMemo(() => (
    personalities?.reduce((acc, persona) => {
      acc[persona.id] = persona
      return acc
    }, {}) ?? {}
  ), [personalities])

  const rowRefs = useRef({})

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
      const eventCount = activityEvents.length
      const hasMeaningfulSignals = eventCount > 0

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
        <div className="console-header-indicator">
          <span className="pulse" />
          <span>Analyzing</span>
        </div>
      </div>

      <div className="console-feed">
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
              {row.summary.trim() ? row.summary : '\u00A0'}
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
                  const rows = Math.max(3, Math.ceil(row.interactions / dotsPerRow))
                  const totalDots = rows * dotsPerRow
                  return (
                    <div className="interaction-dot-grid" style={{ '--rows': rows }}>
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
    </div>
  )
}
