import { isRecord } from '@plugin/utils/result'

export interface EndWikiSubmitPayload {
  item: Record<string, unknown>
  commitMsg: string
}

export interface ParsedEndWikiSubmitPayload extends EndWikiSubmitPayload {
  hasSubmitEnvelope: boolean
}

export interface EndWikiSubmitPayloadTextEdit {
  startOffset: number
  endOffset: number
  newText: string
}

const SERVER_ONLY_NULLABLE_FIELDS = ['createdUser', 'lastUpdatedUser'] as const

function cloneSubmitRecord(value: Record<string, unknown>) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value) as Record<string, unknown>
  }
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

function isEmptyRecord(value: unknown): value is Record<string, never> {
  return isRecord(value) && !Object.keys(value).length
}

function removeEmptyArrayField(record: Record<string, unknown>, key: string) {
  const value = record[key]
  if (Array.isArray(value) && !value.length) {
    delete record[key]
  }
}

function removeEmptyRecordField(record: Record<string, unknown>, key: string) {
  if (isEmptyRecord(record[key])) {
    delete record[key]
  }
}

function removeEmptyStringField(record: Record<string, unknown>, key: string) {
  if (record[key] === '') {
    delete record[key]
  }
}

function removeNullField(record: Record<string, unknown>, key: string) {
  if (record[key] === null) {
    delete record[key]
  }
}

function normalizeBriefForSubmit(item: Record<string, unknown>) {
  const brief = isRecord(item.brief) ? item.brief : null
  if (!brief) {
    return
  }

  removeNullField(brief, 'associate')
  removeNullField(brief, 'composite')

  const description = isRecord(brief.description) ? brief.description : null
  if (description && isEmptyRecord(description.authorMap)) {
    delete description.authorMap
  }
}

function normalizeExtraInfoForSubmit(item: Record<string, unknown>) {
  const document = isRecord(item.document) ? item.document : null
  const extraInfo = document && isRecord(document.extraInfo) ? document.extraInfo : null
  if (!extraInfo) {
    return
  }

  removeEmptyStringField(extraInfo, 'composite')
  removeEmptyStringField(extraInfo, 'showType')
}

function normalizeWidgetCommonMapForSubmit(item: Record<string, unknown>) {
  const document = isRecord(item.document) ? item.document : null
  const widgetCommonMap =
    document && isRecord(document.widgetCommonMap) ? document.widgetCommonMap : null
  if (!widgetCommonMap) {
    return
  }

  for (const widget of Object.values(widgetCommonMap)) {
    if (!isRecord(widget)) {
      continue
    }

    removeEmptyArrayField(widget, 'tableList')

    if (widget.type === 'table') {
      removeEmptyArrayField(widget, 'tabList')
      removeEmptyRecordField(widget, 'tabDataMap')
    }

    const tabList = Array.isArray(widget.tabList) ? widget.tabList : null
    if (tabList) {
      for (const tab of tabList) {
        if (!isRecord(tab)) {
          continue
        }
        removeEmptyStringField(tab, 'icon')
        removeEmptyStringField(tab, 'title')
      }
    }

    const tabDataMap = isRecord(widget.tabDataMap) ? widget.tabDataMap : null
    if (!tabDataMap) {
      continue
    }

    for (const tabData of Object.values(tabDataMap)) {
      if (!isRecord(tabData)) {
        continue
      }
      removeNullField(tabData, 'intro')
      removeEmptyStringField(tabData, 'content')
    }
  }
}

function normalizeItemForSubmit(item: Record<string, unknown>, clone = true) {
  const nextItem = clone ? cloneSubmitRecord(item) : item

  if ('status' in nextItem) {
    nextItem.status = 0
  }

  for (const field of SERVER_ONLY_NULLABLE_FIELDS) {
    if (field in nextItem) {
      nextItem[field] = null
    }
  }

  normalizeBriefForSubmit(nextItem)
  normalizeExtraInfoForSubmit(nextItem)
  normalizeWidgetCommonMapForSubmit(nextItem)

  return nextItem
}

function extractCommitMsg(value: Record<string, unknown>, fallbackCommitMsg: string) {
  return typeof value.commitMsg === 'string' ? value.commitMsg : fallbackCommitMsg
}

function extractFormalItem(value: Record<string, unknown>) {
  const nestedData = isRecord(value.data) ? value.data : null
  const candidates = [
    nestedData?.draft,
    nestedData?.newest,
    nestedData?.item,
    value.draft,
    value.newest,
    value.item,
  ]

  for (const candidate of candidates) {
    if (isRecord(candidate)) {
      return candidate
    }
  }

  return value
}

function parseJsonRecord(raw: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Edited payload must be valid JSON: ${message}`)
  }
  if (!isRecord(parsed)) {
    throw new Error('Edited payload must be a JSON object')
  }
  return parsed
}

function skipWhitespace(raw: string, startIndex: number) {
  let index = startIndex
  while (index < raw.length && /\s/.test(raw[index]!)) {
    index += 1
  }
  return index
}

function scanJsonString(raw: string, startIndex: number) {
  let index = startIndex + 1
  let escaped = false

  while (index < raw.length) {
    const char = raw[index]!
    if (escaped) {
      escaped = false
    } else if (char === '\\') {
      escaped = true
    } else if (char === '"') {
      return index + 1
    }
    index += 1
  }

  throw new Error('Invalid JSON string literal')
}

function scanJsonCompound(raw: string, startIndex: number) {
  const stack = [raw[startIndex] === '{' ? '}' : ']']
  let index = startIndex + 1
  let escaped = false
  let inString = false

  while (index < raw.length) {
    const char = raw[index]!
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      index += 1
      continue
    }

    if (char === '"') {
      inString = true
    } else if (char === '{') {
      stack.push('}')
    } else if (char === '[') {
      stack.push(']')
    } else if (char === stack[stack.length - 1]) {
      stack.pop()
      if (!stack.length) {
        return index + 1
      }
    }

    index += 1
  }

  throw new Error('Invalid JSON compound value')
}

function scanJsonValue(raw: string, startIndex: number) {
  const char = raw[startIndex]
  if (!char) {
    throw new Error('Unexpected end of JSON input')
  }

  if (char === '"') {
    return scanJsonString(raw, startIndex)
  }

  if (char === '{' || char === '[') {
    return scanJsonCompound(raw, startIndex)
  }

  let index = startIndex
  while (index < raw.length && !/[\s,\]}]/.test(raw[index]!)) {
    index += 1
  }
  return index
}

function detectLineIndent(raw: string, index: number) {
  const lineStart = raw.lastIndexOf('\n', index - 1)
  return raw.slice(lineStart + 1, index)
}

function detectPreferredNewline(raw: string) {
  return raw.includes('\r\n') ? '\r\n' : '\n'
}

function inspectRootObject(raw: string) {
  const objectStart = skipWhitespace(raw, 0)
  if (raw[objectStart] !== '{') {
    throw new Error('Edited payload must be a JSON object')
  }

  const properties: Array<{
    key: string
    keyStart: number
    valueStart: number
    valueEnd: number
  }> = []

  let index = objectStart + 1
  let closeIndex = -1

  while (index < raw.length) {
    index = skipWhitespace(raw, index)
    if (raw[index] === '}') {
      closeIndex = index
      break
    }

    const keyStart = index
    if (raw[keyStart] !== '"') {
      throw new Error('Invalid JSON object key')
    }

    const keyEnd = scanJsonString(raw, keyStart)
    const key = JSON.parse(raw.slice(keyStart, keyEnd)) as string

    index = skipWhitespace(raw, keyEnd)
    if (raw[index] !== ':') {
      throw new Error('Invalid JSON object property')
    }

    index = skipWhitespace(raw, index + 1)
    const valueStart = index
    const valueEnd = scanJsonValue(raw, valueStart)

    properties.push({
      key,
      keyStart,
      valueStart,
      valueEnd,
    })

    index = skipWhitespace(raw, valueEnd)
    if (raw[index] === ',') {
      index += 1
      continue
    }
    if (raw[index] === '}') {
      closeIndex = index
      break
    }

    throw new Error('Invalid JSON object separator')
  }

  if (closeIndex < 0) {
    throw new Error('Invalid JSON object terminator')
  }

  return {
    objectStart,
    closeIndex,
    properties,
  }
}

function findRootProperty(raw: string, key: string) {
  return inspectRootObject(raw).properties.find((property) => property.key === key) || null
}

function readRootStringProperty(raw: string, key: string) {
  const property = findRootProperty(raw, key)
  if (!property || raw[property.valueStart] !== '"') {
    return null
  }

  const parsed = JSON.parse(raw.slice(property.valueStart, property.valueEnd)) as unknown
  return typeof parsed === 'string' ? parsed : null
}

export function hasSubmitPayloadEnvelope(raw: string) {
  const root = inspectRootObject(raw)
  return root.properties.some((property) => property.key === 'item' || property.key === 'commitMsg')
}

function buildRootStringPropertyEdit(raw: string, key: string, nextValue: string) {
  const root = inspectRootObject(raw)
  const encodedKey = JSON.stringify(key)
  const encodedValue = JSON.stringify(nextValue)
  const existingProperty = root.properties.find((property) => property.key === key)

  if (existingProperty) {
    if (raw.slice(existingProperty.valueStart, existingProperty.valueEnd) === encodedValue) {
      return null
    }

    return {
      startOffset: existingProperty.valueStart,
      endOffset: existingProperty.valueEnd,
      newText: encodedValue,
    } satisfies EndWikiSubmitPayloadTextEdit
  }

  const isMultiline =
    root.properties.length > 0
      ? raw.slice(root.objectStart + 1, root.properties[0]!.keyStart).includes('\n')
      : raw.slice(root.objectStart + 1, root.closeIndex).includes('\n')
  const newline = detectPreferredNewline(raw)

  if (!root.properties.length) {
    if (isMultiline) {
      const closeIndent = detectLineIndent(raw, root.closeIndex)
      return {
        startOffset: root.objectStart + 1,
        endOffset: root.closeIndex,
        newText: `${newline}  ${encodedKey}: ${encodedValue}${newline}${closeIndent}`,
      } satisfies EndWikiSubmitPayloadTextEdit
    }

    return {
      startOffset: root.objectStart + 1,
      endOffset: root.closeIndex,
      newText: `${encodedKey}: ${encodedValue}`,
    } satisfies EndWikiSubmitPayloadTextEdit
  }

  if (isMultiline) {
    const indent = detectLineIndent(raw, root.properties[0]!.keyStart) || '  '
    const lastProperty = root.properties[root.properties.length - 1]!
    return {
      startOffset: lastProperty.valueEnd,
      endOffset: lastProperty.valueEnd,
      newText: `,${newline}${indent}${encodedKey}: ${encodedValue}`,
    } satisfies EndWikiSubmitPayloadTextEdit
  }

  const lastProperty = root.properties[root.properties.length - 1]!
  return {
    startOffset: lastProperty.valueEnd,
    endOffset: lastProperty.valueEnd,
    newText: `, ${encodedKey}: ${encodedValue}`,
  } satisfies EndWikiSubmitPayloadTextEdit
}

export function readSubmitPayload(raw: string, fallbackCommitMsg = '') {
  const parsed = parseJsonRecord(raw)
  const hasSubmitEnvelope = 'item' in parsed || 'commitMsg' in parsed

  if (hasSubmitEnvelope) {
    if (!isRecord(parsed.item)) {
      throw new Error('Edited submit payload must contain an object at `item`')
    }

    return {
      item: parsed.item,
      commitMsg: extractCommitMsg(parsed, fallbackCommitMsg),
      hasSubmitEnvelope: true,
    } as const
  }

  return {
    item: extractFormalItem(parsed),
    commitMsg: fallbackCommitMsg,
    hasSubmitEnvelope: false,
  } as const
}

export function createSubmitPayload(
  value: unknown,
  fallbackCommitMsg = ''
): EndWikiSubmitPayload {
  if (!isRecord(value)) {
    throw new Error('Edited payload must be a JSON object')
  }

  return {
    item: normalizeItemForSubmit(extractFormalItem(value), true),
    commitMsg: extractCommitMsg(value, fallbackCommitMsg),
  }
}

export function parseSubmitPayload(
  raw: string,
  fallbackCommitMsg = ''
): ParsedEndWikiSubmitPayload {
  const parsed = readSubmitPayload(raw, fallbackCommitMsg)

  return {
    item: normalizeItemForSubmit(parsed.item, false),
    commitMsg: parsed.commitMsg,
    hasSubmitEnvelope: parsed.hasSubmitEnvelope,
  }
}

export function getSubmitPayloadCommitMsg(raw: string, fallbackCommitMsg = '') {
  return readRootStringProperty(raw, 'commitMsg') ?? fallbackCommitMsg
}

export function getSubmitPayloadCommitMsgEdit(raw: string, commitMsg: string) {
  const parsed = readSubmitPayload(raw, commitMsg)
  if (!parsed.hasSubmitEnvelope) {
    return null
  }
  return buildRootStringPropertyEdit(raw, 'commitMsg', commitMsg)
}
