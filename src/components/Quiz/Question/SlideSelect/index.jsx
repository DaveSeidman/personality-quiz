import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  getSelectRule,
  getSelectionInstruction,
  isSelectionComplete,
  normalizeSelections,
  shuffle,
} from '../utils'
import './index.scss'

const CONFIRM_THRESHOLD = 0.5

export default function SlideSelect({ question, sessionKey, onDraftChange, onReadyChange }) {
  const [orderedOptions, setOrderedOptions] = useState(() => shuffle(question.answers))
  const [progressById, setProgressById] = useState({})
  const [confirmedIds, setConfirmedIds] = useState([])
  const [draggingId, setDraggingId] = useState(null)

  const pointerRef = useRef({ pointerId: null, optionId: null })
  const trackRefs = useRef({})

  const selectRule = useMemo(() => getSelectRule(question.select), [question.select])

  useEffect(() => {
    setOrderedOptions(shuffle(question.answers))
    setProgressById({})
    setConfirmedIds([])
    setDraggingId(null)
    pointerRef.current = { pointerId: null, optionId: null }
    onDraftChange(null)
    onReadyChange(false)
  }, [question.id, question.answers, sessionKey, onDraftChange, onReadyChange])

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

  const getProgressFromPoint = (optionId, clientX) => {
    const track = trackRefs.current[optionId]
    if (!track) return 0

    const rect = track.getBoundingClientRect()
    if (rect.width <= 0) return 0

    const rawProgress = (clientX - rect.left) / rect.width
    return Math.max(0, Math.min(1, rawProgress))
  }

  const handlePointerDown = (event, optionId) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)

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

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const optionProgress = progressById[optionId] ?? 0
    const didConfirm = optionProgress >= CONFIRM_THRESHOLD

    if (!didConfirm) {
      setProgress(optionId, 0)
      setConfirmedIds(prev => prev.filter(id => id !== optionId))
    } else if (selectRule.mode === 'exact' && selectRule.count === 1) {
      setProgressById(prev => {
        const reset = Object.keys(prev).reduce((acc, id) => {
          acc[id] = 0
          return acc
        }, {})
        return { ...reset, [optionId]: 1 }
      })
      setConfirmedIds([optionId])
    } else {
      setConfirmedIds(prev => {
        const next = prev.filter(id => id !== optionId)

        if (selectRule.mode === 'exact' && next.length >= selectRule.count) {
          setProgress(optionId, 0)
          return next
        }

        setProgress(optionId, 1)
        return [...next, optionId]
      })
    }

    pointerRef.current = { pointerId: null, optionId: null }
    setDraggingId(null)
  }

  return (
    <div className="slide-select">
      <h2 className="slide-select-title">{question.text}</h2>
      <p className="slide-select-subtitle">{getSelectionInstruction(question.select)} Slide any answer to confirm.</p>

      <div className="slide-select-list">
        {orderedOptions.map((option) => {
          const progress = progressById[option.id] ?? 0
          const isSelected = confirmedIds.includes(option.id)

          return (
            <div key={option.id} className={`slide-select-row ${isSelected ? 'selected' : ''}`}>
              <span className="slide-select-row-label">{option.content}</span>

              <div
                ref={(node) => setTrackRef(option.id, node)}
                className={`slide-select-row-track ${draggingId === option.id ? 'dragging' : ''}`}
                onPointerDown={(event) => handlePointerDown(event, option.id)}
                onPointerMove={(event) => handlePointerMove(event, option.id)}
                onPointerUp={(event) => handlePointerUpOrCancel(event, option.id)}
                onPointerCancel={(event) => handlePointerUpOrCancel(event, option.id)}
              >
                <div className="slide-select-row-fill" style={{ width: `${progress * 100}%` }} />
                <div className="slide-select-row-thumb" style={{ left: `calc(${progress * 100}% - 14px)` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
