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
globalThis.UIEvent = window.UIEvent
globalThis.CustomEvent = window.CustomEvent
globalThis.MutationObserver = window.MutationObserver
globalThis.FormData = window.FormData
globalThis.getComputedStyle = window.getComputedStyle.bind(window)
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window)
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window)
globalThis.queueMicrotask = queueMicrotask
globalThis.SVGElement = window.SVGElement
globalThis.localStorage = window.localStorage
globalThis.sessionStorage = window.sessionStorage
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true })
if (typeof window.document.queryCommandSupported !== 'function') {
  window.document.queryCommandSupported = () => false
}
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
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent() {
      return false
    },
  }))

globalThis.matchMedia = window.matchMedia
Object.defineProperty(globalThis, 'Worker', {
  value: undefined,
  configurable: true,
})
Object.defineProperty(window, 'Worker', {
  value: undefined,
  configurable: true,
})
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
function buildFormalItem(name) {
  return {
    itemId: '1',
    name,
    lang: 'zh_Hans',
    status: 1,
    createdUser: {
      id: 'user-created',
      nickname: 'Creator',
    },
    lastUpdatedUser: {
      id: 'user-updated',
      nickname: 'Editor',
    },
    lastAuditPassedAt: '1234567890',
    mainType: {
      id: 'main-type',
      name: 'Main Type',
    },
    subType: {
      id: 'sub-type',
      name: 'Sub Type',
    },
    tagIds: ['tag-1'],
    brief: {
      name,
      associate: null,
      composite: null,
      description: {
        id: 'brief-doc',
        blockIds: [],
        blockMap: {},
        authorMap: {},
        version: '1.0.0',
      },
    },
    document: {
      extraInfo: {
        illustration: '',
        showType: '',
        composite: '',
      },
      widgetCommonMap: {
        audioWidget: {
          type: 'audio',
          tableList: [],
          tabList: [],
          tabDataMap: {
            default: {
              intro: null,
              content: '',
              audioList: [
                {
                  title: 'Theme',
                  profile: 'Theme intro',
                  resourceUrl: 'https://example.com/theme.mp3',
                },
              ],
            },
          },
        },
        imageTabs: {
          type: 'common',
          tableList: [],
          tabList: [
            {
              tabId: 'tab-1',
              title: '',
              icon: 'https://example.com/icon.png',
            },
            {
              tabId: 'tab-2',
              title: 'Keep title',
              icon: '',
            },
          ],
          tabDataMap: {
            default: {
              intro: null,
              content: 'doc-1',
              audioList: [],
            },
            'tab-2': {
              intro: {
                name: 'Keep intro',
              },
              content: '',
              audioList: [],
            },
          },
        },
        tableWidget: {
          type: 'table',
          tableList: [
            {
              label: 'A1',
              value: 'A2',
            },
          ],
          tabList: [],
          tabDataMap: {},
        },
      },
    },
  }
}

function buildExpectedSubmitItem(name) {
  return {
    itemId: '1',
    name,
    lang: 'zh_Hans',
    status: 0,
    createdUser: null,
    lastUpdatedUser: null,
    lastAuditPassedAt: '1234567890',
    mainType: {
      id: 'main-type',
      name: 'Main Type',
    },
    subType: {
      id: 'sub-type',
      name: 'Sub Type',
    },
    tagIds: ['tag-1'],
    brief: {
      name,
      description: {
        id: 'brief-doc',
        blockIds: [],
        blockMap: {},
        version: '1.0.0',
      },
    },
    document: {
      extraInfo: {
        illustration: '',
      },
      widgetCommonMap: {
        audioWidget: {
          type: 'audio',
          tabList: [],
          tabDataMap: {
            default: {
              audioList: [
                {
                  title: 'Theme',
                  profile: 'Theme intro',
                  resourceUrl: 'https://example.com/theme.mp3',
                },
              ],
            },
          },
        },
        imageTabs: {
          type: 'common',
          tabList: [
            {
              tabId: 'tab-1',
              icon: 'https://example.com/icon.png',
            },
            {
              tabId: 'tab-2',
              title: 'Keep title',
            },
          ],
          tabDataMap: {
            default: {
              content: 'doc-1',
              audioList: [],
            },
            'tab-2': {
              intro: {
                name: 'Keep intro',
              },
              audioList: [],
            },
          },
        },
        tableWidget: {
          type: 'table',
          tableList: [
            {
              label: 'A1',
              value: 'A2',
            },
          ],
        },
      },
    },
  }
}

const currentItem = buildFormalItem('Newest from host')
const draftItem = buildFormalItem('Draft from host')
const fetchUpdateInfoCalls = []
const submitItemUpdateCalls = []
const clearItemDraftCalls = []
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
    fetchUpdateInfo: async (args) => {
      fetchUpdateInfoCalls.push(args)
      return ok({
        code: 0,
        message: 'OK',
        timestamp: 'now',
        data: {
          newest: currentItem,
          draft: draftItem,
          templates: [],
          associateList: [],
        },
      })
    },
    submitItemUpdate: async (args) => {
      submitItemUpdateCalls.push(args)
      return ok({ revisionId: 2 })
    },
    clearItemDraft: async (args) => {
      clearItemDraftCalls.push(args)
      return ok(null)
    },
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

function findModalButton(windowEl, labels) {
  const expected = Array.isArray(labels) ? labels : [labels]
  const candidates = [...windowEl.querySelectorAll('.ipe-modal-btn')]
  return (
    candidates.find((node) => {
      const text = (node.textContent || '').trim().toLowerCase()
      return expected.some((label) => text.includes(String(label).toLowerCase()))
    }) || null
  )
}

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
  const editorBridge = window.document.querySelector('.endwiki-monacoEditor')
  assert.ok(editorBridge)
  assert.ok(
    ['loading', 'monaco', 'textarea'].includes(editorBridge?.getAttribute('data-editor-mode') || '')
  )
  assert.ok(window.document.querySelector('textarea#wpTextbox1'))
  assert.ok(window.document.querySelector('input[name="summary"]'))
  assert.ok(window.document.body.textContent?.includes('Follow MW preferences'))
  assert.ok(!window.document.body.textContent?.includes('watchlist.preferences'))
  assert.deepEqual(fetchUpdateInfoCalls, [{ itemId: '1', lang: 'zh_Hans' }])
  const textarea = window.document.querySelector('textarea#wpTextbox1')
  assert.ok(textarea)
  assert.ok(textarea.value.includes('"name": "Draft from host"'))
  assert.ok(textarea.value.includes('"status": 0'))
  assert.ok(textarea.value.includes('"createdUser": null'))
  assert.ok(!textarea.value.includes('"code":'))
  assert.ok(!textarea.value.includes('"templates":'))
  assert.ok(!textarea.value.includes('"associate": null'))
  assert.ok(!textarea.value.includes('"authorMap": {}'))
  assert.ok(!textarea.value.includes('"composite": ""'))
  assert.ok(!textarea.value.includes('"intro": null'))
  assert.ok(!textarea.value.includes('"tableList": []'))
  assert.equal(window.document.querySelector('input[name="minor"]')?.hasAttribute('disabled'), true)
  assert.equal(
    window.document.querySelector('input[name="watchlist"]')?.hasAttribute('disabled'),
    true
  )
  assert.ok(window.document.body.textContent?.includes('not sent by the host submit API yet'))

  const quickEditWindow =
    window.document.querySelector('.ipe-modal-modal__window.ipe-quickEdit') ||
    window.document.querySelector('.ipe-modal-modal__window')
  assert.ok(quickEditWindow)

  textarea.value = '{"itemId":"1","name":"Changed by smoke"}'
  textarea.dispatchEvent(new window.Event('input', { bubbles: true }))

  const previewBtn = findModalButton(quickEditWindow, ['preview', '预览'])
  assert.ok(previewBtn)
  const modalCountBeforePreview = window.document.querySelectorAll('.ipe-modal-modal').length
  previewBtn.click()
  await new Promise((resolve) => setTimeout(resolve, 120))
  assert.ok(window.document.querySelectorAll('.ipe-modal-modal').length > modalCountBeforePreview)
  assert.ok(window.document.body.textContent?.includes('Changed by smoke'))

  const diffBtn = findModalButton(quickEditWindow, ['diff', '差异'])
  assert.ok(diffBtn)
  const modalCountBeforeDiff = window.document.querySelectorAll('.ipe-modal-modal').length
  diffBtn.click()
  await new Promise((resolve) => setTimeout(resolve, 120))
  assert.ok(window.document.querySelectorAll('.ipe-modal-modal').length > modalCountBeforeDiff)
  assert.ok(window.document.querySelector('.endwiki-ipe-json-diff'))
  assert.ok(window.document.body.textContent?.includes('Changed by smoke'))

  textarea.value = JSON.stringify(
    {
      code: 0,
      message: 'OK',
      data: {
        item: buildFormalItem('Changed by smoke'),
      },
    },
    null,
    2
  )
  textarea.dispatchEvent(new window.Event('input', { bubbles: true }))

  const submitBtn = findModalButton(quickEditWindow, ['submit', '提交'])
  assert.ok(submitBtn)
  submitBtn.click()
  await new Promise((resolve) => setTimeout(resolve, 200))
  assert.deepEqual(
    submitItemUpdateCalls.map(({ itemJson, ...rest }) => ({
      ...rest,
      itemJson: JSON.parse(itemJson),
    })),
    [
      {
        itemJson: buildExpectedSubmitItem('Changed by smoke'),
        commitMsg: '[IPE-NEXT] Quick edit',
      },
    ]
  )
  assert.deepEqual(clearItemDraftCalls, [{ itemId: '1', lang: 'zh_Hans' }])
  assert.ok(window.document.body.textContent?.includes('Your changes have been saved.'))

  window.document.querySelector('#ipe-toolbox__preferences-btn')?.dispatchEvent(
    new window.MouseEvent('click', { bubbles: true }),
  )
  await new Promise((resolve) => setTimeout(resolve, 200))

  assert.ok(window.document.querySelectorAll('.ipe-modal-modal.is-centered').length >= 1)
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
