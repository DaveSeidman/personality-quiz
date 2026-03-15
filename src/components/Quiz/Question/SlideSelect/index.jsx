import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  getSelectRule,
  getSelectionInstruction,
  isSelectionComplete,
  normalizeSelections,
  shuffle,
} from '../../../utils'
import './index.scss'

const CONFIRM_THRESHOLD = 0.5

export default function SlideSelect({ question, sessionKey, onDraftChange, onReadyChange, onAnalyticsEvent, onAnalyticsPatch, animateAnswers = false }) {
  const [orderedOptions, setOrderedOptions] = useState(() => shuffle(question.answers))
  const [progressById, setProgressById] = useState({})
  const [confirmedIds, setConfirmedIds] = useState([])
  const [draggingId, setDraggingId] = useState(null)

  const pointerRef = useRef({ pointerId: null, optionId: null })
  const trackRefs = useRef({})
  const rowRefs = useRef({})

  const selectRule = useMemo(() => getSelectRule(question.select), [question.select])

  useEffect(() => {
    const nextOrder = shuffle(question.answers)
    setOrderedOptions(nextOrder)
    setProgressById({})
    setConfirmedIds([])
    setDraggingId(null)
    pointerRef.current = { pointerId: null, optionId: null }
    onDraftChange(null)
    onReadyChange(false)

    const order = nextOrder.map(option => option.id)
    onAnalyticsEvent(String(question.id), 'answers_presented_order', {
      order,
    })
    onAnalyticsPatch && onAnalyticsPatch(String(question.id), {
      presentation: { answerOrder: order, firstAnswerId: order[0] ?? null },
    })
  }, [question.id, question.answers, sessionKey, onDraftChange, onReadyChange, onAnalyticsEvent, onAnalyticsPatch])

  useEffect(() => {
    onReadyChange(isSelectionComplete(confirmedIds, question.select))

    if (!isSelectionComplete(confirmedIds, question.select)) {
      onDraftChange(null)
      return
    }

    const normalized = normalizeSelections(confirmedIds)
    if (selectRule.mode === 'exact' && selectRule.count === 1) {
      onDraftChange(normalized[0] ?? null)
      return
    }

    onDraftChange(normalized)
  }, [confirmedIds, onDraftChange, onReadyChange, question.select, selectRule.count, selectRule.mode])

  const setProgress = (optionId, nextProgress) => {
    setProgressById(prev => ({ ...prev, [optionId]: nextProgress }))
  }

  const setTrackRef = (optionId, node) => {
    trackRefs.current[optionId] = node
  }

  const setRowRef = (optionId, node) => {
    rowRefs.current[optionId] = node
  }

  const getProgressFromPoint = (optionId, clientX) => {
    const row = rowRefs.current[optionId]
    const track = trackRefs.current[optionId]
    if (!row && !track) return 0

    if (row) {
      const rowRect = row.getBoundingClientRect()
      const styles = window.getComputedStyle(row)
      const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0
      const paddingRight = Number.parseFloat(styles.paddingRight) || 0
      const innerLeft = rowRect.left + paddingLeft
      const innerWidth = rowRect.width - paddingLeft - paddingRight

      if (innerWidth > 0) {
        const rawProgress = (clientX - innerLeft) / innerWidth
        return Math.max(0, Math.min(1, rawProgress))
      }
    }

    const rect = track.getBoundingClientRect()
    if (rect.width <= 0) return 0

    const rawProgress = (clientX - rect.left) / rect.width
    return Math.max(0, Math.min(1, rawProgress))
  }

  const capturePointer = (event) => {
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  const releasePointer = (event) => {
    if (typeof event.currentTarget.hasPointerCapture === 'function' &&
      event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handlePointerDown = (event, optionId) => {
    event.preventDefault()
    capturePointer(event)

    onAnalyticsEvent(String(question.id), 'pointer_down', {
      optionId,
      pressure: typeof event.pressure === 'number' ? event.pressure : 0,
      pointerType: event.pointerType ?? 'mouse',
    })

    pointerRef.current = { pointerId: event.pointerId, optionId }
    setDraggingId(optionId)

    const nextProgress = getProgressFromPoint(optionId, event.clientX)
    setProgress(optionId, nextProgress)
  }

  const handlePointerMove = (event, optionId) => {
    const pointer = pointerRef.current
    if (!pointer.pointerId || pointer.pointerId !== event.pointerId || pointer.optionId !== optionId) return

    const nextProgress = getProgressFromPoint(optionId, event.clientX)
    setProgress(optionId, nextProgress)
  }

  const handlePointerUpOrCancel = (event, optionId) => {
    const pointer = pointerRef.current
    if (!pointer.pointerId || pointer.pointerId !== event.pointerId || pointer.optionId !== optionId) return

    onAnalyticsEvent(String(question.id), 'pointer_up', {
      optionId,
      pressure: typeof event.pressure === 'number' ? event.pressure : 0,
    })

    releasePointer(event)

    const optionProgress = progressById[optionId] ?? 0
    const didConfirm = optionProgress >= CONFIRM_THRESHOLD

    if (!didConfirm) {
      setProgress(optionId, 0)
      const nextSelections = confirmedIds.filter(id => id !== optionId)
      setConfirmedIds(nextSelections)
      onAnalyticsEvent(String(question.id), 'answer_changed', {
        interaction: 'slide_rejected',
        optionId,
        selections: nextSelections,
        progress: optionProgress,
      })
    } else if (selectRule.mode === 'exact' && selectRule.count === 1) {
      setProgressById(prev => {
        const reset = Object.keys(prev).reduce((acc, id) => {
          acc[id] = 0
          return acc
        }, {})
        return { ...reset, [optionId]: 1 }
      })
      setConfirmedIds([optionId])
      onAnalyticsEvent(String(question.id), 'answer_changed', {
        interaction: 'slide_confirmed',
        optionId,
        selections: [optionId],
        progress: optionProgress,
      })
    } else {
      const base = confirmedIds.filter(id => id !== optionId)

      if (selectRule.mode === 'exact' && base.length >= selectRule.count) {
        setProgress(optionId, 0)
        setConfirmedIds(base)
        onAnalyticsEvent(String(question.id), 'selection_limit_reached', {
          attemptedOptionId: optionId,
          selectRule,
          selections: base,
        })
      } else {
        setProgress(optionId, 1)
        const committed = [...base, optionId]
        setConfirmedIds(committed)
        onAnalyticsEvent(String(question.id), 'answer_changed', {
          interaction: 'slide_confirmed',
          optionId,
          selections: committed,
          progress: optionProgress,
        })
      }
    }

    pointerRef.current = { pointerId: null, optionId: null }
    setDraggingId(null)
  }

  return (
    <div className="slide-select">
      <h2 className="slide-select-title">{question.text}</h2>
      <p className="slide-select-subtitle">select {question.select} answer{question.select > 1 ? 's' : ''} by sliding</p>

      <div className="slide-select-list">
        {orderedOptions.map((option, index) => {
          const progress = progressById[option.id] ?? 0
          const isSelected = confirmedIds.includes(option.id)

          return (
            <div
              key={option.id}
              ref={(node) => setRowRef(option.id, node)}
              className={`slide-select-row ${isSelected ? 'selected' : ''} ${draggingId === option.id ? 'dragging' : ''} ${animateAnswers ? 'answer-animate' : ''}`}
              style={{
                ...(animateAnswers ? { animationDelay: `${index * 140}ms` } : undefined),
                '--slide-progress': progress.toFixed(3),
              }}
              onPointerDown={(event) => handlePointerDown(event, option.id)}
              onPointerMove={(event) => handlePointerMove(event, option.id)}
              onPointerUp={(event) => handlePointerUpOrCancel(event, option.id)}
              onPointerCancel={(event) => handlePointerUpOrCancel(event, option.id)}
            >
              <span className="slide-select-row-label">{option.content}</span>

              <div className={`slide-select-row-track-hit ${draggingId === option.id ? 'dragging' : ''}`}>
                <div
                  ref={(node) => setTrackRef(option.id, node)}
                  className="slide-select-row-track"
                >
                  <div className="slide-select-row-fill" style={{ width: `${progress * 100}%` }} />
                  <div className="slide-select-row-thumb" style={{ left: `clamp(.74vh, ${progress * 100}%, calc(100% - .74vh))` }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
