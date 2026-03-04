import React from "react"
import './index.scss'

export default function Analysis({ answers }) {

  return (
    <div className="analysis">
      {JSON.stringify(answers)}
    </div>
  )
} 