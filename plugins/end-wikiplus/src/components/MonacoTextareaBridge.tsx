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

export interface MonacoTextareaBridgeProps {
  id?: string
  language?: string
  name: string
  onError?: (error: unknown) => void
  onReady?: (handle: MonacoTextareaBridgeHandle) => void
  spellcheck?: boolean
  textareaClassName?: string
  textareaStyle?: Record<string, string>
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

  const initialValue = props.value ?? ''
  const language = props.language || 'json'

  const syncTextarea = () => {
    if (!textareaRef) {
      return
    }
    textareaRef.value = editorInstance ? editorInstance.getValue() : textareaRef.value
  }

  const dispose = () => {
    mountToken += 1
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

      ensureMonacoEnvironment(runtime.editorWorker, runtime.jsonWorker)

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
      })

      blurDisposable = editorInstance.onDidBlurEditorText(() => {
        syncTextarea()
      })

      setMode('monaco')
      syncTextarea()
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
      className="endwiki-monacoEditor"
      data-editor-mode="loading"
    >
      <div
        ref={(el) => {
          surfaceRef = el as HTMLDivElement
          applyInlineStyle(surfaceRef, props.textareaStyle)
        }}
        className={`endwiki-monacoEditor__surface ${props.textareaClassName || ''}`}
      >
        <div
          ref={(el) => {
            containerRef = el as HTMLDivElement
            queueMicrotask(() => {
              void mountEditor()
            })
          }}
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
          className={`endwiki-monacoEditor__compatTextarea ${props.textareaClassName || ''}`}
          style={props.textareaStyle}
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