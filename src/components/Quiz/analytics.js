export const CONFIDENCE_WEIGHTS = {
  answerSpeed: 0.2,
  nextDecisiveness: 0.2,
  answerStability: 0.2,
  revisitPenalty: 0.15,
  blockedNextPenalty: 0.1,
  pointerPressure: 0.15,
}

const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, n))

function getRevisitCount(questionData) {
  const stored = questionData?.revisitCount ?? 0
  const fromEvents = Array.isArray(questionData?.events)
    ? questionData.events.filter((event) => event?.type === 'question_revisited').length
    : 0
  return Math.max(stored, fromEvents)
}

function normalizePressure(events = []) {
  const pressures = events
    .map(event => event?.payload?.pressure)
    .filter(value => typeof value === 'number' && Number.isFinite(value))

  if (!pressures.length) return 0.5

  const avg = pressures.reduce((sum, value) => sum + value, 0) / pressures.length
  return clamp(avg)
}

function countEvents(events = [], type) {
  return events.filter(event => event.type === type).length
}

export function computeQuestionConfidence(questionData, weights = CONFIDENCE_WEIGHTS) {
  const events = questionData?.events ?? []

  const presentedAt = questionData?.presentedAt ?? events[0]?.timestamp ?? 0
  const firstInteractionAt = questionData?.firstInteractionAt ?? presentedAt
  const answerCommittedAt = questionData?.answerCommittedAt ?? firstInteractionAt
  const nextClickedAt = questionData?.nextClickedAt ?? answerCommittedAt

  const readMs = Math.max(0, firstInteractionAt - presentedAt)
  const answerMs = Math.max(0, answerCommittedAt - firstInteractionAt)
  const nextDelayMs = Math.max(0, nextClickedAt - answerCommittedAt)

  const changeCount = countEvents(events, 'answer_changed')
  const blockedNext = countEvents(events, 'next_clicked_blocked')
  const revisitCount = getRevisitCount(questionData)

  const answerSpeed = clamp(1 - answerMs / 12000)
  const nextDecisiveness = clamp(1 - nextDelayMs / 7000)
  const answerStability = clamp(1 - Math.max(0, changeCount - 1) / 6)
  const revisitPenalty = clamp(1 - revisitCount / 5)
  const blockedNextPenalty = clamp(1 - blockedNext / 5)
  const pointerPressure = normalizePressure(events)

  const raw =
    weights.answerSpeed * answerSpeed +
    weights.nextDecisiveness * nextDecisiveness +
    weights.answerStability * answerStability +
    weights.revisitPenalty * revisitPenalty +
    weights.blockedNextPenalty * blockedNextPenalty +
    weights.pointerPressure * pointerPressure

  const confidence = clamp(raw)

  return {
    confidence,
    components: {
      readMs,
      answerMs,
      nextDelayMs,
      answerSpeed,
      nextDecisiveness,
      answerStability,
      revisitPenalty,
      blockedNextPenalty,
      pointerPressure,
      changeCount,
      blockedNext,
      revisitCount,
    },
  }
}

export function finalizeAnalytics(analyticsByQuestion, weights = CONFIDENCE_WEIGHTS) {
  const output = {}

  Object.entries(analyticsByQuestion).forEach(([questionId, entry]) => {
    const score = computeQuestionConfidence(entry?.data, weights)

    output[questionId] = {
      confidence: score.confidence,
      data: {
        ...entry?.data,
        confidenceComponents: score.components,
      },
    }
  })

  return output
}
