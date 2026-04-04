import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="app"></div></body></html>', {
  url: 'http://127.0.0.1:9000/wiki-renderer/test',
  pretendToBeVisual: true,
})

const { window } = dom
const originalError = console.error
const consoleErrors = []

console.error = (...args) => {
  consoleErrors.push(args.map((arg) => String(arg)).join(' '))
  return originalError.apply(console, args)
}

globalThis.window = window
globalThis.document = window.document
globalThis.HTMLElement = window.HTMLElement
globalThis.Element = window.Element
globalThis.Node = window.Node
globalThis.Event = window.Event
globalThis.CustomEvent = window.CustomEvent
globalThis.MutationObserver = window.MutationObserver
globalThis.getComputedStyle = window.getComputedStyle.bind(window)
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window)
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window)
globalThis.queueMicrotask = queueMicrotask
globalThis.SVGElement = window.SVGElement
globalThis.localStorage = window.localStorage
globalThis.sessionStorage = window.sessionStorage
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true })
globalThis.customElements =
  window.customElements ||
  ({
    define() {},
    get() {
      return undefined
    },
    whenDefined() {
      return Promise.resolve()
    },
  })

window.matchMedia =
  window.matchMedia ||
  (() => ({
    matches: false,
    media: '',
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent() {
      return false
    },
  }))

globalThis.matchMedia = window.matchMedia
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const listeners = new Map()
const ok = (data) => ({ ok: true, data })
const currentItem = { itemId: '1', name: 'Test', lang: 'zh_Hans' }
const selfPlugin = {
  id: 'inpageedit-next-end-wikiplus',
  name: 'InPageEdit NEXT for Endfield Wiki⁺',
  version: '0.1.0',
  enabled: true,
  pages: ['wiki-renderer'],
}

const hostContext = {
  host: {
    getInfo: async () => ok({ apiVersion: 1, appVersion: 'dev', platform: 'desktop-tauri' }),
  },
  page: {
    getContext: async () =>
      ok({
        kind: 'wiki-renderer',
        routeName: 'wiki-render',
        fullPath: '/wiki-renderer/test',
        params: {},
        query: {},
        wikiItemId: '1',
        wikiItemName: 'Test',
        hasWikiItem: true,
      }),
  },
  wiki: {
    getCurrentItem: async () => ok(currentItem),
    fetchCatalog: async () => ok({ items: [] }),
    fetchItem: async () => ok({ item: currentItem }),
    fetchMe: async () => ok({ item: null }),
    fetchUpdateInfo: async () =>
      ok({
        item: currentItem,
        revisionId: 1,
        content: '{}',
        contentModel: 'json',
        timestamp: 'now',
        categories: [],
      }),
    submitItemUpdate: async () => ok({ revisionId: 2 }),
    clearItemDraft: async () => ok(null),
  },
  auth: {
    getSession: async () =>
      ok({
        hasSession: false,
        credentialSource: '',
        wikiProfileNickname: '',
        wikiProfileAvatar: '',
        wikiProfileUserId: '',
      }),
  },
  storage: {
    getItem: async () => ok(null),
    setItem: async () => ok(null),
    removeItem: async () => ok(null),
    listKeys: async () => ok([]),
  },
  ui: {
    notify: async () => ok(null),
  },
  plugins: {
    getSelf: async () => ok(selfPlugin),
    getLoaded: async () => ok([selfPlugin]),
  },
  events: {
    on: async (event, handler) => {
      const handlers = listeners.get(event) || new Set()
      handlers.add(handler)
      listeners.set(event, handlers)
      return ok(() => handlers.delete(handler))
    },
    emit: async (event, payload) => {
      const handlers = listeners.get(event)
      if (handlers) {
        for (const handler of handlers) {
          await handler(payload)
        }
      }
      return ok({ pluginId: selfPlugin.id, event, payload })
    },
  },
}

const logger = { info() {}, warn() {}, error() {}, debug() {} }
window.__END_WIKIPLUS_PLUGIN_LOGGER__ = logger
globalThis.__END_WIKIPLUS_PLUGIN_LOGGER__ = logger

async function main() {
  const artifactUrl = new URL(
    `../artifacts/inpageedit-next-end-wikiplus/dist/index.js?ts=${Date.now()}`,
    import.meta.url,
  )
  const mod = await import(artifactUrl.href)
  const cleanup = await mod.default.activate(hostContext)
  await new Promise((resolve) => setTimeout(resolve, 400))

  const buttonIds = [...window.document.querySelectorAll('#ipe-edit-toolbox .ipe-toolbox-btn')].map(
    (node) => node.id || node.getAttribute('data-id'),
  )

  assert.equal(window.document.body.getAttribute('data-end-wikiplus-ipe'), 'active')
  assert.deepEqual(buttonIds, [
    'ipe-toolbox__quick-edit-btn',
    'ipe-toolbox__preferences-btn',
    'toolbox-toggler',
  ])
  assert.equal(typeof cleanup, 'function')

  window.document.querySelector('#ipe-toolbox__quick-edit-btn')?.dispatchEvent(
    new window.MouseEvent('click', { bubbles: true }),
  )
  await new Promise((resolve) => setTimeout(resolve, 200))

  assert.ok(window.document.querySelector('.ipe-modal-modal.is-centered'))
  assert.ok(window.document.querySelector('.ipe-quickEdit__form'))
  assert.ok(window.document.querySelector('textarea#wpTextbox1'))
  assert.ok(window.document.querySelector('input[name="summary"]'))
  assert.ok(window.document.body.textContent?.includes('Follow MW preferences'))
  assert.ok(!window.document.body.textContent?.includes('watchlist.preferences'))

  window.document.querySelector('#ipe-toolbox__preferences-btn')?.dispatchEvent(
    new window.MouseEvent('click', { bubbles: true }),
  )
  await new Promise((resolve) => setTimeout(resolve, 200))

  assert.ok(window.document.querySelectorAll('.ipe-modal-modal.is-centered').length >= 2)
  assert.ok(window.document.querySelector('#ipe-preferences-app'))
  assert.ok(window.document.body.textContent?.includes('General'))
  assert.ok(!window.document.body.textContent?.includes('prefs.general.label'))

  window.document
    .querySelector('.ipe-modal-modal__window.ipe-preference .ipe-modal-btn.is-primary')
    ?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, 300))

  assert.equal(window.document.querySelector('#ipe-preferences-app'), null)
  assert.ok(window.document.body.textContent?.includes('Preferences Saved'))

  await cleanup()
  await new Promise((resolve) => setTimeout(resolve, 50))

  assert.equal(window.document.body.getAttribute('data-end-wikiplus-ipe'), null)
  assert.equal(window.document.querySelector('#ipe-edit-toolbox'), null)
  assert.deepEqual(consoleErrors, [])

  console.log(
    JSON.stringify(
      {
        ok: true,
        activeBeforeCleanup: 'active',
        buttonIds,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    console.error = originalError
  })
