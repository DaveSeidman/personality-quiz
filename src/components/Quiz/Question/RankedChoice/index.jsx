import React, { useEffect, useRef, useState } from "react"
import './index.scss'

function shuffle(items) {
  const array = [...items]
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

export default function RankedChoice({ question, sessionKey, onDraftChange, onReadyChange }) {
  const [orderedOptions, setOrderedOptions] = useState(() => shuffle(question.answers))
  const [draggingId, setDraggingId] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [touchedIds, setTouchedIds] = useState({})

  const dragRef = useRef({ pointerId: null, optionId: null })

  useEffect(() => {
    const nextOrder = shuffle(question.answers)
    setOrderedOptions(nextOrder)
    setTouchedIds({})
    onDraftChange(nextOrder.map(option => option.id))
    onReadyChange(false)
  }, [question.id, question.answers, sessionKey, onDraftChange, onReadyChange])

  useEffect(() => {
    onDraftChange(orderedOptions.map(option => option.id))
  }, [orderedOptions, onDraftChange])

  useEffect(() => {
    onReadyChange(Object.keys(touchedIds).length > 0)
  }, [touchedIds, onReadyChange])

  const handlePointerDown = (event, optionId) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)

    setTouchedIds(prev => ({ ...prev, [optionId]: true }))
    dragRef.current = { pointerId: event.pointerId, optionId }
    setDraggingId(optionId)
    setIsDragging(true)
  }

  const handlePointerMove = (event) => {
    const drag = dragRef.current
    if (!isDragging || drag.pointerId !== event.pointerId || !drag.optionId) return

    const element = document.elementFromPoint(event.clientX, event.clientY)
    const row = element?.closest('[data-option-id]')
    const hoverId = row?.getAttribute('data-option-id')
    if (!hoverId || hoverId === drag.optionId) return

    setOrderedOptions(prev => {
      const from = prev.findIndex(option => option.id === drag.optionId)
      const to = prev.findIndex(option => option.id === hoverId)
      if (from === -1 || to === -1 || from === to) return prev

      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const clearPointerState = (event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    dragRef.current = { pointerId: null, optionId: null }
    setDraggingId(null)
    setIsDragging(false)
  }

  return (
    <div className="ranked-choice">
      <h2 className="ranked-choice-title">{question.text}</h2>
      <p className="ranked-choice-subtitle">rearrange the answers so that your favorite is on top and least favorite is on bottom</p>

      <div className="ranked-choice-list">
        {orderedOptions.map((option, index) => (
          <div
            key={option.id}
            data-option-id={option.id}
            className={`ranked-choice-row ${draggingId === option.id ? 'dragging' : ''} ${touchedIds[option.id] ? 'touched' : ''}`}
            onPointerDown={(event) => handlePointerDown(event, option.id)}
            onPointerMove={handlePointerMove}
            onPointerUp={clearPointerState}
            onPointerCancel={clearPointerState}
          >
            <span className="ranked-choice-rank">{index + 1}</span>
            <span className="ranked-choice-label">{option.content}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
