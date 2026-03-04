import React, { useEffect, useState } from "react"
import './index.scss'

function shuffle(items) {
  const array = [...items]
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

export default function MultipleChoice({ question, answer, setAnswers, sessionKey }) {
  const [orderedOptions, setOrderedOptions] = useState(() => shuffle(question.answers))

  useEffect(() => {
    setOrderedOptions(shuffle(question.answers))
  }, [question.id, sessionKey])

  return (
    <div className="question multiple-choice">
      <h2>{question.text}</h2>
      <p className="multiple-choice-instruction">&nbsp;</p>
      <div className="multiple-choice-answers">
        {orderedOptions.map((option) => (
          <span
            key={option.id}
            className={`multiple-choice-answers-answer ${answer === option.id ? 'selected' : ''}`}
            onClick={() => setAnswers(prev => ({ ...prev, [question.id]: option.id }))}
          >
            {option.content}
          </span>
        ))}
      </div>
    </div>
  )
}
