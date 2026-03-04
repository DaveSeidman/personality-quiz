import React, { useCallback, useEffect, useRef, useState } from "react"
import Question from "./Question"
import Results from "./Results"
import { CONFIDENCE_WEIGHTS, finalizeAnalytics } from "./analytics"
import "./index.scss"

function fakeSubmitAnswers(payload) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("Fake API submit:", payload)
      resolve({ ok: true })
    }, 900)
  })
}

export default function Quiz({ attract, questions, answers, setAnswers, analytics, setAnalytics }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [sessionKey, setSessionKey] = useState(0)

  const totalSteps = questions.length + 1
  const resultsStepIndex = questions.length
  const seenQuestionIdsRef = useRef(new Set())
  const questionTypeById = useRef(Object.fromEntries(questions.map(question => [String(question.id), question.type])))

  const ensureQuestionAnalytics = useCallback((questionId, patch = {}) => {
    setAnalytics((prev) => {
      const prevEntry = prev[questionId] ?? { confidence: 0, data: { events: [], revisitCount: 0 } }
      const prevData = prevEntry.data ?? { events: [], revisitCount: 0 }

      return {
        ...prev,
        [questionId]: {
          confidence: prevEntry.confidence ?? 0,
          data: {
            ...prevData,
            ...patch,
            events: prevData.events ?? [],
          },
        },
      }
    })
  }, [setAnalytics])

  const trackQuestionEvent = useCallback((questionId, type, payload = {}) => {
    const now = Date.now()

    setAnalytics((prev) => {
      const prevEntry = prev[questionId] ?? { confidence: 0, data: { events: [], revisitCount: 0 } }
      const prevData = prevEntry.data ?? { events: [], revisitCount: 0 }

      const nextEvents = [
        ...(prevData.events ?? []),
        {
          timestamp: now,
          type,
          payload,
        },
      ]

      const firstInteractionAt =
        prevData.firstInteractionAt ??
        (type.startsWith('pointer_') || type === 'answer_changed' ? now : null)

      return {
        ...prev,
        [questionId]: {
          confidence: prevEntry.confidence ?? 0,
          data: {
            ...prevData,
            questionId,
            questionType: prevData.questionType ?? questionTypeById.current[String(questionId)],
            events: nextEvents,
            firstInteractionAt,
          },
        },
      }
    })
  }, [setAnalytics])

  useEffect(() => {
    if (attract) {
      setCurrentStep(0)
      setSessionKey(prev => prev + 1)
      seenQuestionIdsRef.current = new Set()
      setAnalytics({})
    }
  }, [attract, setAnalytics])

  useEffect(() => {
    const element = document.getElementById(`step-${currentStep}`)
    if (!element) return

    element.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" })

    if (currentStep < questions.length) {
      const question = questions[currentStep]
      const questionId = String(question.id)
      const now = Date.now()

      setAnalytics((prev) => {
        const prevEntry = prev[questionId] ?? { confidence: 0, data: { events: [], revisitCount: 0 } }
        const prevData = prevEntry.data ?? { events: [], revisitCount: 0 }

        const hasSeen = seenQuestionIdsRef.current.has(questionId)
        if (!hasSeen) seenQuestionIdsRef.current.add(questionId)

        return {
          ...prev,
          [questionId]: {
            confidence: prevEntry.confidence ?? 0,
            data: {
              ...prevData,
              questionId,
              questionType: question.type,
              presentedAt: now,
              revisitCount: hasSeen ? (prevData.revisitCount ?? 0) + 1 : (prevData.revisitCount ?? 0),
              events: [
                ...(prevData.events ?? []),
                {
                  timestamp: now,
                  type: hasSeen ? 'question_revisited' : 'question_presented',
                  payload: { stepIndex: currentStep },
                },
              ],
            },
          },
        }
      })
    }
  }, [currentStep, questions, setAnalytics])

  const goToPrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
  }

  const goToNext = () => {
    setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1))
  }

  const handleSubmit = async () => {
    const finalizedAnalytics = finalizeAnalytics(analytics, CONFIDENCE_WEIGHTS)
    setAnalytics(finalizedAnalytics)

    await fakeSubmitAnswers({
      answers,
      analytics: finalizedAnalytics,
      confidenceWeights: CONFIDENCE_WEIGHTS,
    })
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
            onAnalyticsEvent={trackQuestionEvent}
            onAnalyticsPatch={ensureQuestionAnalytics}
            isFirst={index === 0}
            sessionKey={sessionKey}
          />
        </div>
      ))}

      <div className="quiz-step" id={`step-${resultsStepIndex}`}>
        <Results
          answers={answers}
          analytics={analytics}
          confidenceWeights={CONFIDENCE_WEIGHTS}
          onPrevious={goToPrevious}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  )
}
