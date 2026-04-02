import type { HostPluginContext } from '@plugin/types/host'

type TypedStorageEntry<T = any> = {
  time: number
  value: T
  version?: number | string
}

type StorageSnapshot<T> = Record<string, TypedStorageEntry<T>>

function isExpired(entry: TypedStorageEntry<unknown> | undefined, ttl?: number) {
  if (!entry) return true
  if (!ttl || ttl <= 0) return false
  return Date.now() - entry.time > ttl
}

export class HostStorageService {
  constructor(
    public ctx: { set(key: string, value: unknown): void },
    private host: HostPluginContext,
    private namespace: string
  ) {
    ctx.set('storage', this)
  }

  createDatabase<T = any>(
    storeName: string,
    ttl = 0,
    version?: number | string,
    _engine: 'indexedDB' | 'localStorage' | 'sessionStorage' | 'memory' = 'memory'
  ) {
    return new HostDatabaseManager<T>(this.host, `${this.namespace}:${storeName}`, ttl, version)
  }
}

class HostDatabaseManager<T> {
  constructor(
    private host: HostPluginContext,
    private storageKey: string,
    private defaultTtl = 0,
    private version?: number | string
  ) {}

  async get(key: string, ttl = this.defaultTtl, setter?: () => Promise<any> | any): Promise<T | null> {
    const snapshot = await this.readSnapshot()
    const entry = snapshot[key]
    if (isExpired(entry, ttl)) {
      if (entry) {
        delete snapshot[key]
        await this.writeSnapshot(snapshot)
      }
      if (setter) {
        const value = await setter()
        await this.set(key, value)
        return value as T
      }
      return null
    }
    return entry.value
  }

  async set(key: string, value: null | undefined): Promise<void>
  async set(record: Record<string, T | null | undefined>): Promise<Record<string, TypedStorageEntry<T> | void>>
  async set(key: string, value: T): Promise<TypedStorageEntry<T>>
  async set(
    keyOrRecord: string | Record<string, T | null | undefined>,
    value?: T | null
  ): Promise<TypedStorageEntry<T> | Record<string, TypedStorageEntry<T> | void> | void> {
    if (typeof keyOrRecord === 'string') {
      const snapshot = await this.readSnapshot()
      if (value == null) {
        delete snapshot[keyOrRecord]
        await this.writeSnapshot(snapshot)
        return
      }
      const entry: TypedStorageEntry<T> = {
        time: Date.now(),
        value,
        version: this.version,
      }
      snapshot[keyOrRecord] = entry
      await this.writeSnapshot(snapshot)
      return entry
    }

    const snapshot = await this.readSnapshot()
    const output: Record<string, TypedStorageEntry<T> | void> = {}
    for (const [key, entryValue] of Object.entries(keyOrRecord)) {
      if (entryValue == null) {
        delete snapshot[key]
        output[key] = undefined
        continue
      }
      const entry: TypedStorageEntry<T> = {
        time: Date.now(),
        value: entryValue,
        version: this.version,
      }
      snapshot[key] = entry
      output[key] = entry
    }
    await this.writeSnapshot(snapshot)
    return output
  }

  async has(key: string, ttl = this.defaultTtl): Promise<boolean> {
    return (await this.get(key, ttl)) !== null
  }

  async delete(key: string): Promise<void> {
    const snapshot = await this.readSnapshot()
    delete snapshot[key]
    await this.writeSnapshot(snapshot)
  }

  async *keys(): AsyncIterable<string> {
    const snapshot = await this.readSnapshot()
    for (const key of Object.keys(snapshot)) {
      yield key
    }
  }

  async *values(): AsyncIterable<TypedStorageEntry<T>> {
    const snapshot = await this.readSnapshot()
    for (const entry of Object.values(snapshot)) {
      yield entry
    }
  }

  async *entries(): AsyncIterable<[string, TypedStorageEntry<T>]> {
    const snapshot = await this.readSnapshot()
    for (const entry of Object.entries(snapshot)) {
      yield entry
    }
  }

  async updatedAt(key: string): Promise<number> {
    const snapshot = await this.readSnapshot()
    return snapshot[key]?.time ?? 0
  }

  async clear(): Promise<this> {
    await this.writeSnapshot({})
    return this
  }

  private async readSnapshot(): Promise<StorageSnapshot<T>> {
    const result = await this.host.storage.getItem(this.storageKey)
    if (!result.ok || !result.data) {
      return {}
    }
    try {
      return JSON.parse(result.data) as StorageSnapshot<T>
    } catch {
      return {}
    }
  }

  private async writeSnapshot(snapshot: StorageSnapshot<T>) {
    if (!Object.keys(snapshot).length) {
      await this.host.storage.removeItem(this.storageKey)
      return
    }
    await this.host.storage.setItem(this.storageKey, JSON.stringify(snapshot))
  }
}
