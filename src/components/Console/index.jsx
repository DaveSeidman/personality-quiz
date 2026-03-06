import React, { useEffect, useMemo, useRef } from 'react'
import './index.scss'

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
  const hasSignals = Array.isArray(entry?.data?.events) && entry.data.events.length > 0

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

const buildMetrics = (entry) => {
  if (!entry) return []

  const data = entry.data || {}
  const latencyMs = data.answerCommittedAt && data.firstInteractionAt
    ? data.answerCommittedAt - data.firstInteractionAt
    : null
  const revisitCount = data.revisitCount ?? 0
  const eventCount = Array.isArray(data.events) ? data.events.length : 0
  const confidence = typeof entry.confidence === 'number' ? entry.confidence : null

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

      return {
        id: questionId,
        label: question.label ?? `Question ${question.id}`,
        summary: buildSummary({ entry, personality }),
        metrics: buildMetrics(entry),
        confidence: typeof entry?.confidence === 'number' ? entry.confidence : null,
        interactions: entry?.data?.events?.length ?? 0,
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
    <aside className="console">
      <div className="console-header">
        <div>
          <p className="console-header-label">Signal Console</p>
          <p className="console-header-sub">Facts-for-nerds stream of how the quiz brain is reading the room.</p>
        </div>
        <div className="console-header-indicator">
          <span className="pulse" />
          <span>Live</span>
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
              <div className="console-feed-row-graph">
                <span>Confidence</span>
                <div className="console-feed-row-graph-track">
                  <div className="console-feed-row-graph-fill" style={{ width: `${Math.min(100, Math.max(0, (row.confidence || 0) * 100))}%` }} />
                </div>
              </div>
              <div className="console-feed-row-graph">
                <span>Interactions</span>
                <div className="console-feed-row-graph-track">
                  <div className="console-feed-row-graph-fill interactions" style={{ width: `${Math.min(100, row.interactions * 6)}%` }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
