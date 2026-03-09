import React from "react"
import blobVideo from '../../assets/videos/blobs.webm'
import './index.scss'

export default function Attract({ attract, quizData }) {
  return (
    <div className={`attract ${attract ? '' : 'hidden'}`}>
      <video
        className="attract-blob"
        src={blobVideo}
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="attract-copy">
        <h1>AI Cocktail Quiz</h1>
        <p>Discover your personality type by<br></br>answering {quizData.questions.length} questions.</p>
      </div>
    </div>
  )
}
