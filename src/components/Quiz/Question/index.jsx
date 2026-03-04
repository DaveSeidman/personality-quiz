import React from 'react'
import MultipleChoice from './MutlipleChoice'
import RankedChoice from './RankedChoice'
import RangeSliders from './RangeSliders'
import './index.scss'

export default function Question({ index, question }) {
  const [answer, setAnswer] = React.useState(null)

  return (
    <div className="question">
      <div className="question-content">{
        question.type === 'multiple-choice-text' || question.type === 'multiple-choice-image' ? (
          <MultipleChoice question={question} answer={answer} setAnswer={setAnswer} />
        ) : question.type === 'ranked-choice' ? (
          <RankedChoice question={question} answer={answer} setAnswer={setAnswer} />
        ) : question.type === 'range-sliders' ? (
          <RangeSliders question={question} answer={answer} setAnswer={setAnswer} />
        ) : null
      } </div>
      <div className="question-navigation">
        <button className={`question-navigation-prev ${index === 0 ? 'hidden' : ''}`}>Previous</button>
        <button className={`question-navigation-next ${answer ? '' : 'hidden'}`}>Next</button>
      </div>
    </div>
  )
}