import BasePlugin from '@/plugins/BasePlugin'
import type { QuickEditUiState } from '@plugin/types/editor'
import { capabilityByKey } from '@plugin/constants/capabilities'
import { createCapabilityBadge, createElement } from '@plugin/utils/dom'

export class EndWikiQuickDiffPlugin extends BasePlugin {
  constructor(public ctx: any) {
    super(ctx, {}, 'endwiki-quick-diff')
    ctx.set('quickDiff', this)
  }

  showModal(state: QuickEditUiState) {
    const capability = capabilityByKey('quick-diff')
    const modal = this.ctx.modal.show({
      className: 'endwiki-quick-diff',
      sizeClass: 'large',
      center: false,
      title: `Quick Diff${state.itemName ? ` · ${state.itemName}` : ''}`,
      content: createElement('div'),
    })

    const content = createElement('section', { className: 'endwiki-ipe-stack' }, [
      createCapabilityBadge('quick-diff'),
      createElement('p', {
        className: 'endwiki-ipe-muted',
        text: capability?.summary || 'Local JSON diff preview',
      }),
      createElement('section', { className: 'endwiki-ipe-json-diff' }, [
        createElement('div', { className: 'endwiki-ipe-stack' }, [
          createElement('strong', { text: 'Original' }),
          createElement('pre', { text: state.originalSource }),
        ]),
        createElement('div', { className: 'endwiki-ipe-stack' }, [
          createElement('strong', { text: 'Current Draft' }),
          createElement('pre', { text: state.getCurrentSource() }),
        ]),
      ]),
    ])

    modal.setContent(content)
    modal.setButtons([
      {
        label: 'Close',
        className: 'is-ghost',
        method: () => modal.close(),
      },
    ])

    return modal
  }
}
