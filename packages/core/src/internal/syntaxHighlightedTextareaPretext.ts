import { layoutWithLines, prepareWithSegments, setLocale } from '@chenglou/pretext'

import { createSegmentMaps } from './syntaxHighlightedTextarea'

let activeLocale = ''

export function preparePretextSegments(text: string, font: string, locale: string) {
  if (activeLocale !== locale) {
    setLocale(locale || undefined)
    activeLocale = locale
  }

  const prepared = prepareWithSegments(text, font, {
    whiteSpace: 'pre-wrap',
  })

  return {
    prepared,
    segmentMaps: createSegmentMaps(prepared.segments, locale),
  }
}

export function layoutPretextSegments(
  prepared: ReturnType<typeof preparePretextSegments>['prepared'],
  maxWidth: number,
  lineHeight: number
) {
  return layoutWithLines(prepared, maxWidth, lineHeight)
}
