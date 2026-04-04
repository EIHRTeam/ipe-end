import { Inject } from '@/InPageEdit'
import BasePlugin from '@/plugins/BasePlugin'
import { capabilityByKey } from '@plugin/constants/capabilities'
import { createCapabilityBadge, createElement } from '@plugin/utils/dom'

@Inject(['bridge', 'preferences', '$'])
export class EndWikiPluginStorePlugin extends BasePlugin {
  constructor(public ctx: any) {
    super(ctx, {}, 'endwiki-plugin-store')
  }

  protected start() {
    const $ = this.ctx.$
    this.ctx.preferences.defineCategory({
      name: 'plugin-store',
      label: $`Plugin Store`,
      description: $`Host-local plugin registry view`,
      autoGenerateForm: false,
      customRenderer: async () => {
        const capability = capabilityByKey('plugin-store')
        const loadedPlugins = await this.ctx.bridge.listLoadedPlugins().catch(() => [])

        return createElement('section', { className: 'endwiki-ipe-stack' }, [
          createCapabilityBadge('plugin-store'),
          createElement('p', {
            className: 'endwiki-ipe-muted',
            text: capability?.summary || 'Host-local registry view',
          }),
          createElement('div', { className: 'endwiki-ipe-stack' }, [
            ...loadedPlugins.map((plugin: { id: string; name: string; version: string; enabled: boolean }) =>
              createElement('article', { className: 'endwiki-ipe-stack' }, [
                createElement('strong', { text: `${plugin.name} (${plugin.version})` }),
                createElement('p', {
                  className: 'endwiki-ipe-muted',
                  text: `${plugin.id} · ${plugin.enabled ? $`enabled` : $`disabled`}`,
                }),
              ]),
            ),
          ]),
          createElement('p', {
            className: 'endwiki-ipe-muted',
            text: $`Remote registry, npm install and online download actions stay visible as a documented limitation in this phase and will remain disabled in the Endfield Wiki⁺ host.`,
          }),
        ])
      },
    })
  }
}
