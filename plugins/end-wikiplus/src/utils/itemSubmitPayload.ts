import { isRecord } from '@plugin/utils/result'

export interface EndWikiSubmitPayload {
  item: Record<string, unknown>
  commitMsg: string
}

export interface ParsedEndWikiSubmitPayload extends EndWikiSubmitPayload {
  hasSubmitEnvelope: boolean
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
  const parsed = JSON.parse(raw) as unknown
  if (!isRecord(parsed)) {
    throw new Error('Edited payload must be a JSON object')
  }

  if ('item' in parsed || 'commitMsg' in parsed) {
    if (!isRecord(parsed.item)) {
      throw new Error('Edited submit payload must contain an object at `item`')
    }

    return {
      item: normalizeItemForSubmit(parsed.item),
      commitMsg: extractCommitMsg(parsed, fallbackCommitMsg),
      hasSubmitEnvelope: true,
    }
  }

  return {
    item: normalizeItemForSubmit(extractFormalItem(parsed)),
    commitMsg: fallbackCommitMsg,
    hasSubmitEnvelope: false,
  }
}
