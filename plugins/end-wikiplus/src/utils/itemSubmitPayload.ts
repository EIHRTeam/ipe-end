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

function cloneJsonRecord(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

function normalizeItemForSubmit(item: Record<string, unknown>) {
  const nextItem = cloneJsonRecord(item)

  if ('status' in nextItem) {
    nextItem.status = 0
  }

  for (const field of SERVER_ONLY_NULLABLE_FIELDS) {
    if (field in nextItem) {
      nextItem[field] = null
    }
  }

  return nextItem
}

function extractCommitMsg(value: Record<string, unknown>, fallbackCommitMsg: string) {
  return typeof value.commitMsg === 'string' ? value.commitMsg : fallbackCommitMsg
}

function extractFormalItem(value: Record<string, unknown>) {
  if (isRecord(value.item)) {
    return value.item
  }

  if (isRecord(value.data) && isRecord(value.data.item)) {
    return value.data.item
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
    item: normalizeItemForSubmit(extractFormalItem(value)),
    commitMsg: extractCommitMsg(value, fallbackCommitMsg),
  }
}

export function parseSubmitPayload(
  raw: string,
  fallbackCommitMsg = ''
): ParsedEndWikiSubmitPayload {
  const parsed = readSubmitPayload(raw, fallbackCommitMsg)

  return {
    item: normalizeItemForSubmit(parsed.item),
    commitMsg: parsed.commitMsg,
    hasSubmitEnvelope: parsed.hasSubmitEnvelope,
  }
}

export function getSubmitPayloadCommitMsg(raw: string, fallbackCommitMsg = '') {
  return readSubmitPayload(raw, fallbackCommitMsg).commitMsg
}

export function getSubmitPayloadCommitMsgEdit(raw: string, commitMsg: string) {
  const parsed = readSubmitPayload(raw, commitMsg)
  if (!parsed.hasSubmitEnvelope) {
    return null
  }
  return buildRootStringPropertyEdit(raw, 'commitMsg', commitMsg)
}
