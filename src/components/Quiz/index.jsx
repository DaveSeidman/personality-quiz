import React, { useEffect, useState } from "react"
import Question from "./Question"
import Results from "./Results"
import "./index.scss"

function fakeSubmitAnswers(payload) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("Fake API submit:", payload)
      resolve({ ok: true })
    }, 900)
  })
}

export default function Quiz({ attract, questions, answers, setAnswers }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [sessionKey, setSessionKey] = useState(0)

  const totalSteps = questions.length + 1
  const resultsStepIndex = questions.length

  useEffect(() => {
    if (attract) {
      setCurrentStep(0)
      setSessionKey(prev => prev + 1)
    }
  }, [attract])

  useEffect(() => {
    const element = document.getElementById(`step-${currentStep}`)
    if (!element) return

    element.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" })
  }, [currentStep])

  const goToPrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
  }

  const goToNext = () => {
    setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1))
  }

  return (
    <div className="quiz">
      {questions.map((question, index) => (
        <div className="quiz-step" id={`step-${index}`} key={question.id}>
          <Question
            question={question}
            answers={answers}
            setAnswers={setAnswers}
            onPrevious={goToPrevious}
            onNext={goToNext}
            isFirst={index === 0}
            sessionKey={sessionKey}
          />
        </div>
      ))}

      <div className="quiz-step" id={`step-${resultsStepIndex}`}>
        <Results
          answers={answers}
          onPrevious={goToPrevious}
          onSubmit={() => fakeSubmitAnswers(answers)}
        />
      </div>
    </div>
  )
}
