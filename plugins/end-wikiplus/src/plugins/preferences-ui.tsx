import { Inject, InPageEdit } from '@/InPageEdit'
import PreferencesApp from '@/plugins/preferences-ui/components/PreferencesApp.vue'
import { createVueAppWithIPE } from '@/utils/vueHooks'
import type { CustomIPEModal } from '@/services/ModalService'
import { ProgressBar } from '@/components'
import type { App as VueApp } from 'vue'
import BasePlugin from '@/plugins/BasePlugin'
import { CAPABILITY_MATRIX } from '@plugin/constants/capabilities'
import { createCapabilityBadge, createElement } from '@plugin/utils/dom'

declare module '@/InPageEdit' {
  export interface InPageEdit {
    preferencesUI: EndWikiPreferencesUIPlugin
  }
  export interface Events {
    'preferences-ui/modal-shown'(payload: { ctx: InPageEdit; modal: CustomIPEModal }): void
    'preferences-ui/vue-app-mounted'(payload: {
      ctx: InPageEdit
      app: VueApp
      form: InstanceType<typeof PreferencesApp>
    }): void
    'preferences-ui/modal-closed'(payload: { ctx: InPageEdit; modal: CustomIPEModal }): void
  }
}

function renderPreferencesIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      class="icon icon-tabler icons-tabler-filled icon-tabler-settings"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M14.647 4.081a.724 .724 0 0 0 1.08 .448c2.439 -1.485 5.23 1.305 3.745 3.744a.724 .724 0 0 0 .447 1.08c2.775 .673 2.775 4.62 0 5.294a.724 .724 0 0 0 -.448 1.08c1.485 2.439 -1.305 5.23 -3.744 3.745a.724 .724 0 0 0 -1.08 .447c-.673 2.775 -4.62 2.775 -5.294 0a.724 .724 0 0 0 -1.08 -.448c-2.439 1.485 -5.23 -1.305 -3.745 -3.744a.724 .724 0 0 0 -.447 -1.08c-2.775 -.673 -2.775 -4.62 0 -5.294a.724 .724 0 0 0 .448 -1.08c-1.485 -2.439 1.305 -5.23 3.744 -3.745a.722 .722 0 0 0 1.08 -.447c.673 -2.775 4.62 -2.775 5.294 0zm-2.647 4.919a3 3 0 1 0 0 6a3 3 0 0 0 0 -6z" />
    </svg>
  ) as HTMLElement
}

@Inject(['preferences', 'modal', 'toolbox', '$', '$$'])
export class EndWikiPreferencesUIPlugin extends BasePlugin {
  _modal: CustomIPEModal | null = null
  _form: InstanceType<typeof PreferencesApp> | null = null

  constructor(public ctx: any) {
    super(ctx, {}, 'endwiki-preferences-ui')
    ctx.set('preferencesUI', this)
    const $ = ctx.$
    const $$ = ctx.$$

    ctx.preferences.defineCategory({
      name: 'general',
      label: $`prefs.general.label`,
      description: $`prefs.general.description`,
      autoGenerateForm: true,
    })

    ctx.preferences.defineCategory({
      name: 'editor',
      label: $`prefs.editor.label`,
      description: $`prefs.editor.description`,
      autoGenerateForm: true,
    })

    ctx.preferences.defineCategory({
      name: 'capabilities',
      label: $`Capabilities`,
      description: $`Current End Wiki+ adapter support matrix.`,
      index: 90,
      autoGenerateForm: false,
      customRenderer: () =>
        createElement('section', { className: 'endwiki-ipe-stack' }, [
          ...CAPABILITY_MATRIX.map((entry) =>
            createElement('article', { className: 'endwiki-preferences-card endwiki-ipe-stack' }, [
              createCapabilityBadge(entry.key),
              createElement('p', { className: 'endwiki-ipe-muted', text: entry.summary }),
            ]),
          ),
        ]),
    })

    ctx.preferences.defineCategory({
      name: 'about',
      label: $$`prefs.about.label`,
      description: $$`prefs.about.description`,
      index: 99,
      autoGenerateForm: false,
      customRenderer: () => {
        return (
          <section className="theme-ipe-prose">
            <h2>✏️ InPageEdit NEXT for End Wiki+</h2>
            <p>
              {$`This adapter keeps the original IPE settings shell and moves wiki operations onto the End Wiki+ host bridge.`}
            </p>
            <h3>{$`Current Status`}</h3>
            <ul>
              <li>{$`Floating toolbox, preferences UI and quick edit modal now follow original IPE code paths.`}</li>
              <li>{$`Quick edit submits through the host item update API and clears host drafts after save.`}</li>
              <li>{$`Preview and diff keep the original button layout, with host-adapted placeholder behavior.`}</li>
            </ul>
            <h3>{$`Runtime`}</h3>
            <ul>
              <li>
                <strong>{$`Plugin version`}</strong>: {this.ctx.version}
              </li>
              <li>
                <strong>{$`Current item`}</strong>:{' '}
                {this.ctx.bridge.getCurrentItemName() || this.ctx.bridge.getCurrentItemId() || $`none`}
              </li>
            </ul>
            <hr />
            <p style={{ textAlign: 'center' }}>{$$`prefs.about.copyright`}</p>
            <hr />
          </section>
        )
      },
    })

    ctx.inject(['toolbox'], (ctx: InPageEdit) => {
      ctx.toolbox.addButton({
        id: 'preferences',
        icon: renderPreferencesIcon(),
        tooltip: () => $`Configure Preferences`,
        group: 'group2',
        index: 99,
        onClick: () => this.showModal(),
      })

      this.addDisposeHandler((ctx) => {
        ctx.toolbox.removeButton('preferences')
      })
    })
  }

  protected async start(): Promise<void> {
    this.ctx.on('preferences/changed', (payload: { input: Record<string, unknown> }) => {
      this._form?.mergeValue?.(payload.input)
    })
  }

  showModal() {
    const { $ } = this.ctx
    if (this._modal && !this._modal.isDestroyed) {
      return this._modal
    }
    const modal = this.ctx.modal.show({
      className: 'ipe-preference compact-buttons',
      sizeClass: 'small',
      fixedHeight: true,
      outSideClose: false,
      center: true,
      title: `${$`InPageEdit Preferences`} (${this.ctx.version})`,
      content: (
        <>
          <ProgressBar />
        </>
      ) as HTMLElement,
    })

    modal.get$window().classList.add('dialog')

    const root = <div id="ipe-preferences-app" style={{ height: '100%' }}></div> as HTMLElement
    modal.setContent(root)

    this.ctx.emit('preferences-ui/modal-shown', {
      ctx: this.ctx,
      modal,
    })

    const app = this.createPreferencesUIApp()
    const form = app.mount(root) as InstanceType<typeof PreferencesApp>
    this._form = form

    this.ctx.emit('preferences-ui/vue-app-mounted', {
      ctx: this.ctx,
      app,
      form,
    })

    modal.setButtons([
      {
        label: $`Close`,
        className: 'is-ghost',
        method: () => {
          modal.close()
        },
      },
      {
        label: $`Save`,
        className: 'is-primary is-ghost',
        method: async () => {
          const value = form.getValue()
          await this.ctx.preferences.setMany(value)
          modal.close()
          this.ctx.modal.notify('success', {
            title: $`Preferences Saved`,
            content: <p>{$`Some settings may take effect after reopening the editor.`}</p>,
          })
        },
      },
    ])

    this._modal = modal

    modal.on(modal.Event.Close, () => {
      app.unmount()
      this._modal = null
      this._form = null

      this.ctx.emit('preferences-ui/modal-closed', {
        ctx: this.ctx,
        modal,
      })
    })

    return modal
  }

  getCurrentModal() {
    return this._modal
  }

  closeCurrentModal() {
    return this._modal?.close()
  }

  async dispatchFormSave(form?: InstanceType<typeof PreferencesApp>) {
    form = form || this._form || undefined
    const value = form?.getValue()
    if (!value) {
      return false
    }
    await this.ctx.preferences.setMany(value)
    return true
  }

  getCurrentFormValue() {
    return this._form?.getValue()
  }

  mergeFormValue(value: Record<string, unknown>) {
    this._form?.mergeValue?.(value)
    return !!this._form?.mergeValue
  }

  createPreferencesUIApp() {
    return createVueAppWithIPE(this.ctx, PreferencesApp)
  }
}
