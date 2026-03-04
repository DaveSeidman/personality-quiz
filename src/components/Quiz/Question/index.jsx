import React from 'react'
import MultipleChoice from './MutlipleChoice'
import RankedChoice from './RankedChoice'
import RangeSliders from './RangeSliders'
import './index.scss'

export default function Question({ index, question, answers, setAnswers }) {

  return (
    <div className="question">
      <div className="question-content">{
        question.type === 'multiple-choice-text' || question.type === 'multiple-choice-image' ? (
          <MultipleChoice question={question} setAnswers={setAnswers} />
        ) : question.type === 'ranked-choice' ? (
          <RankedChoice question={question} setAnswers={setAnswers} />
        ) : question.type === 'range-sliders' ? (
          <RangeSliders question={question} setAnswers={setAnswers} />
        ) : null
      } </div>
      <div className="question-navigation">
        <button className={`question-navigation-prev ${index === 0 ? 'hidden' : ''}`}>Previous</button>
        <button className={`question-navigation-next ${answers[question.id] ? '' : 'hidden'}`}>Next</button>
      </div>
    </div>
  )
}