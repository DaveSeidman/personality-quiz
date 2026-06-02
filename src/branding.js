const DEFAULT_BRAND_ID = 'lightbox'
const BRAND_FONT_STYLE_ID = 'brand-font-face'
const DEFAULT_FONT_STACK = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const BRAND_FONT_ALIAS = '"Brand Experience Font"'
const BRAND_HEADING_FONT_ALIAS = '"Brand Experience Heading Font"'
const BRAND_CONFIG_FILENAMES = ['brand.json', 'manifest.json']
const BASE_URL = import.meta.env.BASE_URL || '/'

const QUIZ_MODE_TOKENS = {
  dark: {
    quizText: 'rgba(255, 255, 255, 0.88)',
    quizMutedText: 'rgba(255, 255, 255, 0.7)',
    quizStrongText: '#ffffff',
    quizBorder: 'rgba(255, 255, 255, 0.18)',
    quizBorderStrong: 'rgba(255, 255, 255, 0.35)',
    consoleText: 'rgba(243, 239, 230, 0.94)',
    consoleMutedText: 'rgba(255, 255, 255, 0.58)',
    consoleStrongText: 'rgba(255, 255, 255, 0.92)',
    consoleSurface: 'rgba(8, 8, 8, 0.68)',
    consoleSurfaceActive: 'rgba(8, 8, 8, 0.78)',
    consoleSurfaceStrong: 'rgba(8, 8, 8, 0.92)',
    consoleSurfaceSoft: 'rgba(255, 255, 255, 0.04)',
    consoleBorder: 'rgba(255, 255, 255, 0.12)',
    consoleBorderStrong: 'rgba(255, 255, 255, 0.3)',
    consoleTrack: 'rgba(255, 255, 255, 0.08)',
  },
  light: {
    quizText: 'rgba(10, 10, 10, 0.82)',
    quizMutedText: 'rgba(10, 10, 10, 0.62)',
    quizStrongText: '#050505',
    quizBorder: 'rgba(10, 10, 10, 0.14)',
    quizBorderStrong: 'rgba(10, 10, 10, 0.28)',
    consoleText: 'rgba(10, 10, 10, 0.82)',
    consoleMutedText: 'rgba(10, 10, 10, 0.56)',
    consoleStrongText: '#050505',
    consoleSurface: 'rgba(255, 255, 255, 0.64)',
    consoleSurfaceActive: 'rgba(255, 255, 255, 0.78)',
    consoleSurfaceStrong: 'rgba(255, 255, 255, 0.92)',
    consoleSurfaceSoft: 'rgba(10, 10, 10, 0.04)',
    consoleBorder: 'rgba(10, 10, 10, 0.1)',
    consoleBorderStrong: 'rgba(10, 10, 10, 0.22)',
    consoleTrack: 'rgba(10, 10, 10, 0.08)',
  },
}

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

function hasOwnPath(object, path) {
  let current = object

  for (const key of path) {
    if (!isObject(current) || !Object.prototype.hasOwnProperty.call(current, key)) {
      return false
    }
    current = current[key]
  }

  return true
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

function buildFontFaceCss(fontFaces = [], fontAlias = BRAND_FONT_ALIAS) {
  return fontFaces.map((fontFace) => {
    const declarations = [
      `font-family: ${fontAlias}`,
      `src: url("${fontFace.url}")`,
      'font-display: swap',
      fontFace.weight ? `font-weight: ${fontFace.weight}` : '',
      fontFace.style ? `font-style: ${fontFace.style}` : '',
    ].filter(Boolean)

    return `@font-face { ${declarations.join('; ')}; }`
  }).join('\n')
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
  if (primaryUrl === false || primaryUrl === null) {
    return ''
  }

  if (primaryUrl && await assetExists(primaryUrl)) {
    return resolvePublicUrl(primaryUrl)
  }

  return fallbackUrl ? resolvePublicUrl(fallbackUrl) : ''
}

async function resolveFontFaces(fontFaces = [], fallbackUrl = '') {
  const resolvedFaces = await Promise.all(
    (Array.isArray(fontFaces) ? fontFaces : []).map(async (fontFace) => {
      const resolvedUrl = await resolveAssetUrl(fontFace?.url, '')
      if (!resolvedUrl) return null

      return {
        ...fontFace,
        url: resolvedUrl,
      }
    }),
  )

  const validFaces = resolvedFaces.filter(Boolean)
  if (validFaces.length) return validFaces
  if (!fallbackUrl) return []

  return [{
    url: fallbackUrl,
    weight: 400,
    style: 'normal',
  }]
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
  if (requestedBrandId !== DEFAULT_BRAND_ID && !hasOwnPath(overrideBrand, ['copy', 'intro'])) {
    mergedBrand.copy = {
      ...(mergedBrand.copy || {}),
      intro: {
        enabled: false,
      },
    }
  }
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
  const resolvedFontFaces = await resolveFontFaces(
    mergedBrand.theme?.fontFaces,
    resolvedFontUrl,
  )
  const resolvedHeadingFontUrl = await resolveAssetUrl(
    mergedBrand.theme?.headingFontUrl,
    '',
  )
  const resolvedHeadingFontFaces = await resolveFontFaces(
    mergedBrand.theme?.headingFontFaces,
    resolvedHeadingFontUrl,
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
        fontFaces: resolvedFontFaces,
        headingFontUrl: resolvedHeadingFontUrl,
        headingFontFaces: resolvedHeadingFontFaces,
      },
    },
    quizData,
  }
}

export function applyBrandTheme(brand) {
  const root = document.documentElement
  const theme = brand?.theme || {}
  const colors = theme.colors || {}
  const quizMode = theme.quizMode === 'light' ? 'light' : 'dark'
  const modeTokens = QUIZ_MODE_TOKENS[quizMode]
  const accentColor = brand?.accentColor || theme.accentColor || colors.accent || '#f3efe6'
  const accentContrast = brand?.accentContrast || theme.accentContrast || colors.accentContrast || getReadableTextColor(accentColor)
  const fontFallback = theme.fontFallback || DEFAULT_FONT_STACK
  const headingFontFallback = theme.headingFontFallback || fontFallback
  const fontFaces = Array.isArray(theme.fontFaces) ? theme.fontFaces.filter((fontFace) => Boolean(fontFace?.url)) : []
  const headingFontFaces = Array.isArray(theme.headingFontFaces) ? theme.headingFontFaces.filter((fontFace) => Boolean(fontFace?.url)) : []
  const hasCustomFont = fontFaces.length > 0 || Boolean(theme.fontUrl)
  const hasCustomHeadingFont = headingFontFaces.length > 0 || Boolean(theme.headingFontUrl)
  const canvasFontFamily = hasCustomFont ? BRAND_FONT_ALIAS : (theme.fontFamily ? `"${theme.fontFamily}"` : 'sans-serif')
  const fontFamily = hasCustomFont
    ? `${BRAND_FONT_ALIAS}, ${fontFallback}`
    : `${theme.fontFamily ? `"${theme.fontFamily}"` : ''}${theme.fontFamily ? ', ' : ''}${fontFallback}`
  const headingFontFamily = hasCustomHeadingFont
    ? `${BRAND_HEADING_FONT_ALIAS}, ${headingFontFallback}`
    : `${theme.headingFontFamily ? `"${theme.headingFontFamily}"` : ''}${theme.headingFontFamily ? ', ' : ''}${fontFamily}`

  root.style.setProperty('--app-bg', colors.appBg || '#040404')
  root.style.setProperty('--app-text', colors.text || '#f3efe6')
  root.style.setProperty('--accent', accentColor)
  root.style.setProperty('--accent-contrast', accentContrast)
  root.style.setProperty('--quiz-mode', quizMode)
  Object.entries(modeTokens).forEach(([key, value]) => {
    const cssName = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
    root.style.setProperty(`--${cssName}`, value)
  })
  root.style.setProperty('--question-panel-bg', colors.questionPanel || 'rgba(0, 0, 0, 0.5)')
  root.style.setProperty('--question-panel-border', colors.questionPanelBorder || 'rgba(255, 255, 255, 0.18)')
  root.style.setProperty('--question-option-bg', colors.questionOption || 'rgba(10, 10, 10, 0.58)')
  root.style.setProperty('--question-selected-bg', colors.questionSelected || accentColor)
  root.style.setProperty('--question-selected-text', colors.questionSelectedText || accentContrast)
  root.style.setProperty('--question-selected-border', colors.questionSelectedBorder || 'var(--quiz-border-strong)')
  root.style.setProperty('--app-logo-height', theme.logoHeight || '10.5vh')
  root.style.setProperty('--app-logo-margin', theme.logoMargin || '1vh 3vh')
  root.style.setProperty('--app-logo-top', theme.logoTop || '0')
  root.style.setProperty('--app-logo-left', theme.logoLeft || '0')
  root.style.setProperty('--app-logo-transform', theme.logoTransform || 'none')
  root.style.setProperty('--background-image-opacity', theme.backgroundImageOpacity ?? 0.42)
  root.style.setProperty('--background-video-opacity', theme.backgroundVideoOpacity ?? 0.44)
  root.style.setProperty('--app-font-family', fontFamily)
  root.style.setProperty('--app-heading-font-family', headingFontFamily)
  root.style.setProperty('--app-heading-text-transform', theme.headingTextTransform || 'none')
  root.style.setProperty('--app-font-family-canvas', canvasFontFamily)

  let styleTag = document.getElementById(BRAND_FONT_STYLE_ID)
  if (!styleTag) {
    styleTag = document.createElement('style')
    styleTag.id = BRAND_FONT_STYLE_ID
    document.head.appendChild(styleTag)
  }

  styleTag.textContent = [
    hasCustomFont ? buildFontFaceCss(fontFaces.length ? fontFaces : [{ url: theme.fontUrl }], BRAND_FONT_ALIAS) : '',
    hasCustomHeadingFont ? buildFontFaceCss(headingFontFaces.length ? headingFontFaces : [{ url: theme.headingFontUrl }], BRAND_HEADING_FONT_ALIAS) : '',
  ].filter(Boolean).join('\n')
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
