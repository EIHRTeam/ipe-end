## Plan: 长文档卡顿根因与修复路线

当前卡顿的本质不是 pretext 是否接入，而是编辑器渲染仍是主线程全量同步链路。按照 PLAN.md 的既定范围，pretext 仅替换了布局层，语言检测与高亮仍由 highlight.js 全文处理，所以在长文档下会被放大。推荐先完成可量化基线，再按“可见区渲染优先、全量计算后置”的顺序落地优化。

**Steps**
1. Phase A - 复现与基线采样（起点）: 在 core quick-edit 与 end-wikiplus quick-edit 两条入口统一复现长文档卡顿场景，记录 updateHighlight 每帧耗时、节点数量和输入延迟；输出可比较的 P50/P95 数据作为后续验收基线。
2. Phase B - 根因分桶（依赖 Step 1）: 将单次更新拆分为语言检测、hljs 高亮、HTML 扁平化、pretext 布局、行模型切分、DOM 写入 6 个桶，确认每个桶在 50KB/100KB/500KB 文本下的占比，形成优先级矩阵。
3. Phase C - P0 优化 1（依赖 Step 2）: 引入可视窗口渲染（仅渲染可见行 + overscan），保留总高度占位与滚动同步，避免每次输入/resize 重建全部行节点。
4. Phase D - P0 优化 2（可并行于 Step 3，最终集成依赖 Step 3）: 将高亮更新改为增量策略（小编辑走局部更新，大编辑回退全文），并减少 detectCodeLanguage 在 resize 场景的重复全文扫描。
5. Phase E - P1 优化（依赖 Step 3/4）: 优化 run 切分算法（游标推进或区间索引替代逐行全量扫描），并将 replaceChildren 全量重建替换为行级最小化更新。
6. Phase F - 测试与回归（依赖 Step 3-5）: 新增性能回归用例与手工长文档验收清单，确保输入、滚动、resize、fallback 路径都可稳定通过。

**Relevant files**
- /Users/null/Desktop/inpageedit-next/PLAN.md — 已执行计划的边界条件与设计假设（pretext 仅替换布局层、保留 highlight.js）。
- /Users/null/Desktop/inpageedit-next/packages/core/src/components/SyntaxHighlightedTextarea.tsx — 主耗时链路（detectCodeLanguage、hljs、高亮缓存、pretext 布局、DOM 渲染、ResizeObserver 触发）。
- /Users/null/Desktop/inpageedit-next/packages/core/src/internal/syntaxHighlightedTextarea.ts — HTML 扁平化、grapheme 映射、行切分与 run slicing 算法热点。
- /Users/null/Desktop/inpageedit-next/packages/core/src/internal/syntaxHighlightedTextareaPretext.ts — prepare/layout 与 locale 切换入口。
- /Users/null/Desktop/inpageedit-next/packages/core/src/plugins/quick-edit/index.tsx — core quick-edit 接入点。
- /Users/null/Desktop/inpageedit-next/plugins/end-wikiplus/src/plugins/quick-edit.tsx — end-wikiplus quick-edit 接入点。
- /Users/null/Desktop/inpageedit-next/packages/core/src/components/SyntaxHighlightedTextarea.component.spec.ts — 当前组件测试覆盖点（功能路径完整、性能路径缺失）。

**Verification**
1. 采样命令: pnpm --filter @inpageedit/core dev，分别在 quick-edit 模态中粘贴 50KB/100KB/500KB JSON 与 HTML 文本，采集输入延迟与帧耗时。
2. 自动化: pnpm --filter @inpageedit/core exec vitest run src/components/SyntaxHighlightedTextarea.component.spec.ts src/components/SyntaxHighlightedTextarea.spec.ts src/internal/syntaxHighlightedTextarea.spec.ts。
3. 构建回归: pnpm --filter @inpageedit/core build:import。
4. 冒烟: pnpm --filter @inpageedit/end-wikiplus smoke。
5. 验收阈值建议: 100KB 文本单字符输入 P95 < 50ms，500KB 文本滚动无明显掉帧，Resize 期间无持续主线程长任务（>100ms）。

**Decisions**
- 已确认范围: 卡顿分析聚焦 SyntaxHighlightedTextarea 及两处 quick-edit 接入点，不扩展到仓库其它文本域。
- 已确认事实: PLAN.md 的目标是功能正确性与可视一致性，不包含虚拟滚动、增量高亮、后台线程化，因此长文档性能问题仍会存在。
- 本轮纳入: 根因拆解、优先级排序、可执行优化顺序与验收标准。
- 本轮排除: 直接替换 highlight.js 生态、重写编辑器为第三方富文本内核。

**Further Considerations**
1. 可视窗口策略建议: Option A 固定 overscan 行数，Option B 按像素高度动态 overscan；建议先 A（实现风险更低）。
2. 增量高亮策略建议: Option A 只优化 JSON/JS 主场景，Option B 支持所有语言；建议先 A，避免首轮复杂度过高。
3. 线程化策略建议: Option A 第二阶段引入 Web Worker，Option B 继续主线程并加强节流；建议先完成虚拟化后再评估 A。
