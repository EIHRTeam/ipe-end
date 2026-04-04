import { Inject, InPageEdit, Schema } from '@/InPageEdit'
import { RegisterPreferences } from '@/decorators/Preferences'
import BasePlugin from '@/plugins/BasePlugin'
import { WatchlistAction } from '@/models/WikiPage/types/WatchlistAction'
import { CheckBox, InputBox, MBox, ProgressBar, RadioBox } from '@/components'
import { makeCallable } from '@/utils/makeCallable.js'
import { noop } from '@/utils/noop'
import { sleep } from '@/utils/sleep'
import { IPEModal } from '@inpageedit/modal'
import type { ReactNode } from 'jsx-dom'
import { parseJsonObject, prettyJson } from '@plugin/utils/result'

declare module '@/InPageEdit' {
  interface InPageEdit {
    quickEdit: EndWikiQuickEditPlugin & {
      (...args: Parameters<EndWikiQuickEditPlugin['showModal']>): ReturnType<EndWikiQuickEditPlugin['showModal']>
    }
  }
  interface Events {
    'quick-edit/init-options'(payload: Omit<EndWikiQuickEditEventPayload, 'modal' | 'wikiPage'>): void
    'quick-edit/show-modal'(payload: Omit<EndWikiQuickEditEventPayload, 'wikiPage'>): void
    'quick-edit/wiki-page'(payload: EndWikiQuickEditEventPayload): void
    'quick-edit/edit-notice'(payload: EndWikiQuickEditEventPayload & { editNotices: ReactNode[] }): void
    'quick-edit/submit'(payload: EndWikiQuickEditSubmitPayload & { ctx: InPageEdit }): void
  }
  interface PreferencesMap {
    'quickEdit.editSummary': string
    'quickEdit.editMinor': boolean
    'quickEdit.outSideClose': boolean
    'quickEdit.watchList': WatchlistAction
    'quickEdit.keyshortcut.save': string
    'quickEdit.editFont': string
  }
}

const BUILT_IN_FONT_OPTIONS = ['preferences', 'monospace', 'sans-serif', 'serif'] as const

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
  })
    .description('Quick edit options')
    .extra('category', 'editor'),
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
        typeof payload.createOnly === 'boolean' ? payload.createOnly : this.DEFAULT_OPTIONS.createOnly,
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
      })
      .init()
    modal.setTitle(
      (
        <>
          Loading: <u>{options.title}</u>
        </>
      ) as HTMLElement,
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
      ) as HTMLElement,
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
    const isCreatingNewPage = wikiPage.pageid === 0

    modal.setTitle(
      (
        <>
          {$`Quick ${isCreatingNewPage ? 'Create' : 'Edit'}`} <u>{wikiPage.pageInfo.title}</u>
        </>
      ) as HTMLElement,
    )

    const editNotices = [] as ReactNode[]
    if (!options.itemId) {
      editNotices.push(
        <MBox title={$`Attention`} type="important">
          <p>
            {$`The current host page has not resolved an item id yet. Saving still works if the edited JSON contains a valid item identifier.`}
          </p>
        </MBox>,
      )
    } else if (isCreatingNewPage) {
      editNotices.push(
        <MBox title={$`Attention`} type="important">
          <p>{$`This page does not exist.`}</p>
        </MBox>,
      )
    }

    this.ctx.emit('quick-edit/edit-notice', {
      ctx: this.ctx,
      options,
      modal,
      wikiPage,
      editNotices,
    })

    const editForm = (
      <form className="ipe-quickEdit__form">
        <div className="ipe-quickEdit__notices">{editNotices}</div>
        <div
          className="ipe-quickEdit__content"
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <textarea
            className={`ipe-quickEdit__textarea ${fontOptions.className}`}
            style={{ fontFamily: fontOptions.fontFamily }}
            name="text"
            id="wpTextbox1"
            spellcheck={false}
          >
            {editingContent}
          </textarea>
        </div>
        <div
          className="ipe-quickEdit__options"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            marginTop: '1rem',
          }}
        >
          <InputBox label={$`Summary`} id="summary" name="summary" value={options.editSummary} />
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

    let dismissWarnings = false
    modal.addButton(
      {
        side: 'left',
        className: 'is-primary submit-btn',
        label: $`Submit`,
        keyPress: (await this.ctx.preferences.get('quickEdit.keyshortcut.save')) || undefined,
        method: async () => {
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
      0,
    )
    modal.setOptions({
      beforeClose: () => {
        const oldStr = wikiPage.revisions[0]?.content || ''
        const newStr = editForm.querySelector('textarea')?.value || ''
        if (newStr === oldStr) {
          return true
        }

        this.ctx.modal.confirm(
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
          },
        )
        return false
      },
    })

    this.ctx.emit('quick-edit/wiki-page', {
      ctx: this.ctx,
      options,
      modal,
      wikiPage,
    })

    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (editForm.querySelector('textarea')?.value === editingContent) {
        return true
      }
      event.preventDefault()
      return $`You have unsaved changes. Are you sure you want to leave?`
    }
    window.addEventListener('beforeunload', beforeUnload)
    modal.on(modal.Event.Close, () => {
      window.removeEventListener('beforeunload', beforeUnload)
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
    payload: Partial<EndWikiQuickEditOptions>,
  ): Promise<EndWikiQuickEditWikiPage> {
    const itemId = payload.itemId ?? this.ctx.bridge.getCurrentItemId()
    const lang = payload.lang || this.ctx.bridge.getCurrentLanguage()
    const currentItem = this.ctx.bridge.getCurrentItem()
    const title =
      payload.title ||
      this.ctx.bridge.getCurrentItemName() ||
      itemId ||
      this.ctx.$`Current item`

    let sourceObject = currentItem ?? { itemId: itemId || '' }

    if (itemId) {
      const editableItem = await this.ctx.bridge.fetchEditableItem(itemId, lang).catch(() => null)
      if (editableItem) {
        sourceObject = editableItem
      }
    }

    const initialContent = prettyJson(sourceObject)

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
        const parsed = parseJsonObject(rawText)
        const submittedItemId =
          (typeof parsed.itemId === 'string' && parsed.itemId) ||
          (typeof parsed.id === 'string' && parsed.id) ||
          itemId

        await this.ctx.bridge.submitItemUpdate(rawText, summary || '')
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
