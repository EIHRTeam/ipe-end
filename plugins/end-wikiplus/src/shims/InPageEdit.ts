import Schema from 'schemastery'
import {
  Context,
  Inject,
  EffectScope,
  ForkScope,
  MainScope,
  ScopeStatus,
  symbols as CordisSymbols,
  Service,
  CordisError,
  Lifecycle,
} from '@cordisjs/core'
import type {
  Events as CordisEvents,
  Plugin as CordisPlugin,
  Registry as CordisRegistry,
} from '@cordisjs/core'
import { Endpoints } from '@/constants/endpoints'

export interface InPageEditCoreConfig {
  apiConfigs: Record<string, unknown>
  legacyPreferences: Record<string, unknown>
  logLevel: number
  storageNamespace: string
  autoloadStyles: boolean
  autoInstallCorePlugins: boolean
}

export class InPageEdit extends Context {
  readonly version: string = import.meta.env.__VERSION__ || '0.0.0'
  readonly schema = Schema
  readonly config: Partial<InPageEditCoreConfig> = {}
  Endpoints = Endpoints
}

export { Schema }

export interface PreferencesMap {}
export interface Events<C extends Context = Context> extends CordisEvents<C> {}
export type IPEPlugin<C = any> = CordisPlugin<Context, C>
export type IPERegistry = CordisRegistry<Context>

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
