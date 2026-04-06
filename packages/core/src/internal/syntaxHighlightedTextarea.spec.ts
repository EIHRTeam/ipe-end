// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import {
  buildLineRenderModels,
  createHighlightRunRanges,
  createSegmentMaps,
  cursorToTextOffset,
  flattenHighlightedHtml,
} from './syntaxHighlightedTextarea'

describe('flattenHighlightedHtml', () => {
  it('flattens nested highlight markup into ordered runs', () => {
    const runs = flattenHighlightedHtml(
      document,
      '<span class="hljs-tag">&lt;div</span> plain <span class="hljs-string">"hero"</span><span class="hljs-tag">&gt;</span>'
    )

    expect(runs).toEqual([
      { text: '<div', className: 'hljs-tag' },
      { text: ' plain ', className: null },
      { text: '"hero"', className: 'hljs-string' },
      { text: '>', className: 'hljs-tag' },
    ])
  })
})

describe('cursorToTextOffset', () => {
  it('tracks grapheme offsets across emoji and mixed bidi text', () => {
    const segmentMaps = createSegmentMaps(['A🚀B', 'مرحبا'], 'en')

    expect(cursorToTextOffset({ segmentIndex: 0, graphemeIndex: 2 }, segmentMaps)).toBe(3)
    expect(cursorToTextOffset({ segmentIndex: 1, graphemeIndex: 3 }, segmentMaps)).toBe(7)
    expect(cursorToTextOffset({ segmentIndex: 2, graphemeIndex: 0 }, segmentMaps)).toBe(9)
  })
})

describe('buildLineRenderModels', () => {
  it('preserves JSON highlighting across hard line breaks and tabs', () => {
    const text = '{\n\t"emoji": "🚀",\n\t"rtl": "مرحبا"\n}'
    const runs = flattenHighlightedHtml(
      document,
      '<span class="hljs-punctuation">{</span>\n\t<span class="hljs-attr">"emoji"</span><span class="hljs-punctuation">:</span> <span class="hljs-string">"🚀"</span><span class="hljs-punctuation">,</span>\n\t<span class="hljs-attr">"rtl"</span><span class="hljs-punctuation">:</span> <span class="hljs-string">"مرحبا"</span>\n<span class="hljs-punctuation">}</span>'
    )
    const runRanges = createHighlightRunRanges(runs)
    const segments = ['{\n', '\t"emoji": "🚀",\n', '\t"rtl": "مرحبا"\n', '}']
    const segmentMaps = createSegmentMaps(segments, 'en')
    const lines = [
      {
        text: '{\n',
        start: { segmentIndex: 0, graphemeIndex: 0 },
        end: { segmentIndex: 1, graphemeIndex: 0 },
      },
      {
        text: '\t"emoji": "🚀",\n',
        start: { segmentIndex: 1, graphemeIndex: 0 },
        end: { segmentIndex: 2, graphemeIndex: 0 },
      },
      {
        text: '\t"rtl": "مرحبا"\n',
        start: { segmentIndex: 2, graphemeIndex: 0 },
        end: { segmentIndex: 3, graphemeIndex: 0 },
      },
      {
        text: '}',
        start: { segmentIndex: 3, graphemeIndex: 0 },
        end: { segmentIndex: 4, graphemeIndex: 0 },
      },
    ]

    const models = buildLineRenderModels(text, lines, runRanges, segmentMaps)

    expect(models.map((line) => line.text)).toEqual(lines.map((line) => line.text))
    expect(models[1]?.parts).toEqual([
      { text: '\t', className: null },
      { text: '"emoji"', className: 'hljs-attr' },
      { text: ':', className: 'hljs-punctuation' },
      { text: ' ', className: null },
      { text: '"🚀"', className: 'hljs-string' },
      { text: ',', className: 'hljs-punctuation' },
      { text: '\n', className: null },
    ])
    expect(models[2]?.parts.at(-1)?.text).toBe('\n')
  })

  it('slices JavaScript highlight runs at grapheme boundaries', () => {
    const text = 'ab🚀cd'
    const runs = flattenHighlightedHtml(document, 'ab<span class="hljs-string">🚀c</span>d')
    const runRanges = createHighlightRunRanges(runs)
    const segmentMaps = createSegmentMaps([text], 'en')
    const lines = [
      {
        text: 'ab🚀',
        start: { segmentIndex: 0, graphemeIndex: 0 },
        end: { segmentIndex: 0, graphemeIndex: 3 },
      },
      {
        text: 'cd',
        start: { segmentIndex: 0, graphemeIndex: 3 },
        end: { segmentIndex: 1, graphemeIndex: 0 },
      },
    ]

    const models = buildLineRenderModels(text, lines, runRanges, segmentMaps)

    expect(models[0]?.parts).toEqual([
      { text: 'ab', className: null },
      { text: '🚀', className: 'hljs-string' },
    ])
    expect(models[1]?.parts).toEqual([
      { text: 'c', className: 'hljs-string' },
      { text: 'd', className: null },
    ])
  })
})
