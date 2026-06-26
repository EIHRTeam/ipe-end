type AnyRecord = Record<string, any>
type JsxComponent = (props?: AnyRecord & { children?: any }) => HTMLElement

declare module '@/InPageEdit' {
  import {
    Context,
    CordisError,
    EffectScope,
    ForkScope,
    Inject,
    Lifecycle,
    MainScope,
    ScopeStatus,
    Service,
    symbols as CordisSymbols,
  } from '@cordisjs/core'

  export class InPageEdit extends Context {
    [key: string]: any
    readonly version: string
    readonly schema: any
    readonly Endpoints: typeof import('@/constants/endpoints').Endpoints
  }

  export const Schema: any
  export interface PreferencesMap {}
  export interface Events {}
  export type IPEPlugin<C = any> = any
  export type IPERegistry = any

  export {
    Inject,
    EffectScope,
    ForkScope,
    MainScope,
    ScopeStatus,
    CordisSymbols,
    Service,
    CordisError,
    Lifecycle,
  }
}

declare module '@/constants/endpoints' {
  export enum Endpoints {
    ANALYTICS_API_BASE = 'https://analytics.ipe.wiki/api/v6',
    ANALYTICS_DASH_URL = 'https://analytics.ipe.wiki',
    GITHUB_URL = 'https://github.com/inpageedit/inpageedit-next',
    GITHUB_OWNER = 'inpageedit',
    GITHUB_REPO = 'inpageedit-next',
    HOME_URL = 'https://www.ipe.wiki/',
    UPDATE_LOGS_URL = 'https://www.ipe.wiki/changelogs/',
    PLUGIN_REGISTRY_URL = 'https://registry.ipe.wiki/registry.v1.json',
    I18N_INDEX_URL = 'https://registry.ipe.wiki/i18n/index.json',
    QQ_GROUP_ID = '1026023666',
  }
}

declare module '@/decorators/Preferences' {
  export function RegisterPreferences(...args: any[]): ClassDecorator
}

declare module '@/plugins/BasePlugin' {
  export default class BasePlugin {
    readonly ctx: any
    readonly config: any
    readonly name: string
    readonly logger: any
    constructor(ctx: any, config?: any, name?: string)
    addDisposeHandler(callback: (ctx: any) => void): void
  }
}

declare module '@/plugins/toolbox' {
  export class PluginToolbox {
    constructor(...args: any[])
  }
}

declare module '@/components' {
  export const CheckBox: JsxComponent
  export const InputBox: JsxComponent
  export const MBox: JsxComponent
  export const ProgressBar: JsxComponent
  export const RadioBox: JsxComponent
}

declare module '@/components/Icon' {
  export const IconUpload: JsxComponent
}

declare module '@/models/WikiPage/types/WatchlistAction' {
  export enum WatchlistAction {
    preferences = 'preferences',
    watch = 'watch',
    unwatch = 'unwatch',
    nochange = 'nochange',
  }
}

declare module '@/utils/makeCallable.js' {
  export function makeCallable<T extends object>(target: T, method: keyof T): T
}

declare module '@/utils/noop' {
  export function noop(): void
}

declare module '@/utils/sleep' {
  export function sleep(ms?: number): Promise<void>
}

declare module '@/utils/vueHooks' {
  export function createVueAppWithIPE(ctx: any, component: any): {
    mount(root: Element | string): any
    unmount(): void
    config: AnyRecord
  }
}

declare module '@/services/ModalService' {
  export type CustomIPEModal = any
  export class ModalService {
    constructor(...args: any[])
  }
}

declare module '@/services/PreferencesService' {
  export class PreferencesService {
    constructor(...args: any[])
  }
}

declare module '@/services/theme/ThemeService' {
  export class ThemeService {
    constructor(...args: any[])
  }
}

declare module '@/services/i18n/I18nManager' {
  export class I18nManager {
    constructor(init?: Record<string, any>, options?: { language?: string; globals?: Record<string, unknown> })
    setLanguageData(language: string, data: Record<string, any>): this
    setLanguage(language: string): this
    $(strings: TemplateStringsArray, ...values: unknown[]): string
    $raw(strings: TemplateStringsArray, ...values: unknown[]): string
    $$(key: string): string
    $$raw(key: string): string
  }
}

declare module '@/__mock__/i18n/*.json' {
  const value: Record<string, string>
  export default value
}

declare module '@/plugins/preferences-ui/components/PreferencesApp.vue' {
  const component: new (...args: any[]) => any
  export default component
}

declare module 'monaco-editor/esm/vs/editor/editor.api' {
  export * from 'monaco-editor/esm/vs/editor/editor.api.js'
}

declare module 'monaco-editor/esm/vs/language/json/monaco.contribution' {
  export {}
}

declare module 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution' {
  export {}
}

declare module '*?worker&inline' {
  const WorkerFactory: {
    new (): Worker
  }
  export default WorkerFactory
}
