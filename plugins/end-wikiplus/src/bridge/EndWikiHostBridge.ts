import type {
  HostAuthSessionSummary,
  HostPageContext,
  HostPluginContext,
  HostPluginSummary,
} from '@plugin/types/host'
import { isRecord, unwrapHostResult } from '@plugin/utils/result'

export interface EndWikiBootstrapSnapshot {
  page: HostPageContext
  currentItem: Record<string, unknown> | null
  me: Record<string, unknown> | null
  session: HostAuthSessionSummary | null
  selfPlugin: HostPluginSummary
}

function extractItemPayload(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null
  if (isRecord(value.data) && isRecord(value.data.item)) {
    return value.data.item
  }
  if (isRecord(value.item)) {
    return value.item
  }
  return value
}

export class EndWikiHostBridge {
  private pageContext!: HostPageContext
  private currentItem: Record<string, unknown> | null = null
  private me: Record<string, unknown> | null = null
  private session: HostAuthSessionSummary | null = null
  private selfPlugin!: HostPluginSummary
  private hostEventUnsubscribers: Array<() => void> = []
  private listeners = new Map<string, Set<(payload: unknown) => void>>()

  constructor(readonly host: HostPluginContext) {}

  async bootstrap(): Promise<EndWikiBootstrapSnapshot> {
    const [page, currentItem, me, selfPlugin] = await Promise.all([
      this.host.page.getContext().then((result) => unwrapHostResult(result)),
      this.host.wiki.getCurrentItem().then((result) => unwrapHostResult(result)),
      this.host.wiki.fetchMe().then((result) => extractItemPayload(unwrapHostResult(result))).catch(() => null),
      this.host.plugins.getSelf().then((result) => unwrapHostResult(result)),
    ])

    let session: HostAuthSessionSummary | null = null
    if (this.host.auth?.getSession) {
      session = await this.host.auth
        .getSession()
        .then((result) => unwrapHostResult(result))
        .catch(() => null)
    }

    this.pageContext = page
    this.currentItem = currentItem
    this.me = me
    this.session = session
    this.selfPlugin = selfPlugin

    await this.subscribeToHostEvents()

    return {
      page,
      currentItem,
      me,
      session,
      selfPlugin,
    }
  }

  async dispose() {
    this.hostEventUnsubscribers.forEach((unsubscribe) => unsubscribe())
    this.hostEventUnsubscribers = []
    this.listeners.clear()
  }

  getPageContext() {
    return this.pageContext
  }

  getCurrentItem() {
    return this.currentItem
  }

  getCurrentItemId() {
    const raw = this.pageContext?.wikiItemId || this.currentItem?.itemId
    return typeof raw === 'string' ? raw : raw == null ? null : String(raw)
  }

  getCurrentItemName() {
    const raw = this.pageContext?.wikiItemName || this.currentItem?.name
    return typeof raw === 'string' ? raw : raw == null ? null : String(raw)
  }

  getCurrentLanguage() {
    const raw = this.currentItem?.lang
    if (typeof raw === 'string' && raw.trim()) {
      return raw
    }
    return 'zh_Hans'
  }

  getSession() {
    return this.session
  }

  getMe() {
    return this.me
  }

  getSelfPlugin() {
    return this.selfPlugin
  }

  async refreshPageContext() {
    this.pageContext = unwrapHostResult(await this.host.page.getContext())
    this.currentItem = unwrapHostResult(await this.host.wiki.getCurrentItem())
    this.emit('host:page-context-changed', this.pageContext)
    this.emit('host:current-item-changed', this.currentItem)
  }

  async fetchEditableItem(itemId: string, lang = this.getCurrentLanguage()) {
    const data = unwrapHostResult(await this.host.wiki.fetchUpdateInfo({ itemId, lang }))
    return extractItemPayload(data)
  }

  async fetchItem(itemId: string) {
    const data = unwrapHostResult(await this.host.wiki.fetchItem({ itemId }))
    return extractItemPayload(data)
  }

  async submitItemUpdate(itemJson: string, commitMsg = '') {
    return unwrapHostResult(await this.host.wiki.submitItemUpdate({ itemJson, commitMsg }))
  }

  async clearDraft(itemId: string, lang = this.getCurrentLanguage()) {
    return unwrapHostResult(await this.host.wiki.clearItemDraft({ itemId, lang }))
  }

  async listLoadedPlugins() {
    return unwrapHostResult(await this.host.plugins.getLoaded())
  }

  on(event: string, handler: (payload: unknown) => void) {
    const handlers = this.listeners.get(event) ?? new Set<(payload: unknown) => void>()
    handlers.add(handler)
    this.listeners.set(event, handlers)
    return () => {
      handlers.delete(handler)
      if (!handlers.size) {
        this.listeners.delete(event)
      }
    }
  }

  private emit(event: string, payload: unknown) {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    handlers.forEach((handler) => {
      try {
        handler(payload)
      } catch (error) {
        console.warn(`[EndWikiHostBridge] listener failed for ${event}`, error)
      }
    })
  }

  private async subscribeToHostEvents() {
    const pageChanged = await this.host.events.on('host:page-context-changed', async () => {
      await this.refreshPageContext()
    })
    if (pageChanged.ok) {
      this.hostEventUnsubscribers.push(pageChanged.data)
    }

    const currentItemChanged = await this.host.events.on('wiki:current-item-changed', async () => {
      this.currentItem = unwrapHostResult(await this.host.wiki.getCurrentItem())
      this.emit('host:current-item-changed', this.currentItem)
    })
    if (currentItemChanged.ok) {
      this.hostEventUnsubscribers.push(currentItemChanged.data)
    }
  }
}
