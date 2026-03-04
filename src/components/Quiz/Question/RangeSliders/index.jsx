import React, { useEffect, useState } from "react"
import { shuffle } from '../utils'
import './index.scss'

export default function RangeSliders({ question, sessionKey, onDraftChange, onReadyChange }) {
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
  }, [question.id, question.answers, sessionKey, onDraftChange, onReadyChange])

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
  }

  return (
    <div className="range-sliders">
      <h2 className="range-sliders-title">{question.text}</h2>
      <p className="range-sliders-instruction">Slide each item to score it from -1 to 1.</p>

      <div className="range-sliders-list">
        {orderedOptions.map((option) => (
          <div key={option.id} className={`range-sliders-row ${touched[option.id] ? 'touched' : ''}`}>
            <span className="range-sliders-label">{option.content}</span>

            <div className="range-sliders-control">
              <span>-1</span>
              <input
                type="range"
                min="-1"
                max="1"
                step="1"
                value={values[option.id] ?? 0}
                onPointerDown={() => markTouched(option.id)}
                onChange={(event) => {
                  markTouched(option.id)
                  updateValue(option.id, event.target.value)
                }}
              />
              <span>0</span>
              <span>1</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
