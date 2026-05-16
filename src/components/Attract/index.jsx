import React from "react"
import { formatBrandCopy } from '../../branding'
import { renderSuperscriptMarks } from '../utils'
import './index.scss'

export default function Attract({ attract, quizData, brand, consoleEnabled = true }) {
  const attractTitle = brand?.copy?.attractTitle || 'AI Cocktail Quiz'
  const attractSubtitle = formatBrandCopy(
    brand?.copy?.attractSubtitle || 'Discover your personality type by answering {questionCount} questions.',
    { questionCount: quizData.questions.length },
  )

  return (
    <div className={`attract ${consoleEnabled ? '' : 'attract--full-height'} ${attract ? '' : 'hidden'}`}>
      <video
        className="attract-blob"
        src={brand?.assets?.attractVideo}
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="attract-copy">
        <h1>{renderSuperscriptMarks(attractTitle)}</h1>
        <p>{renderSuperscriptMarks(attractSubtitle)}</p>
      </div>
    </div>
  )
}
