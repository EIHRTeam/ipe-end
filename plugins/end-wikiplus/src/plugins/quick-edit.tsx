import { Inject } from '@/InPageEdit'
import Schema from 'schemastery'
import BasePlugin from '@/plugins/BasePlugin'
import type { QuickEditUiState } from '@plugin/types/editor'
import { createCapabilityBadge, createElement } from '@plugin/utils/dom'
import { parseJsonObject, prettyJson } from '@plugin/utils/result'

@Inject(['bridge', 'modal', 'preferences', 'quickDiff', 'quickPreview', 'toolbox'])
export class EndWikiQuickEditPlugin extends BasePlugin {
  constructor(public ctx: any) {
    super(ctx, {}, 'endwiki-quick-edit')
    ctx.set('quickEdit', this)
  }

  protected start() {
    this.ctx.preferences.registerCustomConfig(
      'endwiki-editor-shell',
      Schema.object({
        'endWiki.editorLang': Schema.string().default('zh_Hans').description('Editor language'),
        'endWiki.commitMessage': Schema.string()
          .default('')
          .description('Default commit message for the End Wiki+ quick edit shell'),
      }).description('End Wiki+ quick edit shell'),
      'editor',
    )

    const toolbox = this.ctx.toolbox
    toolbox.addButton({
      id: 'endwiki-quick-edit',
      group: 'group1',
      index: 0,
      icon: '✏️',
      tooltip: () => 'Quick Edit',
      onClick: () => {
        void this.showModal()
      },
    })

    this.addDisposeHandler(() => {
      toolbox.removeButton('endwiki-quick-edit')
    })
  }

  private buildUiState(textarea: HTMLTextAreaElement, summaryInput: HTMLInputElement): QuickEditUiState {
    return {
      itemId: this.ctx.bridge.getCurrentItemId(),
      itemName: this.ctx.bridge.getCurrentItemName(),
      lang: this.ctx.bridge.getCurrentLanguage(),
      originalSource: textarea.defaultValue,
      getCurrentSource: () => textarea.value,
      getCommitMessage: () => summaryInput.value.trim(),
    }
  }

  private setEditorSource(textarea: HTMLTextAreaElement, source: string) {
    textarea.value = source
    textarea.defaultValue = source
  }

  private async loadEditableSource(
    itemId: string | null,
    lang: string,
    fallbackSource: string,
    modal: { setLoadingState(state: boolean): void },
  ) {
    if (!itemId) {
      return fallbackSource
    }

    modal.setLoadingState(true)
    try {
      const editableItem = await this.ctx.bridge.fetchEditableItem(itemId, lang)
      return editableItem ? prettyJson(editableItem) : fallbackSource
    } catch (error) {
      this.ctx.modal.notify('warning', {
        title: 'Using fallback item data',
        content:
          error instanceof Error
            ? error.message
            : 'Failed to load wiki.update-info, using current item snapshot instead.',
      })
      return fallbackSource
    } finally {
      modal.setLoadingState(false)
    }
  }

  private async submitEdit(
    state: QuickEditUiState,
    textarea: HTMLTextAreaElement,
    modal: { close(): void; setLoadingState(state: boolean): void },
  ) {
    const parsed = parseJsonObject(textarea.value)
    const itemId =
      (typeof parsed.itemId === 'string' && parsed.itemId) ||
      (typeof parsed.id === 'string' && parsed.id) ||
      state.itemId

    let shouldClose = false
    modal.setLoadingState(true)
    try {
      await this.ctx.bridge.submitItemUpdate(textarea.value, state.getCommitMessage())

      if (itemId) {
        await this.ctx.bridge.clearDraft(itemId, state.lang)
      }

      state.originalSource = textarea.value
      textarea.defaultValue = textarea.value

      this.ctx.modal.notify('success', {
        title: 'Wiki item submitted',
        content: itemId ? `Submitted item ${itemId} and cleared its draft.` : 'Submission completed.',
      })
      shouldClose = true
    } finally {
      modal.setLoadingState(false)
    }

    if (shouldClose) {
      modal.close()
    }
  }

  async showModal() {
    const currentItem = this.ctx.bridge.getCurrentItem()
    const itemName = this.ctx.bridge.getCurrentItemName()
    const itemId = this.ctx.bridge.getCurrentItemId()
    const lang = this.ctx.bridge.getCurrentLanguage()
    const initialSource = currentItem ? prettyJson(currentItem) : '{\n  "itemId": ""\n}'
    const defaultCommit = this.ctx.preferences.defaultOf('endWiki.commitMessage') || ''

    const modal = this.ctx.modal.show({
      className: 'endwiki-quick-edit',
      sizeClass: 'large',
      center: false,
      title: `Quick Edit${itemName ? ` · ${itemName}` : ''}`,
      content: createElement('div'),
    })

    const summaryInput = createElement('input', {
      attrs: {
        type: 'text',
        value: defaultCommit,
        placeholder: 'Commit message',
      },
    }) as HTMLInputElement
    summaryInput.className = 'endwiki-ipe-json'
    summaryInput.style.minHeight = '0'
    summaryInput.style.resize = 'none'

    const textarea = createElement('textarea', {
      className: 'endwiki-ipe-json',
      text: initialSource,
      attrs: {
        spellcheck: 'false',
      },
    }) as HTMLTextAreaElement
    textarea.defaultValue = initialSource

    const state = this.buildUiState(textarea, summaryInput)
    state.lang = lang

    const content = createElement('section', { className: 'endwiki-ipe-stack' }, [
      createCapabilityBadge('quick-edit'),
      createElement('p', {
        className: 'endwiki-ipe-muted',
        text:
          'This is the End Wiki+ quick edit shell. It now loads editable JSON through host wiki.update-info and submits through host wiki.item.submit.',
      }),
      createElement('p', {
        className: 'endwiki-ipe-muted',
        text: itemId ? `Current item: ${itemName || itemId} (${itemId})` : 'No wiki item context detected.',
      }),
      createElement('label', { text: 'Commit Message' }),
      summaryInput,
      createElement('label', { text: 'Item JSON' }),
      textarea,
    ])

    modal.setContent(content)
    modal.setButtons([
      {
        label: 'Close',
        className: 'is-ghost',
        method: () => modal.close(),
      },
      {
        label: 'Reload',
        side: 'left',
        className: 'btn btn-secondary',
        method: async () => {
          const nextSource = await this.loadEditableSource(itemId, state.lang, initialSource, modal)
          this.setEditorSource(textarea, nextSource)
          state.originalSource = nextSource
        },
      },
      {
        label: 'Preview',
        side: 'left',
        className: 'btn btn-secondary',
        method: () => {
          this.ctx.quickPreview.showModal(state)
        },
      },
      {
        label: 'Diff',
        side: 'left',
        className: 'btn btn-secondary',
        method: () => {
          this.ctx.quickDiff.showModal(state)
        },
      },
      {
        label: 'Submit',
        side: 'right',
        className: 'is-primary is-ghost',
        method: async () => {
          try {
            await this.submitEdit(state, textarea, modal)
          } catch (error) {
            this.ctx.modal.notify('error', {
              title: 'Submit failed',
              content: error instanceof Error ? error.message : 'Unknown submit error',
            })
          }
        },
      },
    ])

    const loadedSource = await this.loadEditableSource(itemId, state.lang, initialSource, modal)
    this.setEditorSource(textarea, loadedSource)
    state.originalSource = loadedSource

    return modal
  }
}
