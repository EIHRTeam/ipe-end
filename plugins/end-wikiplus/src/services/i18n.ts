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
    'Current Endfield Wiki⁺ adapter support matrix.':
      'Current Endfield Wiki⁺ adapter support matrix.',
    'This adapter keeps the original IPE settings shell and moves wiki operations onto the Endfield Wiki⁺ host bridge.':
      'This adapter keeps the original IPE settings shell and moves wiki operations onto the Endfield Wiki⁺ host bridge.',
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
    'Payload mode': 'Payload mode',
    json模式: 'JSON mode',
    xml模式: 'XML mode',
    'Format conversion': 'Format conversion',
    转换到xml: 'Convert to XML',
    转换到json: 'Convert to JSON',
    'Conversion Error': 'Conversion Error',
    'Payload Converted': 'Payload Converted',
    'Editor content has been converted with the Endfield Wiki format rules.':
      'Editor content has been converted with the Endfield Wiki format rules.',
    'Host-local plugin registry view': 'Host-local plugin registry view',
    enabled: 'enabled',
    disabled: 'disabled',
    'Remote registry, npm install and online download actions stay visible as a documented limitation in this phase and will remain disabled in the Endfield Wiki⁺ host.':
      'Remote registry, npm install and online download actions stay visible as a documented limitation in this phase and will remain disabled in the Endfield Wiki⁺ host.',
    'Upload Files': 'Upload Files',
    'Upload Queue': 'Upload Queue',
    'Preview & Result': 'Preview & Result',
    'Checking the host SKLand session...': 'Checking the host SKLand session...',
    'The host upload bridge is not available.': 'The host upload bridge is not available.',
    'Upload in progress': 'Upload in progress',
    'Please wait for the current upload batch to finish.':
      'Please wait for the current upload batch to finish.',
    'Ready to upload through the host bridge.': 'Ready to upload through the host bridge.',
    'Only image files are supported in this phase.':
      'Only image files are supported in this phase.',
    'Failed to read the host SKLand session.': 'Failed to read the host SKLand session.',
    'Upload bridge is ready.': 'Upload bridge is ready.',
    Queued: 'Queued',
    Uploading: 'Uploading',
    Uploaded: 'Uploaded',
    Failed: 'Failed',
    Unsupported: 'Unsupported',
    'Upload failed with an unknown error.': 'Upload failed with an unknown error.',
    'URL Copied': 'URL Copied',
    'URLs Copied': 'URLs Copied',
    'Copy Failed': 'Copy Failed',
    'No uploaded URLs': 'No uploaded URLs',
    'Upload at least one image before copying URLs.':
      'Upload at least one image before copying URLs.',
    'Copied all successful upload URLs to the clipboard.':
      'Copied all successful upload URLs to the clipboard.',
    'Session Required': 'Session Required',
    'Uploading through the host bridge...': 'Uploading through the host bridge...',
    'Upload completed. Copy the final wiki URL from this row or the preview panel.':
      'Upload completed. Copy the final wiki URL from this row or the preview panel.',
    'Signed in as': 'Signed in as',
    'Upload Bridge': 'Upload Bridge',
    'The button says "file", but phase 1 only uploads image files. Other files stay in the queue as unsupported.':
      'The button says "file", but phase 1 only uploads image files. Other files stay in the queue as unsupported.',
    'Refresh Session': 'Refresh Session',
    'No files selected': 'No files selected',
    'Choose or drop files to start building an upload queue.':
      'Choose or drop files to start building an upload queue.',
    'Copy URL': 'Copy URL',
    Retry: 'Retry',
    'No image preview available': 'No image preview available',
    'Select a queue item to inspect its preview and upload result.':
      'Select a queue item to inspect its preview and upload result.',
    'Uploaded URL': 'Uploaded URL',
    'Copy successful URLs': 'Copy successful URLs',
    'Choose Files': 'Choose Files',
    'Retry failed': 'Retry failed',
    'Uploading...': 'Uploading...',
    'Choose or drop files': 'Choose or drop files',
    'Unknown type': 'Unknown type',
    'Image upload is live now. Non-image files will stay in the queue as unsupported placeholders.':
      'Image upload is live now. Non-image files will stay in the queue as unsupported placeholders.',
    'Sign in to a SKLand account in the host app before uploading.':
      'Sign in to a SKLand account in the host app before uploading.',
    'The browser clipboard API is unavailable in the current host runtime.':
      'The browser clipboard API is unavailable in the current host runtime.',
  },
  ja: {
    Capabilities: '機能',
    'Current Endfield Wiki⁺ adapter support matrix.':
      '現在の Endfield Wiki⁺ アダプター対応状況です。',
    'This adapter keeps the original IPE settings shell and moves wiki operations onto the Endfield Wiki⁺ host bridge.':
      'このアダプターは元の IPE 設定 UI を維持しつつ、Wiki 操作を Endfield Wiki⁺ のホストブリッジに移します。',
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
    'Payload mode': '入力モード',
    json模式: 'JSON モード',
    xml模式: 'XML モード',
    'Format conversion': '形式変換',
    转换到xml: 'XML に変換',
    转换到json: 'JSON に変換',
    'Conversion Error': '変換エラー',
    'Payload Converted': '変換完了',
    'Editor content has been converted with the Endfield Wiki format rules.':
      'エディター内容を Endfield Wiki 形式ルールで変換しました。',
    'Host-local plugin registry view': 'ホスト内ローカルのプラグインレジストリ表示',
    enabled: '有効',
    disabled: '無効',
    'Remote registry, npm install and online download actions stay visible as a documented limitation in this phase and will remain disabled in the Endfield Wiki⁺ host.':
      'この段階では、リモートレジストリ・npm インストール・オンラインダウンロード操作は制限事項として表示のみ残し、Endfield Wiki⁺ ホストでは無効のままです。',
    'Upload Files': 'ファイルをアップロード',
    'Upload Queue': 'アップロードキュー',
    'Preview & Result': 'プレビューと結果',
    'Checking the host SKLand session...': 'ホストの SKLand セッションを確認しています...',
    'The host upload bridge is not available.': 'ホストのアップロードブリッジは利用できません。',
    'Upload in progress': 'アップロード中',
    'Please wait for the current upload batch to finish.':
      '現在のアップロード処理が完了するまでお待ちください。',
    'Ready to upload through the host bridge.': 'ホストブリッジ経由でアップロードできます。',
    'Only image files are supported in this phase.': 'この段階では画像ファイルのみ対応しています。',
    'Failed to read the host SKLand session.': 'ホストの SKLand セッションを読み取れませんでした。',
    'Upload bridge is ready.': 'アップロードブリッジの準備ができました。',
    Queued: '待機中',
    Uploading: 'アップロード中',
    Uploaded: 'アップロード済み',
    Failed: '失敗',
    Unsupported: '未対応',
    'Upload failed with an unknown error.': '不明なエラーでアップロードに失敗しました。',
    'URL Copied': 'URL をコピーしました',
    'URLs Copied': 'URL をコピーしました',
    'Copy Failed': 'コピーに失敗しました',
    'No uploaded URLs': 'コピーできる URL がありません',
    'Upload at least one image before copying URLs.':
      'URL をコピーする前に、少なくとも 1 枚アップロードしてください。',
    'Copied all successful upload URLs to the clipboard.':
      '成功したアップロード URL をすべてクリップボードにコピーしました。',
    'Session Required': 'セッションが必要です',
    'Uploading through the host bridge...': 'ホストブリッジ経由でアップロードしています...',
    'Upload completed. Copy the final wiki URL from this row or the preview panel.':
      'アップロードが完了しました。この行またはプレビューパネルから最終 URL をコピーできます。',
    'Signed in as': 'ログイン中',
    'Upload Bridge': 'アップロードブリッジ',
    'The button says "file", but phase 1 only uploads image files. Other files stay in the queue as unsupported.':
      'ボタン表記は「ファイル」ですが、第 1 段階で実際にアップロードできるのは画像のみです。他のファイルは未対応としてキューに残ります。',
    'Refresh Session': 'セッションを再確認',
    'No files selected': 'ファイルが選択されていません',
    'Choose or drop files to start building an upload queue.':
      'ファイルを選択またはドロップしてアップロードキューを作成してください。',
    'Copy URL': 'URL をコピー',
    Retry: '再試行',
    'No image preview available': '画像プレビューは利用できません',
    'Select a queue item to inspect its preview and upload result.':
      'キュー項目を選択すると、プレビューとアップロード結果を確認できます。',
    'Uploaded URL': 'アップロード済み URL',
    'Copy successful URLs': '成功した URL をコピー',
    'Choose Files': 'ファイルを選択',
    'Retry failed': '失敗分を再試行',
    'Uploading...': 'アップロード中...',
    'Choose or drop files': 'ファイルを選択またはドロップ',
    'Unknown type': '不明なタイプ',
    'Image upload is live now. Non-image files will stay in the queue as unsupported placeholders.':
      '現在は画像アップロードのみ有効です。画像以外のファイルは未対応のプレースホルダーとしてキューに残ります。',
    'Sign in to a SKLand account in the host app before uploading.':
      'アップロードする前に、ホストアプリで SKLand アカウントにログインしてください。',
    'The browser clipboard API is unavailable in the current host runtime.':
      '現在のホスト実行環境ではブラウザーのクリップボード API を利用できません。',
  },
  'zh-hans': {
    Capabilities: '能力',
    'Current Endfield Wiki⁺ adapter support matrix.': '当前 Endfield Wiki⁺ 适配器能力矩阵。',
    'This adapter keeps the original IPE settings shell and moves wiki operations onto the Endfield Wiki⁺ host bridge.':
      '这个适配器保留原版 IPE 设置外壳，并将 Wiki 操作迁移到 Endfield Wiki⁺ 宿主桥接层。',
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
    'Payload mode': '内容模式',
    json模式: 'json模式',
    xml模式: 'xml模式',
    'Format conversion': '格式转换',
    转换到xml: '转换到xml',
    转换到json: '转换到json',
    'Conversion Error': '转换失败',
    'Payload Converted': '转换完成',
    'Editor content has been converted with the Endfield Wiki format rules.':
      '已按 Endfield Wiki 规则完成内容转换。',
    'Host-local plugin registry view': '宿主本地插件注册表视图',
    enabled: '已启用',
    disabled: '已禁用',
    'Remote registry, npm install and online download actions stay visible as a documented limitation in this phase and will remain disabled in the Endfield Wiki⁺ host.':
      '远程注册表、npm 安装和在线下载操作在这一阶段仅作为限制说明保留展示，在 Endfield Wiki⁺ 宿主中仍保持禁用。',
    'Upload Files': '上传文件',
    'Upload Queue': '上传队列',
    'Preview & Result': '预览与结果',
    'Checking the host SKLand session...': '正在检查宿主 SKLand 会话...',
    'The host upload bridge is not available.': '宿主上传桥当前不可用。',
    'Upload in progress': '上传进行中',
    'Please wait for the current upload batch to finish.': '请等待当前上传批次完成。',
    'Ready to upload through the host bridge.': '已就绪，可通过宿主桥接上传。',
    'Only image files are supported in this phase.': '这一期目前只支持图片文件上传。',
    'Failed to read the host SKLand session.': '读取宿主 SKLand 会话失败。',
    'Upload bridge is ready.': '上传桥已就绪。',
    Queued: '待上传',
    Uploading: '上传中',
    Uploaded: '已上传',
    Failed: '失败',
    Unsupported: '暂不支持',
    'Upload failed with an unknown error.': '上传失败，且没有拿到明确错误信息。',
    'URL Copied': 'URL 已复制',
    'URLs Copied': 'URL 已复制',
    'Copy Failed': '复制失败',
    'No uploaded URLs': '暂无可复制的 URL',
    'Upload at least one image before copying URLs.': '请至少成功上传一张图片后再复制 URL。',
    'Copied all successful upload URLs to the clipboard.': '已将全部成功上传的 URL 复制到剪贴板。',
    'Session Required': '需要可用会话',
    'Uploading through the host bridge...': '正在通过宿主桥接上传...',
    'Upload completed. Copy the final wiki URL from this row or the preview panel.':
      '上传完成，可直接在当前条目或右侧预览面板复制最终 Wiki URL。',
    'Signed in as': '当前账号',
    'Upload Bridge': '上传桥',
    'The button says "file", but phase 1 only uploads image files. Other files stay in the queue as unsupported.':
      '按钮文案保留为“文件”，但一期真正可上传的只有图片；其他文件会进入队列并标记为暂不支持。',
    'Refresh Session': '刷新会话',
    'No files selected': '还没有选择文件',
    'Choose or drop files to start building an upload queue.':
      '选择文件或直接拖拽到这里，即可开始构建上传队列。',
    'Copy URL': '复制 URL',
    Retry: '重试',
    'No image preview available': '当前没有可用的图片预览',
    'Select a queue item to inspect its preview and upload result.':
      '选择一个队列条目后，可以在这里查看预览和上传结果。',
    'Uploaded URL': '上传结果 URL',
    'Copy successful URLs': '复制成功 URL',
    'Choose Files': '选择文件',
    'Retry failed': '重试失败项',
    'Uploading...': '上传中...',
    'Choose or drop files': '选择或拖拽文件',
    'Unknown type': '未知类型',
    'Image upload is live now. Non-image files will stay in the queue as unsupported placeholders.':
      '图片上传链路已经打通，非图片文件会保留在队列中，作为暂不支持的占位项展示。',
    'Sign in to a SKLand account in the host app before uploading.':
      '请先在宿主应用中登录 SKLand 账号，再进行上传。',
    'The browser clipboard API is unavailable in the current host runtime.':
      '当前宿主运行环境不可用浏览器剪贴板 API。',
  },
  'zh-hant': {
    Capabilities: '能力',
    'Current Endfield Wiki⁺ adapter support matrix.': '目前 Endfield Wiki⁺ 適配器能力矩陣。',
    'This adapter keeps the original IPE settings shell and moves wiki operations onto the Endfield Wiki⁺ host bridge.':
      '這個適配器保留原版 IPE 設定外殼，並將 Wiki 操作遷移到 Endfield Wiki⁺ 宿主橋接層。',
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
    'Payload mode': '內容模式',
    json模式: 'json模式',
    xml模式: 'xml模式',
    'Format conversion': '格式轉換',
    转换到xml: '轉換到xml',
    转换到json: '轉換到json',
    'Conversion Error': '轉換失敗',
    'Payload Converted': '轉換完成',
    'Editor content has been converted with the Endfield Wiki format rules.':
      '已依 Endfield Wiki 規則完成內容轉換。',
    'Host-local plugin registry view': '宿主本地插件註冊表檢視',
    enabled: '已啟用',
    disabled: '已停用',
    'Remote registry, npm install and online download actions stay visible as a documented limitation in this phase and will remain disabled in the Endfield Wiki⁺ host.':
      '遠端註冊表、npm 安裝與線上下載操作在這個階段僅保留為限制說明，在 Endfield Wiki⁺ 宿主中仍維持停用。',
    'Upload Files': '上傳檔案',
    'Upload Queue': '上傳佇列',
    'Preview & Result': '預覽與結果',
    'Checking the host SKLand session...': '正在檢查宿主 SKLand 會話...',
    'The host upload bridge is not available.': '宿主上傳橋目前不可用。',
    'Upload in progress': '上傳進行中',
    'Please wait for the current upload batch to finish.': '請等待目前上傳批次完成。',
    'Ready to upload through the host bridge.': '已就緒，可透過宿主橋接上傳。',
    'Only image files are supported in this phase.': '這一期目前只支援圖片檔案上傳。',
    'Failed to read the host SKLand session.': '讀取宿主 SKLand 會話失敗。',
    'Upload bridge is ready.': '上傳橋已就緒。',
    Queued: '待上傳',
    Uploading: '上傳中',
    Uploaded: '已上傳',
    Failed: '失敗',
    Unsupported: '暫不支援',
    'Upload failed with an unknown error.': '上傳失敗，且沒有拿到明確錯誤資訊。',
    'URL Copied': 'URL 已複製',
    'URLs Copied': 'URL 已複製',
    'Copy Failed': '複製失敗',
    'No uploaded URLs': '暫無可複製的 URL',
    'Upload at least one image before copying URLs.': '請至少成功上傳一張圖片後再複製 URL。',
    'Copied all successful upload URLs to the clipboard.': '已將全部成功上傳的 URL 複製到剪貼簿。',
    'Session Required': '需要可用會話',
    'Uploading through the host bridge...': '正在透過宿主橋接上傳...',
    'Upload completed. Copy the final wiki URL from this row or the preview panel.':
      '上傳完成，可直接在目前條目或右側預覽面板複製最終 Wiki URL。',
    'Signed in as': '目前帳號',
    'Upload Bridge': '上傳橋',
    'The button says "file", but phase 1 only uploads image files. Other files stay in the queue as unsupported.':
      '按鈕文案保留為「檔案」，但一期真正可上傳的只有圖片；其他檔案會進入佇列並標記為暫不支援。',
    'Refresh Session': '重新整理會話',
    'No files selected': '還沒有選擇檔案',
    'Choose or drop files to start building an upload queue.':
      '選擇檔案或直接拖放到這裡，即可開始建立上傳佇列。',
    'Copy URL': '複製 URL',
    Retry: '重試',
    'No image preview available': '目前沒有可用的圖片預覽',
    'Select a queue item to inspect its preview and upload result.':
      '選擇一個佇列項目後，可以在這裡查看預覽和上傳結果。',
    'Uploaded URL': '上傳結果 URL',
    'Copy successful URLs': '複製成功 URL',
    'Choose Files': '選擇檔案',
    'Retry failed': '重試失敗項',
    'Uploading...': '上傳中...',
    'Choose or drop files': '選擇或拖放檔案',
    'Unknown type': '未知類型',
    'Image upload is live now. Non-image files will stay in the queue as unsupported placeholders.':
      '圖片上傳鏈路已經打通，非圖片檔案會保留在佇列中，作為暫不支援的占位項顯示。',
    'Sign in to a SKLand account in the host app before uploading.':
      '請先在宿主應用中登入 SKLand 帳號，再進行上傳。',
    'The browser clipboard API is unavailable in the current host runtime.':
      '目前宿主執行環境不可用瀏覽器剪貼簿 API。',
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
  options?: { language?: string }
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
