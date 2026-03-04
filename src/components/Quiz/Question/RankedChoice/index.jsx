import React from "react"
import './index.scss'

export default function RankedChoice({ question, answer, setAnswer }) {
  return (
    <div className="ranked-choice question">
      <h2>{question.text}</h2>
      <div className="options">
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