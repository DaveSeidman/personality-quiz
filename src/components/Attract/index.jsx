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
  const attractCtaLabel = brand?.copy?.attractCtaLabel

  return (
    <div className={`attract attract--brand-${brand?.id || 'default'} ${consoleEnabled ? '' : 'attract--full-height'} ${attract ? '' : 'hidden'}`}>
      {brand?.assets?.attractVideo ? (
        <video
          className="attract-blob"
          src={brand.assets.attractVideo}
          autoPlay
          loop
          muted
          playsInline
        />
      ) : null}
      {brand?.assets?.attractImage ? (
        <img
          className="attract-graphic"
          src={brand.assets.attractImage}
          alt=""
          aria-hidden="true"
        />
      ) : null}
      <div className="attract-copy">
        <h1>{renderSuperscriptMarks(attractTitle)}</h1>
        <p>{renderSuperscriptMarks(attractSubtitle)}</p>
      </div>
      {attractCtaLabel ? (
        <button className="attract-cta" type="button">
          {renderSuperscriptMarks(attractCtaLabel)}
        </button>
      ) : null}
    </div>
  )
}
