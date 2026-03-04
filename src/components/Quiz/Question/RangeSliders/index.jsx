import React, { useEffect, useState } from "react"
import { shuffle } from '../utils'
import './index.scss'

export default function RangeSliders({ question, sessionKey, onDraftChange, onReadyChange, onAnalyticsEvent }) {
  const [orderedOptions, setOrderedOptions] = useState(() => shuffle(question.answers))
  const [values, setValues] = useState({})
  const [touched, setTouched] = useState({})

  useEffect(() => {
    const nextOrder = shuffle(question.answers)
    setOrderedOptions(nextOrder)
    setValues({})
    setTouched({})
    onDraftChange(null)
    onReadyChange(false)

    onAnalyticsEvent(String(question.id), 'answers_presented_order', {
      order: nextOrder.map(option => option.id),
    })
  }, [question.id, question.answers, sessionKey, onDraftChange, onReadyChange, onAnalyticsEvent])

  useEffect(() => {
    const touchedCount = Object.keys(touched).length
    const allTouched = orderedOptions.length > 0 && orderedOptions.every(option => touched[option.id])

    onReadyChange(allTouched)

    if (!allTouched) {
      onDraftChange(null)
      return
    }

    const fullValues = orderedOptions.reduce((acc, option) => {
      acc[option.id] = values[option.id] ?? 0
      return acc
    }, {})

    onDraftChange(fullValues)
  }, [orderedOptions, touched, values, onDraftChange, onReadyChange])

  const markTouched = (optionId) => {
    setTouched(prev => ({ ...prev, [optionId]: true }))
  }

  const updateValue = (optionId, nextValue) => {
    setValues(prev => ({ ...prev, [optionId]: Number(nextValue) }))
    onAnalyticsEvent(String(question.id), 'answer_changed', {
      interaction: 'slider_change',
      optionId,
      value: Number(nextValue),
    })
  }

  return (
    <div className="range-sliders">
      <h2 className="range-sliders-title">{question.text}</h2>
      <p className="range-sliders-instruction">Slide each item to score it.</p>

      <div className="range-sliders-list">
        {orderedOptions.map((option) => (
          <div key={option.id} className={`range-sliders-row ${touched[option.id] ? 'touched' : ''}`}>
            <span className="range-sliders-label">{option.content}</span>

            <div className="range-sliders-control">
              <input
                type="range"
                min="-1"
                max="1"
                step="1"
                value={values[option.id] ?? 0}
                onPointerDown={(event) => {
                  markTouched(option.id)
                  onAnalyticsEvent(String(question.id), 'pointer_down', {
                    optionId: option.id,
                    pressure: typeof event.pressure === 'number' ? event.pressure : 0,
                    pointerType: event.pointerType ?? 'mouse',
                  })
                }}
                onPointerUp={(event) => {
                  onAnalyticsEvent(String(question.id), 'pointer_up', {
                    optionId: option.id,
                    pressure: typeof event.pressure === 'number' ? event.pressure : 0,
                  })
                }}
                onChange={(event) => {
                  markTouched(option.id)
                  updateValue(option.id, event.target.value)
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
