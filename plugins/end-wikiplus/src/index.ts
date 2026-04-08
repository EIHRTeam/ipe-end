import '@plugin/styles/index.scss'

import { PluginToolbox } from '@/plugins/toolbox'
import type { HostPluginContext, HostPluginModule } from '@plugin/types/host'
import { EndWikiHostBridge } from '@plugin/bridge/EndWikiHostBridge'
import { EndWikiPlusApp } from '@plugin/app/EndWikiPlusApp'
import { EndWikiPreferencesUIPlugin } from '@plugin/plugins/preferences-ui'
import { EndWikiQuickDiffPlugin } from '@plugin/plugins/quick-diff'
import { EndWikiQuickEditPlugin } from '@plugin/plugins/quick-edit'
import { EndWikiQuickPreviewPlugin } from '@plugin/plugins/quick-preview'
import { EndWikiPluginStorePlugin } from '@plugin/plugins/plugin-store'
import { pluginRuntimeDebug } from '@plugin/utils/debug'

const bootApp = async (host: HostPluginContext) => {
  pluginRuntimeDebug.info('boot', '开始启动 Endfield Wiki⁺ IPE 插件')
  const bridge = new EndWikiHostBridge(host)
  const bootstrap = await bridge.bootstrap()
  pluginRuntimeDebug.debug('boot', 'bridge.bootstrap 完成', {
    routeName: bootstrap.page.routeName,
    pageKind: bootstrap.page.kind,
    wikiItemId: bootstrap.page.wikiItemId,
    hasCurrentItem: Boolean(bootstrap.currentItem),
    hasMe: Boolean(bootstrap.me),
  })
  const app = new EndWikiPlusApp(bridge, bootstrap)
  ;(app as any).on?.('internal/runtime', (runtime: any) => {
    pluginRuntimeDebug.debug('cordis', 'runtime 变更', {
      name: runtime?.name,
      pluginName: runtime?.plugin?.name,
      inject: runtime?.inject ? Object.keys(runtime.inject) : [],
    })
  })
  ;(app as any).on?.('internal/status', (scope: any, oldStatus: unknown) => {
    pluginRuntimeDebug.debug('cordis', 'scope 状态变更', {
      name: scope?.runtime?.name,
      pluginName: scope?.runtime?.plugin?.name,
      status: scope?.status,
      oldStatus,
      ready: scope?.ready,
      hasError: scope?.hasError,
    })
  })
  ;(app as any).on?.('internal/error', (error: unknown) => {
    pluginRuntimeDebug.error('cordis', '框架内部错误', error)
  })
  ;(app as any).on?.('internal/warning', (warning: unknown) => {
    pluginRuntimeDebug.warn('cordis', '框架内部警告', warning)
  })
  pluginRuntimeDebug.debug('boot', '应用实例已创建')
  pluginRuntimeDebug.debug('boot', '预注册 toolbox runtime')
  app.plugin(PluginToolbox as never)
  pluginRuntimeDebug.debug('boot', '启动应用生命周期')
  await (app as any).start?.()
  pluginRuntimeDebug.debug('boot', '应用生命周期已启动')
  await app.withInject(['preferences', 'modal'])
  pluginRuntimeDebug.debug('boot', '基础服务已就绪', {
    hasPreferences: Boolean((app as any).preferences),
    hasModal: Boolean((app as any).modal),
  })

  document.body.setAttribute('data-end-wikiplus-ipe', 'active')
  pluginRuntimeDebug.debug('boot', '等待 toolbox service 可用')
  window.setTimeout(() => {
    pluginRuntimeDebug.debug('boot', 'toolbox 延时检查', {
      afterMs: 100,
      hasToolbox: Boolean((app as any).toolbox),
      toolboxExists: Boolean(document.querySelector('#ipe-edit-toolbox')),
    })
  }, 100)
  window.setTimeout(() => {
    pluginRuntimeDebug.debug('boot', 'toolbox 延时检查', {
      afterMs: 1000,
      hasToolbox: Boolean((app as any).toolbox),
      toolboxExists: Boolean(document.querySelector('#ipe-edit-toolbox')),
    })
  }, 1000)
  await Promise.race([
    app.withInject(['toolbox']),
    new Promise((_, reject) => {
      window.setTimeout(() => {
        reject(
          new Error(
            `toolbox 注入超时，DOM=${Boolean(document.querySelector('#ipe-edit-toolbox'))}`
          )
        )
      }, 2000)
    }),
  ])
  pluginRuntimeDebug.debug('boot', 'toolbox 已装配', {
    hasToolbox: Boolean((app as any).toolbox),
    toolboxExists: Boolean(document.querySelector('#ipe-edit-toolbox')),
  })
  app.plugin(EndWikiPreferencesUIPlugin as never)
  app.plugin(EndWikiQuickDiffPlugin as never)
  app.plugin(EndWikiQuickPreviewPlugin as never)
  app.plugin(EndWikiPluginStorePlugin as never)
  app.plugin(EndWikiQuickEditPlugin as never)
  pluginRuntimeDebug.debug('boot', 'UI 插件已挂载', {
    plugins: [
      'EndWikiPreferencesUIPlugin',
      'EndWikiQuickDiffPlugin',
      'EndWikiQuickPreviewPlugin',
      'EndWikiPluginStorePlugin',
      'EndWikiQuickEditPlugin',
    ],
  })
  pluginRuntimeDebug.info('boot', 'Endfield Wiki⁺ IPE 插件启动完成', {
    toolboxExists: Boolean(document.querySelector('#ipe-edit-toolbox')),
    activeFlag: document.body.getAttribute('data-end-wikiplus-ipe'),
  })

  return {
    app,
    bridge,
  }
}

const moduleExport: HostPluginModule = {
  async activate(host) {
    const { app, bridge } = await bootApp(host)

    return async () => {
      pluginRuntimeDebug.info('boot', '开始停用 Endfield Wiki⁺ IPE 插件')
      await bridge.dispose()
      document.body.removeAttribute('data-end-wikiplus-ipe')
      await (app as any).dispose?.()
      await (app as any).stop?.()
      pluginRuntimeDebug.info('boot', 'Endfield Wiki⁺ IPE 插件已停用', {
        toolboxExists: Boolean(document.querySelector('#ipe-edit-toolbox')),
      })
    }
  },
}

export default moduleExport
