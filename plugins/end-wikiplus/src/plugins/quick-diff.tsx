import { Inject, InPageEdit, Schema } from '@/InPageEdit'
import { RegisterPreferences } from '@/decorators/Preferences'
import BasePlugin from '@/plugins/BasePlugin'
import { IPEModal, IPEModalOptions } from '@inpageedit/modal'
import type { EndWikiQuickEditEventPayload, EndWikiQuickEditWikiPage } from '@plugin/plugins/quick-edit'
import { capabilityByKey } from '@plugin/constants/capabilities'

declare module '@/InPageEdit' {
  interface InPageEdit {
    quickDiff: EndWikiQuickDiffPlugin
  }
  interface Events {
    'quick-diff/show-modal'(payload: {
      ctx: InPageEdit
      modal: IPEModal
      wikiPage: EndWikiQuickEditWikiPage
      originalText: string
      currentText: string
    }): void
  }
  interface PreferencesMap {
    'quickDiff.keyshortcut': string
  }
}

@Inject(['modal', 'preferences', '$'])
@RegisterPreferences(
  Schema.object({
    'quickDiff.keyshortcut': Schema.string()
      .default('ctrl-d')
      .role('keyshortcut')
      .description('Key shortcut to open quick diff in quick edit modal'),
  })
    .description('Quick diff options')
    .extra('category', 'editor'),
)
export class EndWikiQuickDiffPlugin extends BasePlugin {
  constructor(public ctx: any) {
    super(ctx, {}, 'endwiki-quick-diff')
    this.ctx.set('quickDiff', this)
  }

  protected start(): Promise<void> | void {
    this.ctx.on('quick-edit/wiki-page', this.injectQuickEdit.bind(this))
  }

  showModal(
    originalText: string,
    currentText: string,
    wikiPage: EndWikiQuickEditWikiPage,
    modal?: IPEModal,
    modalOptions?: Partial<IPEModalOptions>,
  ) {
    const { $ } = this.ctx
    const capability = capabilityByKey('quick-diff')

    if (!modal || modal.isDestroyed) {
      modal = this.ctx.modal
        .createObject({
          title: $`Loading diff...`,
          content: '',
          className: 'quick-diff',
          center: false,
          ...modalOptions,
        })
        .init()
    } else {
      modal.removeButton('*')
    }

    modal.show()
    modal.setTitle($(wikiPage.pageInfo.title)`Quick Diff - {{ $1 }}`)
    modal.setContent(
      (
        <section className="endwiki-ipe-stack endwiki-ipe-json-diff">
          <p className="endwiki-ipe-muted">
            {capability?.summary || 'Local JSON diff preview'}
          </p>
          <div className="endwiki-ipe-stack">
            <strong>{$`Original`}</strong>
            <pre>{originalText}</pre>
          </div>
          <div className="endwiki-ipe-stack">
            <strong>{$`Current Draft`}</strong>
            <pre>{currentText}</pre>
          </div>
        </section>
      ) as HTMLElement,
    )
    modal.bringToFront()
    this.ctx.emit('quick-diff/show-modal', {
      ctx: this.ctx,
      modal,
      wikiPage,
      originalText,
      currentText,
    })

    return modal
  }

  private async injectQuickEdit({
    modal,
    wikiPage,
    getEditorValue,
    syncEditorValue,
  }: EndWikiQuickEditEventPayload) {
    const { $ } = this.ctx
    let latestDiffModal: IPEModal | undefined
    modal.addButton(
      {
        label: $`Diff`,
        side: 'left',
        keyPress: (await this.ctx.preferences.get('quickDiff.keyshortcut')) || undefined,
        className: 'btn btn-secondary',
        method: () => {
          syncEditorValue?.()
          const originalText = wikiPage.revisions?.[0]?.content || ''
          const currentText =
            getEditorValue?.() ||
            (modal.get$content().querySelector<HTMLTextAreaElement>('textarea[name="text"]')
              ?.value as string) ||
            ''

          if (originalText === currentText) {
            return this.ctx.modal.notify('info', {
              title: $`Quick Diff`,
              content: $`No changes`,
            })
          }

          latestDiffModal = this.showModal(
            originalText,
            currentText,
            wikiPage,
            latestDiffModal,
            {
              backdrop: false,
              draggable: true,
            },
          )
          return latestDiffModal
        },
      },
      2,
    )
    modal.on(modal.Event.Close, () => {
      latestDiffModal?.destroy()
      latestDiffModal = undefined
    })
  }
}
