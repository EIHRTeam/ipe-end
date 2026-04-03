import { Context } from '@cordisjs/core'
import Schema from 'schemastery'
import { LoggerLevel, createLogger, type Logger } from '@inpageedit/logger'
import { Endpoints } from '@/constants/endpoints'
import { ModalService } from '@/services/ModalService'
import { PreferencesService } from '@/services/PreferencesService'
import { ThemeService } from '@/services/theme/ThemeService'
import { EndWikiHostBridge } from '@plugin/bridge/EndWikiHostBridge'
import { HostStorageService } from '@plugin/services/hostStorage'
import { EndWikiMetadataService } from '@plugin/services/wikiMetadata'
import { attachI18nShortcuts } from '@plugin/services/i18n'

export class EndWikiPlusApp extends Context {
  readonly version = `end-wikiplus-${import.meta.env.__VERSION__ || '0.1.0'}`
  readonly schema = Schema
  readonly Endpoints = Endpoints
  readonly logger: Logger

  constructor(
    readonly bridge: EndWikiHostBridge,
    readonly bootstrap: Awaited<ReturnType<EndWikiHostBridge['bootstrap']>>
  ) {
    super({ name: 'EndWikiPlusIPE' })
    this.logger = createLogger({
      name: 'END_WIKI_IPE',
      color: '#33aaff',
      level: import.meta.env.DEV ? LoggerLevel.debug : LoggerLevel.info,
    })
    this.initialize()
  }

  private initialize() {
    this.set('bridge', this.bridge)
    new EndWikiMetadataService(this as unknown as { set(key: string, value: unknown): void }, {
      session: this.bootstrap.session,
      page: {
        wikiItemId: this.bootstrap.page.wikiItemId,
        wikiItemName: this.bootstrap.page.wikiItemName,
      },
    })
    new HostStorageService(
      this as unknown as { set(key: string, value: unknown): void },
      this.bridge.host,
      `end-wikiplus:${this.bootstrap.selfPlugin.id}`
    )
    attachI18nShortcuts(this as unknown as { set(key: string, value: unknown): void })

    this.plugin(ModalService as never)
    this.plugin(PreferencesService as never)
    this.plugin(ThemeService as never)
    this.markServiceAsBuiltIn([
      'bridge',
      '$',
      '$raw',
      '$$',
      '$$raw',
      'modal',
      'preferences',
      'storage',
      'theme',
      'wiki',
      'getUrl',
      'getSciprtUrl',
      'getMainpageUrl',
    ])
  }

  private markServiceAsBuiltIn(services: string[]) {
    const internalKey = (this.constructor as typeof Context & { internal?: symbol }).internal
    if (!internalKey || !Array.isArray(services) || services.length === 0) return this
    const internal = (this as Record<PropertyKey, Record<string, { type?: string; builtin?: boolean }>>)[
      internalKey
    ]
    if (!internal) return this
    for (const name of services) {
      const entry = internal[name]
      if (entry?.type === 'service') {
        entry.builtin = true
      }
    }
    return this
  }

  async withInject(inject: string[]) {
    let resolvePromise!: (value: this) => void
    const promise = new Promise<this>((resolve) => {
      resolvePromise = resolve
    })
    this.inject(inject, (ctx) => resolvePromise(ctx as this))
    return promise
  }
}
