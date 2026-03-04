import React, { useEffect, useState } from 'react'
import MultipleChoice from './MutlipleChoice'
import RankedChoice from './RankedChoice'
import RangeSliders from './RangeSliders'
import './index.scss'

export default function Question({
  question,
  answers,
  setAnswers,
  onPrevious,
  onNext,
  isFirst,
  sessionKey
}) {
  const [draftAnswer, setDraftAnswer] = useState(null)
  const [canProceedLocal, setCanProceedLocal] = useState(false)

  useEffect(() => {
    setDraftAnswer(null)
    setCanProceedLocal(false)
  }, [question.id, sessionKey])

  const isImmediateQuestion = question.type === 'multiple-choice-text' || question.type === 'multiple-choice-image'
  const committedAnswer = answers[question.id]
  const canProceed = isImmediateQuestion ? Boolean(committedAnswer) : canProceedLocal

  const handleNext = () => {
    if (!isImmediateQuestion && draftAnswer !== null) {
      setAnswers(prev => ({ ...prev, [question.id]: draftAnswer }))
    }
    onNext()
  }

  return (
    <div className="question" id={`question-${question.id}`}>
      <div className="question-content">{
        isImmediateQuestion ? (
          <MultipleChoice
            question={question}
            answer={committedAnswer}
            setAnswers={setAnswers}
            sessionKey={sessionKey}
          />
        ) : question.type === 'ranked-choice' ? (
          <RankedChoice
            question={question}
            sessionKey={sessionKey}
            onDraftChange={setDraftAnswer}
            onReadyChange={setCanProceedLocal}
          />
        ) : question.type === 'range-sliders' ? (
          <RangeSliders
            question={question}
            sessionKey={sessionKey}
            onDraftChange={setDraftAnswer}
            onReadyChange={setCanProceedLocal}
          />
        ) : null
      }</div>

      <div className="question-navigation">
        <button
          className={`question-navigation-prev ${isFirst ? 'hidden' : ''}`}
          onClick={onPrevious}
          disabled={isFirst}
        >
          Previous
        </button>

        <button
          className={`question-navigation-next ${canProceed ? '' : 'hidden'}`}
          onClick={handleNext}
          disabled={!canProceed}
        >
          Next
        </button>
      </div>
    </div>
  )
}
