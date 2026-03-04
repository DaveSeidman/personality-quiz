import React from "react"
import './index.scss'

function formatConfidence(value) {
  if (typeof value !== 'number') return '—'
  return `${Math.round(value * 100)}%`
}

export default function Analysis({ answers, analytics, visible, onToggle }) {
  const entries = Object.entries(analytics || {})

  return (
    <aside className={`analysis ${visible ? 'visible' : ''}`}>
      <button type="button" className="analysis-toggle" onClick={onToggle}>
        {visible ? 'Hide Analysis' : 'Show Analysis'}
      </button>

      {visible ? (
        <div className="analysis-panel">
          <h3 className="analysis-title">Behavior Analytics</h3>

          <section className="analysis-block">
            <h4>Answers</h4>
            <pre>{JSON.stringify(answers, null, 2)}</pre>
          </section>

          <section className="analysis-block">
            <h4>Per Question</h4>
            {entries.length === 0 ? <p>No analytics captured yet.</p> : null}
            {entries.map(([questionId, entry]) => (
              <div key={questionId} className="analysis-card">
                <p><strong>Q{questionId}</strong> · confidence: {formatConfidence(entry.confidence)}</p>
                <p>events: {entry?.data?.events?.length ?? 0}</p>
                <p>revisits: {entry?.data?.revisitCount ?? 0}</p>

                {entry?.data?.confidenceComponents ? (
                  <details className="analysis-rollup" open>
                    <summary>confidence components</summary>
                    <pre>{JSON.stringify(entry.data.confidenceComponents, null, 2)}</pre>
                  </details>
                ) : null}

                <details className="analysis-rollup">
                  <summary>event timeline</summary>
                  <pre>{JSON.stringify(entry?.data?.events ?? [], null, 2)}</pre>
                </details>

                <details className="analysis-rollup">
                  <summary>full data object</summary>
                  <pre>{JSON.stringify(entry?.data ?? {}, null, 2)}</pre>
                </details>
              </div>
            ))}
          </section>
        </div>
      ) : null}
    </aside>
  )
}
