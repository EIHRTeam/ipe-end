import { Inject, InPageEdit, Schema } from '@/InPageEdit'
import { RegisterPreferences } from '@/decorators/Preferences'
import BasePlugin from '@/plugins/BasePlugin'
import { ProgressBar } from '@/components'
import { IPEModal, IPEModalOptions } from '@inpageedit/modal'
import type { EndWikiQuickEditEventPayload, EndWikiQuickEditWikiPage } from '@plugin/plugins/quick-edit'
import { capabilityByKey } from '@plugin/constants/capabilities'

interface EndWikiQuickPreviewEventPayload {
  ctx: InPageEdit
  modal: IPEModal
  wikiPage: EndWikiQuickEditWikiPage
  text: string
}

declare module '@/InPageEdit' {
  interface InPageEdit {
    quickPreview: EndWikiQuickPreviewPlugin & {
      (
        ...args: Parameters<EndWikiQuickPreviewPlugin['showModal']>
      ): ReturnType<EndWikiQuickPreviewPlugin['showModal']>
    }
  }
  interface Events {
    'quick-preview/show-modal'(payload: EndWikiQuickPreviewEventPayload): void
  }
  interface PreferencesMap {
    'quickPreview.keyshortcut': string
  }
}

@Inject(['modal', 'preferences', '$'])
@RegisterPreferences(
  Schema.object({
    'quickPreview.keyshortcut': Schema.string()
      .default('ctrl-i')
      .role('keyshortcut')
      .description('Key shortcut to open quick preview in quick edit modal'),
  })
    .extra('category', 'editor')
    .description('Quick preview options'),
)
export class EndWikiQuickPreviewPlugin extends BasePlugin {
  constructor(public ctx: any) {
    super(ctx, {}, 'endwiki-quick-preview')
    this.ctx.set('quickPreview', this)
  }

  protected start(): Promise<void> | void {
    this.ctx.on('quick-edit/wiki-page', this.injectQuickEdit.bind(this))
  }

  showModal(
    text: string,
    wikiPage: EndWikiQuickEditWikiPage,
    modal?: IPEModal,
    modalOptions?: Partial<IPEModalOptions>,
  ) {
    const { $ } = this.ctx
    const capability = capabilityByKey('quick-preview')

    if (!modal || modal.isDestroyed) {
      modal = this.ctx.modal
        .createObject({
          className: 'in-page-edit ipe-quickPreview',
          sizeClass: 'large',
          center: false,
          ...modalOptions,
        })
        .init()
    }

    modal.show()
    modal.setTitle($`Preview - Loading...`)
    modal.setContent(<ProgressBar /> as HTMLElement)
    modal.bringToFront()
    this.ctx.emit('quick-preview/show-modal', {
      ctx: this.ctx,
      text,
      modal,
      wikiPage,
    })

    modal.setTitle($(wikiPage.pageInfo.title)`Preview - {{ $1 }}`)
    modal.setContent(
      (
        <section className="endwiki-ipe-stack">
          <p className="endwiki-ipe-muted">
            {capability?.summary || 'Preview is not available in the host yet.'}
          </p>
          <pre>{text}</pre>
        </section>
      ) as HTMLElement,
    )

    return modal
  }

  private async injectQuickEdit({
    modal,
    wikiPage,
    getEditorValue,
    syncEditorValue,
  }: EndWikiQuickEditEventPayload) {
    const { $ } = this.ctx
    let latestPreviewModal: IPEModal | undefined
    modal.addButton(
      {
        label: $`Preview`,
        side: 'left',
        className: 'btn btn-secondary',
        keyPress: (await this.ctx.preferences.get('quickPreview.keyshortcut')) || undefined,
        method: () => {
          syncEditorValue?.()
          const text =
            getEditorValue?.() ||
            (modal.get$content().querySelector<HTMLTextAreaElement>('textarea[name="text"]')
              ?.value as string) ||
            ''

          latestPreviewModal = this.showModal(
            text,
            wikiPage,
            latestPreviewModal,
            {
              backdrop: false,
              draggable: true,
            },
          )
        },
      },
      1,
    )
    modal.on(modal.Event.Close, () => {
      latestPreviewModal?.destroy()
      latestPreviewModal = undefined
    })
  }
}
