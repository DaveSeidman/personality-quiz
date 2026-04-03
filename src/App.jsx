import React, { useEffect, useState, useRef } from 'react'
import Quiz from './components/Quiz'
import Attract from './components/Attract'
import Console from './components/Console'
import Background from './components/Background'
import useFaceAnalysis from './components/useFaceAnalysis'
import { applyBrandTheme, loadBrandExperience } from './branding'
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
  const [experienceState, setExperienceState] = useState({
    status: 'loading',
    brand: null,
    quizData: null,
    error: null,
  })
  const [attract, setAttract] = useState(true)
  const [answers, setAnswers] = useState({})
  const [analytics, setAnalytics] = useState({})
  const [activeQuestionId, setActiveQuestionId] = useState(null)
  const [analysisComplete, setAnalysisComplete] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const activityTimeoutRef = useRef(null)
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()
  const faceAnalysisEnabled = experienceState.quizData?.features?.faceAnalysis !== false
  const { videoRef: faceVideoRef, faceAnalysis } = useFaceAnalysis({
    active: experienceState.status === 'ready' && faceAnalysisEnabled && !attract && cameraEnabled,
  })
  const INACTIVITY_TIMEOUT = 60000

  useEffect(() => {
    let cancelled = false

    const loadExperience = async () => {
      try {
        const nextExperience = await loadBrandExperience()
        if (cancelled) return

        applyBrandTheme(nextExperience.brand)
        setExperienceState({
          status: 'ready',
          brand: nextExperience.brand,
          quizData: nextExperience.quizData,
          error: null,
        })
      } catch (error) {
        console.error('Unable to load brand experience', error)
        if (cancelled) return

        setExperienceState({
          status: 'error',
          brand: null,
          quizData: null,
          error,
        })
      }
    }

    loadExperience()

    return () => {
      cancelled = true
    }
  }, [])

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

    const handleContextMenu = (event) => event.preventDefault()
    window.addEventListener('click', handleGlobalClick)
    window.addEventListener('contextmenu', handleContextMenu)

    return () => {
      window.removeEventListener('click', handleGlobalClick)
      window.removeEventListener('contextmenu', handleContextMenu)
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!faceAnalysisEnabled) {
      setCameraEnabled(false)
    }
  }, [faceAnalysisEnabled])

  if (experienceState.status !== 'ready') {
    return (
      <div className="app app--loading">
        <div className="app-loading-panel">
          <p>Loading quiz experience...</p>
          <span>
            {experienceState.status === 'error'
              ? 'Unable to load the selected brand. Please check the configuration and try again.'
              : 'Preparing assets, copy, and questions.'}
          </span>
        </div>
      </div>
    )
  }

  const { brand, quizData } = experienceState

  return (
    <div className="app">
      <Background brand={brand} />

      <div className="app-layout">
        <Quiz
          brand={brand}
          attract={attract}
          quizId={quizData.quizId}
          features={quizData.features || {}}
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
          faceAnalysisEnabled={faceAnalysisEnabled}
          faceAnalysis={faceAnalysis}
        />
      </div>

      <Attract
        attract={attract}
        quizData={quizData}
        brand={brand}
      />

      <div className="app-logo">
        <img src={brand.assets.logo} alt={`${brand.displayName || 'Quiz'} logo`} />
      </div>

      {faceAnalysisEnabled ? (
        <button
          className={`app-camera-btn${cameraEnabled ? ' is-active hidden' : ''}`}
          onClick={() => setCameraEnabled((enabled) => !enabled)}
          data-exit-button="true"
        >
          {cameraEnabled ? 'Cam On' : 'Cam Off'}
        </button>
      ) : null}

      <button
        className={`app-fullscreen-btn${isFullscreen ? ' hidden' : ''}`}
        onClick={toggleFullscreen}
        data-exit-button="true"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" />
          <path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
      </button>

      {faceAnalysisEnabled ? (
        <video
          ref={faceVideoRef}
          className="app-camera-proxy"
          autoPlay
          muted
          playsInline
        />
      ) : null}
    </div>
  )
}
