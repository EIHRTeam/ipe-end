import type {
  IDisposable,
  editor as MonacoEditor,
} from 'monaco-editor/esm/vs/editor/editor.api'

export interface MonacoTextareaBridgeHandle {
  getValue(): string
  setValue(nextValue: string): void
  syncTextarea(): void
  dispose(): void
  isReady(): boolean
}

export type MonacoThemeMode = 'auto' | 'light' | 'dark'

export interface MonacoTextareaBridgeProps {
  id?: string
  language?: string
  name: string
  onChange?: (value: string) => void
  onError?: (error: unknown) => void
  onReady?: (handle: MonacoTextareaBridgeHandle) => void
  spellcheck?: boolean
  textareaClassName?: string
  textareaStyle?: Record<string, string>
  themeMode?: MonacoThemeMode
  value?: string
}

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

let monacoRuntimePromise: Promise<MonacoRuntime> | null = null

function loadMonacoRuntime() {
  if (!monacoRuntimePromise) {
    monacoRuntimePromise = Promise.all([
      import('monaco-editor/esm/vs/editor/editor.api'),
      import('monaco-editor/esm/vs/language/json/monaco.contribution'),
      import('monaco-editor/esm/vs/editor/editor.worker?worker'),
      import('monaco-editor/esm/vs/language/json/json.worker?worker'),
    ]).then(([monaco, _jsonContribution, editorWorker, jsonWorker]) => ({
      monaco,
      editorWorker: editorWorker.default as WorkerCtor,
      jsonWorker: jsonWorker.default as WorkerCtor,
    }))
  }

  return monacoRuntimePromise
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

  const ipeTheme = document.body?.getAttribute('data-ipe-theme')
  if (ipeTheme === 'dark') {
    return 'vs-dark'
  }
  if (ipeTheme === 'light') {
    return 'vs'
  }

  if (typeof matchMedia === 'function') {
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs'
  }

  return 'vs'
}

export function MonacoTextareaBridge(props: MonacoTextareaBridgeProps) {
  let rootRef: HTMLDivElement | null = null
  let surfaceRef: HTMLDivElement | null = null
  let containerRef: HTMLDivElement | null = null
  let textareaRef: HTMLTextAreaElement | null = null

  let mounted = false
  let mountToken = 0
  let mutationObserver: MutationObserver | null = null
  let modelDisposable: IDisposable | null = null
  let blurDisposable: IDisposable | null = null
  let editorInstance: MonacoEditor.IStandaloneCodeEditor | null = null
  let layoutFrameIds: number[] = []
  let layoutTimerIds: number[] = []

  const initialValue = props.value ?? ''
  const language = props.language || 'json'
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
    if (!editorInstance || !containerRef) {
      return
    }
    const { width, height } = getLayoutSize()
    if (!width || !height) {
      return
    }
    editorInstance.layout({ width, height })
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

  const syncTextarea = () => {
    if (!textareaRef) {
      return
    }
    textareaRef.value = editorInstance ? editorInstance.getValue() : textareaRef.value
  }

  const emitChange = () => {
    props.onChange?.(editorInstance ? editorInstance.getValue() : textareaRef?.value || '')
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
    editorInstance?.dispose()
    editorInstance = null
    mutationObserver?.disconnect()
    mutationObserver = null
  }

  const handle: MonacoTextareaBridgeHandle = {
    getValue() {
      if (editorInstance) {
        return editorInstance.getValue()
      }
      return textareaRef?.value || ''
    },
    setValue(nextValue: string) {
      if (editorInstance && editorInstance.getValue() !== nextValue) {
        editorInstance.setValue(nextValue)
      }
      if (textareaRef) {
        textareaRef.value = nextValue
      }
    },
    syncTextarea,
    dispose,
    isReady() {
      return Boolean(editorInstance)
    },
  }

  const setMode = (mode: 'loading' | 'monaco' | 'textarea') => {
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

  const mountEditor = async () => {
    if (mounted || !containerRef || !textareaRef) {
      return
    }
    mounted = true
    const currentToken = ++mountToken

    try {
      if (typeof Worker === 'undefined') {
        throw new Error('Worker is not available in current runtime')
      }

      const runtime = await loadMonacoRuntime()
      if (currentToken !== mountToken || !containerRef || !textareaRef) {
        return
      }

      await waitForContainerVisibility(currentToken)
      if (currentToken !== mountToken || !containerRef || !textareaRef) {
        return
      }

      ensureMonacoEnvironment(runtime.editorWorker, runtime.jsonWorker)
      runtime.monaco.editor.setTheme(resolveMonacoTheme(props.themeMode))

      const styleTarget = surfaceRef || containerRef
      const computedStyle = styleTarget.ownerDocument.defaultView?.getComputedStyle(styleTarget)
      const fontSize = Number.parseFloat(computedStyle?.fontSize || '')
      const lineHeight = Number.parseFloat(computedStyle?.lineHeight || '')

      editorInstance = runtime.monaco.editor.create(containerRef, {
        value: textareaRef.value,
        language,
        automaticLayout: true,
        minimap: { enabled: false },
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        tabSize: 2,
        insertSpaces: true,
        fontFamily: computedStyle?.fontFamily || props.textareaStyle?.fontFamily || undefined,
        fontSize: Number.isFinite(fontSize) ? fontSize : 13,
        lineHeight: Number.isFinite(lineHeight) ? lineHeight : undefined,
      })

      modelDisposable = editorInstance.onDidChangeModelContent(() => {
        syncTextarea()
        emitChange()
      })

      blurDisposable = editorInstance.onDidBlurEditorText(() => {
        syncTextarea()
      })

      setMode('monaco')
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
      className="endwiki-monacoEditor"
      data-editor-mode="loading"
    >
      <div
        ref={(el) => {
          surfaceRef = el as HTMLDivElement
          applyInlineStyle(surfaceRef, props.textareaStyle)
        }}
        style={defaultEditorSizeStyle}
        className={`endwiki-monacoEditor__surface ${props.textareaClassName || ''}`}
      >
        <div
          ref={(el) => {
            containerRef = el as HTMLDivElement
            queueMicrotask(() => {
              void mountEditor()
            })
          }}
          style={defaultEditorSizeStyle}
          className="endwiki-monacoEditor__container"
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
          className={`endwiki-monacoEditor__compatTextarea ${props.textareaClassName || ''}`}
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
