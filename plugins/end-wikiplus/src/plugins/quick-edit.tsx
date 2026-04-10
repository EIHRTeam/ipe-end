import { Inject, InPageEdit, Schema } from '@/InPageEdit'
import { RegisterPreferences } from '@/decorators/Preferences'
import BasePlugin from '@/plugins/BasePlugin'
import { WatchlistAction } from '@/models/WikiPage/types/WatchlistAction'
import {
  CheckBox,
  InputBox,
  MBox,
  ProgressBar,
  RadioBox,
} from '@/components'
import { makeCallable } from '@/utils/makeCallable.js'
import { noop } from '@/utils/noop'
import { sleep } from '@/utils/sleep'
import { IPEModal } from '@inpageedit/modal'
import type { ReactNode } from 'jsx-dom'
import {
  MonacoTextareaBridge,
  type MonacoTextareaBridgeHandle,
  type MonacoThemeMode,
} from '@plugin/components/MonacoTextareaBridge'
import { prettyJson } from '@plugin/utils/result'
import {
  createSubmitPayload,
  getSubmitPayloadCommitMsg,
  getSubmitPayloadCommitMsgEdit,
  parseSubmitPayload,
  readSubmitPayload,
} from '@plugin/utils/itemSubmitPayload'

declare module '@/InPageEdit' {
  interface InPageEdit {
    quickEdit: EndWikiQuickEditPlugin & {
      (
        ...args: Parameters<EndWikiQuickEditPlugin['showModal']>
      ): ReturnType<EndWikiQuickEditPlugin['showModal']>
    }
  }
  interface Events {
    'quick-edit/init-options'(
      payload: Omit<EndWikiQuickEditEventPayload, 'modal' | 'wikiPage'>
    ): void
    'quick-edit/show-modal'(payload: Omit<EndWikiQuickEditEventPayload, 'wikiPage'>): void
    'quick-edit/wiki-page'(payload: EndWikiQuickEditEventPayload): void
    'quick-edit/edit-notice'(
      payload: EndWikiQuickEditEventPayload & { editNotices: ReactNode[] }
    ): void
    'quick-edit/submit'(payload: EndWikiQuickEditSubmitPayload & { ctx: InPageEdit }): void
  }
  interface PreferencesMap {
    'quickEdit.editSummary': string
    'quickEdit.editMinor': boolean
    'quickEdit.outSideClose': boolean
    'quickEdit.watchList': WatchlistAction
    'quickEdit.keyshortcut.save': string
    'quickEdit.editFont': string
    'quickEdit.monacoTheme': MonacoThemeMode
  }
}

const BUILT_IN_FONT_OPTIONS = ['preferences', 'monospace', 'sans-serif', 'serif'] as const
type EndWikiQuickEditPresentationMode = 'default' | 'window-fullscreen'
const HOST_FULLSCREEN_CLASS = 'endwiki-quickEditHostFullscreen'

type HostQuickEditRevision = {
  content: string
  revid?: number
}

export interface EndWikiQuickEditOptions {
  title: string
  itemId: string | null
  lang: string
  editMinor: boolean
  editSummary: string
  createOnly: boolean
  reloadAfterSave: boolean
}

export interface EndWikiQuickEditWikiPage {
  pageid: number
  lastrevid: number
  revisions: HostQuickEditRevision[]
  pageInfo: {
    title: string
    special: boolean
  }
  edit(payload: {
    text?: string
    summary?: string
    minor?: boolean
    createonly?: boolean
    recreate?: boolean
    watchlist?: WatchlistAction
  }): Promise<void>
}

export interface EndWikiQuickEditEventPayload {
  ctx: InPageEdit
  options: EndWikiQuickEditOptions
  modal: IPEModal
  wikiPage: EndWikiQuickEditWikiPage
  getEditorValue?: () => string
  setEditorValue?: (value: string) => void
  syncEditorValue?: () => void
}

export interface EndWikiQuickEditSubmitPayload {
  wikiPage: EndWikiQuickEditWikiPage
  text?: string
  summary?: string
  minor?: boolean
  createonly?: boolean
  recreate?: boolean
  watchlist?: WatchlistAction
}

@Inject(['bridge', 'modal', 'preferences', 'toolbox', '$'])
@RegisterPreferences(
  Schema.object({
    'quickEdit.editSummary': Schema.string()
      .description('Default edit summary for quick edits')
      .default('[IPE-NEXT] Quick edit'),
    'quickEdit.editMinor': Schema.boolean()
      .description('Default to checking "minor edit" option')
      .default(false),
    'quickEdit.outSideClose': Schema.boolean()
      .description('Close editor modal by clicking outside')
      .default(true),
    'quickEdit.watchList': Schema.union([
      Schema.const(WatchlistAction.preferences).description('Follow MW preferences'),
      Schema.const(WatchlistAction.nochange).description('Keep the current watchlist status'),
      Schema.const(WatchlistAction.watch).description('Add the page to watchlist'),
      Schema.const(WatchlistAction.unwatch).description('Remove the page from watchlist'),
    ])
      .description('Watchlist options')
      .default(WatchlistAction.preferences),
    'quickEdit.keyshortcut.save': Schema.string()
      .default('ctrl-s')
      .role('keyshortcut')
      .description('save button key shortcut (blank to disable)'),
    'quickEdit.editFont': Schema.union([
      Schema.const('preferences').description('Follow MW preferences'),
      Schema.const('monospace').description('Monospace'),
      Schema.const('sans-serif').description('Sans-serif'),
      Schema.const('serif').description('Serif'),
      Schema.string().description('Custom font (same as CSS `font-family` property)').default(''),
    ])
      .description("Font to use in quick edit's textarea")
      .default('preferences'),
    'quickEdit.monacoTheme': Schema.union([
      Schema.const('auto').description('Follow IPE/system theme'),
      Schema.const('light').description('Light mode'),
      Schema.const('dark').description('Dark mode'),
    ])
      .description('Monaco editor theme')
      .default('auto'),
  })
    .description('Quick edit options')
    .extra('category', 'editor')
)
export class EndWikiQuickEditPlugin extends BasePlugin {
  private readonly DEFAULT_OPTIONS: EndWikiQuickEditOptions = {
    title: '',
    itemId: null,
    lang: 'zh_Hans',
    editMinor: false,
    editSummary: '',
    createOnly: false,
    reloadAfterSave: false,
  }

  constructor(public ctx: any) {
    super(ctx, {}, 'endwiki-quick-edit')
    this.ctx.root.set('quickEdit', makeCallable(this, 'showModal'))
  }

  protected start(): Promise<void> | void {
    this.ctx.inject(['toolbox'], (ctx: InPageEdit) => {
      this.injectToolbox(ctx)
      ctx.on('dispose', () => {
        this.removeToolbox(ctx)
      })
    })
  }

  async showModal(payload?: string | Partial<EndWikiQuickEditOptions>) {
    const { $ } = this.ctx

    await this.ctx.bridge.refreshPageContext().catch(() => {})

    if (typeof payload === 'undefined') {
      payload = {}
    } else if (typeof payload === 'string') {
      payload = {
        title: payload,
      } as Partial<EndWikiQuickEditOptions>
    }

    const outSideClose = (await this.ctx.preferences.get('quickEdit.outSideClose'))!
    const watchList = (await this.ctx.preferences.get('quickEdit.watchList'))!
    const editSummary =
      typeof payload.editSummary === 'string'
        ? payload.editSummary
        : (await this.ctx.preferences.get('quickEdit.editSummary'))!
    const editMinor =
      typeof payload.editMinor === 'boolean'
        ? payload.editMinor
        : (await this.ctx.preferences.get('quickEdit.editMinor'))!
    const monacoTheme =
      ((await this.ctx.preferences.get('quickEdit.monacoTheme')) as MonacoThemeMode) || 'auto'
    const fontOptions = await this.getEditFontOptions()

    const options: EndWikiQuickEditOptions = {
      ...this.DEFAULT_OPTIONS,
      editSummary,
      editMinor,
      title:
        payload.title ||
        this.ctx.bridge.getCurrentItemName() ||
        this.ctx.bridge.getCurrentItemId() ||
        $`Current item`,
      itemId: payload.itemId ?? this.ctx.bridge.getCurrentItemId(),
      lang: payload.lang || this.ctx.bridge.getCurrentLanguage(),
      reloadAfterSave:
        typeof payload.reloadAfterSave === 'boolean'
          ? payload.reloadAfterSave
          : this.DEFAULT_OPTIONS.reloadAfterSave,
      createOnly:
        typeof payload.createOnly === 'boolean'
          ? payload.createOnly
          : this.DEFAULT_OPTIONS.createOnly,
    }

    if (!options.editSummary) {
      options.editSummary = (await this.ctx.preferences.get('quickEdit.editSummary')) || ''
    }

    const modal = this.ctx.modal
      .createObject({
        className: 'ipe-quickEdit',
        sizeClass: 'large',
        center: true,
        outSideClose,
        fixedHeight: true,
      })
      .init()
    modal.setTitle(
      (
        <>
          Loading: <u>{options.title}</u>
        </>
      ) as HTMLElement
    )
    modal.setContent(
      (
        <section
          className="ipe-quickEdit-loading"
          style={{
            height: '70vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <ProgressBar />
        </section>
      ) as HTMLElement
    )
    modal.addButton({
      side: 'right',
      type: 'button',
      className: 'is-danger is-ghost',
      label: $`Cancel`,
      method() {
        modal.close()
      },
    })
    modal.show()

    let wikiPage: EndWikiQuickEditWikiPage
    try {
      wikiPage = await this.getWikiPageFromPayload(options)
      if (wikiPage.pageInfo.special) {
        throw new Error($`Special page is not editable.`)
      }
    } catch (error) {
      modal.off(modal.Event.Close)
      modal.close()
      this.ctx.modal.notify('error', {
        content: error instanceof Error ? error.message : String(error),
      })
      return
    }

    this.ctx.emit('quick-edit/init-options', { ctx: this.ctx, options })
    this.ctx.emit('quick-edit/show-modal', { ctx: this.ctx, modal, options })

    const editingContent = wikiPage.revisions[0]?.content || ''
    const initialCommitMsg = getSubmitPayloadCommitMsg(editingContent, options.editSummary)
    const isCreatingNewPage = wikiPage.pageid === 0

    modal.setTitle(
      (
        <>
          {$`Quick ${isCreatingNewPage ? 'Create' : 'Edit'}`} <u>{wikiPage.pageInfo.title}</u>
        </>
      ) as HTMLElement
    )

    const editNotices = [] as ReactNode[]
    if (!options.itemId) {
      editNotices.push(
        <MBox title={$`Attention`} type="important">
          <p>
            {$`The current host page has not resolved an item id yet. Saving still works if the edited JSON contains a valid item identifier.`}
          </p>
        </MBox>
      )
    } else if (isCreatingNewPage) {
      editNotices.push(
        <MBox title={$`Attention`} type="important">
          <p>{$`This page does not exist.`}</p>
        </MBox>
      )
    }

    this.ctx.emit('quick-edit/edit-notice', {
      ctx: this.ctx,
      options,
      modal,
      wikiPage,
      editNotices,
    })

    let editorBridge: MonacoTextareaBridgeHandle | null = null
    let editFormRef: HTMLFormElement | null = null
    let editorContentRef: HTMLDivElement | null = null
    let summaryInputRef: HTMLInputElement | null = null
    let editorLayoutFrameId = 0
    let editorLayoutTimerIds: number[] = []
    let editorLayoutObserver: ResizeObserver | null = null
    let presentationMode: EndWikiQuickEditPresentationMode = 'default'
    let floatingExitButton: HTMLButtonElement | null = null
    let windowFullscreenButton: HTMLButtonElement | null = null
    let isSyncingCommitMsgFromEditor = false
    let isSyncingCommitMsgFromField = false

    let fallbackNotified = false
    const syncEditorValue = () => {
      editorBridge?.syncTextarea()
    }
    const getFallbackTextarea = () =>
      editForm.querySelector<HTMLTextAreaElement>('textarea[name="text"]')
    const getEditorValue = () => {
      syncEditorValue()
      if (editorBridge) {
        return editorBridge.getValue()
      }
      return getFallbackTextarea()?.value || ''
    }
    const setEditorValue = (value: string) => {
      if (editorBridge) {
        editorBridge.setValue(value)
      }
      const textarea = getFallbackTextarea()
      if (textarea) {
        textarea.value = value
      }
    }
    const replaceEditorValue = (startOffset: number, endOffset: number, value: string) => {
      if (editorBridge) {
        editorBridge.replaceText(startOffset, endOffset, value)
        return
      }

      const textarea = getFallbackTextarea()
      if (textarea) {
        textarea.value = textarea.value.slice(0, startOffset) + value + textarea.value.slice(endOffset)
      }
    }
    const getSummaryValue = () => summaryInputRef?.value || ''
    const setSummaryValue = (value: string) => {
      if (summaryInputRef && summaryInputRef.value !== value) {
        summaryInputRef.value = value
      }
    }

    const syncCommitMsgFieldFromEditor = (editorValue = getEditorValue()) => {
      if (isSyncingCommitMsgFromField) {
        return
      }

      try {
        const payload = readSubmitPayload(editorValue, getSummaryValue())
        isSyncingCommitMsgFromEditor = true
        setSummaryValue(payload.commitMsg)
      } catch {
        // Keep the side input editable while the JSON is temporarily invalid.
      } finally {
        isSyncingCommitMsgFromEditor = false
      }
    }

    const syncCommitMsgInEditor = (commitMsg: string) => {
      if (isSyncingCommitMsgFromEditor) {
        return
      }

      try {
        const rawEditorValue = getEditorValue()
        isSyncingCommitMsgFromField = true
        const payload = readSubmitPayload(rawEditorValue, commitMsg)
        if (!payload.hasSubmitEnvelope) {
          setEditorValue(
            prettyJson({
              item: payload.item,
              commitMsg,
            })
          )
          return
        }

        const textEdit = getSubmitPayloadCommitMsgEdit(rawEditorValue, commitMsg)
        if (!textEdit) {
          return
        }

        replaceEditorValue(textEdit.startOffset, textEdit.endOffset, textEdit.newText)
      } catch {
        // Leave the editor untouched until the JSON becomes valid again.
      } finally {
        isSyncingCommitMsgFromField = false
      }
    }

    const getNumericCssValue = (value: string | null | undefined) => {
      if (!value) {
        return 0
      }
      const parsed = Number.parseFloat(value)
      return Number.isFinite(parsed) ? parsed : 0
    }

    const getModalContentInnerHeight = () => {
      const modalContent = modal.get$content()
      const computedStyle = modalContent.ownerDocument.defaultView?.getComputedStyle(modalContent)
      const paddingBlock =
        getNumericCssValue(computedStyle?.paddingTop) + getNumericCssValue(computedStyle?.paddingBottom)
      return Math.max(0, modalContent.clientHeight - paddingBlock)
    }

    const syncEditorLayout = () => {
      if (!editFormRef || !editorContentRef) {
        return
      }

      const computedStyle = editFormRef.ownerDocument.defaultView?.getComputedStyle(editFormRef)
      const rowGap = getNumericCssValue(computedStyle?.rowGap || computedStyle?.gap)
      const visibleChildren = Array.from(editFormRef.children).filter(
        (node) => (node as HTMLElement).offsetParent !== null
      )
      const totalGap = Math.max(0, visibleChildren.length - 1) * rowGap
      const occupiedHeight = visibleChildren.reduce((height, node) => {
        if (node === editorContentRef) {
          return height
        }
        return height + (node as HTMLElement).offsetHeight
      }, 0)

      const contentHeight = getModalContentInnerHeight() || editFormRef.clientHeight
      const availableHeight = contentHeight - occupiedHeight - totalGap
      const nextHeight = Math.max(0, Math.floor(availableHeight))

      editFormRef.style.height = `${Math.max(0, Math.floor(contentHeight))}px`
      editFormRef.style.minHeight = '0'
      editorContentRef.style.height = `${nextHeight}px`
      editorContentRef.style.minHeight = '0'
    }

    const scheduleEditorLayoutSync = () => {
      if (!editFormRef) {
        return
      }

      const view = editFormRef.ownerDocument.defaultView || window
      if (editorLayoutFrameId) {
        view.cancelAnimationFrame(editorLayoutFrameId)
      }

      editorLayoutFrameId = view.requestAnimationFrame(() => {
        editorLayoutFrameId = 0
        syncEditorLayout()
      })
    }

    const queueEditorLayoutSync = (delay = 0) => {
      if (!editFormRef) {
        return
      }

      const view = editFormRef.ownerDocument.defaultView || window
      if (delay <= 0) {
        scheduleEditorLayoutSync()
        return
      }

      const timerId = view.setTimeout(() => {
        editorLayoutTimerIds = editorLayoutTimerIds.filter((id) => id !== timerId)
        scheduleEditorLayoutSync()
      }, delay)
      editorLayoutTimerIds.push(timerId)
    }

    const queueEditorLayoutSyncPasses = () => {
      queueEditorLayoutSync(0)
      queueEditorLayoutSync(48)
      queueEditorLayoutSync(140)
      queueEditorLayoutSync(360)
    }

    const updatePresentationState = (nextMode: EndWikiQuickEditPresentationMode) => {
      presentationMode = nextMode

      const modalRoot = modal.get$modal()
      const modalDocument = getModalDocument()
      const hostBody = modalDocument.body
      modalRoot.classList.toggle(
        'endwiki-quickEditModal--windowFullscreen',
        nextMode === 'window-fullscreen'
      )

      if (editorContentRef) {
        editorContentRef.classList.toggle(
          'endwiki-quickEdit__content--windowFullscreen',
          nextMode === 'window-fullscreen'
        )
      }

      floatingExitButton?.classList.toggle('is-active', nextMode !== 'default')
      windowFullscreenButton?.classList.toggle('is-active', nextMode === 'window-fullscreen')

      if (hostBody) {
        hostBody.classList.toggle(HOST_FULLSCREEN_CLASS, nextMode !== 'default')
      }

      queueEditorLayoutSyncPasses()
    }

    const getModalDocument = () => modal.get$window().ownerDocument
    const exitPresentationMode = async () => {
      if (presentationMode !== 'default') {
        updatePresentationState('default')
      }
    }

    const enterWindowFullscreen = async () => {
      updatePresentationState(
        presentationMode === 'window-fullscreen' ? 'default' : 'window-fullscreen'
      )
    }

    const createHeaderIconButton = (label: string, svgPath: string, onClick: () => void) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'ipe-modal-modal__icon endwiki-quickEdit__headerIcon'
      button.title = label
      button.setAttribute('aria-label', label)
      button.innerHTML = `
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path d="${svgPath}" />
        </svg>
      `
      button.addEventListener('click', onClick)
      return button
    }

    const setupEditorPresentationControls = () => {
      if (!editorContentRef) {
        return
      }

      const icons = modal.get$icons()
      const closeButton = icons.querySelector<HTMLButtonElement>('.ipe-modal-modal__close')

      windowFullscreenButton = createHeaderIconButton(
        $`Window fullscreen`,
        'M4.75 5.5h10.5a1.25 1.25 0 0 1 1.25 1.25v6.5a1.25 1.25 0 0 1-1.25 1.25H4.75A1.25 1.25 0 0 1 3.5 13.25v-6.5A1.25 1.25 0 0 1 4.75 5.5ZM3.5 8.5h13',
        () => {
          void enterWindowFullscreen()
        }
      )

      if (closeButton) {
        icons.insertBefore(windowFullscreenButton, closeButton)
      } else {
        icons.append(windowFullscreenButton)
      }

      floatingExitButton = createHeaderIconButton(
        $`Exit fullscreen`,
        'M8 4v4H4M12 4v4h4M16 12h-4v4M8 16v-4H4',
        () => {
          void exitPresentationMode()
        }
      )
      floatingExitButton.classList.add('endwiki-quickEdit__floatingExit')
      editorContentRef.appendChild(floatingExitButton)
      updatePresentationState('default')
    }

    const setupEditorLayoutSync = () => {
      if (!editFormRef) {
        return
      }

      const view = editFormRef.ownerDocument.defaultView || window
      const modalContent = modal.get$content()
      const syncTargets = Array.from(
        new Set([editFormRef, modalContent, ...Array.from(editFormRef.children)].filter(Boolean))
      ) as Element[]

      if (typeof ResizeObserver !== 'undefined') {
        editorLayoutObserver = new ResizeObserver(() => {
          scheduleEditorLayoutSync()
        })
        for (const target of syncTargets) {
          editorLayoutObserver.observe(target)
        }
      }

      const onWindowResize = () => {
        scheduleEditorLayoutSync()
      }

      view.addEventListener('resize', onWindowResize)
      queueEditorLayoutSyncPasses()

      modal.on(modal.Event.Close, () => {
        if (editorLayoutFrameId) {
          view.cancelAnimationFrame(editorLayoutFrameId)
          editorLayoutFrameId = 0
        }

        for (const timerId of editorLayoutTimerIds) {
          view.clearTimeout(timerId)
        }
        editorLayoutTimerIds = []

        editorLayoutObserver?.disconnect()
        editorLayoutObserver = null
        view.removeEventListener('resize', onWindowResize)
      })
    }

    const editForm = (
      <form
        ref={(el) => {
          editFormRef = el as HTMLFormElement
        }}
        className="ipe-quickEdit__form"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'stretch',
          gap: '1rem',
          height: '100%',
          minHeight: '0',
        }}
      >
        <div className="ipe-quickEdit__notices">{editNotices}</div>
        <div
          ref={(el) => {
            editorContentRef = el as HTMLDivElement
          }}
          className="ipe-quickEdit__content"
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: '1 1 0',
            height: '100%',
            minHeight: '0',
          }}
        >
          <MonacoTextareaBridge
            textareaClassName={`ipe-quickEdit__textarea ${fontOptions.className}`}
            textareaStyle={{ fontFamily: fontOptions.fontFamily }}
            name="text"
            id="wpTextbox1"
            spellcheck={false}
            language="json"
            themeMode={monacoTheme}
            value={editingContent}
            onChange={(value) => {
              syncCommitMsgFieldFromEditor(value)
            }}
            onReady={(bridge) => {
              editorBridge = bridge
            }}
            onError={(error) => {
              this.logger.warn('Monaco editor initialization failed, fallback to textarea.', error)
              if (!fallbackNotified) {
                fallbackNotified = true
                this.ctx.modal.notify('warning', {
                  title: $`Editor Fallback`,
                  content: $`Advanced editor is unavailable in this environment. Switched to compatible textarea mode.`,
                })
              }
            }}
          />
        </div>
        <div
          className="ipe-quickEdit__options"
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: '0 0 auto',
            gap: '1rem',
            marginTop: '0',
          }}
        >
          <InputBox
            label={$`Summary`}
            id="summary"
            name="summary"
            value={initialCommitMsg}
            inputProps={{
              ref: (el) => {
                summaryInputRef = el as HTMLInputElement
              },
              onInput: (event: Event) => {
                syncCommitMsgInEditor((event.target as HTMLInputElement)?.value || '')
              },
            }}
          />
          <div className="ipe-input-box">
            <label htmlFor="watchlist" style={{ display: 'block' }}>
              {$`Watchlist`}
            </label>
            <div style={{ display: 'flex', gap: '1rem', whiteSpace: 'nowrap', overflowX: 'auto' }}>
              {[
                WatchlistAction.preferences,
                WatchlistAction.nochange,
                WatchlistAction.watch,
                WatchlistAction.unwatch,
              ].map((action) => (
                <RadioBox
                  key={action}
                  name="watchlist"
                  value={action}
                  inputProps={{
                    checked: watchList === action,
                  }}
                >
                  {$`watchlist.${action}`}
                </RadioBox>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <CheckBox name="minor" id="minor" checked={options.editMinor}>
              {$`Minor edit`}
            </CheckBox>
            <CheckBox name="reloadAfterSave" id="reloadAfterSave" checked={options.reloadAfterSave}>
              {$`Reload after save`}
            </CheckBox>
          </div>
        </div>
      </form>
    ) as HTMLFormElement
    modal.setContent(editForm)
    setupEditorLayoutSync()
    setupEditorPresentationControls()

    const onDocumentKeyDownCapture = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || presentationMode === 'default') {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      void exitPresentationMode()
    }

    const modalDocument = getModalDocument()
    modalDocument.addEventListener('keydown', onDocumentKeyDownCapture, true)

    let dismissWarnings = false
    modal.addButton(
      {
        side: 'left',
        className: 'is-primary submit-btn',
        label: $`Submit`,
        keyPress: (await this.ctx.preferences.get('quickEdit.keyshortcut.save')) || undefined,
        method: async () => {
          syncEditorValue()
          const formData = new FormData(editForm)
          modal.setLoadingState(true)

          try {
            await this.handleSubmit({
              wikiPage,
              text: formData.get('text') as string,
              summary: formData.get('summary') as string,
              minor: formData.get('minor') === 'on',
              watchlist: watchList,
              createonly: wikiPage.pageid === 0 && !dismissWarnings,
              recreate: wikiPage.pageid === 0 && dismissWarnings,
            })

            modal.setOptions({
              beforeClose: noop,
            })
            modal.close()

            this.ctx.modal.notify('success', {
              title: $`Submission Successful`,
              content: $`Your changes have been saved.`,
            })

            if (formData.get('reloadAfterSave')) {
              await sleep(500)
              location.reload()
            }
          } catch (error) {
            modal.setLoadingState(false)
            this.ctx.modal.notify('error', {
              title: $`Submission Error`,
              content: error instanceof Error ? error.message : String(error),
            })
          }
        },
      },
      0
    )
    modal.setOptions({
      beforeClose: () => {
        syncEditorValue()
        const oldStr = wikiPage.revisions[0]?.content || ''
        const newStr = getEditorValue()
        if (newStr === oldStr) {
          return true
        }

        const showConfirm = this.ctx.modal?.confirm
        if (typeof showConfirm !== 'function') {
          return true
        }

        showConfirm(
          {
            className: 'is-primary',
            title: $`Unsaved Changes`,
            content: $`All edit contents will be lost after closing the modal. Are you sure you want to close?`,
            center: true,
            okBtn: {
              label: $`Give Up`,
              className: 'is-danger is-ghost',
            },
            cancelBtn: {
              label: $`Continue Editing`,
              className: 'is-primary is-ghost',
            },
          },
          (confirmed: boolean) => {
            if (confirmed) {
              modal.setOptions({
                beforeClose: noop,
              })
              modal.close()
            }
            return true
          }
        )
        return false
      },
    })

    this.ctx.emit('quick-edit/wiki-page', {
      ctx: this.ctx,
      options,
      modal,
      wikiPage,
      getEditorValue,
      setEditorValue,
      syncEditorValue,
    })

    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (getEditorValue() === editingContent) {
        return true
      }
      event.preventDefault()
      return $`You have unsaved changes. Are you sure you want to leave?`
    }
    window.addEventListener('beforeunload', beforeUnload)
    modal.on(modal.Event.Close, () => {
      void exitPresentationMode()
      modalDocument.removeEventListener('keydown', onDocumentKeyDownCapture, true)
      window.removeEventListener('beforeunload', beforeUnload)
      editorBridge?.dispose()
      editorBridge = null
    })

    return modal
  }

  async handleSubmit(payload: EndWikiQuickEditSubmitPayload) {
    const { wikiPage, ...rest } = payload

    this.ctx.emit('quick-edit/submit', {
      ctx: this.ctx,
      wikiPage,
      ...rest,
    })

    return wikiPage.edit({
      ...rest,
    })
  }

  private async getEditFontOptions() {
    const prefEditFont = (await this.ctx.preferences.get('quickEdit.editFont'))!
    if (BUILT_IN_FONT_OPTIONS.includes(prefEditFont)) {
      const editFont = prefEditFont === 'preferences' ? 'monospace' : prefEditFont
      return {
        className: `ipe-quickEdit__textarea--${editFont}`,
        fontFamily: '',
      }
    }

    return {
      className: 'ipe-quickEdit__textarea--custom',
      fontFamily: prefEditFont,
    }
  }

  private async getWikiPageFromPayload(
    payload: Partial<EndWikiQuickEditOptions>
  ): Promise<EndWikiQuickEditWikiPage> {
    const itemId = payload.itemId ?? this.ctx.bridge.getCurrentItemId()
    const lang = payload.lang || this.ctx.bridge.getCurrentLanguage()
    const currentItem = this.ctx.bridge.getCurrentItem()
    const title =
      payload.title || this.ctx.bridge.getCurrentItemName() || itemId || this.ctx.$`Current item`

    let sourceObject = currentItem ?? { itemId: itemId || '' }

    if (itemId) {
      const editableItem = await this.ctx.bridge.fetchEditableItem(itemId, lang).catch(() => null)
      if (editableItem) {
        sourceObject = editableItem
      }
    }

    const initialContent = prettyJson(createSubmitPayload(sourceObject, payload.editSummary || ''))

    return {
      pageid: itemId || currentItem ? 1 : 0,
      lastrevid: 0,
      revisions: [{ content: initialContent }],
      pageInfo: {
        title,
        special: false,
      },
      edit: async ({ text, summary }) => {
        const rawText = text ?? ''
        const parsed = parseSubmitPayload(rawText, summary || '')
        const submittedItemIdRaw = parsed.item.itemId ?? parsed.item.id ?? itemId
        const submittedItemId =
          typeof submittedItemIdRaw === 'string' && submittedItemIdRaw
            ? submittedItemIdRaw
            : submittedItemIdRaw == null
              ? itemId
              : String(submittedItemIdRaw)

        await this.ctx.bridge.submitItemUpdate(prettyJson(parsed.item), parsed.commitMsg)
        if (submittedItemId) {
          await this.ctx.bridge.clearDraft(submittedItemId, lang)
        }
      },
    }
  }

  private injectToolbox(ctx: InPageEdit) {
    const { $ } = this.ctx
    ctx.toolbox.addButton({
      id: 'quick-edit',
      group: 'group1',
      index: 0,
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-edit"
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" />
          <path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z" />
          <path d="M16 5l3 3" />
        </svg>
      ) as HTMLElement,
      tooltip: () => $`Quick Edit`,
      onClick: () => {
        void this.showModal({
          title:
            this.ctx.bridge.getCurrentItemName() ||
            this.ctx.bridge.getCurrentItemId() ||
            $`Current item`,
          itemId: this.ctx.bridge.getCurrentItemId(),
          lang: this.ctx.bridge.getCurrentLanguage(),
        })
      },
    })
  }

  protected removeToolbox(ctx: InPageEdit) {
    ctx.toolbox.removeButton('quick-edit')
  }
}
