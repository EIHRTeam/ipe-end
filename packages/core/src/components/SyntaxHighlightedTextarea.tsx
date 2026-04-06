import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import javascript from 'highlight.js/lib/languages/javascript'
import xml from 'highlight.js/lib/languages/xml'

import {
  buildLineRenderModels,
  createHighlightRunRanges,
  flattenHighlightedHtml,
  type HighlightRun,
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

export function SyntaxHighlightedTextarea(props: SyntaxHighlightedTextareaProps) {
  let textareaRef: HTMLTextAreaElement | null = null
  let highlightViewportRef: HTMLDivElement | null = null
  let highlightRef: HTMLDivElement | null = null
  let badgeRef: HTMLSpanElement | null = null
  let editorRef: HTMLDivElement | null = null
  let resizeObserver: ResizeObserver | null = null
  let frameId = 0
  let currentRenderer: 'pretext' | 'dom' = 'dom'

  let highlightCache: HighlightCacheState | null = null
  let preparedState: PreparedRenderState | null = null

  let currentLanguage = detectCodeLanguage(props.value ?? '', {
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
    const { lines } = layoutPretextSegments(
      prepared.prepared,
      metrics.contentWidth,
      metrics.lineHeight
    )
    const lineModels = buildLineRenderModels(
      value,
      lines,
      highlightState.runRanges,
      prepared.segmentMaps
    )

    currentRenderer = 'pretext'
    highlightRef.className = joinClassName(
      'ipe-codeEditor__highlight ipe-codeEditor__highlight--pretext',
      props.textareaClassName
    )
    highlightRef.replaceChildren()

    const fragment = textareaRef.ownerDocument.createDocumentFragment()
    const lineHeightValue = `${metrics.lineHeight}px`

    for (const line of lineModels) {
      const lineElement = textareaRef.ownerDocument.createElement('div')
      lineElement.className = 'ipe-codeEditor__line'
      lineElement.style.height = lineHeightValue
      lineElement.style.lineHeight = lineHeightValue
      lineElement.style.direction = metrics.direction

      const renderedParts = stripTrailingHardBreakFromRuns(line.parts)
      if (!renderedParts.length) {
        lineElement.textContent = stripTrailingHardBreak(line.text) || '\u200b'
        fragment.appendChild(lineElement)
        continue
      }

      for (const part of renderedParts) {
        const span = textareaRef.ownerDocument.createElement('span')
        if (part.className) {
          span.className = part.className
        }
        span.textContent = part.text || '\u200b'
        lineElement.appendChild(span)
      }

      fragment.appendChild(lineElement)
    }

    if (!lineModels.length) {
      const emptyLine = textareaRef.ownerDocument.createElement('div')
      emptyLine.className = 'ipe-codeEditor__line'
      emptyLine.style.height = lineHeightValue
      emptyLine.style.lineHeight = lineHeightValue
      emptyLine.textContent = '\u200b'
      fragment.appendChild(emptyLine)
    }

    highlightRef.appendChild(fragment)
    applyHighlightMetrics(metrics)
  }

  const updateHighlight = () => {
    if (!textareaRef || !highlightRef) {
      return
    }

    const value = textareaRef.value
    currentLanguage = detectCodeLanguage(value, {
      contentModel: props.contentModel,
      previousLanguage: currentLanguage,
      title: props.title,
    })

    const highlightState = getHighlightState(textareaRef.ownerDocument, value, currentLanguage)

    try {
      renderPretextHighlight(value, highlightState)
    } catch (error) {
      preparedState = null
      const metrics = readEditorMetrics(textareaRef)
      renderDomFallback(highlightState, metrics)
    }

    updateLanguageBadge()
    syncScrollPosition()
  }

  const scheduleHighlightUpdate = () => {
    if (!textareaRef) {
      return
    }

    const frameScheduler = createFrameScheduler(textareaRef.ownerDocument.defaultView || window)
    frameScheduler.cancel(frameId)
    frameId = frameScheduler.request(() => {
      updateHighlight()
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
      scheduleHighlightUpdate()
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
              scheduleHighlightUpdate()
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
            scheduleHighlightUpdate()
          }}
          className={`ipe-codeEditor__textarea ${props.textareaClassName || ''}`}
          style={props.textareaStyle}
          name={props.name}
          id={props.id}
          spellCheck={props.spellcheck}
          onInput={() => {
            scheduleHighlightUpdate()
          }}
          onScroll={() => {
            syncScrollPosition()
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
