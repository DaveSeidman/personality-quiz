import React from "react"
import './index.scss'

export default function MultipleChoice({ question, answer, setAnswers }) {
  return (
    <div className="question multiple-choice">
      <h2>{question.text}</h2>
      <div className="multiple-choice-answers">
        {question.answers.map((option, i) => (
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