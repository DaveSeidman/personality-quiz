export const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value))

const LEGACY_PERSONALITY_COLORS = {
  strategist: '#4dbb89',
  pioneer: '#4c78ff',
  catalyst: '#d66bba',
  architect: '#ff6200',
}

const DEFAULT_PERSONALITY_PALETTE = [
  '#4dbb89',
  '#4c78ff',
  '#d66bba',
  '#ff6200',
  '#ffd166',
  '#7bdff2',
  '#c792ea',
  '#ff8fab',
]

export const PERSONALITY_LEGEND = [
  { id: 'strategist', label: 'The Strategist' },
  { id: 'pioneer', label: 'The Pioneer' },
  { id: 'catalyst', label: 'The Catalyst' },
  { id: 'architect', label: 'The Architect' },
]

export const QUESTION_TYPE_COLORS = {
  'multiple-choice': 'rgba(98, 170, 255, 0.22)',
  'ranked-choice': 'rgba(255, 155, 98, 0.22)',
  'range-sliders': 'rgba(130, 225, 170, 0.22)',
  'slide-select': 'rgba(220, 142, 235, 0.22)',
}

function parseHexColor(value) {
  const hex = value.replace('#', '').trim()
  if (hex.length === 3) {
    return hex.split('').map((char) => Number.parseInt(`${char}${char}`, 16))
  }

  if (hex.length === 6) {
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
    ]
  }

  return null
}

function parseRgbColor(value) {
  const matches = value.match(/[\d.]+/g)
  if (!matches || matches.length < 3) return null

  return matches.slice(0, 3).map((entry) => Number.parseFloat(entry))
}

function parseColorToRgb(value) {
  if (!value || typeof value !== 'string') return null
  if (value.startsWith('#')) return parseHexColor(value)
  if (value.startsWith('rgb')) return parseRgbColor(value)
  return null
}

export function toAlphaColor(value, alpha = 1) {
  const rgb = parseColorToRgb(value)
  if (!rgb) return `rgba(255, 255, 255, ${alpha})`
  const [r, g, b] = rgb
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`
}

export function getPersonalityLegend(personalities = []) {
  if (Array.isArray(personalities) && personalities.length) {
    return personalities.map((personality) => ({
      id: personality.id,
      label: personality.name || titleCase(humanizePersonality(personality.id)),
      color: personality.color,
    }))
  }

  return PERSONALITY_LEGEND
}

export function getPersonalityBaseColor(personality = {}, index = 0) {
  if (personality?.color) return personality.color
  if (personality?.id && LEGACY_PERSONALITY_COLORS[personality.id]) return LEGACY_PERSONALITY_COLORS[personality.id]
  return DEFAULT_PERSONALITY_PALETTE[index % DEFAULT_PERSONALITY_PALETTE.length]
}

export function buildPersonalityColorMap(personalities = [], alpha = 0.72) {
  const legend = getPersonalityLegend(personalities)
  return legend.reduce((acc, entry, index) => {
    acc[entry.id] = toAlphaColor(getPersonalityBaseColor(entry, index), alpha)
    return acc
  }, {})
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

function buildEmptyVector(legend = []) {
  return legend.reduce((acc, entry) => {
    acc[entry.id] = 0
    return acc
  }, {})
}

function normalizeVector(vector = {}) {
  const max = Math.max(...Object.values(vector), 0.0001)
  return Object.fromEntries(
    Object.entries(vector).map(([key, value]) => [key, clamp(value / max)])
  )
}

function buildVectorFromCard(card, legend = []) {
  if (!legend.length) return {}

  const vector = buildEmptyVector(legend)
  const ids = legend.map((entry) => entry.id)
  const selectedIndex = ids.indexOf(card.personalityId)
  const selectedId = selectedIndex >= 0 ? ids[selectedIndex] : null
  const baseline = 0.08

  ids.forEach((id) => {
    vector[id] = baseline
  })

  const metrics = card.metrics || {}
  const resonance = clamp(
    ((metrics.speed || 0) * 0.24) +
    ((1 - (metrics.hesitation || 0)) * 0.28) +
    ((metrics.coverage || 0) * 0.18) +
    ((card.confidence || 0) * 0.2) +
    ((metrics.avgPressure || 0) * 0.1),
  )

  if (selectedId) {
    vector[selectedId] += 0.48 + (resonance * 0.24)

    const peers = ids.filter((id) => id !== selectedId)
    const spreadBase = (0.18 + (resonance * 0.12)) / Math.max(peers.length, 1)

    peers.forEach((id, index) => {
      const dampener = 1 - ((index / Math.max(peers.length, 1)) * 0.2)
      vector[id] += spreadBase * dampener
    })

    if (ids.length > 1) {
      const nextId = ids[(selectedIndex + 1) % ids.length]
      vector[nextId] += ((metrics.speed || 0) * 0.12) + ((metrics.slidePrecision || 0) * 0.08)
    }

    if (ids.length > 2) {
      const previousId = ids[(selectedIndex - 1 + ids.length) % ids.length]
      vector[previousId] += ((metrics.avgPressure || 0) * 0.12) + ((1 - (metrics.hesitation || 0)) * 0.08)
    }

    if (ids.length > 3) {
      const oppositeId = ids[(selectedIndex + Math.floor(ids.length / 2)) % ids.length]
      vector[oppositeId] += clamp(
        ((metrics.reorderDensity || 0) * 0.45) +
        ((metrics.sliderDensity || 0) * 0.35) +
        (clamp((metrics.changeCount || 0) / 8) * 0.2),
      ) * 0.14
    }
  } else {
    ids.forEach((id, index) => {
      vector[id] += 0.16 + (resonance * (index === 0 ? 0.16 : 0.1))
    })
  }

  return normalizeVector(vector)
}

export function buildRadarData(cards = [], personalities = []) {
  const legend = getPersonalityLegend(personalities)
  const compositeTotals = buildEmptyVector(legend)

  const byQuestion = cards.map((card) => {
    const vector = buildVectorFromCard(card, legend)
    Object.keys(compositeTotals).forEach((key) => {
      compositeTotals[key] += vector[key] || 0
    })

    return {
      questionId: card.questionId,
      type: card.type,
      vector,
    }
  })

  return {
    legend,
    composite: normalizeVector(compositeTotals),
    byQuestion,
  }
}
