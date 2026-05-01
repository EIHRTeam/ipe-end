import type { Ace } from 'ace-builds'
import type {
  IDisposable,
  editor as MonacoEditor,
} from 'monaco-editor/esm/vs/editor/editor.api'

export type CodeEditorEngine = 'monaco' | 'ace'

export interface CodeEditorTextareaBridgeHandle {
  getValue(): string
  replaceText(startOffset: number, endOffset: number, nextText: string): void
  setValue(nextValue: string): void
  setLanguage(nextLanguage: string): void
  syncTextarea(): void
  dispose(): void
  isReady(): boolean
}

export type MonacoTextareaBridgeHandle = CodeEditorTextareaBridgeHandle

export type MonacoThemeMode = 'auto' | 'light' | 'dark'

export interface CodeEditorTextareaBridgeProps {
  editorEngine?: CodeEditorEngine
  id?: string
  language?: string
  name: string
  onChange?: (value: string) => void
  onError?: (error: unknown) => void
  onReady?: (handle: CodeEditorTextareaBridgeHandle) => void
  spellcheck?: boolean
  textareaClassName?: string
  textareaStyle?: Record<string, string>
  themeMode?: MonacoThemeMode
  value?: string
}

export type MonacoTextareaBridgeProps = CodeEditorTextareaBridgeProps

type MonacoGlobal = typeof globalThis & {
  MonacoEnvironment?: {
    getWorker?: (_workerId: string, label: string) => Worker
  }
  __ENDWIKI_MONACO_ENV__?: boolean
}

type MonacoModule = typeof import('monaco-editor/esm/vs/editor/editor.api')
type WorkerCtor = new () => Worker

interface MonacoRuntime {
  monaco: MonacoModule
  editorWorker: WorkerCtor
  jsonWorker: WorkerCtor
}

type AceModule = typeof import('ace-builds')

interface AceRuntime {
  ace: AceModule
}

type EditorMode = 'loading' | CodeEditorEngine | 'textarea'

let monacoRuntimePromise: Promise<MonacoRuntime> | null = null
let aceRuntimePromise: Promise<AceRuntime> | null = null

function loadMonacoRuntime() {
  if (!monacoRuntimePromise) {
    monacoRuntimePromise = Promise.all([
      import('monaco-editor/esm/vs/editor/editor.api'),
      import('monaco-editor/esm/vs/language/json/monaco.contribution'),
      import('monaco-editor/esm/vs/basic-languages/xml/xml.contribution'),
      import('monaco-editor/esm/vs/editor/editor.worker?worker&inline'),
      import('monaco-editor/esm/vs/language/json/json.worker?worker&inline'),
    ]).then(([monaco, _jsonContribution, _xmlContribution, editorWorker, jsonWorker]) => ({
      monaco,
      editorWorker: editorWorker.default as WorkerCtor,
      jsonWorker: jsonWorker.default as WorkerCtor,
    }))
  }

  return monacoRuntimePromise
}

function loadAceRuntime() {
  if (!aceRuntimePromise) {
    aceRuntimePromise = (async () => {
      const aceModule = await import('ace-builds')
      const ace = ((aceModule as { default?: AceModule }).default || aceModule) as AceModule
      await import('ace-builds/src-noconflict/mode-json')
      await import('ace-builds/src-noconflict/mode-xml')
      await import('ace-builds/src-noconflict/theme-textmate')
      await import('ace-builds/src-noconflict/theme-tomorrow_night')
      return { ace }
    })()
  }

  return aceRuntimePromise
}

function ensureMonacoEnvironment(editorWorker: WorkerCtor, jsonWorker: WorkerCtor) {
  const target = globalThis as MonacoGlobal
  if (target.__ENDWIKI_MONACO_ENV__) {
    return
  }

  target.MonacoEnvironment = {
    getWorker: (_workerId: string, label: string) => {
      if (label === 'json') {
        return new jsonWorker()
      }
      return new editorWorker()
    },
  }

  target.__ENDWIKI_MONACO_ENV__ = true
}

function applyInlineStyle(element: HTMLElement | null, style?: Record<string, string>) {
  if (!element || !style) {
    return
  }

  for (const [key, value] of Object.entries(style)) {
    if (key.includes('-')) {
      element.style.setProperty(key, value)
      continue
    }
    ;(element.style as unknown as Record<string, string>)[key] = value
  }
}

function resolveMonacoTheme(themeMode: MonacoThemeMode | undefined): 'vs' | 'vs-dark' {
  if (themeMode === 'dark') {
    return 'vs-dark'
  }
  if (themeMode === 'light') {
    return 'vs'
  }

  return isDarkTheme() ? 'vs-dark' : 'vs'
}

function resolveAceTheme(): 'ace/theme/textmate' | 'ace/theme/tomorrow_night' {
  return isDarkTheme() ? 'ace/theme/tomorrow_night' : 'ace/theme/textmate'
}

function isDarkTheme() {
  const ipeTheme = document.body?.getAttribute('data-ipe-theme')
  if (ipeTheme === 'dark') {
    return true
  }
  if (ipeTheme === 'light') {
    return false
  }

  if (typeof matchMedia === 'function') {
    return matchMedia('(prefers-color-scheme: dark)').matches
  }

  return false
}

function resolveAceMode(nextLanguage: string) {
  return nextLanguage === 'xml' ? 'ace/mode/xml' : 'ace/mode/json'
}

export function CodeEditorTextareaBridge(props: CodeEditorTextareaBridgeProps) {
  let rootRef: HTMLDivElement | null = null
  let surfaceRef: HTMLDivElement | null = null
  let containerRef: HTMLDivElement | null = null
  let textareaRef: HTMLTextAreaElement | null = null

  let mounted = false
  let mountToken = 0
  let mutationObserver: MutationObserver | null = null
  let modelDisposable: IDisposable | null = null
  let blurDisposable: IDisposable | null = null
  let monacoEditorInstance: MonacoEditor.IStandaloneCodeEditor | null = null
  let aceEditorInstance: Ace.Editor | null = null
  let aceChangeListener: Ace.EditorEvents['change'] | null = null
  let aceBlurListener: Ace.EditorEvents['blur'] | null = null
  let layoutFrameIds: number[] = []
  let layoutTimerIds: number[] = []

  const initialValue = props.value ?? ''
  const editorEngine: CodeEditorEngine = props.editorEngine || 'monaco'
  let language = props.language || 'json'
  let monacoApi: MonacoModule | null = null
  const defaultRootStyle = {
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 auto',
    height: '100%',
    minHeight: '0',
  }
  const defaultEditorSizeStyle = {
    display: 'flex',
    flex: '1 1 auto',
    width: '100%',
    height: '100%',
    minHeight: '0',
  }

  const defaultTextareaStyle = {
    ...defaultEditorSizeStyle,
    ...props.textareaStyle,
  }

  const removeFrameId = (id: number) => {
    layoutFrameIds = layoutFrameIds.filter((current) => current !== id)
  }

  const removeTimerId = (id: number) => {
    layoutTimerIds = layoutTimerIds.filter((current) => current !== id)
  }

  const getLayoutSize = () => {
    if (!containerRef) {
      return { width: 0, height: 0 }
    }
    const width = containerRef.clientWidth || containerRef.offsetWidth || 0
    const height = containerRef.clientHeight || containerRef.offsetHeight || 0
    return { width, height }
  }

  const runLayout = () => {
    if (!containerRef) {
      return
    }
    const { width, height } = getLayoutSize()
    if (!width || !height) {
      return
    }
    if (monacoEditorInstance) {
      monacoEditorInstance.layout({ width, height })
    }
    aceEditorInstance?.resize(true)
  }

  const scheduleLayout = (delay = 0) => {
    if (!containerRef) {
      return
    }
    const view = containerRef.ownerDocument.defaultView || window
    if (delay <= 0) {
      const frameId = view.requestAnimationFrame(() => {
        removeFrameId(frameId)
        runLayout()
      })
      layoutFrameIds.push(frameId)
      return
    }

    const timerId = view.setTimeout(() => {
      removeTimerId(timerId)
      const frameId = view.requestAnimationFrame(() => {
        removeFrameId(frameId)
        runLayout()
      })
      layoutFrameIds.push(frameId)
    }, delay)
    layoutTimerIds.push(timerId)
  }

  const scheduleLayoutPasses = () => {
    scheduleLayout(0)
    scheduleLayout(32)
    scheduleLayout(96)
    scheduleLayout(240)
    scheduleLayout(560)
  }

  const waitForContainerVisibility = async (token: number) => {
    if (!containerRef) {
      return
    }

    const view = containerRef.ownerDocument.defaultView || window
    for (let i = 0; i < 20; i += 1) {
      if (token !== mountToken || !containerRef) {
        return
      }

      const { width, height } = getLayoutSize()
      if (width > 48 && height > 48) {
        return
      }

      await new Promise<void>((resolve) => {
        const frameId = view.requestAnimationFrame(() => {
          removeFrameId(frameId)
          resolve()
        })
        layoutFrameIds.push(frameId)
      })
    }
  }

  const getEditorValue = () => {
    if (monacoEditorInstance) {
      return monacoEditorInstance.getValue()
    }
    if (aceEditorInstance) {
      return aceEditorInstance.getValue()
    }
    return textareaRef?.value || ''
  }

  const syncTextarea = () => {
    if (!textareaRef) {
      return
    }
    textareaRef.value = getEditorValue()
  }

  const emitChange = () => {
    props.onChange?.(getEditorValue())
  }

  const dispose = () => {
    mountToken += 1
    for (const frameId of layoutFrameIds) {
      cancelAnimationFrame(frameId)
    }
    layoutFrameIds = []
    for (const timerId of layoutTimerIds) {
      clearTimeout(timerId)
    }
    layoutTimerIds = []
    modelDisposable?.dispose()
    modelDisposable = null
    blurDisposable?.dispose()
    blurDisposable = null
    monacoEditorInstance?.dispose()
    monacoEditorInstance = null
    monacoApi = null
    if (aceEditorInstance) {
      if (aceChangeListener) {
        aceEditorInstance.off('change', aceChangeListener)
        aceChangeListener = null
      }
      if (aceBlurListener) {
        aceEditorInstance.off('blur', aceBlurListener)
        aceBlurListener = null
      }
      aceEditorInstance.destroy()
      aceEditorInstance.container?.remove()
      aceEditorInstance = null
    }
    mutationObserver?.disconnect()
    mutationObserver = null
  }

  const handle: CodeEditorTextareaBridgeHandle = {
    getValue() {
      return getEditorValue()
    },
    replaceText(startOffset: number, endOffset: number, nextText: string) {
      if (monacoEditorInstance) {
        const model = monacoEditorInstance.getModel()
        if (model) {
          const start = model.getPositionAt(startOffset)
          const end = model.getPositionAt(endOffset)
          monacoEditorInstance.executeEdits('endwiki-summary-sync', [
            {
              range: {
                startLineNumber: start.lineNumber,
                startColumn: start.column,
                endLineNumber: end.lineNumber,
                endColumn: end.column,
              },
              text: nextText,
              forceMoveMarkers: true,
            },
          ])
          return
        }
      }

      if (aceEditorInstance) {
        const session = aceEditorInstance.getSession()
        const documentRef = session.getDocument()
        const range = {
          start: documentRef.indexToPosition(startOffset),
          end: documentRef.indexToPosition(endOffset),
        }
        session.replace(range, nextText)
        return
      }

      if (textareaRef) {
        const currentValue = textareaRef.value
        textareaRef.value =
          currentValue.slice(0, startOffset) + nextText + currentValue.slice(endOffset)
        emitChange()
      }
    },
    setValue(nextValue: string) {
      if (monacoEditorInstance && monacoEditorInstance.getValue() !== nextValue) {
        monacoEditorInstance.setValue(nextValue)
      }
      if (aceEditorInstance && aceEditorInstance.getValue() !== nextValue) {
        aceEditorInstance.setValue(nextValue, -1)
      }
      if (textareaRef) {
        textareaRef.value = nextValue
      }
    },
    setLanguage(nextLanguage: string) {
      if (!nextLanguage || nextLanguage === language) {
        return
      }

      language = nextLanguage
      if (monacoEditorInstance && monacoApi) {
        const model = monacoEditorInstance.getModel()
        if (model) {
          monacoApi.editor.setModelLanguage(model, nextLanguage)
        }
      }
      if (aceEditorInstance) {
        aceEditorInstance.getSession().setMode(resolveAceMode(nextLanguage))
      }
    },
    syncTextarea,
    dispose,
    isReady() {
      return Boolean(monacoEditorInstance || aceEditorInstance)
    },
  }

  const setMode = (mode: EditorMode) => {
    if (!rootRef) {
      return
    }
    rootRef.dataset.editorMode = mode
  }

  const enableTextareaFallback = (error: unknown) => {
    setMode('textarea')
    containerRef?.remove()
    if (textareaRef) {
      textareaRef.style.display = 'block'
    }
    props.onError?.(error)
  }

  const getEditorTypography = () => {
    const styleTarget = surfaceRef || containerRef
    const computedStyle = styleTarget?.ownerDocument.defaultView?.getComputedStyle(styleTarget)
    const fontSize = Number.parseFloat(computedStyle?.fontSize || '')
    const lineHeight = Number.parseFloat(computedStyle?.lineHeight || '')

    return {
      fontFamily: computedStyle?.fontFamily || props.textareaStyle?.fontFamily || undefined,
      fontSize: Number.isFinite(fontSize) ? fontSize : 13,
      lineHeight: Number.isFinite(lineHeight) ? lineHeight : undefined,
    }
  }

  const mountMonacoEditor = async (token: number) => {
    if (typeof Worker === 'undefined') {
      throw new Error('Worker is not available in current runtime')
    }

    const runtime = await loadMonacoRuntime()
    if (token !== mountToken || !containerRef || !textareaRef) {
      return
    }

    ensureMonacoEnvironment(runtime.editorWorker, runtime.jsonWorker)
    runtime.monaco.editor.setTheme(resolveMonacoTheme(props.themeMode))
    monacoApi = runtime.monaco

    const typography = getEditorTypography()
    monacoEditorInstance = runtime.monaco.editor.create(containerRef, {
      value: textareaRef.value,
      language,
      automaticLayout: true,
      minimap: { enabled: false },
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      tabSize: 2,
      insertSpaces: true,
      fontFamily: typography.fontFamily,
      fontSize: typography.fontSize,
      lineHeight: typography.lineHeight,
    })

    modelDisposable = monacoEditorInstance.onDidChangeModelContent(() => {
      syncTextarea()
      emitChange()
    })

    blurDisposable = monacoEditorInstance.onDidBlurEditorText(() => {
      syncTextarea()
    })
  }

  const mountAceEditor = async (token: number) => {
    const runtime = await loadAceRuntime()
    if (token !== mountToken || !containerRef || !textareaRef) {
      return
    }

    const typography = getEditorTypography()
    aceEditorInstance = runtime.ace.edit(containerRef, {
      value: textareaRef.value,
      mode: resolveAceMode(language),
      theme: resolveAceTheme(),
      useWorker: false,
      wrap: true,
      tabSize: 2,
      useSoftTabs: true,
      showPrintMargin: false,
      fontFamily: typography.fontFamily,
      fontSize: typography.fontSize,
      scrollPastEnd: 0,
    })
    aceEditorInstance.renderer.setScrollMargin(0, 0)
    aceEditorInstance.renderer.setPadding(8)

    aceChangeListener = () => {
      syncTextarea()
      emitChange()
    }
    aceBlurListener = () => {
      syncTextarea()
    }
    aceEditorInstance.on('change', aceChangeListener)
    aceEditorInstance.on('blur', aceBlurListener)
  }

  const mountEditor = async () => {
    if (mounted || !containerRef || !textareaRef) {
      return
    }
    mounted = true
    const currentToken = ++mountToken

    try {
      await waitForContainerVisibility(currentToken)
      if (currentToken !== mountToken || !containerRef || !textareaRef) {
        return
      }

      if (editorEngine === 'ace') {
        await mountAceEditor(currentToken)
      } else {
        await mountMonacoEditor(currentToken)
      }

      if (currentToken !== mountToken) {
        return
      }

      setMode(editorEngine)
      syncTextarea()
      scheduleLayoutPasses()
      props.onReady?.(handle)
    } catch (error) {
      enableTextareaFallback(error)
    }
  }

  const watchDisconnect = (node: HTMLElement | null) => {
    mutationObserver?.disconnect()
    mutationObserver = null

    if (!node) {
      return
    }

    const documentRef = node.ownerDocument
    mutationObserver = new MutationObserver(() => {
      if (!node.isConnected) {
        dispose()
      }
    })
    mutationObserver.observe(documentRef, { childList: true, subtree: true })
  }

  return (
    <div
      ref={(el) => {
        rootRef = el as HTMLDivElement
        setMode('loading')
        watchDisconnect(rootRef)
      }}
      style={defaultRootStyle}
      className="endwiki-codeEditor endwiki-monacoEditor"
      data-editor-engine={editorEngine}
      data-editor-mode="loading"
    >
      <div
        ref={(el) => {
          surfaceRef = el as HTMLDivElement
          applyInlineStyle(surfaceRef, props.textareaStyle)
        }}
        style={defaultEditorSizeStyle}
        className={`endwiki-codeEditor__surface endwiki-monacoEditor__surface ${props.textareaClassName || ''}`}
      >
        <div
          ref={(el) => {
            containerRef = el as HTMLDivElement
            queueMicrotask(() => {
              void mountEditor()
            })
          }}
          style={defaultEditorSizeStyle}
          className="endwiki-codeEditor__container endwiki-monacoEditor__container"
        ></div>
        <textarea
          ref={(el) => {
            textareaRef = el as HTMLTextAreaElement
            if (textareaRef) {
              textareaRef.value = initialValue
              textareaRef.style.display = 'none'
            }
          }}
          onInput={() => {
            emitChange()
          }}
          className={`endwiki-codeEditor__compatTextarea endwiki-monacoEditor__compatTextarea ${props.textareaClassName || ''}`}
          style={defaultTextareaStyle}
          name={props.name}
          id={props.id}
          spellCheck={props.spellcheck}
        >
          {initialValue}
        </textarea>
      </div>
    </div>
  ) as HTMLElement
}

export function MonacoTextareaBridge(props: MonacoTextareaBridgeProps) {
  return <CodeEditorTextareaBridge {...props} editorEngine={props.editorEngine || 'monaco'} />
}
