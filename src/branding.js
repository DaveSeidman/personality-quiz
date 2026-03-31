const DEFAULT_BRAND_ID = 'lightbox'
const BRAND_FONT_STYLE_ID = 'brand-font-face'
const DEFAULT_FONT_STACK = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const BRAND_FONT_ALIAS = '"Brand Experience Font"'
const BRAND_CONFIG_FILENAMES = ['manifest.json', 'brand.json']
const BASE_URL = import.meta.env.BASE_URL || '/'

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function deepMerge(base, override) {
  if (!isObject(base)) return override ?? base
  if (!isObject(override)) return override ?? base

  const merged = { ...base }

  Object.keys(override).forEach((key) => {
    const baseValue = base[key]
    const overrideValue = override[key]
    merged[key] = isObject(baseValue) && isObject(overrideValue)
      ? deepMerge(baseValue, overrideValue)
      : overrideValue
  })

  return merged
}

function sanitizeBrandId(value = '') {
  const normalized = String(value).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
  return normalized || DEFAULT_BRAND_ID
}

function resolvePublicUrl(value = '') {
  const nextValue = String(value || '').trim()

  if (!nextValue) return ''
  if (/^(?:[a-z]+:)?\/\//i.test(nextValue) || nextValue.startsWith('data:')) return nextValue
  if (nextValue.startsWith(BASE_URL)) return nextValue

  const normalizedBase = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`
  const normalizedValue = nextValue.startsWith('/') ? nextValue.slice(1) : nextValue
  return `${normalizedBase}${normalizedValue}`
}

function getReadableTextColor(backgroundColor) {
  const rgb = parseColorToRgb(backgroundColor)
  if (!rgb) return '#050505'

  const [r, g, b] = rgb.map((value) => value / 255)
  const [lr, lg, lb] = [r, g, b].map((value) => (
    value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4)
  ))
  const luminance = (0.2126 * lr) + (0.7152 * lg) + (0.0722 * lb)

  return luminance > 0.42 ? '#050505' : '#ffffff'
}

async function fetchJson(url) {
  const response = await fetch(resolvePublicUrl(url))
  if (!response.ok) {
    throw new Error(`Failed to load ${url} (${response.status})`)
  }

  return response.json()
}

async function assetExists(url) {
  if (!url) return false

  try {
    const response = await fetch(resolvePublicUrl(url), { method: 'HEAD' })
    return response.ok
  } catch (error) {
    return false
  }
}

async function fetchBrandConfig(brandId) {
  let lastError = null

  for (const filename of BRAND_CONFIG_FILENAMES) {
    const url = `/brands/${brandId}/${filename}`

    try {
      return await fetchJson(url)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error(`Failed to load brand config for ${brandId}`)
}

async function resolveAssetUrl(primaryUrl, fallbackUrl) {
  if (primaryUrl && await assetExists(primaryUrl)) {
    return resolvePublicUrl(primaryUrl)
  }

  return fallbackUrl ? resolvePublicUrl(fallbackUrl) : ''
}

export function getRequestedBrandId() {
  const params = new URLSearchParams(window.location.search)
  return sanitizeBrandId(params.get('brand') || DEFAULT_BRAND_ID)
}

export async function loadBrandExperience() {
  const requestedBrandId = getRequestedBrandId()
  const defaultBrand = await fetchBrandConfig(DEFAULT_BRAND_ID)

  let overrideBrand = {}
  if (requestedBrandId !== DEFAULT_BRAND_ID) {
    try {
      overrideBrand = await fetchBrandConfig(requestedBrandId)
    } catch (error) {
      overrideBrand = {}
    }
  }

  const mergedBrand = deepMerge(defaultBrand, overrideBrand)
  const resolvedAssets = {}
  const assetKeys = new Set([
    ...Object.keys(defaultBrand.assets || {}),
    ...Object.keys(mergedBrand.assets || {}),
  ])

  for (const assetKey of assetKeys) {
    resolvedAssets[assetKey] = await resolveAssetUrl(
      mergedBrand.assets?.[assetKey],
      defaultBrand.assets?.[assetKey],
    )
  }

  const resolvedFontUrl = await resolveAssetUrl(
    mergedBrand.theme?.fontUrl,
    defaultBrand.theme?.fontUrl,
  )

  const resolvedQuizUrl = await resolveAssetUrl(
    mergedBrand.quizUrl,
    defaultBrand.quizUrl,
  )

  const quizData = await fetchJson(resolvedQuizUrl)

  return {
    requestedBrandId,
    brandId: sanitizeBrandId(mergedBrand.id || requestedBrandId),
    brand: {
      ...mergedBrand,
      assets: resolvedAssets,
      quizUrl: resolvedQuizUrl,
      theme: {
        ...(mergedBrand.theme || {}),
        fontUrl: resolvedFontUrl,
      },
    },
    quizData,
  }
}

export function applyBrandTheme(brand) {
  const root = document.documentElement
  const theme = brand?.theme || {}
  const colors = theme.colors || {}
  const accentColor = brand?.accentColor || theme.accentColor || colors.accent || '#f3efe6'
  const accentContrast = brand?.accentContrast || theme.accentContrast || colors.accentContrast || getReadableTextColor(accentColor)
  const fontFallback = theme.fontFallback || DEFAULT_FONT_STACK
  const hasFontUrl = Boolean(theme.fontUrl)
  const canvasFontFamily = hasFontUrl ? BRAND_FONT_ALIAS : (theme.fontFamily ? `"${theme.fontFamily}"` : 'sans-serif')
  const fontFamily = hasFontUrl
    ? `${BRAND_FONT_ALIAS}, ${fontFallback}`
    : `${theme.fontFamily ? `"${theme.fontFamily}"` : ''}${theme.fontFamily ? ', ' : ''}${fontFallback}`

  root.style.setProperty('--app-bg', colors.appBg || '#040404')
  root.style.setProperty('--app-text', colors.text || '#f3efe6')
  root.style.setProperty('--accent', accentColor)
  root.style.setProperty('--accent-contrast', accentContrast)
  root.style.setProperty('--app-font-family', fontFamily)
  root.style.setProperty('--app-font-family-canvas', canvasFontFamily)

  let styleTag = document.getElementById(BRAND_FONT_STYLE_ID)
  if (!styleTag) {
    styleTag = document.createElement('style')
    styleTag.id = BRAND_FONT_STYLE_ID
    document.head.appendChild(styleTag)
  }

  styleTag.textContent = hasFontUrl
    ? `@font-face { font-family: ${BRAND_FONT_ALIAS}; src: url("${theme.fontUrl}"); font-display: swap; }`
    : ''
}

export function formatBrandCopy(template, replacements = {}) {
  return Object.entries(replacements).reduce((value, [key, replacement]) => {
    return value.replaceAll(`{${key}}`, String(replacement))
  }, template || '')
}

export function getCanvasFontFamily() {
  if (typeof window === 'undefined') {
    return `${BRAND_FONT_ALIAS}, sans-serif`
  }

  return getComputedStyle(document.documentElement)
    .getPropertyValue('--app-font-family-canvas')
    .trim() || `${BRAND_FONT_ALIAS}, sans-serif`
}
