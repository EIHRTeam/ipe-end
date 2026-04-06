// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createSegmentMaps } from '@/internal/syntaxHighlightedTextarea'

const pretextAdapterMocks = vi.hoisted(() => {
  const toLineSegments = (text: string) => {
    const parts = text.split('\n')
    return parts.map((part, index) => (index < parts.length - 1 ? `${part}\n` : part))
  }

  return {
    layoutPretextSegments: vi.fn(
      (prepared: { segments: string[] }, maxWidth: number, lineHeight: number) => {
        const lines = prepared.segments.map((segment, index) => ({
          text: segment,
          width: Math.min(maxWidth, segment.length * 8),
          start: { segmentIndex: index, graphemeIndex: 0 },
          end: { segmentIndex: index + 1, graphemeIndex: 0 },
        }))

        return {
          height: lines.length * lineHeight,
          lineCount: lines.length,
          lines,
        }
      }
    ),
    preparePretextSegments: vi.fn((text: string) => {
      const segments = toLineSegments(text)
      return {
        prepared: { segments },
        segmentMaps: createSegmentMaps(segments, 'en'),
      }
    }),
  }
})

vi.mock('@/internal/syntaxHighlightedTextareaPretext', () => ({
  layoutPretextSegments: pretextAdapterMocks.layoutPretextSegments,
  preparePretextSegments: pretextAdapterMocks.preparePretextSegments,
}))

type MetricsState = {
  clientHeight: number
  clientWidth: number
  scrollHeight: number
}

class MockResizeObserver {
  static instances: MockResizeObserver[] = []

  callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    MockResizeObserver.instances.push(this)
  }

  disconnect() {}

  observe() {}

  unobserve() {}

  trigger() {
    this.callback([], this as unknown as ResizeObserver)
  }

  static reset() {
    MockResizeObserver.instances.length = 0
  }
}

let frameQueue: Array<{ callback: FrameRequestCallback; id: number }> = []
let nextFrameId = 1
let SyntaxHighlightedTextarea: typeof import('./SyntaxHighlightedTextarea').SyntaxHighlightedTextarea

function flushAnimationFrames() {
  while (frameQueue.length) {
    const queue = frameQueue
    frameQueue = []
    for (const frame of queue) {
      frame.callback(0)
    }
  }
}

function mountEditor(value = 'const answer = "ready"\n') {
  const element = SyntaxHighlightedTextarea({
    name: 'text',
    textareaClassName: 'ipe-quickEdit__textarea--monospace',
    value,
  })
  document.body.appendChild(element)

  const textarea = element.querySelector('textarea')
  const highlight = element.querySelector('.ipe-codeEditor__highlight')
  if (!(textarea instanceof HTMLTextAreaElement) || !(highlight instanceof HTMLDivElement)) {
    throw new Error('editor mount failed')
  }

  textarea.style.font = '16px monospace'
  textarea.style.lineHeight = '24px'
  textarea.style.padding = '4px 8px'

  const metrics: MetricsState = {
    clientHeight: 180,
    clientWidth: 520,
    scrollHeight: 260,
  }

  Object.defineProperties(textarea, {
    clientHeight: {
      configurable: true,
      get: () => metrics.clientHeight,
    },
    clientWidth: {
      configurable: true,
      get: () => metrics.clientWidth,
    },
    scrollHeight: {
      configurable: true,
      get: () => metrics.scrollHeight,
    },
  })

  return {
    element,
    highlight,
    metrics,
    textarea,
  }
}

describe('SyntaxHighlightedTextarea renderer', () => {
  beforeEach(async () => {
    frameQueue = []
    nextFrameId = 1
    document.body.innerHTML = ''
    vi.resetModules()

    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        const id = nextFrameId++
        frameQueue.push({ callback, id })
        return id
      })
    )
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((id: number) => {
        frameQueue = frameQueue.filter((frame) => frame.id !== id)
      })
    )
    vi.stubGlobal('ResizeObserver', MockResizeObserver)

    const syntaxHighlightedTextareaModule = await import('./SyntaxHighlightedTextarea')
    SyntaxHighlightedTextarea = syntaxHighlightedTextareaModule.SyntaxHighlightedTextarea
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    MockResizeObserver.reset()
    document.body.innerHTML = ''
  })

  it('renders the initial view with the pretext renderer', () => {
    const { element, highlight } = mountEditor()

    flushAnimationFrames()

    expect(pretextAdapterMocks.preparePretextSegments).toHaveBeenCalledTimes(1)
    expect(pretextAdapterMocks.layoutPretextSegments).toHaveBeenCalledTimes(1)
    expect(element.dataset.ipeRenderer).toBe('pretext')
    expect(highlight.className).toContain('ipe-codeEditor__highlight--pretext')
    expect(highlight.querySelectorAll('.ipe-codeEditor__line').length).toBeGreaterThan(0)
  })

  it('re-renders highlighted lines after input changes', () => {
    const { element, textarea } = mountEditor()

    flushAnimationFrames()
    pretextAdapterMocks.preparePretextSegments.mockClear()
    pretextAdapterMocks.layoutPretextSegments.mockClear()

    textarea.value = 'const nextValue = "updated"\n'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    flushAnimationFrames()

    expect(element.dataset.ipeRenderer).toBe('pretext')
    expect(pretextAdapterMocks.preparePretextSegments).toHaveBeenCalledTimes(1)
    expect(pretextAdapterMocks.layoutPretextSegments).toHaveBeenCalledTimes(1)
    expect(element.querySelector('.ipe-codeEditor__line')?.textContent).toBe(
      'const nextValue = "updated"'
    )
  })

  it('reuses prepared text on resize and only recomputes layout', () => {
    const { metrics } = mountEditor()

    flushAnimationFrames()
    pretextAdapterMocks.preparePretextSegments.mockClear()
    pretextAdapterMocks.layoutPretextSegments.mockClear()

    metrics.clientWidth = 720
    MockResizeObserver.instances[0]?.trigger()
    flushAnimationFrames()

    expect(pretextAdapterMocks.preparePretextSegments).not.toHaveBeenCalled()
    expect(pretextAdapterMocks.layoutPretextSegments).toHaveBeenCalledTimes(1)
  })

  it('falls back to the DOM renderer when pretext throws', () => {
    pretextAdapterMocks.preparePretextSegments.mockImplementationOnce(() => {
      throw new Error('pretext failed')
    })

    const { element, highlight } = mountEditor('const failure = true;\n')

    flushAnimationFrames()

    expect(element.dataset.ipeRenderer).toBe('dom')
    expect(highlight.className).toContain('ipe-codeEditor__highlight--dom')
    expect(highlight.innerHTML).toContain('hljs-keyword')
  })
})
