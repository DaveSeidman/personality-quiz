import React from "react"
import './index.scss'

export default function Attract({ attract }) {
  return (
    <div className={`attract ${attract ? '' : 'hidden'}`}>
      <h1>Personality Quiz</h1>
      <p>Discover your personality type with our fun and insightful quiz!</p>
    </div>
  )
}