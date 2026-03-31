import React from "react"
import { formatBrandCopy } from '../../branding'
import './index.scss'

export default function Attract({ attract, quizData, brand }) {
  const attractTitle = brand?.copy?.attractTitle || 'AI Cocktail Quiz'
  const attractSubtitle = formatBrandCopy(
    brand?.copy?.attractSubtitle || 'Discover your personality type by answering {questionCount} questions.',
    { questionCount: quizData.questions.length },
  )

  return (
    <div className={`attract ${attract ? '' : 'hidden'}`}>
      <video
        className="attract-blob"
        src={brand?.assets?.attractVideo}
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="attract-copy">
        <h1>{attractTitle}</h1>
        <p>{attractSubtitle}</p>
      </div>
    </div>
  )
}
