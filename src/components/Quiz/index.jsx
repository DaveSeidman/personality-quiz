import React, { useState, useRef, useEffect } from "react"
import Question from "./Question"
import "./index.scss"

export default function Quiz({ attract, questions }) {
  const [currentQuestion, setCurrentQuestion] = useState(0)

  useEffect(() => {
    if (attract) setCurrentQuestion(0)
  }, [attract])

  return (
    <div className="quiz">
      {questions.map((question, index) => (
        <Question key={question.id} index={index} question={question} />
      ))}
    </div>
  )
} 