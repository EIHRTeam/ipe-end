import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import javascript from 'highlight.js/lib/languages/javascript'
import xml from 'highlight.js/lib/languages/xml'

import {
  buildLineRenderModels,
  createHighlightRunRanges,
  flattenHighlightedHtml,
  type HighlightRun,
  type LineRenderModel,
  type HighlightRunRange,
  type SegmentMap,
} from '@/internal/syntaxHighlightedTextarea'
import {
  layoutPretextSegments,
  preparePretextSegments,
} from '@/internal/syntaxHighlightedTextareaPretext'

if (!hljs.getLanguage('json')) {
  hljs.registerLanguage('json', json)
}
if (!hljs.getLanguage('javascript')) {
  hljs.registerLanguage('javascript', javascript)
}
if (!hljs.getLanguage('xml')) {
  hljs.registerLanguage('xml', xml)
}

export type CodeLanguage = 'plain' | 'json' | 'javascript' | 'html'

export interface DetectCodeLanguageOptions {
  contentModel?: string | null
  previousLanguage?: CodeLanguage
  title?: string | null
}

export interface SyntaxHighlightedTextareaProps {
  contentModel?: string | null
  id?: string
  name: string
  spellcheck?: boolean
  textareaClassName?: string
  textareaStyle?: Record<string, string>
  title?: string | null
  value?: string
}

interface HighlightCacheState {
  html: string
  language: CodeLanguage
  runRanges: HighlightRunRange[]
  runs: HighlightRun[]
  text: string
}

interface PreparedRenderState {
  font: string
  locale: string
  prepared: ReturnType<typeof preparePretextSegments>['prepared']
  segmentMaps: SegmentMap[]
  text: string
}

interface EditorMetrics {
  contentWidth: number
  direction: string
  font: string
  lineHeight: number
  locale: string
}

type PretextLayoutLine = Pick<
  ReturnType<typeof layoutPretextSegments>['lines'][number],
  'start' | 'end' | 'text'
>

interface PretextViewportState {
  contentWidth: number
  direction: string
  lineCount: number
  lineHeight: number
  lineModelsByIndex: Map<number, LineRenderModel>
  lines: PretextLayoutLine[]
  runRanges: HighlightRunRange[]
  segmentMaps: SegmentMap[]
  value: string
  windowEnd: number
  windowStart: number
}

interface PretextLayoutState {
  contentWidth: number
  lineHeight: number
  lines: PretextLayoutLine[]
  prepared: PreparedRenderState['prepared']
}

interface PretextViewportDomState {
  bottomSpacer: HTMLDivElement
  lineContainer: HTMLDivElement
  lineElementsByKey: Map<string, HTMLDivElement>
  topSpacer: HTMLDivElement
}

interface PretextWindowRange {
  end: number
  start: number
}

type HighlightUpdateReason = 'input' | 'mount' | 'resize'

const CONTENT_MODEL_TO_LANGUAGE: Partial<Record<string, CodeLanguage>> = {
  json: 'json',
  GeoJson: 'json',
  'smw/schema': 'json',
  javascript: 'javascript',
}

const TITLE_EXTENSION_TO_LANGUAGE: Partial<Record<string, CodeLanguage>> = {
  json: 'json',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  html: 'html',
  htm: 'html',
}

const LANGUAGE_LABEL: Record<Exclude<CodeLanguage, 'plain'>, string> = {
  json: 'JSON',
  javascript: 'JavaScript',
  html: 'HTML',
}

const PRETEXT_OVERSCAN_LINES = 30
const PRETEXT_MODEL_CACHE_BUFFER_LINES = PRETEXT_OVERSCAN_LINES * 4
const LARGE_TEXT_INPUT_DEBOUNCE_THRESHOLD = 50_000
const LARGE_TEXT_INPUT_DEBOUNCE_MS = 80

function getPretextWindowRange(
  scrollTop: number,
  viewportHeight: number,
  lineHeight: number,
  lineCount: number
): PretextWindowRange {
  const start = Math.max(0, Math.floor(scrollTop / lineHeight) - PRETEXT_OVERSCAN_LINES)
  const end = Math.min(
    lineCount,
    Math.ceil((scrollTop + viewportHeight) / lineHeight) + PRETEXT_OVERSCAN_LINES
  )

  return { end, start }
}

export function detectCodeLanguage(
  value: string,
  { contentModel, previousLanguage, title }: DetectCodeLanguageOptions = {}
): CodeLanguage {
  const languageFromContext =
    detectLanguageFromContentModel(contentModel) ?? detectLanguageFromTitle(title)
  if (languageFromContext) {
    return languageFromContext
  }

  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return previousLanguage ?? 'plain'
  }

  if (
    previousLanguage &&
    previousLanguage !== 'plain' &&
    looksLikeLanguage(trimmedValue, previousLanguage)
  ) {
    return previousLanguage
  }

  if (looksLikeJson(trimmedValue)) {
    return 'json'
  }
  if (looksLikeHtml(trimmedValue)) {
    return 'html'
  }
  if (looksLikeJavaScript(trimmedValue)) {
    return 'javascript'
  }

  return 'plain'
}

function detectLanguageFromContentModel(contentModel?: string | null): CodeLanguage | null {
  if (!contentModel) {
    return null
  }
  return CONTENT_MODEL_TO_LANGUAGE[contentModel] ?? null
}

function detectLanguageFromTitle(title?: string | null): CodeLanguage | null {
  if (!title) {
    return null
  }

  const normalizedTitle = title.split(/[?#]/, 1)[0]
  const extension = normalizedTitle.split('.').pop()?.toLowerCase()
  if (!extension) {
    return null
  }

  return TITLE_EXTENSION_TO_LANGUAGE[extension] ?? null
}

function looksLikeLanguage(value: string, language: Exclude<CodeLanguage, 'plain'>) {
  switch (language) {
    case 'json':
      return looksLikeJsonish(value)
    case 'html':
      return looksLikeHtml(value)
    case 'javascript':
      return looksLikeJavaScriptish(value)
  }
}

function looksLikeJson(value: string) {
  if (!looksLikeJsonish(value)) {
    return false
  }

  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

function looksLikeJsonish(value: string) {
  return /^[\[{]/.test(value) && /[:,\]}",]/.test(value)
}

function looksLikeHtml(value: string) {
  return (
    /^<!doctype html\b/i.test(value) ||
    /^<([a-z][\w:-]*)(\s[^>]*)?>[\s\S]*<\/\1>\s*$/i.test(value) ||
    /<\/?[a-z][\w:-]*(\s[^>]*)?>/i.test(value) ||
    /<!--[\s\S]*?-->/.test(value)
  )
}

function looksLikeJavaScript(value: string) {
  return looksLikeJavaScriptish(value) && !looksLikeHtml(value) && !looksLikeJsonish(value)
}

function looksLikeJavaScriptish(value: string) {
  if (!/[;{}()[\]=]/.test(value)) {
    return false
  }

  return [
    /\b(?:const|let|var|function|class|return|async|await|try|catch|throw|new)\b/,
    /^\s*(?:import|export)\s/m,
    /=>/,
    /\b(?:if|for|while|switch)\s*\(/,
    /\b(?:window|document|console)\./,
  ].some((pattern) => pattern.test(value))
}

function renderHighlightedCode(value: string, language: CodeLanguage) {
  const source = value || ' '
  if (language === 'plain') {
    return escapeHtml(source)
  }

  const highlightLanguage = language === 'html' ? 'xml' : language
  return hljs.highlight(source, {
    language: highlightLanguage,
    ignoreIllegals: true,
  }).value
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function getLanguageLabel(language: CodeLanguage) {
  return language === 'plain' ? '' : LANGUAGE_LABEL[language]
}

function readEditorMetrics(textarea: HTMLTextAreaElement): EditorMetrics | null {
  const style = textarea.ownerDocument.defaultView?.getComputedStyle(textarea)
  if (!style) {
    return null
  }

  const contentWidth = Math.max(
    1,
    textarea.clientWidth - parsePixelValue(style.paddingLeft) - parsePixelValue(style.paddingRight)
  )
  const lineHeight = parsePixelValue(style.lineHeight) || parsePixelValue(textarea.style.lineHeight)
  const font = normalizeFont(style) || normalizeFont(textarea.style)
  if (!lineHeight || !font) {
    return null
  }

  return {
    contentWidth,
    direction: textarea.dir || style.direction || 'ltr',
    font,
    lineHeight,
    locale: textarea.ownerDocument.documentElement.lang || '',
  }
}

function parsePixelValue(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeFont(style: CSSStyleDeclaration) {
  if (style.font) {
    return style.font
  }

  const parts = [
    style.fontStyle,
    style.fontVariant,
    style.fontWeight,
    style.fontStretch,
    style.fontSize,
    style.fontFamily,
  ]
    .map((part) => part.trim())
    .filter(Boolean)

  return parts.join(' ').trim()
}

function createFrameScheduler(windowRef: Window) {
  const request =
    windowRef.requestAnimationFrame?.bind(windowRef) ??
    ((callback: FrameRequestCallback) =>
      windowRef.setTimeout(() => callback(windowRef.performance.now()), 16))
  const cancel =
    windowRef.cancelAnimationFrame?.bind(windowRef) ??
    ((id: number) => {
      windowRef.clearTimeout(id)
    })

  return { cancel, request }
}

function joinClassName(baseClassName: string, extraClassName?: string) {
  return extraClassName ? `${baseClassName} ${extraClassName}` : baseClassName
}

function stripTrailingHardBreak(text: string) {
  return text.endsWith('\n') ? text.slice(0, -1) : text
}

function stripTrailingHardBreakFromRuns(runs: HighlightRun[]) {
  if (!runs.length) {
    return runs
  }

  const lastRun = runs[runs.length - 1]
  if (!lastRun.text.endsWith('\n')) {
    return runs
  }

  const nextRuns = runs.slice()
  const nextLastRun = {
    ...lastRun,
    text: stripTrailingHardBreak(lastRun.text),
  }

  if (!nextLastRun.text) {
    nextRuns.pop()
    return nextRuns
  }

  nextRuns[nextRuns.length - 1] = nextLastRun
  return nextRuns
}

function createPretextLineElement(
  documentRef: Document,
  line: LineRenderModel,
  lineHeightValue: string,
  direction: string
) {
  const lineElement = documentRef.createElement('div')
  lineElement.className = 'ipe-codeEditor__line'
  lineElement.style.height = lineHeightValue
  lineElement.style.lineHeight = lineHeightValue
  lineElement.style.direction = direction

  syncPretextLineElementContent(lineElement, documentRef, line)
  return lineElement
}

function syncPretextLineElementContent(
  lineElement: HTMLDivElement,
  documentRef: Document,
  line: LineRenderModel
) {
  const renderedParts = stripTrailingHardBreakFromRuns(line.parts)
  if (!renderedParts.length) {
    const nextTextContent = stripTrailingHardBreak(line.text) || '\u200b'
    if (lineElement.textContent !== nextTextContent || lineElement.children.length > 0) {
      lineElement.textContent = nextTextContent
    }
    return
  }

  if (lineElement.firstChild?.nodeType === Node.TEXT_NODE) {
    lineElement.textContent = ''
  }

  let childIndex = 0
  for (const part of renderedParts) {
    let span = lineElement.children.item(childIndex)
    if (!(span instanceof HTMLSpanElement)) {
      const nextSpan = documentRef.createElement('span')
      if (span) {
        lineElement.replaceChild(nextSpan, span)
      } else {
        lineElement.appendChild(nextSpan)
      }
      span = nextSpan
    }

    const nextClassName = part.className || ''
    if (span.className !== nextClassName) {
      span.className = nextClassName
    }

    const nextTextContent = part.text || '\u200b'
    if (span.textContent !== nextTextContent) {
      span.textContent = nextTextContent
    }

    childIndex += 1
  }

  while (lineElement.children.length > childIndex) {
    lineElement.lastElementChild?.remove()
  }
}

export function SyntaxHighlightedTextarea(props: SyntaxHighlightedTextareaProps) {
  let textareaRef: HTMLTextAreaElement | null = null
  let highlightViewportRef: HTMLDivElement | null = null
  let highlightRef: HTMLDivElement | null = null
  let badgeRef: HTMLSpanElement | null = null
  let editorRef: HTMLDivElement | null = null
  let resizeObserver: ResizeObserver | null = null
  let fullFrameId = 0
  let viewportFrameId = 0
  let inputDebounceTimer = 0
  let currentRenderer: 'pretext' | 'dom' = 'dom'

  let highlightCache: HighlightCacheState | null = null
  let preparedState: PreparedRenderState | null = null
  let layoutState: PretextLayoutState | null = null
  let pretextViewportState: PretextViewportState | null = null
  let pretextViewportDomState: PretextViewportDomState | null = null

  let lastDetectedValue = props.value ?? ''

  let currentLanguage = detectCodeLanguage(lastDetectedValue, {
    contentModel: props.contentModel,
    title: props.title,
  })

  const syncScrollPosition = () => {
    if (!textareaRef || !highlightViewportRef) {
      return
    }

    highlightViewportRef.scrollTop = textareaRef.scrollTop
    highlightViewportRef.scrollLeft = textareaRef.scrollLeft
  }

  const updateLanguageBadge = () => {
    if (!editorRef || !badgeRef) {
      return
    }

    editorRef.dataset.ipeLanguage = currentLanguage
    editorRef.dataset.ipeRenderer = currentRenderer
    const showBadge = currentLanguage !== 'plain'
    badgeRef.hidden = !showBadge
    badgeRef.textContent = getLanguageLabel(currentLanguage)
  }

  const getHighlightState = (documentRef: Document, value: string, language: CodeLanguage) => {
    if (highlightCache?.text === value && highlightCache.language === language) {
      return highlightCache
    }

    const html = renderHighlightedCode(value, language)
    const runs = flattenHighlightedHtml(documentRef, html)
    highlightCache = {
      html,
      language,
      runRanges: createHighlightRunRanges(runs),
      runs,
      text: value,
    }
    return highlightCache
  }

  const getPreparedState = (value: string, metrics: EditorMetrics) => {
    if (
      preparedState?.text === value &&
      preparedState.font === metrics.font &&
      preparedState.locale === metrics.locale
    ) {
      return preparedState
    }

    const { prepared, segmentMaps } = preparePretextSegments(value, metrics.font, metrics.locale)
    preparedState = {
      font: metrics.font,
      locale: metrics.locale,
      prepared,
      segmentMaps,
      text: value,
    }
    return preparedState
  }

  const getLayoutState = (prepared: PreparedRenderState, metrics: EditorMetrics) => {
    if (
      layoutState?.prepared === prepared.prepared &&
      layoutState.contentWidth === metrics.contentWidth &&
      layoutState.lineHeight === metrics.lineHeight
    ) {
      return layoutState
    }

    const { lines } = layoutPretextSegments(prepared.prepared, metrics.contentWidth, metrics.lineHeight)
    layoutState = {
      contentWidth: metrics.contentWidth,
      lineHeight: metrics.lineHeight,
      lines,
      prepared: prepared.prepared,
    }
    return layoutState
  }

  const applyHighlightMetrics = (metrics: EditorMetrics) => {
    if (!highlightRef || !textareaRef) {
      return
    }

    highlightRef.style.direction = metrics.direction
    highlightRef.style.height = `${Math.max(textareaRef.clientHeight, textareaRef.scrollHeight)}px`
    highlightRef.style.minHeight = `${textareaRef.clientHeight}px`
  }

  const renderDomFallback = (
    highlightState: HighlightCacheState,
    metrics: EditorMetrics | null
  ) => {
    if (!highlightRef) {
      return
    }

    pretextViewportState = null
    pretextViewportDomState = null
    currentRenderer = 'dom'
    highlightRef.className = joinClassName(
      'ipe-codeEditor__highlight ipe-codeEditor__highlight--dom',
      props.textareaClassName
    )
    highlightRef.innerHTML = highlightState.html
    if (metrics) {
      applyHighlightMetrics(metrics)
    }
  }

  const renderPretextViewport = (state: PretextViewportState) => {
    if (!highlightRef || !textareaRef) {
      return
    }

    const { start: windowStart, end: windowEnd } = getPretextWindowRange(
      textareaRef.scrollTop,
      textareaRef.clientHeight,
      state.lineHeight,
      state.lineCount
    )

    if (state.windowStart === windowStart && state.windowEnd === windowEnd) {
      return
    }

    state.windowStart = windowStart
    state.windowEnd = windowEnd

    const documentRef = textareaRef.ownerDocument
    if (!pretextViewportDomState) {
      const topSpacer = documentRef.createElement('div')
      topSpacer.className = 'ipe-codeEditor__spacer'

      const lineContainer = documentRef.createElement('div')
      lineContainer.className = 'ipe-codeEditor__lineContainer'

      const bottomSpacer = documentRef.createElement('div')
      bottomSpacer.className = 'ipe-codeEditor__spacer'

      pretextViewportDomState = {
        bottomSpacer,
        lineContainer,
        lineElementsByKey: new Map(),
        topSpacer,
      }
      highlightRef.replaceChildren(topSpacer, lineContainer, bottomSpacer)
    }

    pretextViewportDomState.topSpacer.style.height =
      windowStart > 0 ? `${windowStart * state.lineHeight}px` : '0px'
    pretextViewportDomState.bottomSpacer.style.height =
      windowEnd < state.lineCount ? `${(state.lineCount - windowEnd) * state.lineHeight}px` : '0px'

    const lineHeightValue = `${state.lineHeight}px`

    if (!state.lineCount) {
      const emptyLine = documentRef.createElement('div')
      emptyLine.className = 'ipe-codeEditor__line'
      emptyLine.style.height = lineHeightValue
      emptyLine.style.lineHeight = lineHeightValue
      emptyLine.textContent = '\u200b'
      state.lineModelsByIndex.clear()
      pretextViewportDomState.lineContainer.replaceChildren(emptyLine)
      pretextViewportDomState.lineElementsByKey = new Map([['__empty__', emptyLine]])
      return
    }

    const missingRanges: Array<{ end: number; start: number }> = []
    let missingStart = -1

    for (let index = windowStart; index < windowEnd; index += 1) {
      if (state.lineModelsByIndex.has(index)) {
        if (missingStart !== -1) {
          missingRanges.push({ start: missingStart, end: index })
          missingStart = -1
        }
        continue
      }

      if (missingStart === -1) {
        missingStart = index
      }
    }

    if (missingStart !== -1) {
      missingRanges.push({ start: missingStart, end: windowEnd })
    }

    for (const range of missingRanges) {
      const lineModelsForRange = buildLineRenderModels(
        state.value,
        state.lines.slice(range.start, range.end),
        state.runRanges,
        state.segmentMaps
      )

      lineModelsForRange.forEach((lineModel, offset) => {
        state.lineModelsByIndex.set(range.start + offset, lineModel)
      })
    }

    const lineModels: LineRenderModel[] = []
    for (let index = windowStart; index < windowEnd; index += 1) {
      const lineModel = state.lineModelsByIndex.get(index)
      if (!lineModel) {
        throw new Error('missing cached line model for viewport line')
      }
      lineModels.push(lineModel)
    }

    const keepStart = Math.max(0, windowStart - PRETEXT_MODEL_CACHE_BUFFER_LINES)
    const keepEnd = Math.min(state.lineCount, windowEnd + PRETEXT_MODEL_CACHE_BUFFER_LINES)
    for (const index of state.lineModelsByIndex.keys()) {
      if (index < keepStart || index >= keepEnd) {
        state.lineModelsByIndex.delete(index)
      }
    }

    const nextLineElementsByKey = new Map<string, HTMLDivElement>()
    for (let index = 0; index < lineModels.length; index += 1) {
      const line = lineModels[index]
      let lineElement = pretextViewportDomState.lineElementsByKey.get(line.key)
      if (!lineElement) {
        lineElement = createPretextLineElement(documentRef, line, lineHeightValue, state.direction)
      } else {
        if (lineElement.style.height !== lineHeightValue) {
          lineElement.style.height = lineHeightValue
          lineElement.style.lineHeight = lineHeightValue
        }
        if (lineElement.style.direction !== state.direction) {
          lineElement.style.direction = state.direction
        }
        syncPretextLineElementContent(lineElement, documentRef, line)
      }

      nextLineElementsByKey.set(line.key, lineElement)

      const expectedPositionElement = pretextViewportDomState.lineContainer.children.item(index)
      if (expectedPositionElement !== lineElement) {
        pretextViewportDomState.lineContainer.insertBefore(lineElement, expectedPositionElement)
      }
    }

    for (const [key, element] of pretextViewportDomState.lineElementsByKey) {
      if (!nextLineElementsByKey.has(key)) {
        element.remove()
      }
    }

    pretextViewportDomState.lineElementsByKey = nextLineElementsByKey
  }

  const renderPretextHighlight = (value: string, highlightState: HighlightCacheState) => {
    if (!highlightRef || !textareaRef) {
      return
    }

    const metrics = readEditorMetrics(textareaRef)
    if (!metrics) {
      renderDomFallback(highlightState, null)
      return
    }

    const prepared = getPreparedState(value, metrics)
    const { lines } = getLayoutState(prepared, metrics)

    const shouldResetViewportDomState =
      !pretextViewportState ||
      pretextViewportState.value !== value ||
      pretextViewportState.runRanges !== highlightState.runRanges ||
      pretextViewportState.contentWidth !== metrics.contentWidth ||
      pretextViewportState.lineHeight !== metrics.lineHeight ||
      pretextViewportState.direction !== metrics.direction

    if (shouldResetViewportDomState) {
      pretextViewportDomState = null
    }

    const lineModelsByIndex = shouldResetViewportDomState
      ? new Map<number, LineRenderModel>()
      : (pretextViewportState?.lineModelsByIndex ?? new Map<number, LineRenderModel>())

    pretextViewportState = {
      contentWidth: metrics.contentWidth,
      direction: metrics.direction,
      lineCount: lines.length,
      lineHeight: metrics.lineHeight,
      lineModelsByIndex,
      lines,
      runRanges: highlightState.runRanges,
      segmentMaps: prepared.segmentMaps,
      value,
      windowEnd: -1,
      windowStart: -1,
    }

    currentRenderer = 'pretext'
    highlightRef.className = joinClassName(
      'ipe-codeEditor__highlight ipe-codeEditor__highlight--pretext',
      props.textareaClassName
    )
    renderPretextViewport(pretextViewportState)
    applyHighlightMetrics(metrics)
  }

  const updateHighlight = (reason: HighlightUpdateReason) => {
    if (!textareaRef || !highlightRef) {
      return
    }

    const value = textareaRef.value

    if (
      reason === 'resize' &&
      currentRenderer === 'pretext' &&
      pretextViewportState &&
      value === lastDetectedValue
    ) {
      const metrics = readEditorMetrics(textareaRef)
      if (
        metrics &&
        metrics.contentWidth === pretextViewportState.contentWidth &&
        metrics.lineHeight === pretextViewportState.lineHeight &&
        metrics.direction === pretextViewportState.direction
      ) {
        try {
          renderPretextViewport(pretextViewportState)
          applyHighlightMetrics(metrics)
          updateLanguageBadge()
          syncScrollPosition()
          return
        } catch {
          layoutState = null
          pretextViewportDomState = null
        }
      }
    }

    if (value !== lastDetectedValue) {
      currentLanguage = detectCodeLanguage(value, {
        contentModel: props.contentModel,
        previousLanguage: currentLanguage,
        title: props.title,
      })
      lastDetectedValue = value
    }

    const highlightState = getHighlightState(textareaRef.ownerDocument, value, currentLanguage)

    try {
      renderPretextHighlight(value, highlightState)
    } catch (error) {
      preparedState = null
      layoutState = null
      const metrics = readEditorMetrics(textareaRef)
      renderDomFallback(highlightState, metrics)
    }

    updateLanguageBadge()
    syncScrollPosition()
  }

  const updatePretextViewport = () => {
    if (currentRenderer !== 'pretext' || !pretextViewportState) {
      return
    }

    renderPretextViewport(pretextViewportState)
  }

  const scheduleHighlightUpdate = (reason: HighlightUpdateReason) => {
    if (!textareaRef) {
      return
    }

    const windowRef = textareaRef.ownerDocument.defaultView || window
    const frameScheduler = createFrameScheduler(windowRef)

    if (inputDebounceTimer) {
      windowRef.clearTimeout(inputDebounceTimer)
      inputDebounceTimer = 0
    }

    const shouldDebounceInput =
      reason === 'input' && textareaRef.value.length >= LARGE_TEXT_INPUT_DEBOUNCE_THRESHOLD
    if (shouldDebounceInput) {
      if (fullFrameId) {
        frameScheduler.cancel(fullFrameId)
        fullFrameId = 0
      }
      if (viewportFrameId) {
        frameScheduler.cancel(viewportFrameId)
        viewportFrameId = 0
      }

      inputDebounceTimer = windowRef.setTimeout(() => {
        inputDebounceTimer = 0
        if (fullFrameId) {
          frameScheduler.cancel(fullFrameId)
        }
        fullFrameId = frameScheduler.request(() => {
          fullFrameId = 0
          updateHighlight(reason)
        })
      }, LARGE_TEXT_INPUT_DEBOUNCE_MS)
      return
    }

    if (fullFrameId) {
      frameScheduler.cancel(fullFrameId)
    }
    if (viewportFrameId) {
      frameScheduler.cancel(viewportFrameId)
      viewportFrameId = 0
    }
    fullFrameId = frameScheduler.request(() => {
      fullFrameId = 0
      updateHighlight(reason)
    })
  }

  const scheduleViewportUpdate = () => {
    if (!textareaRef || !pretextViewportState || currentRenderer !== 'pretext') {
      return
    }

    if (inputDebounceTimer) {
      return
    }

    const nextWindowRange = getPretextWindowRange(
      textareaRef.scrollTop,
      textareaRef.clientHeight,
      pretextViewportState.lineHeight,
      pretextViewportState.lineCount
    )
    if (
      nextWindowRange.start === pretextViewportState.windowStart &&
      nextWindowRange.end === pretextViewportState.windowEnd
    ) {
      return
    }

    if (fullFrameId) {
      return
    }

    const frameScheduler = createFrameScheduler(textareaRef.ownerDocument.defaultView || window)
    if (viewportFrameId) {
      frameScheduler.cancel(viewportFrameId)
    }
    viewportFrameId = frameScheduler.request(() => {
      viewportFrameId = 0
      updatePretextViewport()
    })
  }

  const observeTextarea = (textarea: HTMLTextAreaElement | null) => {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }

    if (!textarea || typeof ResizeObserver === 'undefined') {
      return
    }

    resizeObserver = new ResizeObserver(() => {
      scheduleHighlightUpdate('resize')
    })
    resizeObserver.observe(textarea)
  }

  return (
    <div
      ref={(el) => {
        editorRef = el as HTMLDivElement
        updateLanguageBadge()
      }}
      className="ipe-codeEditor"
      data-ipe-language={currentLanguage}
      data-ipe-renderer={currentRenderer}
    >
      <div className="ipe-codeEditor__surface">
        <div
          ref={(el) => {
            highlightViewportRef = el as HTMLDivElement
            syncScrollPosition()
          }}
          className="ipe-codeEditor__highlightViewport"
          aria-hidden="true"
        >
          <div
            ref={(el) => {
              highlightRef = el as HTMLDivElement
                scheduleHighlightUpdate('mount')
            }}
            className={joinClassName(
              `ipe-codeEditor__highlight ipe-codeEditor__highlight--${currentRenderer}`,
              props.textareaClassName
            )}
            style={props.textareaStyle}
          ></div>
        </div>
        <textarea
          ref={(el) => {
            textareaRef = el as HTMLTextAreaElement
            observeTextarea(textareaRef)
            scheduleHighlightUpdate('mount')
          }}
          className={`ipe-codeEditor__textarea ${props.textareaClassName || ''}`}
          style={props.textareaStyle}
          name={props.name}
          id={props.id}
          spellCheck={props.spellcheck}
          onInput={() => {
            scheduleHighlightUpdate('input')
          }}
          onScroll={() => {
            syncScrollPosition()
            scheduleViewportUpdate()
          }}
        >
          {props.value ?? ''}
        </textarea>
        <span
          ref={(el) => {
            badgeRef = el as HTMLSpanElement
            updateLanguageBadge()
          }}
          className="ipe-codeEditor__language"
          hidden={currentLanguage === 'plain'}
        >
          {getLanguageLabel(currentLanguage)}
        </span>
      </div>
    </div>
  ) as HTMLElement
}
