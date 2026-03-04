import React, { useEffect, useState, useRef } from 'react'
import Quiz from './components/Quiz'
import Analysis from './components/Analysis'
import Attract from './components/Attract'
import quizData from './assets/data/quiz.json'
import './index.scss'

export default function App() {

  const [attract, setAttract] = useState(true)
  const [answers, setAnswers] = useState({})
  const [analytics, setAnalytics] = useState({})
  const [showAnalysis, setShowAnalysis] = useState(false)
  const activityTimeoutRef = useRef(null)
  const INACTIVITY_TIMEOUT = 120000
  const isProduction = import.meta.env.PROD

  const activityTimeout = () => {
    setAttract(true)
    setAnswers({})
    setAnalytics({})
  }

  const resetInactivityTimeout = () => {
    setAttract(false)
    if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current)
    activityTimeoutRef.current = setTimeout(activityTimeout, INACTIVITY_TIMEOUT)
  }

  useEffect(() => {
    window.addEventListener('click', resetInactivityTimeout)

    return () => {
      window.removeEventListener('click', resetInactivityTimeout)
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current)
    }
  }, [])

  return (
    <div className="app">
      <Quiz
        attract={attract}
        questions={quizData.questions}
        answers={answers}
        setAnswers={setAnswers}
        analytics={analytics}
        setAnalytics={setAnalytics}
      />

      {!isProduction ? (
        <Analysis
          answers={answers}
          analytics={analytics}
          visible={showAnalysis}
          onToggle={() => setShowAnalysis(prev => !prev)}
        />
      ) : null}

      <Attract attract={attract} />
    </div>
  )
}