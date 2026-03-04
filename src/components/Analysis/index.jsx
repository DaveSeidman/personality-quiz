import React from "react"
import './index.scss'

export default function Analysis({ results }) {

  return (
    <div className="analysis">
      <h2>Your Personality Type: {results.type}</h2>
      <p>{results.description}</p>
    </div>
  )
} 