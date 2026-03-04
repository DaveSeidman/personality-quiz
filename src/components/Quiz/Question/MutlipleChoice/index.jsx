import React from "react"
import './index.scss'

export default function MultipleChoice({ question, answer, setAnswer }) {
  return (
    <div className="question multiple-choice">
      <h2>{question.text}</h2>
      <div className="multiple-choice-answers">
        {question.answers.map((option, i) => (
          <span
            key={option.id}
            className={answer === option.id ? 'selected' : ''}
            onClick={() => setAnswer(option.id)}
          >
            {option.content}
          </span>
        ))}
      </div>
    </div>
  )
}