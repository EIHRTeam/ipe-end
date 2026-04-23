export type EndfieldWikitextFormat = 'json' | 'xml'

export interface EndfieldWikitextConversionResult {
  text: string
  warnings: string[]
}
