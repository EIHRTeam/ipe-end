import type { EndfieldWikitextConversionResult, EndfieldWikitextFormat } from './types'
import type { DocumentModel } from './model'
import { documentFromJsonText, documentToJsonText } from './jsonFormat'
import { documentFromXmlText, documentToXmlText } from './xmlFormat'

export function convertEndfieldWikitextText(
  source: string,
  fromFormat: EndfieldWikitextFormat,
  toFormat: EndfieldWikitextFormat
): EndfieldWikitextConversionResult {
  if (fromFormat === toFormat) {
    return {
      text: source,
      warnings: [],
    }
  }

  let document: DocumentModel
  let warnings: string[]

  if (fromFormat === 'json') {
    ;[document, warnings] = documentFromJsonText(source)
  } else if (fromFormat === 'xml') {
    ;[document, warnings] = documentFromXmlText(source)
  } else {
    throw new Error(`Unsupported input format: ${String(fromFormat)}`)
  }

  if (toFormat === 'json') {
    return {
      text: documentToJsonText(document),
      warnings,
    }
  }

  if (toFormat === 'xml') {
    return {
      text: documentToXmlText(document),
      warnings,
    }
  }

  throw new Error(`Unsupported output format: ${String(toFormat)}`)
}
