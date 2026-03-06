export function shuffle(items) {
  const array = [...items]
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

export function getSelectRule(select = 'single') {
  if (select === undefined || select === null || select === 'single') {
    return { mode: 'exact', count: 1 }
  }

  if (select === 'multiple') {
    return { mode: 'at-least', count: 1 }
  }

  const exactMatch = String(select).match(/^(\d+)$/)
  if (exactMatch) {
    return { mode: 'exact', count: Number(exactMatch[1]) }
  }

  const atLeastMatch = String(select).match(/^>(\d+)$/)
  if (atLeastMatch) {
    return { mode: 'at-least', count: Number(atLeastMatch[1]) }
  }

  return { mode: 'exact', count: 1 }
}

export function normalizeSelections(value) {
  if (Array.isArray(value)) return value
  if (value === null || value === undefined || value === '') return []
  return [value]
}

export function isSelectionComplete(value, select = 'single') {
  const picks = normalizeSelections(value)
  const rule = getSelectRule(select)

  if (rule.mode === 'exact') return picks.length === rule.count
  return picks.length >= rule.count
}

export function getSelectionInstruction(select = 'single') {
  const rule = getSelectRule(select)

  if (rule.mode === 'exact' && rule.count === 1) return 'Select one answer.'
  if (rule.mode === 'at-least' && rule.count === 1) return 'Select one or more answers.'
  if (rule.mode === 'exact') return `Select exactly ${rule.count} answers.`
  return `Select at least ${rule.count} answers.`
}

export function getSelectionValidationMessage(select = 'single') {
  const rule = getSelectRule(select)

  if (rule.mode === 'exact' && rule.count === 1) return 'Please select one answer before proceeding.'
  if (rule.mode === 'at-least' && rule.count === 1) return 'Please select one or more answers before proceeding.'
  if (rule.mode === 'exact') return `Please select exactly ${rule.count} answers before proceeding.`
  return `Please select at least ${rule.count} answers before proceeding.`
}

export function getSlideSelectValidationMessage(select = 'single') {
  const rule = getSelectRule(select)

  if (rule.mode === 'exact' && rule.count === 1) {
    return 'Please slide one answer at least halfway to confirm before proceeding.'
  }

  if (rule.mode === 'at-least' && rule.count === 1) {
    return 'Please slide one or more answers at least halfway to confirm before proceeding.'
  }

  if (rule.mode === 'exact') {
    return `Please slide exactly ${rule.count} answers at least halfway to confirm before proceeding.`
  }

  return `Please slide at least ${rule.count} answers at least halfway to confirm before proceeding.`
}

export function triggerActivePress(event, duration = 160) {
  const target = event?.currentTarget
  if (!target) return
  target.classList.add('is-active')
  setTimeout(() => {
    target.classList.remove('is-active')
  }, duration)
}
