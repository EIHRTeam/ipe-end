import type { HostPluginApiResult } from '@plugin/types/host'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function unwrapHostResult<T>(
  result: HostPluginApiResult<T>,
  fallbackMessage = 'Host request failed'
): T {
  if (result.ok) {
    return result.data
  }
  throw new Error(result.error.message || fallbackMessage)
}

export function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export function parseJsonObject(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw) as unknown
  if (!isRecord(parsed)) {
    throw new Error('Edited payload must be a JSON object')
  }
  return parsed
}
