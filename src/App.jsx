import React, { useEffect, useState, useRef } from 'react'
import Quiz from './components/Quiz'
import Attract from './components/Attract'
import Console from './components/Console'
import quizData from './assets/data/quiz.json'
import backgroundVideo from './assets/videos/background2.mp4'
import logoImg from './assets/images/logo.png'
import './index.scss'

export default function App() {

  const [attract, setAttract] = useState(true)
  const [answers, setAnswers] = useState({})
  const [analytics, setAnalytics] = useState({})
  const [activeQuestionId, setActiveQuestionId] = useState(null)
  const activityTimeoutRef = useRef(null)
  const INACTIVITY_TIMEOUT = 120000

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
      <video className="app-background" autoPlay loop muted>
        <source src={backgroundVideo} type="video/mp4" />
      </video>

      <div className="app-layout">
        <Quiz
          attract={attract}
          quizId={quizData.quizId}
          questions={quizData.questions}
          personalities={quizData.personalities}
          answers={answers}
          setAnswers={setAnswers}
          analytics={analytics}
          setAnalytics={setAnalytics}
          onActiveQuestionChange={setActiveQuestionId}
        />

        <Console
          analytics={analytics}
          questions={quizData.questions}
          answers={answers}
          personalities={quizData.personalities}
          activeQuestionId={activeQuestionId}
        />
      </div>

      <Attract attract={attract} />

      <div className='app-logo'>
        <img src={logoImg} alt="Logo" />
      </div>
    </div>
  )
}
