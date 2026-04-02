import BasePlugin from '@/plugins/BasePlugin'
import type { QuickEditUiState } from '@plugin/types/editor'
import { capabilityByKey } from '@plugin/constants/capabilities'
import { createCapabilityBadge, createElement } from '@plugin/utils/dom'

export class EndWikiQuickPreviewPlugin extends BasePlugin {
  constructor(public ctx: any) {
    super(ctx, {}, 'endwiki-quick-preview')
    ctx.set('quickPreview', this)
  }

  showModal(state: QuickEditUiState) {
    const capability = capabilityByKey('quick-preview')
    const modal = this.ctx.modal.show({
      className: 'endwiki-quick-preview',
      sizeClass: 'small',
      center: true,
      title: `Quick Preview${state.itemName ? ` · ${state.itemName}` : ''}`,
      content: createElement('div'),
    })

    modal.setContent(
      createElement('section', { className: 'endwiki-ipe-stack' }, [
        createCapabilityBadge('quick-preview'),
        createElement('p', {
          text: capability?.summary || 'Preview is not available in the host yet.',
        }),
        createElement('p', {
          className: 'endwiki-ipe-muted',
          text:
            'The button is kept in place so the UI structure stays aligned with IPE, but the real preview flow will be wired after the host exposes a preview surface.',
        }),
      ]),
    )

    modal.setButtons([
      {
        label: 'Close',
        className: 'is-primary is-ghost',
        method: () => modal.close(),
      },
    ])

    return modal
  }
}
