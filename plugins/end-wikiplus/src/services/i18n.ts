function normalizeTemplate(strings: TemplateStringsArray, values: unknown[]) {
  return strings.reduce((acc, part, index) => {
    const value = index < values.length ? values[index] : ''
    return acc + part + (value == null ? '' : String(value))
  }, '')
}

export function attachI18nShortcuts(ctx: { set(key: string, value: unknown): void }) {
  const tag = (strings: TemplateStringsArray, ...values: unknown[]) =>
    normalizeTemplate(strings, values)

  ctx.set('$', tag as unknown)
  ctx.set('$raw', tag as unknown)
  ctx.set('$$', tag as unknown)
  ctx.set('$$raw', tag as unknown)
}
