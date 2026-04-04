<div align="center">

[<img src="https://www.ipe.wiki/images/logo/ipe-next-uwu.png" width="280" alt="InPageEdit Logo">](https://www.ipe.wiki)

# InPageEdit NEXT for Endfield Wikiplus

🚀 MediaWiki 的模块化、可扩展超级增强插件

**InPageEdit NEXT** 是由机智的小鱼君开发的一款 MediaWiki 多功能插件。主要功能旨在使许多 MediaWiki 的功能在不打开新标签页的情况下完成(包括但不限于编辑)，极大加快维护 wiki 的速度。模块化设计、类型定义清晰完整，插件可自由热插拔。

→ <https://www.ipe.wiki> ←

[![](https://data.jsdelivr.com/v1/package/npm/@inpageedit/core/badge)](https://www.jsdelivr.com/package/npm/@inpageedit/core) [![Crowdin](https://badges.crowdin.net/inpageedit/localized.svg)](https://crowdin.com/project/inpageedit)

</div>

## 快速上手 / Quick Start

在*个人 JS 页*添加以下代码：

<!-- prettier-ignore -->
```javascript
// InPageEdit NEXT
document.body.append(
  Object.assign(document.createElement('script'), {
    src: 'https://cdn.jsdelivr.net/npm/@inpageedit/core/dist/index.js',
    type: 'module',
  })
)
```

## Supported languages

- **English (en)**
- العربية (ar)
- Français (fr)
- Hindī (hi)
- 日本語 (ja)
- Nederlands (nl)
- Polski (pl)
- Português do Brasil (pt_BR)
- **中文(简体) (zh-Hans)**
- 中文(繁體) (zh-Hant)
- _(and more, using machine translation...)_

[Help us translate](https://crowdin.com/project/inpageedit)

## For developers

This is a monorepo:

| package            | description                                                                      | directory                                              |
| ------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------ |
| @inpageedit/core   | 🚀 Modular, Extensible Supercharged Plugin for MediaWiki                         | [packages/core](packages/core)                         |
| @inpageedit/logger | Flexible, Extensible Console Logger with Colored Labels and Hierarchical Loggers | [packages/logger](packages/logger)                     |
| @inpageedit/modal  | Yet another lightweight, framework-free modal and toast notification utility     | [packages/modal](packages/modal)                       |
| idb-plus           | 🗄️ Minimal Promise based IndexedDB Wrapper with Map-like API                     | [packages/idb-plus](packages/idb-plus)                 |
| schemastery-form   | 🧩 WebComponent for Schemastery Form Generation                                  | [packages/schemastery-form](packages/schemastery-form) |
| docs               | InPageEdit Documentation                                                         | [docs](docs)                                           |
| plugins            | Official Plugins                                                                 | [plugins](plugins)                                     |

### Build the main workspace

Use the repo root script:

```bash
pnpm build
```

The root build now follows the `@inpageedit/core` dependency graph and builds the workspace packages required by core first, instead of assuming their `dist/` outputs already exist.

### End Wiki+ host adapter

This repository now also contains a host-first external plugin package for End Wiki+:

| package | description | directory |
| --- | --- | --- |
| @inpageedit/end-wikiplus | End Wiki+ adapter that keeps the IPE shell UI and connects it to the End Wiki+ plugin host APIs | [plugins/end-wikiplus](plugins/end-wikiplus) |

Build it separately with:

```bash
pnpm --filter @inpageedit/end-wikiplus build
```

Current artifact output:

- `plugins/end-wikiplus/artifacts/inpageedit-next-end-wikiplus/manifest.json`
- `plugins/end-wikiplus/artifacts/inpageedit-next-end-wikiplus/dist/index.js`
- `plugins/end-wikiplus/artifacts/inpageedit-next-end-wikiplus/dist/styles.css`

Notes:

- The End Wiki+ package is not a MediaWiki autoload entry.
- It keeps the IPE shell structures such as toolbox / quick-edit / quick-diff / quick-preview / preferences-ui / plugin-store.
- It uses the End Wiki+ host APIs for page context, storage, plugin listing, and wiki submit / draft flows.

---

🚀 Modular, Extensible Supercharged Plugin for MediaWiki.

> [MIT License](https://opensource.org/licenses/MIT)
>
> InPageEdit-NEXT Copyright © 2025-present dragon-fish

See more: [GitHub](https://github.com/inpageedit/inpageedit-next) | [Change Logs](https://www.ipe.wiki/changelogs/) | [File Issues](https://github.com/inpageedit/inpageedit-next/issues) | [Plugin Registry](https://github.com/inpageedit/plugin-registry) | [Translate (Crowdin)](https://crowdin.com/project/inpageedit)
