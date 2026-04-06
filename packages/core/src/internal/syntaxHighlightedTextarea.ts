import type { LayoutCursor, LayoutLine } from '@chenglou/pretext'

export interface HighlightRun {
  text: string
  className: string | null
}

export interface HighlightRunRange extends HighlightRun {
  start: number
  end: number
}

export interface SegmentMap {
  text: string
  startOffset: number
  endOffset: number
  graphemeOffsets: number[]
}

export interface LineRenderPart extends HighlightRun {}

export interface LineRenderModel {
  key: string
  text: string
  parts: LineRenderPart[]
}

const segmenterCache = new Map<string, Intl.Segmenter>()

export function flattenHighlightedHtml(
  documentRef: Document,
  highlightedHtml: string
): HighlightRun[] {
  const template = documentRef.createElement('template')
  template.innerHTML = highlightedHtml

  const runs: HighlightRun[] = []
  walkHighlightNodes(template.content.childNodes, [], runs)
  return runs
}

export function createHighlightRunRanges(runs: HighlightRun[]): HighlightRunRange[] {
  let cursor = 0

  return runs.map((run) => {
    const next = cursor + run.text.length
    const range = {
      ...run,
      start: cursor,
      end: next,
    }
    cursor = next
    return range
  })
}

export function createSegmentMaps(segments: string[], locale?: string): SegmentMap[] {
  let startOffset = 0

  return segments.map((segment) => {
    const graphemeOffsets = [0]
    let consumedLength = 0

    for (const part of segmentIntoGraphemes(segment, locale)) {
      consumedLength += part.length
      graphemeOffsets.push(consumedLength)
    }

    const map = {
      text: segment,
      startOffset,
      endOffset: startOffset + segment.length,
      graphemeOffsets,
    }
    startOffset += segment.length
    return map
  })
}

export function cursorToTextOffset(cursor: LayoutCursor, segmentMaps: SegmentMap[]): number {
  if (!segmentMaps.length) {
    return 0
  }

  const segmentIndex = Math.min(cursor.segmentIndex, segmentMaps.length - 1)
  const segment = segmentMaps[segmentIndex]

  if (cursor.segmentIndex >= segmentMaps.length) {
    return segmentMaps[segmentMaps.length - 1].endOffset
  }

  const graphemeIndex = Math.min(cursor.graphemeIndex, segment.graphemeOffsets.length - 1)
  return segment.startOffset + segment.graphemeOffsets[graphemeIndex]
}

export function buildLineRenderModels(
  fullText: string,
  lines: Array<Pick<LayoutLine, 'start' | 'end' | 'text'>>,
  runRanges: HighlightRunRange[],
  segmentMaps: SegmentMap[]
): LineRenderModel[] {
  const models: LineRenderModel[] = []
  let runStartIndex = 0

  for (const line of lines) {
    const start = cursorToTextOffset(line.start, segmentMaps)
    const rawEnd = cursorToTextOffset(line.end, segmentMaps)
    const rawText = fullText.slice(start, rawEnd)
    const text =
      stripTrailingHardBreak(rawText) === line.text ? stripTrailingHardBreak(rawText) : rawText
    const end = start + text.length

    if (text !== line.text) {
      throw new Error('pretext line text mismatch')
    }

    const { parts, nextRunStartIndex } = sliceHighlightRuns(
      runRanges,
      start,
      end,
      runStartIndex
    )
    runStartIndex = nextRunStartIndex
    const reconstructedText = parts.map((part) => part.text).join('')
    if (reconstructedText !== line.text) {
      throw new Error('highlight run slicing mismatch')
    }

    models.push({
      key: `${start}:${end}`,
      text: line.text,
      parts,
    })
  }

  return models
}

function walkHighlightNodes(nodes: Iterable<Node>, classNames: string[], runs: HighlightRun[]) {
  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      pushHighlightRun(runs, node.textContent || '', normalizeClassNames(classNames))
      continue
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      continue
    }

    const element = node as HTMLElement
    const nextClassNames = normalizeClassNames([...classNames, ...Array.from(element.classList)])
    walkHighlightNodes(element.childNodes, nextClassNames, runs)
  }
}

function pushHighlightRun(runs: HighlightRun[], text: string, classNames: string[]) {
  if (!text) {
    return
  }

  const className = classNames.length ? classNames.join(' ') : null
  const previous = runs[runs.length - 1]
  if (previous && previous.className === className) {
    previous.text += text
    return
  }

  runs.push({ text, className })
}

function normalizeClassNames(classNames: string[]) {
  return Array.from(new Set(classNames.filter(Boolean)))
}

function sliceHighlightRuns(
  runRanges: HighlightRunRange[],
  start: number,
  end: number,
  startRunIndex = 0
): {
  parts: LineRenderPart[]
  nextRunStartIndex: number
} {
  let runIndex = Math.max(0, startRunIndex)
  while (runIndex < runRanges.length && runRanges[runIndex].end <= start) {
    runIndex += 1
  }

  const parts: LineRenderPart[] = []
  let nextRunStartIndex = runIndex

  for (let index = runIndex; index < runRanges.length; index += 1) {
    const run = runRanges[index]
    if (run.start >= end) {
      nextRunStartIndex = index
      return {
        parts,
        nextRunStartIndex,
      }
    }

    const rangeStart = Math.max(run.start, start)
    const rangeEnd = Math.min(run.end, end)
    if (rangeStart < rangeEnd) {
      const offsetStart = rangeStart - run.start
      const offsetEnd = rangeEnd - run.start

      parts.push({
        text: run.text.slice(offsetStart, offsetEnd),
        className: run.className,
      })
    }

    // Keep the current run as the next start if it can continue to the next line.
    if (run.end > end) {
      nextRunStartIndex = index
      return {
        parts,
        nextRunStartIndex,
      }
    }

    nextRunStartIndex = index + 1
  }

  return {
    parts,
    nextRunStartIndex,
  }
}

function segmentIntoGraphemes(text: string, locale?: string) {
  if (typeof Intl.Segmenter === 'undefined') {
    return Array.from(text)
  }

  const cacheKey = locale || ''
  let segmenter = segmenterCache.get(cacheKey)
  if (!segmenter) {
    segmenter = new Intl.Segmenter(locale, { granularity: 'grapheme' })
    segmenterCache.set(cacheKey, segmenter)
  }

  return Array.from(segmenter.segment(text), (segment) => segment.segment)
}

function stripTrailingHardBreak(text: string) {
  return text.replace(/\r?\n$/, '')
}
