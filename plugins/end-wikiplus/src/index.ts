import '@/styles/index.scss'

import { PluginToolbox } from '@/plugins/toolbox'
import type { HostPluginContext, HostPluginModule } from '@plugin/types/host'
import { EndWikiHostBridge } from '@plugin/bridge/EndWikiHostBridge'
import { EndWikiPlusApp } from '@plugin/app/EndWikiPlusApp'
import { EndWikiPreferencesUIPlugin } from '@plugin/plugins/preferences-ui'
import { EndWikiQuickDiffPlugin } from '@plugin/plugins/quick-diff'
import { EndWikiQuickEditPlugin } from '@plugin/plugins/quick-edit'
import { EndWikiQuickPreviewPlugin } from '@plugin/plugins/quick-preview'
import { EndWikiPluginStorePlugin } from '@plugin/plugins/plugin-store'

const bootApp = async (host: HostPluginContext) => {
  const bridge = new EndWikiHostBridge(host)
  const bootstrap = await bridge.bootstrap()
  const app = new EndWikiPlusApp(bridge, bootstrap)

  document.body.setAttribute('data-end-wikiplus-ipe', 'active')
  app.plugin(PluginToolbox as never)
  app.plugin(EndWikiPreferencesUIPlugin as never)
  app.plugin(EndWikiQuickDiffPlugin as never)
  app.plugin(EndWikiQuickPreviewPlugin as never)
  app.plugin(EndWikiPluginStorePlugin as never)
  app.plugin(EndWikiQuickEditPlugin as never)
  await (app as any).start?.()

  return {
    app,
    bridge,
  }
}

const moduleExport: HostPluginModule = {
  async activate(host) {
    const { app, bridge } = await bootApp(host)

    return async () => {
      await bridge.dispose()
      document.body.removeAttribute('data-end-wikiplus-ipe')
      await (app as any).dispose?.()
      await (app as any).stop?.()
    }
  },
}

export default moduleExport
