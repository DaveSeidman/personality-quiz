export const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value))

export const PERSONALITY_LEGEND = [
  { id: 'strategist', label: 'The Strategist' },
  { id: 'pioneer', label: 'The Pioneer' },
  { id: 'catalyst', label: 'The Catalyst' },
  { id: 'architect', label: 'The Architect' },
]

export const PERSONALITY_COLORS = {
  strategist: 'rgba(77, 187, 137, 0.72)',
  pioneer: 'rgba(76, 120, 255, 0.72)',
  catalyst: 'rgba(214, 107, 186, 0.72)',
  architect: 'rgba(255, 98, 0, 0.72)',
}

export const PERSONALITY_AREA_COLORS = {
  strategist: 'rgba(77, 187, 137, 0.16)',
  pioneer: 'rgba(76, 120, 255, 0.16)',
  catalyst: 'rgba(214, 107, 186, 0.16)',
  architect: 'rgba(255, 98, 0, 0.16)',
}

export const QUESTION_TYPE_COLORS = {
  'multiple-choice': 'rgba(98, 170, 255, 0.22)',
  'ranked-choice': 'rgba(255, 155, 98, 0.22)',
  'range-sliders': 'rgba(130, 225, 170, 0.22)',
  'slide-select': 'rgba(220, 142, 235, 0.22)',
}

export function normalizeType(type = '') {
  if (type === 'multiple-choice-text' || type === 'multiple-choice-image') return 'multiple-choice'
  if (type === 'ranked-choice') return 'ranked-choice'
  if (type === 'range-sliders') return 'range-sliders'
  if (type === 'slide-select' || type === 'SlideSelect') return 'slide-select'
  return type
}

export function humanizePersonality(personalityId) {
  if (!personalityId) return 'mixed signal'
  return personalityId.replace(/-/g, ' ')
}

export function titleCase(text = '') {
  return text
    .split(' ')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ')
}

function inferQuestionPersonality(question, answer) {
  if (!question) return null

  if (question.type === 'multiple-choice-text' || question.type === 'multiple-choice-image' || question.type === 'slide-select' || question.type === 'SlideSelect') {
    const selectedIds = Array.isArray(answer) ? answer : (answer ? [answer] : [])
    if (!selectedIds.length) return null

    const counts = {}
    selectedIds.forEach((optionId) => {
      const option = (question.answers || []).find((entry) => entry.id === optionId)
      if (!option?.personalityId) return
      counts[option.personalityId] = (counts[option.personalityId] || 0) + 1
    })

    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null
  }

  if (question.type === 'ranked-choice' && Array.isArray(answer) && answer.length) {
    const top = (question.answers || []).find((entry) => entry.id === answer[0])
    return top?.personalityId || null
  }

  if (question.type === 'range-sliders' && answer && typeof answer === 'object') {
    let maxEntry = null
    Object.entries(answer).forEach(([optionId, value]) => {
      if (!maxEntry || Number(value) > Number(maxEntry.value)) {
        maxEntry = { optionId, value }
      }
    })
    const option = (question.answers || []).find((entry) => entry.id === maxEntry?.optionId)
    return option?.personalityId || null
  }

  return null
}

export function buildQuestionCards(analytics = {}, questions = [], answers = {}) {
  const byId = Object.fromEntries((questions || []).map((q) => [String(q.id), q]))

  return Object.entries(analytics).map(([questionId, entry]) => {
    const events = entry?.data?.events ?? []
    const question = byId[questionId]
    const answer = answers?.[questionId]
    const type = normalizeType(entry?.data?.questionType || question?.type)
    const personalityId = inferQuestionPersonality(question, answer)
    const components = entry?.data?.confidenceComponents || {}

    const pressureSamples = events
      .map((event) => event?.payload?.pressure)
      .filter((value) => typeof value === 'number' && Number.isFinite(value) && value > 0)
    const avgPressure = pressureSamples.length
      ? pressureSamples.reduce((sum, value) => sum + value, 0) / pressureSamples.length
      : 0

    const blockedNext = events.filter((event) => event.type === 'next_clicked_blocked').length
    const changeCount = events.filter((event) => event.type === 'answer_changed').length

    const reorderCount = events.filter(
      (event) => event.type === 'answer_changed' && event.payload?.interaction === 'reorder'
    ).length

    const sliderChanges = events.filter(
      (event) => event.type === 'answer_changed' && event.payload?.interaction === 'slider_change'
    ).length

    const slideConfirms = events.filter(
      (event) => event.type === 'answer_changed' && event.payload?.interaction === 'slide_confirmed'
    ).length

    const slideRejects = events.filter(
      (event) => event.type === 'answer_changed' && event.payload?.interaction === 'slide_rejected'
    ).length

    const touchedOptions = new Set(
      events.filter((event) => event.type === 'pointer_down').map((event) => event.payload?.optionId).filter(Boolean)
    ).size

    const optionCount = question?.answers?.length || 1
    const coverage = clamp(touchedOptions / optionCount)
    const hesitation = clamp(blockedNext * 0.25 + changeCount * 0.07)

    return {
      questionId,
      type,
      personalityId,
      confidence: entry?.confidence || 0,
      metrics: {
        avgPressure: clamp(avgPressure),
        speed: clamp(components.answerSpeed ?? (1 - (components.answerMs || 0) / 12000)),
        nextDecisiveness: clamp(components.nextDecisiveness ?? 0),
        hesitation,
        coverage,
        reorderDensity: clamp(reorderCount / 8),
        sliderDensity: clamp(sliderChanges / 16),
        slidePrecision: clamp(slideConfirms / Math.max(1, slideConfirms + slideRejects)),
        blockedNext,
        changeCount,
      },
    }
  })
}

function buildVectorFromCard(card) {
  const vector = { strategist: 0.08, pioneer: 0.08, catalyst: 0.08, architect: 0.08 }

  if (card.type === 'multiple-choice') {
    vector.pioneer += card.metrics.speed * 0.55
    vector.strategist += card.metrics.nextDecisiveness * 0.45
    vector.architect += clamp(card.metrics.changeCount / 8) * 0.35
    vector.catalyst += (1 - card.metrics.hesitation) * 0.3
  }

  if (card.type === 'ranked-choice') {
    vector.architect += card.metrics.reorderDensity * 0.6
    vector.catalyst += card.metrics.coverage * 0.4
    vector.strategist += card.metrics.avgPressure * 0.45
    vector.pioneer += card.confidence * 0.35
  }

  if (card.type === 'range-sliders') {
    vector.strategist += (1 - card.metrics.hesitation) * 0.55
    vector.catalyst += card.metrics.coverage * 0.4
    vector.architect += card.metrics.sliderDensity * 0.45
    vector.pioneer += card.confidence * 0.3
  }

  if (card.type === 'slide-select') {
    vector.pioneer += card.metrics.slidePrecision * 0.55
    vector.strategist += card.metrics.avgPressure * 0.45
    vector.architect += card.metrics.speed * 0.35
    vector.catalyst += card.confidence * 0.25
  }

  if (card.personalityId && card.personalityId in vector) {
    vector[card.personalityId] += 0.35
  }

  const max = Math.max(...Object.values(vector), 0.0001)
  return {
    strategist: clamp(vector.strategist / max),
    pioneer: clamp(vector.pioneer / max),
    catalyst: clamp(vector.catalyst / max),
    architect: clamp(vector.architect / max),
  }
}

export function buildRadarData(cards = []) {
  const compositeTotals = { strategist: 0, pioneer: 0, catalyst: 0, architect: 0 }

  const byQuestion = cards.map((card) => {
    const vector = buildVectorFromCard(card)
    Object.keys(compositeTotals).forEach((key) => {
      compositeTotals[key] += vector[key]
    })

    return {
      questionId: card.questionId,
      type: card.type,
      vector,
    }
  })

  const max = Math.max(...Object.values(compositeTotals), 0.0001)
  const composite = {
    strategist: clamp(compositeTotals.strategist / max),
    pioneer: clamp(compositeTotals.pioneer / max),
    catalyst: clamp(compositeTotals.catalyst / max),
    architect: clamp(compositeTotals.architect / max),
  }

  return { composite, byQuestion }
}
