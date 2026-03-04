import React, { useEffect, useMemo, useState } from "react"
import { getSelectRule, getSelectionInstruction, normalizeSelections, shuffle } from '../utils'
import './index.scss'

export default function MultipleChoice({ question, answer, setAnswers, sessionKey }) {
  const [orderedOptions, setOrderedOptions] = useState(() => shuffle(question.answers))
  const selectRule = useMemo(() => getSelectRule(question.select), [question.select])
  const selections = normalizeSelections(answer)

  useEffect(() => {
    setOrderedOptions(shuffle(question.answers))
  }, [question.id, sessionKey])

  const isSelected = (optionId) => selections.includes(optionId)

  const commitSelections = (nextSelections) => {
    if (selectRule.mode === 'exact' && selectRule.count === 1) {
      setAnswers(prev => ({ ...prev, [question.id]: nextSelections[0] ?? null }))
      return
    }

    setAnswers(prev => ({ ...prev, [question.id]: nextSelections }))
  }

  const handleSelect = (optionId) => {
    const currentlySelected = isSelected(optionId)

    if (selectRule.mode === 'exact' && selectRule.count === 1) {
      commitSelections([optionId])
      return
    }

    if (currentlySelected) {
      commitSelections(selections.filter(id => id !== optionId))
      return
    }

    if (selectRule.mode === 'exact' && selections.length >= selectRule.count) {
      return
    }

    commitSelections([...selections, optionId])
  }

  return (
    <div className="question multiple-choice">
      <h2>{question.text}</h2>
      <p className="multiple-choice-instruction">{getSelectionInstruction(question.select)}</p>
      <div className="multiple-choice-answers">
        {orderedOptions.map((option) => (
          <span
            key={option.id}
            className={`multiple-choice-answers-answer ${isSelected(option.id) ? 'selected' : ''}`}
            onClick={() => handleSelect(option.id)}
          >
            {option.content}
          </span>
        ))}
      </div>
    </div>
  )
}
