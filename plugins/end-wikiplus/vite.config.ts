import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { readFileSync, mkdirSync, copyFileSync } from 'node:fs'
import Vue from '@vitejs/plugin-vue'

const ROOT = resolve(import.meta.dirname)
const OUT_ROOT = resolve(ROOT, 'artifacts/inpageedit-next-end-wikiplus')
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as { version: string }

export default defineConfig({
  plugins: [
    Vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.includes('-'),
        },
      },
    }),
    {
      name: 'copy-manifest',
      closeBundle() {
        mkdirSync(OUT_ROOT, { recursive: true })
        copyFileSync(resolve(ROOT, 'manifest.json'), resolve(OUT_ROOT, 'manifest.json'))
      },
    },
  ],
  resolve: {
    alias: [
      {
        find: /^@inpageedit\/modal\/style\.css$/,
        replacement: resolve(ROOT, '../../packages/modal/src/style.scss'),
      },
      {
        find: /^@inpageedit\/modal$/,
        replacement: resolve(ROOT, '../../packages/modal/src/index.tsx'),
      },
      {
        find: /^@inpageedit\/logger$/,
        replacement: resolve(ROOT, '../../packages/logger/src/index.ts'),
      },
      {
        find: /^@\/InPageEdit(?:\.js)?$/,
        replacement: resolve(ROOT, './src/shims/InPageEdit.ts'),
      },
      {
        find: /^@plugin\/(.*)$/,
        replacement: resolve(ROOT, './src/$1'),
      },
      {
        find: /^@\/(.*)$/,
        replacement: resolve(ROOT, '../../packages/core/src/$1'),
      },
    ],
  },
  define: {
    'import.meta.env.__VERSION__': JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2022',
    outDir: resolve(OUT_ROOT, 'dist'),
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: resolve(ROOT, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js',
      cssFileName: 'styles',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
