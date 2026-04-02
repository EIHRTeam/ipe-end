export type HostPluginErrorCode =
  | 'INVALID_ARGUMENT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NETWORK_ERROR'
  | 'REMOTE_ERROR'
  | 'PERMISSION_DENIED'
  | 'PLUGIN_LOAD_FAILED'
  | 'UNSUPPORTED'

export interface HostPluginError {
  code: HostPluginErrorCode
  message: string
  details?: unknown
}

export type HostPluginApiResult<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: HostPluginError
    }

export interface HostPageContext {
  kind: 'global' | 'wiki-renderer'
  routeName: string
  fullPath: string
  params: Record<string, string>
  query: Record<string, string>
  wikiItemId: string | null
  wikiItemName: string | null
  hasWikiItem: boolean
}

export interface HostAuthSessionSummary {
  hasSession: boolean
  credentialSource: '' | 'account'
  wikiProfileNickname: string
  wikiProfileAvatar: string
  wikiProfileUserId: string
}

export interface HostPluginSummary {
  id: string
  name: string
  version: string
  enabled: boolean
  pages: Array<'global' | 'wiki-renderer'>
}

export type HostPluginEventHandler = (payload: unknown) => void | Promise<void>

export interface HostPluginContext {
  host: {
    getInfo(): Promise<HostPluginApiResult<{ apiVersion: number; appVersion: string; platform: string }>>
  }
  page: {
    getContext(): Promise<HostPluginApiResult<HostPageContext>>
  }
  wiki: {
    getCurrentItem(): Promise<HostPluginApiResult<Record<string, unknown> | null>>
    fetchItem(args: { itemId: string }): Promise<HostPluginApiResult<unknown>>
    fetchMe(): Promise<HostPluginApiResult<unknown>>
    fetchUpdateInfo(args: { itemId: string; lang: string }): Promise<HostPluginApiResult<unknown>>
    submitItemUpdate(args: {
      itemJson: string
      commitMsg?: string
    }): Promise<HostPluginApiResult<unknown>>
    clearItemDraft(args: {
      itemId: string
      lang: string
    }): Promise<HostPluginApiResult<unknown>>
  }
  storage: {
    getItem(key: string): Promise<HostPluginApiResult<string | null>>
    setItem(key: string, value: string): Promise<HostPluginApiResult<null>>
    removeItem(key: string): Promise<HostPluginApiResult<null>>
    listKeys(): Promise<HostPluginApiResult<string[]>>
  }
  plugins: {
    getSelf(): Promise<HostPluginApiResult<HostPluginSummary>>
    getLoaded(): Promise<HostPluginApiResult<HostPluginSummary[]>>
  }
  events: {
    on(
      event: string,
      handler: HostPluginEventHandler,
    ): Promise<HostPluginApiResult<() => void>>
  }
  auth?: {
    getSession(): Promise<HostPluginApiResult<HostAuthSessionSummary>>
  }
  ui?: {
    notify(input: {
      type?: 'positive' | 'negative' | 'warning' | 'info' | 'ongoing'
      message: string
      caption?: string
      timeout?: number
    }): Promise<HostPluginApiResult<null>>
  }
}

export interface HostPluginModule {
  activate(
    context: HostPluginContext
  ): Promise<void | (() => void | Promise<void>)> | void | (() => void | Promise<void>)
}
