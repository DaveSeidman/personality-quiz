import React, { useEffect, useState, useRef } from 'react'
import Quiz from './components/Quiz'
import Attract from './components/Attract'
import quizData from './assets/data/quiz.json'
import './index.scss'

export default function App() {

  const [attract, setAttract] = useState(true)
  const activityTimeoutRef = useRef(null)
  const INACTIVITY_TIMEOUT = 60000

  const activityTimeout = () => {
    setAttract(true)
  }

  const resetInactivityTimeout = () => {
    setAttract(false)
    activityTimeoutRef.current = setTimeout(activityTimeout, INACTIVITY_TIMEOUT)
  }


  useEffect(() => {

    addEventListener('click', resetInactivityTimeout)

    return () => {
      removeEventListener('click', resetInactivityTimeout)
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current)
    }
  }, [])

  return (
    <div className="app">
      <Quiz attract={attract} questions={quizData.questions} />
      <Attract attract={attract} />
    </div>
  )
}