import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import javascript from 'highlight.js/lib/languages/javascript'
import xml from 'highlight.js/lib/languages/xml'

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

export function SyntaxHighlightedTextarea(props: SyntaxHighlightedTextareaProps) {
  let textareaRef: HTMLTextAreaElement | null = null
  let highlightViewportRef: HTMLDivElement | null = null
  let highlightRef: HTMLPreElement | null = null
  let badgeRef: HTMLSpanElement | null = null
  let editorRef: HTMLDivElement | null = null
  let frameId = 0

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
    const showBadge = currentLanguage !== 'plain'
    badgeRef.hidden = !showBadge
    badgeRef.textContent = getLanguageLabel(currentLanguage)
  }

  const updateHighlight = () => {
    if (!textareaRef || !highlightRef) {
      return
    }

    currentLanguage = detectCodeLanguage(textareaRef.value, {
      contentModel: props.contentModel,
      previousLanguage: currentLanguage,
      title: props.title,
    })
    highlightRef.innerHTML = renderHighlightedCode(textareaRef.value, currentLanguage)
    updateLanguageBadge()
    syncScrollPosition()
  }

  const scheduleHighlightUpdate = () => {
    cancelAnimationFrame(frameId)
    frameId = requestAnimationFrame(updateHighlight)
  }

  return (
    <div
      ref={(el) => {
        editorRef = el as HTMLDivElement
        updateLanguageBadge()
      }}
      className="ipe-codeEditor"
      data-ipe-language={currentLanguage}
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
          <pre
            ref={(el) => {
              highlightRef = el as HTMLPreElement
              scheduleHighlightUpdate()
            }}
            className={`ipe-codeEditor__highlight ${props.textareaClassName || ''}`}
            style={props.textareaStyle}
          ></pre>
        </div>
        <textarea
          ref={(el) => {
            textareaRef = el as HTMLTextAreaElement
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
