import { Inject } from '@/InPageEdit'
import BasePlugin from '@/plugins/BasePlugin'
import type { InPageEditPreferenceUICategory } from '@/services/PreferencesService'
import type { CustomIPEModal } from '@/services/ModalService'
import { CAPABILITY_MATRIX } from '@plugin/constants/capabilities'
import { createCapabilityBadge, createElement } from '@plugin/utils/dom'

type PreferencesControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

interface PreferencesFormState {
  controls: Record<string, PreferencesControl>
  cleanup: Array<() => void>
  values: Record<string, unknown>
}

const THEME_OPTIONS = [
  { value: 'auto', label: 'Follow system' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'site', label: 'Follow site theme' },
]

const EDITOR_LANGUAGE_OPTIONS = [
  { value: 'zh_Hans', label: 'Simplified Chinese' },
  { value: 'zh_Hant', label: 'Traditional Chinese' },
  { value: 'en_US', label: 'English' },
  { value: 'ja_JP', label: 'Japanese' },
]

function setControlValue(control: PreferencesControl, value: unknown) {
  if (control instanceof HTMLInputElement && control.type === 'checkbox') {
    control.checked = Boolean(value)
    return
  }
  control.value = value == null ? '' : String(value)
}

function getControlValue(control: PreferencesControl) {
  if (control instanceof HTMLInputElement && control.type === 'checkbox') {
    return control.checked
  }
  return control.value
}

function createField(
  label: string,
  description: string,
  control: PreferencesControl,
  hint?: Node | null,
) {
  const wrapper = createElement('label', { className: 'endwiki-preferences-field endwiki-ipe-stack' }, [
    createElement('span', { className: 'endwiki-preferences-field__label', text: label }),
    createElement('span', { className: 'endwiki-ipe-muted', text: description }),
    control,
  ])

  if (hint) {
    wrapper.appendChild(hint)
  }

  return wrapper
}

@Inject(['preferences', 'modal', 'toolbox'])
export class EndWikiPreferencesUIPlugin extends BasePlugin {
  _modal: CustomIPEModal | null = null
  _form: PreferencesFormState | null = null

  constructor(public ctx: any) {
    super(ctx, {}, 'endwiki-preferences-ui')
    ctx.set('preferencesUI', this)
  }

  protected start(): void {
    this.ctx.preferences.defineCategory({
      name: 'general',
      label: 'General',
      description: 'End Wiki+ shell preferences',
      autoGenerateForm: true,
    })

    this.ctx.preferences.defineCategory({
      name: 'editor',
      label: 'Editor',
      description: 'Quick Edit shell preferences',
      autoGenerateForm: true,
    })

    this.ctx.preferences.defineCategory({
      name: 'capabilities',
      label: 'Capabilities',
      description: 'Current End Wiki+ adapter support matrix',
      autoGenerateForm: false,
      customRenderer: () => {
        return createElement('section', { className: 'endwiki-ipe-stack' }, [
          ...CAPABILITY_MATRIX.map((entry) =>
            createElement('article', { className: 'endwiki-preferences-card endwiki-ipe-stack' }, [
              createCapabilityBadge(entry.key),
              createElement('p', { className: 'endwiki-ipe-muted', text: entry.summary }),
            ]),
          ),
        ])
      },
    })

    this.ctx.preferences.defineCategory({
      name: 'about',
      label: 'About',
      description: 'Adapter notes',
      index: 99,
      autoGenerateForm: false,
      customRenderer: () => {
        return createElement('section', { className: 'theme-ipe-prose endwiki-ipe-stack' }, [
          createElement('h2', { text: 'InPageEdit NEXT · End Wiki+' }),
          createElement('p', {
            text:
              'This build keeps the IPE interaction shell for End Wiki+ and replaces MediaWiki runtime behavior with host-first adapters.',
          }),
          createElement('p', {
            className: 'endwiki-ipe-muted',
            text:
              'The UI shell is now active and quick edit already uses the host submit flow. Remaining gaps are preview support and remote plugin distribution.',
          }),
        ])
      },
    })

    const toolbox = this.ctx.toolbox
    toolbox.addButton({
      id: 'endwiki-preferences',
      group: 'group2',
      index: 99,
      icon: '⚙️',
      tooltip: () => 'Preferences',
      onClick: () => {
        void this.showModal()
      },
    })

    this.addDisposeHandler(() => {
      toolbox.removeButton('endwiki-preferences')
    })

    this.ctx.on('preferences/changed', (payload: { input: Record<string, unknown> }) => {
      this.mergeFormValue(payload.input)
    })
  }

  async showModal() {
    if (this._modal && !this._modal.isDestroyed) {
      return this._modal
    }

    const modal = this.ctx.modal.show({
      className: 'ipe-preference compact-buttons',
      sizeClass: 'large',
      outSideClose: false,
      center: true,
      title: `End Wiki+ Preferences (${this.ctx.version})`,
      content: createElement('div'),
    })

    modal.get$window().classList.add('dialog', 'endwiki-preferences-modal')

    const root = createElement('div', { className: 'endwiki-preferences-layout endwiki-ipe-stack' }, [
      createElement('p', {
        className: 'endwiki-ipe-muted',
        text: 'Loading preferences…',
      }),
    ])
    root.style.minHeight = 'min(70dvh, 48rem)'
    modal.setContent(root)

    const form = await this.createPreferencesForm(root)
    this._form = form

    modal.setButtons([
      {
        label: 'Close',
        className: 'is-ghost',
        method: () => modal.close(),
      },
      {
        label: 'Save',
        className: 'is-primary is-ghost',
        method: async () => {
          await this.dispatchFormSave()
          modal.close()
          this.ctx.modal.notify('success', {
            title: 'Preferences Saved',
            content: 'UI shell preferences have been stored in host plugin storage.',
          })
        },
      },
    ])

    this._modal = modal
    modal.on(modal.Event.Close, () => {
      form.cleanup.forEach((cleanup) => {
        try {
          cleanup()
        } catch (error) {
          console.warn('[EndWikiPreferencesUIPlugin] cleanup failed', error)
        }
      })
      this._modal = null
      this._form = null
    })

    return modal
  }

  getCurrentModal() {
    return this._modal
  }

  closeCurrentModal() {
    return this._modal?.close()
  }

  async dispatchFormSave(form: PreferencesFormState | null = this._form) {
    if (!form) return false
    const value = this.collectFormValue(form)
    await this.ctx.preferences.setMany(value)
    form.values = {
      ...form.values,
      ...value,
    }
    return true
  }

  getCurrentFormValue() {
    return this._form ? this.collectFormValue(this._form) : null
  }

  mergeFormValue(value: Record<string, unknown>) {
    if (!this._form) return false
    Object.entries(value).forEach(([key, nextValue]) => {
      const control = this._form?.controls[key]
      if (control) {
        setControlValue(control, nextValue)
      }
    })
    this._form.values = {
      ...this._form.values,
      ...value,
    }
    return true
  }

  private async createPreferencesForm(root: HTMLElement): Promise<PreferencesFormState> {
    const values = (await this.ctx.preferences.getAll()) as Record<string, unknown>
    const categories = this.ctx.preferences.getConfigCategories() as InPageEditPreferenceUICategory[]
    const form: PreferencesFormState = {
      controls: {},
      cleanup: [],
      values,
    }

    const sidebar = createElement('aside', { className: 'endwiki-preferences-sidebar endwiki-ipe-stack' })
    const nav = createElement('nav', { className: 'endwiki-preferences-nav endwiki-ipe-stack' })
    const panels = createElement('section', { className: 'endwiki-preferences-panels' })

    sidebar.append(
      createElement('div', { className: 'endwiki-ipe-stack' }, [
        createElement('strong', { text: 'Sections' }),
        createElement('p', {
          className: 'endwiki-ipe-muted',
          text: 'The visible UI follows the IPE structure while host actions are wired incrementally.',
        }),
      ]),
      nav,
    )

    const buttons = new Map<string, HTMLButtonElement>()
    const panelMap = new Map<string, HTMLElement>()

    const activateCategory = (name: string) => {
      buttons.forEach((button, key) => {
        button.classList.toggle('is-active', key === name)
      })
      panelMap.forEach((panel, key) => {
        panel.hidden = key !== name
      })
    }

    categories.forEach((category, index) => {
      const button = createElement('button', {
        className: 'endwiki-preferences-nav__button',
        text: category.label,
        attrs: {
          type: 'button',
        },
      }) as HTMLButtonElement
      button.addEventListener('click', () => {
        activateCategory(category.name)
      })
      nav.appendChild(button)
      buttons.set(category.name, button)

      const panel = createElement('div', {
        className: 'endwiki-preferences-panel-slot',
      })
      panel.hidden = index !== 0
      panels.appendChild(panel)
      panelMap.set(category.name, panel)

      this.renderCategoryPanel(panel, category, form)
    })

    root.replaceChildren(
      createElement('div', { className: 'endwiki-preferences-shell' }, [sidebar, panels]),
    )

    if (categories[0]) {
      activateCategory(categories[0].name)
    }

    return form
  }

  private renderCategoryPanel(
    panel: HTMLElement,
    category: InPageEditPreferenceUICategory,
    form: PreferencesFormState,
  ) {
    panel.replaceChildren(
      createElement('p', {
        className: 'endwiki-ipe-muted',
        text: 'Loading section…',
      }),
    )

    void this.buildCategoryContent(category, form)
      .then((content) => {
        if (this._modal?.isDestroyed) return
        panel.replaceChildren(content)
      })
      .catch((error) => {
        console.error('[EndWikiPreferencesUIPlugin] failed to render category', category.name, error)
        panel.replaceChildren(
          createElement('div', { className: 'endwiki-ipe-stack' }, [
            createElement('strong', { text: `Failed to render ${category.label}` }),
            createElement('p', {
              className: 'endwiki-ipe-muted',
              text: error instanceof Error ? error.message : 'Unknown rendering error.',
            }),
          ]),
        )
      })
  }

  private async buildCategoryContent(
    category: InPageEditPreferenceUICategory,
    form: PreferencesFormState,
  ) {
    const section = createElement('section', { className: 'endwiki-preferences-panel endwiki-ipe-stack' }, [
      createElement('header', { className: 'endwiki-ipe-stack' }, [
        createElement('h2', { text: category.label }),
        category.description
          ? createElement('p', { className: 'endwiki-ipe-muted', text: category.description })
          : null,
      ]),
    ])

    const body = createElement('div', { className: 'endwiki-ipe-stack' })

    if (category.autoGenerateForm !== false) {
      const autoFields = this.createAutoGeneratedFields(category.name, form)
      if (autoFields) {
        body.appendChild(autoFields)
      }
    }

    if (category.customRenderer) {
      const mountCallbacks: Array<(container: HTMLElement) => void> = []
      const cleanupCallbacks: Array<() => void> = []
      const rendered = await Promise.resolve(
        category.customRenderer({
          ctx: this.ctx,
          onMounted: (callback) => mountCallbacks.push(callback),
          onUnmount: (callback) => cleanupCallbacks.push(callback),
        }),
      )

      if (rendered) {
        const slot = createElement('div', { className: 'endwiki-ipe-stack' }, [rendered as Node])
        body.appendChild(slot)
        mountCallbacks.forEach((callback) => callback(slot))
      }
      form.cleanup.push(...cleanupCallbacks)
    }

    if (!body.childNodes.length) {
      body.appendChild(
        createElement('p', {
          className: 'endwiki-ipe-muted',
          text: 'No configurable options in this section yet.',
        }),
      )
    }

    section.appendChild(body)
    return section
  }

  private createAutoGeneratedFields(categoryName: string, form: PreferencesFormState) {
    const fields = createElement('div', { className: 'endwiki-preferences-form endwiki-ipe-stack' })

    switch (categoryName) {
      case 'general':
        fields.append(
          this.createSelectField(
            form,
            'theme',
            'Theme',
            'Choose how the IPE shell follows light and dark appearance.',
            THEME_OPTIONS,
          ),
          this.createCheckboxField(
            form,
            'toolboxAlwaysShow',
            'Keep Toolbox Open',
            'Expand the floating toolbox by default instead of only on hover.',
          ),
        )
        break
      case 'editor':
        fields.append(
          this.createSelectField(
            form,
            'endWiki.editorLang',
            'Editor Language',
            'Language passed into the End Wiki+ quick edit shell.',
            EDITOR_LANGUAGE_OPTIONS,
          ),
          this.createTextField(
            form,
            'endWiki.commitMessage',
            'Default Commit Message',
            'Prefills the commit summary field in the quick edit modal.',
            'Commit message',
          ),
          createElement('div', { className: 'endwiki-preferences-note endwiki-ipe-stack' }, [
            createCapabilityBadge('quick-edit'),
            createElement('p', {
              className: 'endwiki-ipe-muted',
              text:
                'Quick Edit now reads editable item JSON from the host and submits back through the host update and draft APIs.',
            }),
          ]),
        )
        break
      default:
        return null
    }

    return fields
  }

  private createTextField(
    form: PreferencesFormState,
    name: string,
    label: string,
    description: string,
    placeholder: string,
  ) {
    const input = createElement('input', {
      className: 'endwiki-preferences-input',
      attrs: {
        type: 'text',
        placeholder,
      },
    }) as HTMLInputElement

    this.registerControl(form, name, input)
    return createField(label, description, input)
  }

  private createSelectField(
    form: PreferencesFormState,
    name: string,
    label: string,
    description: string,
    options: Array<{ value: string; label: string }>,
  ) {
    const select = createElement('select', {
      className: 'endwiki-preferences-input',
    }) as HTMLSelectElement

    options.forEach((option) => {
      select.appendChild(
        createElement('option', {
          text: option.label,
          attrs: { value: option.value },
        }),
      )
    })

    this.registerControl(form, name, select)
    return createField(label, description, select)
  }

  private createCheckboxField(
    form: PreferencesFormState,
    name: string,
    label: string,
    description: string,
  ) {
    const checkbox = createElement('input', {
      attrs: {
        type: 'checkbox',
      },
    }) as HTMLInputElement

    this.registerControl(form, name, checkbox)

    return createElement('label', { className: 'endwiki-preferences-field endwiki-ipe-stack' }, [
      createElement('span', { className: 'endwiki-preferences-field__label', text: label }),
      createElement('span', { className: 'endwiki-ipe-muted', text: description }),
      createElement('span', { className: 'endwiki-preferences-checkbox' }, [
        checkbox,
        createElement('span', { text: 'Enabled' }),
      ]),
    ])
  }

  private registerControl(form: PreferencesFormState, name: string, control: PreferencesControl) {
    form.controls[name] = control
    setControlValue(control, form.values[name])
  }

  private collectFormValue(form: PreferencesFormState) {
    return Object.fromEntries(
      Object.entries(form.controls).map(([key, control]) => [key, getControlValue(control)]),
    )
  }
}
