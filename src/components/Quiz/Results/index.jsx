import React, { useState } from 'react'
import './index.scss'

export default function Results({ onPrevious, onSubmit }) {
  const [status, setStatus] = useState('idle')

  const handleSubmit = async () => {
    try {
      setStatus('submitting')
      await onSubmit()
      setStatus('submitted')
    } catch (error) {
      setStatus('error')
      console.error(error)
    }
  }

  return (
    <div className="results">
      <h2 className="results-title">Review & Submit</h2>
      <p className="results-instruction">You can go back to change anything before submitting.</p>

      {/* answers block removed by request */}

      <div className="results-navigation">
        <button onClick={onPrevious}>Previous</button>
        <button onClick={handleSubmit} disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Submitting…' : 'Submit'}
        </button>
      </div>

      {status === 'submitted' && <p className="results-status">Submitted to fake API ✅</p>}
      {status === 'error' && <p className="results-status error">Submit failed. Try again.</p>}
    </div>
  )
}
