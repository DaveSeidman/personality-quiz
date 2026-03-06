import React from "react"
import './index.scss'

export default function Attract({ attract }) {
  return (
    <div className={`attract ${attract ? '' : 'hidden'}`}>
      <h1>What kind of event maker are you?</h1>
      <p>Three questions. A sharper perspective on how you think about brand experience.</p>
    </div>
  )
}
