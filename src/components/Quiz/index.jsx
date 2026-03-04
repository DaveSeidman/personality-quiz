import React, { useState, useRef, useEffect } from "react"
import Question from "./Question"
import "./index.scss"

export default function Quiz({ attract, questions, answers, setAnswers }) {
  const [currentQuestion, setCurrentQuestion] = useState(0)

  useEffect(() => {
    if (attract) setCurrentQuestion(0)
  }, [attract])

  useEffect(() => {
    if (currentQuestion < questions.length - 1 && answers[questions[currentQuestion].id]) {
      setCurrentQuestion(prev => prev + 1)
    }
  }, [answers])

  return (
    <div className="quiz">
      {questions.map((question, index) => (
        <Question
          key={question.id}
          index={index}
          question={question}
          answers={answers}
          setAnswers={setAnswers}
        />
      ))}
    </div>
  )
} 