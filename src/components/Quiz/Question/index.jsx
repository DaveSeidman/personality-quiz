import React, { useEffect, useState } from 'react'
import MultipleChoice from './MutlipleChoice'
import RankedChoice from './RankedChoice'
import RangeSliders from './RangeSliders'
import SlideSelect from './SlideSelect'
import { getSelectionValidationMessage, getSlideSelectValidationMessage, isSelectionComplete, triggerActivePress } from '../../utils'
import './index.scss'

export default function Question({
  question,
  answers,
  setAnswers,
  onPrevious,
  onNext,
  onAnalyticsEvent,
  onAnalyticsPatch,
  isFirst,
  sessionKey,
  isActive = false,
  hasVisited = false,
  onExit = () => { }
}) {
  const [draftAnswer, setDraftAnswer] = useState(null)
  const [canProceedLocal, setCanProceedLocal] = useState(false)
  const [validationMessage, setValidationMessage] = useState('')
  const [hasTriggeredBuild, setHasTriggeredBuild] = useState(false)
  const [isBuilding, setIsBuilding] = useState(false)

  useEffect(() => {
    setDraftAnswer(null)
    setCanProceedLocal(false)
    setValidationMessage('')
  }, [question.id, sessionKey])

  const isSlideSelectQuestion = question.type === 'slide-select' || question.type === 'SlideSelect'
  const isImmediateQuestion = question.type === 'multiple-choice-text' || question.type === 'multiple-choice-image'
  const isSelectableQuestion = isImmediateQuestion || isSlideSelectQuestion

  const committedAnswer = answers[question.id]
  const canProceed = isImmediateQuestion
    ? isSelectionComplete(committedAnswer, question.select)
    : canProceedLocal

  useEffect(() => {
    if (canProceed && validationMessage) {
      setValidationMessage('')
    }
  }, [canProceed, validationMessage])

  useEffect(() => {
    setHasTriggeredBuild(false)
    setIsBuilding(false)
  }, [question.id, sessionKey])

  useEffect(() => {
    if (isActive && !hasVisited && !hasTriggeredBuild) {
      setHasTriggeredBuild(true)
      setIsBuilding(true)
      const timer = setTimeout(() => setIsBuilding(false), 800)
      return () => clearTimeout(timer)
    }
  }, [isActive, hasVisited, hasTriggeredBuild])

  const handleNext = () => {
    const questionId = String(question.id)

    if (!canProceed) {
      onAnalyticsEvent(questionId, 'next_clicked_blocked')

      if (question.type === 'ranked-choice') {
        setValidationMessage('Please finish ranking your choices before proceeding.')
      } else if (question.type === 'range-sliders') {
        setValidationMessage('Please set all the range sliders before proceeding.')
      } else if (isSlideSelectQuestion) {
        setValidationMessage(getSlideSelectValidationMessage(question.select))
      } else if (isSelectableQuestion) {
        setValidationMessage(getSelectionValidationMessage(question.select))
      } else {
        setValidationMessage('Please complete this question before proceeding.')
      }
      return
    }

    setValidationMessage('')

    let answerForAnalytics = committedAnswer

    if (!isImmediateQuestion && draftAnswer !== null) {
      answerForAnalytics = draftAnswer
      setAnswers(prev => ({ ...prev, [question.id]: draftAnswer }))
    }

    const now = Date.now()
    onAnalyticsEvent(questionId, 'next_clicked_allowed', { answerSnapshot: answerForAnalytics })
    onAnalyticsPatch(questionId, {
      answerCommittedAt: now,
      nextClickedAt: now,
    })

    onNext()
  }

  return (
    <div className={`question ${!hasVisited ? 'before-visited' : ''} ${isBuilding ? 'build-on' : ''}`} id={`question-${question.id}`}>
      <div className={`question-content ${!hasVisited ? 'before-visited' : ''} ${isBuilding ? 'build-on' : ''}`}>
        {isImmediateQuestion ? (
          <MultipleChoice
            question={question}
            answer={committedAnswer}
            setAnswers={setAnswers}
            sessionKey={sessionKey}
            onAnalyticsEvent={onAnalyticsEvent}
            onAnalyticsPatch={onAnalyticsPatch}
            animateAnswers={!hasVisited}
          />
        ) : question.type === 'ranked-choice' ? (
          <RankedChoice
            question={question}
            sessionKey={sessionKey}
            onDraftChange={setDraftAnswer}
            onReadyChange={setCanProceedLocal}
            onAnalyticsEvent={onAnalyticsEvent}
            onAnalyticsPatch={onAnalyticsPatch}
          />
        ) : question.type === 'range-sliders' ? (
          <RangeSliders
            question={question}
            sessionKey={sessionKey}
            onDraftChange={setDraftAnswer}
            onReadyChange={setCanProceedLocal}
            onAnalyticsEvent={onAnalyticsEvent}
            onAnalyticsPatch={onAnalyticsPatch}
            animateAnswers={!hasVisited}
          />
        ) : question.type === 'slide-select' || question.type === 'SlideSelect' ? (
          <SlideSelect
            question={question}
            sessionKey={sessionKey}
            onDraftChange={setDraftAnswer}
            onReadyChange={setCanProceedLocal}
            onAnalyticsEvent={onAnalyticsEvent}
            onAnalyticsPatch={onAnalyticsPatch}
            animateAnswers={!hasVisited}
          />
        ) : null
        }
      </div>

      {isActive && <div className="question-navigation">
        <div className="question-navigation-prev">
          {isFirst ? (
            <button
              className="question-navigation-prev-button question-navigation-exit-button"
              onClick={(event) => { event.stopPropagation(); onExit(); }}
              onPointerDown={triggerActivePress}
              data-exit-button="true"
            >
              Exit
            </button>
          ) : (
            <button
              className="question-navigation-prev-button"
              onClick={onPrevious}
              onPointerDown={triggerActivePress}
            >
              Prev
            </button>
          )}
        </div>

        <div className="question-navigation-next">
          {validationMessage ? (
            <p className="question-navigation-next-message">
              {validationMessage}
            </p>
          ) : null}

          <button
            className={`question-navigation-next-button ${canProceed ? '' : 'disabled'}`}
            onClick={handleNext}
            onPointerDown={triggerActivePress}
          >
            Next
          </button>
        </div>
      </div>}
    </div>
  )
}
