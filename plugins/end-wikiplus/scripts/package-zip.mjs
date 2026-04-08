import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pluginRoot = resolve(__dirname, '..')
const artifactsRoot = resolve(pluginRoot, 'artifacts')
const artifactDir = resolve(artifactsRoot, 'inpageedit-next-end-wikiplus')
const artifactManifestPath = resolve(artifactDir, 'manifest.json')
const artifactDistPath = resolve(artifactDir, 'dist')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function run(command, args, cwd) {
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
  })
}

function main() {
  console.log('[package-zip] Building @inpageedit/end-wikiplus...')
  run('pnpm', ['build'], pluginRoot)

  if (!existsSync(artifactManifestPath) || !existsSync(artifactDistPath)) {
    throw new Error(
      '[package-zip] Build output missing. Expected artifacts/inpageedit-next-end-wikiplus/{manifest.json,dist}.'
    )
  }

  const pkg = readJson(resolve(pluginRoot, 'package.json'))
  const manifest = readJson(artifactManifestPath)

  if (pkg.version !== manifest.version) {
    throw new Error(
      `[package-zip] Version mismatch: package.json=${pkg.version} manifest.json=${manifest.version}`
    )
  }

  const pluginId = manifest.id
  const assetName = `${pluginId}-v${pkg.version}.zip`
  const assetPath = resolve(artifactsRoot, assetName)
  const stagingRoot = resolve(artifactsRoot, '.zip-staging')
  const stagingPluginDir = resolve(stagingRoot, pluginId)

  rmSync(stagingRoot, { force: true, recursive: true })
  rmSync(assetPath, { force: true })

  mkdirSync(stagingPluginDir, { recursive: true })
  cpSync(artifactManifestPath, resolve(stagingPluginDir, 'manifest.json'))
  cpSync(artifactDistPath, resolve(stagingPluginDir, 'dist'), { recursive: true })

  console.log(`[package-zip] Creating ${assetName} ...`)
  run('zip', ['-r', assetPath, pluginId, '-x', '*.map', '-x', '__MACOSX/*'], stagingRoot)

  rmSync(stagingRoot, { force: true, recursive: true })
  console.log(`[package-zip] Done: ${assetPath}`)
}

main()
