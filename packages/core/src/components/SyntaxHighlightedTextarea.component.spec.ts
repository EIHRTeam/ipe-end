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

function createLongValue(lineCount = 200) {
  return Array.from(
    { length: lineCount },
    (_, index) => `const line_${index.toString().padStart(3, '0')} = ${index};`
  ).join('\n')
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
    vi.useFakeTimers()

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
    vi.useRealTimers()
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

  it('updates line content when input keeps the same text length', () => {
    const { element, textarea } = mountEditor('const value = 1;\n')

    flushAnimationFrames()

    const lineBeforeInput = element.querySelector('.ipe-codeEditor__line')
    expect(lineBeforeInput?.textContent).toBe('const value = 1;')

    textarea.value = 'const value = 2;\n'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    flushAnimationFrames()

    const lineAfterInput = element.querySelector('.ipe-codeEditor__line')
    expect(lineAfterInput?.textContent).toBe('const value = 2;')
  })

  it('debounces highlight updates for very large input content', () => {
    const { textarea } = mountEditor(createLongValue(2200))

    flushAnimationFrames()
    pretextAdapterMocks.preparePretextSegments.mockClear()
    pretextAdapterMocks.layoutPretextSegments.mockClear()

    textarea.value = createLongValue(2400)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))

    expect(frameQueue.length).toBe(0)
    expect(pretextAdapterMocks.preparePretextSegments).not.toHaveBeenCalled()

    vi.advanceTimersByTime(79)
    expect(frameQueue.length).toBe(0)

    vi.advanceTimersByTime(1)
    expect(frameQueue.length).toBe(1)

    flushAnimationFrames()

    expect(pretextAdapterMocks.preparePretextSegments).toHaveBeenCalledTimes(1)
    expect(pretextAdapterMocks.layoutPretextSegments).toHaveBeenCalledTimes(1)
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

  it('skips layout recompute when resize only changes editor height', () => {
    const { metrics } = mountEditor()

    flushAnimationFrames()
    pretextAdapterMocks.preparePretextSegments.mockClear()
    pretextAdapterMocks.layoutPretextSegments.mockClear()

    metrics.clientHeight = 260
    metrics.scrollHeight = 340
    MockResizeObserver.instances[0]?.trigger()
    flushAnimationFrames()

    expect(pretextAdapterMocks.preparePretextSegments).not.toHaveBeenCalled()
    expect(pretextAdapterMocks.layoutPretextSegments).not.toHaveBeenCalled()
  })

  it('updates viewport lines on height-only resize without full recompute', () => {
    const { element, metrics } = mountEditor(createLongValue(220))

    flushAnimationFrames()

    const renderedLinesBeforeResize = element.querySelectorAll('.ipe-codeEditor__line').length
    pretextAdapterMocks.preparePretextSegments.mockClear()
    pretextAdapterMocks.layoutPretextSegments.mockClear()

    metrics.clientHeight = 360
    metrics.scrollHeight = 520
    MockResizeObserver.instances[0]?.trigger()
    flushAnimationFrames()

    const renderedLinesAfterResize = element.querySelectorAll('.ipe-codeEditor__line').length

    expect(renderedLinesAfterResize).toBeGreaterThan(renderedLinesBeforeResize)
    expect(pretextAdapterMocks.preparePretextSegments).not.toHaveBeenCalled()
    expect(pretextAdapterMocks.layoutPretextSegments).not.toHaveBeenCalled()
  })

  it('renders only viewport lines for long documents', () => {
    const { element } = mountEditor(createLongValue(220))

    flushAnimationFrames()

    const renderedLines = element.querySelectorAll('.ipe-codeEditor__line').length
    const spacers = element.querySelectorAll('.ipe-codeEditor__spacer').length

    expect(renderedLines).toBeGreaterThan(0)
    expect(renderedLines).toBeLessThan(220)
    expect(spacers).toBeGreaterThan(0)
  })

  it('updates viewport on scroll without recomputing layout', () => {
    const { element, textarea } = mountEditor(createLongValue(220))

    flushAnimationFrames()

    const firstVisibleLineBeforeScroll = element.querySelector('.ipe-codeEditor__line')?.textContent
    pretextAdapterMocks.preparePretextSegments.mockClear()
    pretextAdapterMocks.layoutPretextSegments.mockClear()

    textarea.scrollTop = 2400
    textarea.dispatchEvent(new Event('scroll', { bubbles: true }))
    flushAnimationFrames()

    const firstVisibleLineAfterScroll = element.querySelector('.ipe-codeEditor__line')?.textContent

    expect(firstVisibleLineBeforeScroll).toBeDefined()
    expect(firstVisibleLineAfterScroll).toBeDefined()
    expect(firstVisibleLineAfterScroll).not.toBe(firstVisibleLineBeforeScroll)
    expect(pretextAdapterMocks.preparePretextSegments).not.toHaveBeenCalled()
    expect(pretextAdapterMocks.layoutPretextSegments).not.toHaveBeenCalled()
  })

  it('skips viewport scheduling when scroll does not cross window boundary', () => {
    const { element, textarea } = mountEditor(createLongValue(220))

    flushAnimationFrames()

    const firstVisibleLineBeforeScroll = element.querySelector('.ipe-codeEditor__line')?.textContent
    pretextAdapterMocks.preparePretextSegments.mockClear()
    pretextAdapterMocks.layoutPretextSegments.mockClear()

    textarea.scrollTop = 1
    textarea.dispatchEvent(new Event('scroll', { bubbles: true }))

    expect(frameQueue.length).toBe(0)

    const firstVisibleLineAfterScroll = element.querySelector('.ipe-codeEditor__line')?.textContent
    expect(firstVisibleLineAfterScroll).toBe(firstVisibleLineBeforeScroll)
    expect(pretextAdapterMocks.preparePretextSegments).not.toHaveBeenCalled()
    expect(pretextAdapterMocks.layoutPretextSegments).not.toHaveBeenCalled()
  })

  it('reuses overlapping line nodes when scrolling small distance', () => {
    const { element, textarea } = mountEditor(createLongValue(220))

    flushAnimationFrames()

    const lineText = 'const line_020 = 20;'
    const findLineNode = () =>
      Array.from(element.querySelectorAll('.ipe-codeEditor__line')).find(
        (line) => line.textContent === lineText
      )

    const beforeScrollNode = findLineNode()
    expect(beforeScrollNode).toBeTruthy()

    textarea.scrollTop = 24
    textarea.dispatchEvent(new Event('scroll', { bubbles: true }))
    flushAnimationFrames()

    const afterScrollNode = findLineNode()
    expect(afterScrollNode).toBe(beforeScrollNode)
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
