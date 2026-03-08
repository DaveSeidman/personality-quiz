import React from "react"
import blobVideo from '../../assets/videos/blobs.webm'
import './index.scss'

export default function Attract({ attract }) {
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
        <h1>Ai PERSONALITY QUIZ</h1>
        <p>Discover your personality type with our fun and insightful quiz!</p>
      </div>
    </div>
  )
}
