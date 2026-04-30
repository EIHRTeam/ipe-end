interface ImportMetaEnv {
  readonly BASE_URL: string
  readonly DEV: boolean
  readonly MODE: string
  readonly PROD: boolean
  readonly __VERSION__: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
