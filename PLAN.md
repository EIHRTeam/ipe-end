# Pretext 驱动的编辑器文本渲染重构计划

## 摘要
- 范围只覆盖当前 `SyntaxHighlightedTextarea`，不扩散到仓库里其它 `textarea`。
- 依赖用 `pnpm` 接入：`pnpm add @chenglou/pretext --filter @inpageedit/core`。
- `pretext` 只替换“文本布局与可视渲染”这一层；语言识别、语法高亮继续保留 `highlight.js`。
- 保留自动降级：`pretext` 方案异常时，回退到现有 DOM `<pre>` 覆盖层方案。

## 实现变更
- 把当前 `SyntaxHighlightedTextarea` 拆成“外壳 + 渲染器”结构。
- 外壳继续保留原生 `textarea` 作为唯一输入源，保存、预览、diff、未保存检测都继续读取同一个 DOM 元素，不改 quick-edit 调用方式。
- 现有 `detectCodeLanguage()` 保持不变；高亮仍由 `highlight.js` 生成 token，只是不再直接把整段 HTML 塞进一个 `<pre>`。
- 新增内部 `HighlightRun[]` 流程：把 `highlight.js` 输出扁平化成“纯文本 + class 列表”的 token runs，后续布局和逐行渲染都基于这个结构。
- `pretext` 渲染器固定使用 `prepareWithSegments(text, font, { whiteSpace: 'pre-wrap' })` 和 `layoutWithLines(...)`。
- `prepareWithSegments()` 只在文本内容、计算后的 `font`、locale 变化时重跑；宽度变化时只重跑 `layoutWithLines()`，不重复 prepare。
- 宽度计算以 `textarea` 的内容区为准，不含左右 padding；字体和行高直接从 `getComputedStyle(textarea)` 取值，避免 CSS 与布局算法脱节。
- 用 `ResizeObserver` 监听编辑区尺寸变化；用 `textarea` 的 `scrollTop/scrollLeft` 单向同步可视层滚动。
- 逐行渲染时，基于 `prepared.segments` 和 `LayoutCursor` 预计算绝对 grapheme/code-unit 偏移，把 `HighlightRun[]` 精确切到每一行，渲染成多行 DOM，而不是整块 `<pre>` 平移。
- 每行 DOM 使用固定 `line-height`、`white-space: pre`、`unicode-bidi: plaintext`，并继承 `direction`，避免双重换行和 bidi 乱序。
- 保留当前 DOM 覆盖层实现作为 fallback renderer；触发条件写死为：`pretext` prepare/layout 抛错、字体/行高不可用、行切分断言失败。
- 根节点增加非公开调试属性 `data-ipe-renderer="pretext|dom"`，便于测试和定位，不新增用户配置项。
- quick-edit 两个接入点保持不变，只消费更新后的组件，不新增 props，不改提交链路。

## 公共接口与类型
- `SyntaxHighlightedTextareaProps` 保持不变。
- `detectCodeLanguage` 保持不变。
- quick-edit 相关插件接口、事件、表单字段名保持不变。
- 仅新增内部实现类型，例如 `HighlightRun`、`PreparedRenderState`、`LineRenderModel`；这些不对外暴露。

## 测试与验收
- 保留并继续跑现有 `detectCodeLanguage` 单测。
- 新增纯函数测试，覆盖 token flatten 和按行切分，样本至少包含 JSON、HTML、JavaScript、空格、`\t`、硬换行、emoji、混合 bidi 文本。
- 新增组件级测试，mock `@chenglou/pretext`，验证：
  - 初始渲染走 `pretext`
  - 输入后只更新布局与行渲染
  - resize 只重跑 layout
  - `pretext` 抛错时自动切回 DOM fallback
- 回归命令统一使用 `pnpm`：
  - `pnpm --filter @inpageedit/core exec vitest run src/components/SyntaxHighlightedTextarea.spec.ts`
  - 新增对应的 pretext renderer 测试命令
  - `pnpm --filter @inpageedit/core build:import`
  - `pnpm --filter @inpageedit/end-wikiplus smoke`
- 验收标准：
  - 长 JSON / HTML / JavaScript 内容滚出初始视口后仍可见且高亮存在
  - `textarea` 与可视层的 `scrollTop/scrollLeft` 始终一致
  - 输入、保存、预览、diff 继续通过原 `textarea#wpTextbox1` 工作
  - 语言角标与现有识别结果一致
  - fallback 路径可被测试稳定触发

## 假设与默认项
- 使用 `@chenglou/pretext@0.0.4`。
- 保留 `highlight.js`，本轮不替换高亮方案。
- 不新增用户开关；fallback 为自动行为。
- 所有新增依赖、构建、测试命令都使用 `pnpm`，不使用 `npm install`。
