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

const buildSummary = ({ entry, answerMeta, personality, isActive }) => {
  if (!answerMeta) {
    return isActive ? '\u00A0' : 'Awaiting response…'
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

  const personaDescriptor = personality ? personality.name : (answerMeta.personalityId ?? 'their preferred')
  parts.push(`aligned with ${personaDescriptor}`)

  if (answerMeta?.content) {
    parts.push(`“${answerMeta.content.replace(/\s+/g, ' ').trim()}”`)
  }

  return parts.join(' · ')
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
        summary: buildSummary({ entry, answerMeta, personality, isActive }),
        confidence: answerMeta && typeof entry?.confidence === 'number' ? entry.confidence : null,
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
            {row.confidence !== null ? (
              <div className="console-feed-row-confidence">{Math.round(row.confidence * 100)}% confidence</div>
            ) : null}
          </div>
        ))}
      </div>
    </aside>
  )
}
