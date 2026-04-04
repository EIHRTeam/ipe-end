import { I18nManager } from '@/services/i18n/I18nManager'
import enData from '@/__mock__/i18n/en.json'
import jaData from '@/__mock__/i18n/ja.json'
import zhHansData from '@/__mock__/i18n/zh-hans.json'
import zhHantData from '@/__mock__/i18n/zh-hant.json'

const CORE_LANGUAGE_DATA = {
  en: enData,
  ja: jaData,
  'zh-hans': zhHansData,
  'zh-hant': zhHantData,
} as const

const ADAPTER_LANGUAGE_DATA = {
  en: {
    Capabilities: 'Capabilities',
    'Current End Wiki+ adapter support matrix.': 'Current End Wiki+ adapter support matrix.',
    'This adapter keeps the original IPE settings shell and moves wiki operations onto the End Wiki+ host bridge.':
      'This adapter keeps the original IPE settings shell and moves wiki operations onto the End Wiki+ host bridge.',
    'Current Status': 'Current Status',
    'Floating toolbox, preferences UI and quick edit modal now follow original IPE code paths.':
      'Floating toolbox, preferences UI and quick edit modal now follow original IPE code paths.',
    'Quick edit submits through the host item update API and clears host drafts after save.':
      'Quick edit submits through the host item update API and clears host drafts after save.',
    'Preview and diff keep the original button layout, with host-adapted placeholder behavior.':
      'Preview and diff keep the original button layout, with host-adapted placeholder behavior.',
    Runtime: 'Runtime',
    'Plugin version': 'Plugin version',
    'Current item': 'Current item',
    none: 'none',
    Original: 'Original',
    'Current Draft': 'Current Draft',
    'The current host page has not resolved an item id yet. Saving still works if the edited JSON contains a valid item identifier.':
      'The current host page has not resolved an item id yet. Saving still works if the edited JSON contains a valid item identifier.',
    'Host-local plugin registry view': 'Host-local plugin registry view',
    enabled: 'enabled',
    disabled: 'disabled',
    'Remote registry, npm install and online download actions stay visible as a documented limitation in this phase and will remain disabled in the End Wiki+ host.':
      'Remote registry, npm install and online download actions stay visible as a documented limitation in this phase and will remain disabled in the End Wiki+ host.',
  },
  ja: {
    Capabilities: '機能',
    'Current End Wiki+ adapter support matrix.': '現在の End Wiki+ アダプター対応状況です。',
    'This adapter keeps the original IPE settings shell and moves wiki operations onto the End Wiki+ host bridge.':
      'このアダプターは元の IPE 設定 UI を維持しつつ、Wiki 操作を End Wiki+ のホストブリッジに移します。',
    'Current Status': '現在の状態',
    'Floating toolbox, preferences UI and quick edit modal now follow original IPE code paths.':
      'フローティングツールボックス、設定 UI、クイック編集モーダルは元の IPE コードパスに沿っています。',
    'Quick edit submits through the host item update API and clears host drafts after save.':
      'クイック編集はホストの item update API 経由で送信し、保存後にホスト下書きを消去します。',
    'Preview and diff keep the original button layout, with host-adapted placeholder behavior.':
      'プレビューと差分は元のボタン配置を維持しつつ、ホスト適応版のプレースホルダー挙動になります。',
    Runtime: '実行環境',
    'Plugin version': 'プラグインバージョン',
    'Current item': '現在の項目',
    none: 'なし',
    Original: '元データ',
    'Current Draft': '現在の下書き',
    'The current host page has not resolved an item id yet. Saving still works if the edited JSON contains a valid item identifier.':
      '現在のホストページではまだ item id が解決されていません。編集した JSON に有効な識別子が含まれていれば保存できます。',
    'Host-local plugin registry view': 'ホスト内ローカルのプラグインレジストリ表示',
    enabled: '有効',
    disabled: '無効',
    'Remote registry, npm install and online download actions stay visible as a documented limitation in this phase and will remain disabled in the End Wiki+ host.':
      'この段階では、リモートレジストリ・npm インストール・オンラインダウンロード操作は制限事項として表示のみ残し、End Wiki+ ホストでは無効のままです。',
  },
  'zh-hans': {
    Capabilities: '能力',
    'Current End Wiki+ adapter support matrix.': '当前 End Wiki+ 适配器能力矩阵。',
    'This adapter keeps the original IPE settings shell and moves wiki operations onto the End Wiki+ host bridge.':
      '这个适配器保留原版 IPE 设置外壳，并将 Wiki 操作迁移到 End Wiki+ 宿主桥接层。',
    'Current Status': '当前状态',
    'Floating toolbox, preferences UI and quick edit modal now follow original IPE code paths.':
      '悬浮工具箱、设置界面和快速编辑弹窗现在都走原版 IPE 代码路径。',
    'Quick edit submits through the host item update API and clears host drafts after save.':
      '快速编辑通过宿主 item update API 提交，并在保存后清理宿主草稿。',
    'Preview and diff keep the original button layout, with host-adapted placeholder behavior.':
      '预览和差异保留原版按钮布局，但内部行为仍是宿主适配后的占位实现。',
    Runtime: '运行时',
    'Plugin version': '插件版本',
    'Current item': '当前条目',
    none: '无',
    Original: '原始内容',
    'Current Draft': '当前草稿',
    'The current host page has not resolved an item id yet. Saving still works if the edited JSON contains a valid item identifier.':
      '当前宿主页面尚未解析出 item id。如果编辑后的 JSON 内包含有效条目标识，仍然可以正常保存。',
    'Host-local plugin registry view': '宿主本地插件注册表视图',
    enabled: '已启用',
    disabled: '已禁用',
    'Remote registry, npm install and online download actions stay visible as a documented limitation in this phase and will remain disabled in the End Wiki+ host.':
      '远程注册表、npm 安装和在线下载操作在这一阶段仅作为限制说明保留展示，在 End Wiki+ 宿主中仍保持禁用。',
  },
  'zh-hant': {
    Capabilities: '能力',
    'Current End Wiki+ adapter support matrix.': '目前 End Wiki+ 適配器能力矩陣。',
    'This adapter keeps the original IPE settings shell and moves wiki operations onto the End Wiki+ host bridge.':
      '這個適配器保留原版 IPE 設定外殼，並將 Wiki 操作遷移到 End Wiki+ 宿主橋接層。',
    'Current Status': '目前狀態',
    'Floating toolbox, preferences UI and quick edit modal now follow original IPE code paths.':
      '懸浮工具箱、設定介面和快速編輯彈窗現在都沿用原版 IPE 程式碼路徑。',
    'Quick edit submits through the host item update API and clears host drafts after save.':
      '快速編輯透過宿主 item update API 提交，並在儲存後清除宿主草稿。',
    'Preview and diff keep the original button layout, with host-adapted placeholder behavior.':
      '預覽與差異保留原版按鈕配置，但內部行為仍是宿主適配後的占位實作。',
    Runtime: '執行階段',
    'Plugin version': '插件版本',
    'Current item': '目前條目',
    none: '無',
    Original: '原始內容',
    'Current Draft': '目前草稿',
    'The current host page has not resolved an item id yet. Saving still works if the edited JSON contains a valid item identifier.':
      '目前宿主頁面尚未解析出 item id。如果編輯後的 JSON 內含有效條目識別，仍然可以正常儲存。',
    'Host-local plugin registry view': '宿主本地插件註冊表檢視',
    enabled: '已啟用',
    disabled: '已停用',
    'Remote registry, npm install and online download actions stay visible as a documented limitation in this phase and will remain disabled in the End Wiki+ host.':
      '遠端註冊表、npm 安裝與線上下載操作在這個階段僅保留為限制說明，在 End Wiki+ 宿主中仍維持停用。',
  },
} as const

function normalizeLanguageCode(input: string) {
  const code = input.trim().replace(/_/g, '-').toLowerCase()
  if (!code) return 'en'
  if (code === 'qqx') return 'qqx'
  if (code.startsWith('ja')) return 'ja'
  if (code.startsWith('zh')) {
    if (
      code.includes('hant') ||
      code.endsWith('-tw') ||
      code.endsWith('-hk') ||
      code.endsWith('-mo')
    ) {
      return 'zh-hant'
    }
    return 'zh-hans'
  }
  return 'en'
}

function detectLanguage(preferred?: string) {
  const candidates = [
    preferred,
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language,
    document.documentElement.lang,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

  for (const candidate of candidates) {
    const normalized = normalizeLanguageCode(candidate)
    if (normalized in CORE_LANGUAGE_DATA || normalized === 'qqx') {
      return normalized
    }
  }

  return 'en'
}

export function attachI18nShortcuts(
  ctx: { set(key: string, value: unknown): void },
  options?: { language?: string },
) {
  const language = detectLanguage(options?.language)
  const manager = new I18nManager({}, { language })

  for (const [code, data] of Object.entries(CORE_LANGUAGE_DATA)) {
    manager.setLanguageData(code, data)
  }
  for (const [code, data] of Object.entries(ADAPTER_LANGUAGE_DATA)) {
    manager.setLanguageData(code, data)
  }

  manager.setLanguage(language)

  ctx.set('$', manager.$.bind(manager))
  ctx.set('$raw', manager.$raw.bind(manager))
  ctx.set('$$', manager.$$.bind(manager))
  ctx.set('$$raw', manager.$$raw.bind(manager))

  return manager
}
