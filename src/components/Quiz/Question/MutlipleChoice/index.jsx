import React, { useEffect, useMemo, useState } from "react"
import { getSelectRule, getSelectionInstruction, normalizeSelections, shuffle, triggerActivePress } from '../../../utils'
import './index.scss'

const ANSWER_STAGGER = 0.08
const ANSWER_BASE_DELAY = 0.18

export default function MultipleChoice({ question, answer, setAnswers, sessionKey, onAnalyticsEvent }) {
  const [orderedOptions, setOrderedOptions] = useState(() => shuffle(question.answers))
  const selectRule = useMemo(() => getSelectRule(question.select), [question.select])
  const selections = normalizeSelections(answer)
  const isPhotoQuestion = question.type === 'multiple-choice-image'
  const [buildActive, setBuildActive] = useState(false)

  useEffect(() => {
    const nextOrder = shuffle(question.answers)
    setOrderedOptions(nextOrder)
    setBuildActive(false)
    const frame = requestAnimationFrame(() => {
      setBuildActive(true)
    })
    onAnalyticsEvent(String(question.id), 'answers_presented_order', {
      order: nextOrder.map(option => option.id),
    })

    return () => cancelAnimationFrame(frame)
  }, [question.id, question.answers, sessionKey, onAnalyticsEvent])

  const isSelected = (optionId) => selections.includes(optionId)
  const isVideoAsset = (content) => /\.(mp4|webm|ogg)$/i.test(content)

  const commitSelections = (nextSelections) => {
    if (selectRule.mode === 'exact' && selectRule.count === 1) {
      setAnswers(prev => ({ ...prev, [question.id]: nextSelections[0] ?? null }))
      return
    }

    setAnswers(prev => ({ ...prev, [question.id]: nextSelections }))
  }

  const handleSelect = (optionId, event) => {
    triggerActivePress(event)
    const questionId = String(question.id)
    const currentlySelected = isSelected(optionId)

    onAnalyticsEvent(questionId, 'pointer_down', {
      optionId,
      pressure: typeof event?.pressure === 'number' ? event.pressure : 0,
      pointerType: event?.pointerType ?? 'mouse',
    })

    let nextSelections = selections

    if (selectRule.mode === 'exact' && selectRule.count === 1) {
      nextSelections = [optionId]
    } else if (currentlySelected) {
      nextSelections = selections.filter(id => id !== optionId)
    } else if (selectRule.mode === 'exact' && selections.length >= selectRule.count) {
      onAnalyticsEvent(questionId, 'selection_limit_reached', {
        selectRule,
        attemptedOptionId: optionId,
      })
      return
    } else {
      nextSelections = [...selections, optionId]
    }

    commitSelections(nextSelections)

    onAnalyticsEvent(questionId, 'answer_changed', {
      optionId,
      selected: !currentlySelected || (selectRule.mode === 'exact' && selectRule.count === 1),
      selectionCount: nextSelections.length,
      selections: nextSelections,
      selectRule,
    })
  }

  return (
    <div className={`multiple-choice ${isPhotoQuestion ? 'photo' : ''} ${buildActive ? 'build-active' : ''}`}>
      <h2>{question.text}</h2>
      <p className="multiple-choice-instruction">{getSelectionInstruction(question.select)}</p>
      <div className="multiple-choice-answers">
        {orderedOptions.map((option, index) => (
          <button
            key={option.id}
            type="button"
            className={`multiple-choice-answers-answer ${isSelected(option.id) ? 'selected' : ''} ${buildActive ? 'build-visible' : ''}`}
            onPointerDown={(event) => handleSelect(option.id, event)}
            style={{ '--answer-delay': buildActive ? `${ANSWER_BASE_DELAY + index * ANSWER_STAGGER}s` : '0s' }}
          >
            {isPhotoQuestion ? (
              isVideoAsset(option.content) ? (
                <video
                  className="multiple-choice-answers-answer-image"
                  src={`${option.content}`}
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                <img
                  className="multiple-choice-answers-answer-image"
                  src={`${option.content}`}
                  alt={option.id}
                />
              )
            ) : (
              option.content
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
