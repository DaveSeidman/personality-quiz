import React, { useEffect, useState, useRef } from 'react'
import Quiz from './components/Quiz'
import Attract from './components/Attract'
import Console from './components/Console'
import useFaceAnalysis from './components/useFaceAnalysis'
import quizData from './assets/data/quiz.json'
import backgroundVideo from './assets/videos/pulses1-loop.mp4'
import logoImg from './assets/images/logo-white.png'
import './index.scss'

function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
  }

  return { isFullscreen, toggle }
}

export default function App() {

  const [attract, setAttract] = useState(true)
  const [answers, setAnswers] = useState({})
  const [analytics, setAnalytics] = useState({})
  const [activeQuestionId, setActiveQuestionId] = useState(null)
  const [analysisComplete, setAnalysisComplete] = useState(false)
  const activityTimeoutRef = useRef(null)
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()
  const { videoRef, faceAnalysis } = useFaceAnalysis({ active: !attract })
  const INACTIVITY_TIMEOUT = 120000

  const activityTimeout = () => {
    setAttract(true)
    setAnswers({})
    setAnalytics({})
    setAnalysisComplete(false)
  }

  const resetInactivityTimeout = () => {
    setAttract(false)
    if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current)
    activityTimeoutRef.current = setTimeout(activityTimeout, INACTIVITY_TIMEOUT)
  }

  const handleExitToAttract = () => {
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current)
      activityTimeoutRef.current = null
    }
    activityTimeout()
    setActiveQuestionId(null)
    setAnalysisComplete(false)
  }

  useEffect(() => {
    const handleGlobalClick = (event) => {
      if (event.target.closest('[data-exit-button="true"]')) {
        return
      }
      resetInactivityTimeout()
    }

    // Kiosk: suppress context menu on long-press
    const handleContextMenu = (event) => event.preventDefault()

    window.addEventListener('click', handleGlobalClick)
    window.addEventListener('contextmenu', handleContextMenu)

    return () => {
      window.removeEventListener('click', handleGlobalClick)
      window.removeEventListener('contextmenu', handleContextMenu)
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
          onExit={handleExitToAttract}
          onAnalysisCompleteChange={setAnalysisComplete}
        />

        <Console
          attract={attract}
          analytics={analytics}
          questions={quizData.questions}
          answers={answers}
          personalities={quizData.personalities}
          activeQuestionId={activeQuestionId}
          analysisComplete={analysisComplete}
          faceAnalysis={faceAnalysis}
        />
      </div>

      <Attract
        attract={attract}
        quizData={quizData}
      />

      <div className='app-logo'>
        <img src={logoImg} alt="Logo" />
      </div>

      <button
        className={`app-fullscreen-btn${isFullscreen ? ' hidden' : ''}`}
        onClick={toggleFullscreen}
        data-exit-button="true"
        aria-label="Enter fullscreen"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
          <path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
        </svg>
      </button>

      <video
        ref={videoRef}
        className="app-camera-proxy"
        autoPlay
        muted
        playsInline
        aria-hidden="true"
      />
    </div>
  )
}
