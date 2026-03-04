import React, { useEffect, useState, useRef } from 'react'
import Quiz from './components/Quiz'
import Analysis from './components/Analysis'
import Attract from './components/Attract'
import quizData from './assets/data/quiz.json'
import './index.scss'

export default function App() {

  const [attract, setAttract] = useState(true)
  const [answers, setAnswers] = useState({})
  const activityTimeoutRef = useRef(null)
  const INACTIVITY_TIMEOUT = 60000

  const activityTimeout = () => {
    setAttract(true)
    setAnswers({})
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
      />
      <Analysis answers={answers} />
      <Attract attract={attract} />
    </div>
  )
}