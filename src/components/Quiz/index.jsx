import React, { useCallback, useEffect, useRef, useState } from "react"
import Question from "./Question"
import Results from "./Results"
import { CONFIDENCE_WEIGHTS, finalizeAnalytics } from "./analytics"
import "./index.scss"

const REMOTE_API = 'https://personality-quiz-backend-eogn.onrender.com'

async function submitAnswersToBackend(payload) {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  const baseUrl = isLocalhost
    ? (import.meta.env.VITE_QUIZ_API_URL || 'http://localhost:8000')
    : REMOTE_API

  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Backend submit failed (${response.status})`)
  }

  return response.json()
}

export default function Quiz({ attract, quizId, questions, personalities, answers, setAnswers, analytics, setAnalytics, onActiveQuestionChange = () => {}, onExit = () => {}, onAnalysisCompleteChange = () => {} }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [sessionKey, setSessionKey] = useState(0)
  const [submissionResult, setSubmissionResult] = useState(null)
  const [visitedQuestions, setVisitedQuestions] = useState({})
  const [quizTransition, setQuizTransition] = useState('')
  const [useSmoothScroll, setUseSmoothScroll] = useState(true)
  const [isResetting, setIsResetting] = useState(false)
  const quizRef = useRef(null)

  const totalSteps = questions.length + 1
  const resultsStepIndex = questions.length
  const seenQuestionIdsRef = useRef(new Set())
  const visitCountsRef = useRef(new Map())
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
      setQuizTransition('fade-out')
      setTimeout(() => {
        setCurrentStep(0)
        setSessionKey(prev => prev + 1)
        seenQuestionIdsRef.current = new Set()
        visitCountsRef.current = new Map()
        setAnalytics({})
        setSubmissionResult(null)
        setVisitedQuestions({})
        onAnalysisCompleteChange(false)
        setQuizTransition('fade-in')
        setTimeout(() => setQuizTransition(''), 1500)
      }, 500)
    }
  }, [attract, setAnalytics, onAnalysisCompleteChange])

  useEffect(() => {
    const element = document.getElementById(`step-${currentStep}`)
    if (!element) return

    element.scrollIntoView({ behavior: useSmoothScroll ? 'smooth' : 'auto', block: 'center', inline: 'center' })

    if (currentStep < questions.length) {
      const question = questions[currentStep]
      const questionId = String(question.id)
      const now = Date.now()

      const visitCount = (visitCountsRef.current.get(questionId) ?? 0) + 1
      visitCountsRef.current.set(questionId, visitCount)
      const hasSeen = visitCount > 1
      const revisitCount = Math.max(0, visitCount - 1)
      if (!seenQuestionIdsRef.current.has(questionId)) {
        seenQuestionIdsRef.current.add(questionId)
      }

      setAnalytics((prev) => {
        const prevEntry = prev[questionId] ?? { confidence: 0, data: { events: [], revisitCount: 0 } }
        const prevData = prevEntry.data ?? { events: [], revisitCount: 0 }

        return {
          ...prev,
          [questionId]: {
            confidence: prevEntry.confidence ?? 0,
            data: {
              ...prevData,
              questionId,
              questionType: question.type,
              presentedAt: now,
              revisitCount,
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

      if (visitCount === 1) {
        setVisitedQuestions(prev => (prev[questionId] ? prev : { ...prev, [questionId]: true }))
      }
    }
  }, [currentStep, questions, setAnalytics, useSmoothScroll])

  useEffect(() => {
    if (!questions || questions.length === 0) {
      onActiveQuestionChange(null)
      return
    }

    if (currentStep < questions.length) {
      onActiveQuestionChange(String(questions[currentStep].id))
    } else {
      onActiveQuestionChange(null)
    }
  }, [currentStep, onActiveQuestionChange, questions])


  useEffect(() => {
    onAnalysisCompleteChange(Boolean(submissionResult))
  }, [submissionResult, onAnalysisCompleteChange])

  const goToPrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
  }

  const goToNext = () => {
    setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1))
  }

  const handleSubmit = async () => {
    const finalizedAnalytics = finalizeAnalytics(analytics, CONFIDENCE_WEIGHTS)
    setAnalytics(finalizedAnalytics)

    const payload = {
      quizId,
      personalities,
      questions,
      answers,
      analytics: finalizedAnalytics,
      confidenceWeights: CONFIDENCE_WEIGHTS,
      submittedAt: Date.now(),
    }

    const result = await submitAnswersToBackend(payload)
    setSubmissionResult(result)
    console.log('Backend analysis result:', result)
  }

  const handleStartOver = () => {
    setQuizTransition('fade-out')
    setIsResetting(true)
    setUseSmoothScroll(false)
    setTimeout(() => {
      setAnswers({})
      setAnalytics({})
      setSubmissionResult(null)
      onAnalysisCompleteChange(false)
      setSessionKey(prev => prev + 1)
      seenQuestionIdsRef.current = new Set()
      visitCountsRef.current = new Map()
      setVisitedQuestions({})
      setCurrentStep(0)

      requestAnimationFrame(() => {
        const firstStep = document.getElementById('step-0')
        if (firstStep) {
          firstStep.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' })
        }
        setQuizTransition('fade-in')
        setTimeout(() => {
          setQuizTransition('')
          setIsResetting(false)
          setUseSmoothScroll(true)
        }, 500)
      })
    }, 200)
  }

  return (
    <div ref={quizRef} className={`quiz ${quizTransition} ${isResetting ? 'quiz--hidden' : ''}`}>
      {questions.map((question, index) => (
        <div
          className="quiz-step"
          id={`step-${index}`}
          key={question.id}
        >
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
            isActive={currentStep === index}
            hasVisited={Boolean(visitedQuestions[question.id])}
            onExit={onExit}
          />
        </div>
      ))}

      <div
        className="quiz-step"
        id={`step-${resultsStepIndex}`}
      >
        <Results
          result={submissionResult}
          analytics={analytics}
          questions={questions}
          answers={answers}
          sessionKey={sessionKey}
          onPrevious={goToPrevious}
          onSubmit={handleSubmit}
          onStartOver={handleStartOver}
        />
      </div>
    </div>
  )
}
