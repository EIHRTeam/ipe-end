type PluginRuntimeLogger = {
  debug(scope: string, message: string, details?: unknown): void
  info(scope: string, message: string, details?: unknown): void
  warn(scope: string, message: string, details?: unknown): void
  error(scope: string, message: string, details?: unknown): void
}

function getLogger(): PluginRuntimeLogger | null {
  const candidate = (globalThis as typeof globalThis & {
    __END_WIKIPLUS_PLUGIN_LOGGER__?: PluginRuntimeLogger
  }).__END_WIKIPLUS_PLUGIN_LOGGER__
  return candidate || null
}

function fallback(
  level: 'debug' | 'info' | 'warn' | 'error',
  scope: string,
  message: string,
  details?: unknown
) {
  const line = `[end-wikiplus-plugin][${scope}] ${message}`
  if (details !== undefined) {
    console[level](line, details)
    return
  }
  console[level](line)
}

export const pluginRuntimeDebug = {
  debug(scope: string, message: string, details?: unknown) {
    const logger = getLogger()
    if (logger) {
      logger.debug(scope, message, details)
      return
    }
    fallback('debug', scope, message, details)
  },
  info(scope: string, message: string, details?: unknown) {
    const logger = getLogger()
    if (logger) {
      logger.info(scope, message, details)
      return
    }
    fallback('info', scope, message, details)
  },
  warn(scope: string, message: string, details?: unknown) {
    const logger = getLogger()
    if (logger) {
      logger.warn(scope, message, details)
      return
    }
    fallback('warn', scope, message, details)
  },
  error(scope: string, message: string, details?: unknown) {
    const logger = getLogger()
    if (logger) {
      logger.error(scope, message, details)
      return
    }
    fallback('error', scope, message, details)
  },
}
