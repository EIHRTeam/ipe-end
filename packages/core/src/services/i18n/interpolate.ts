// keyword & RegExp caches
const ESCAPE_ARG_L = '\uF114'
const ESCAPE_ARG_R = '\uF514'
const REG_ESCAPE_ARG_L = /\\\{/g
const REG_ESCAPE_ARG_R = /\\\}/g
const REG_RESTORE_ARG_L = new RegExp(ESCAPE_ARG_L, 'g')
const REG_RESTORE_ARG_R = new RegExp(ESCAPE_ARG_R, 'g')

/**
 * interpolate
 *  - 具名插值：`{{expr}}`，其中 expr 可为标识符或简单表达式（如 `{{ name || "world" }}`、`{{ name ? 'hi ' + name : '' }}`）。
 *  - 匿名插值：使用 `{{ $1 }}`、`{{ $2 }}`...，可用可变参数或数组提供位置参数。
 *  - 具名与匿名可混用；若缺失值，替换为空字符串。
 *
 * 示例：
 * ```ts
 *  interpolate('hello, {{ name }}') // 'hello, '
 *  interpolate('hello, {{ name || "world" }}') // 'hello, world'
 *  interpolate('hello, {{ name || "world" }}', { name: 'dragon' }) // 'hello, dragon'
 *  interpolate('hello, {{ $1 }}. {{ $2 }}', 'dragon', 'yeah') // 'hello, dragon. yeah'
 *  interpolate('hello, {{ $1 }}. {{ $2 }}', ['dragon', 'yeah']) // 'hello, dragon. yeah'
 *  interpolate('hello, {{ $1 }}. {{ greeting || "" }}', { $1: 'dragon', greeting: 'yeah' }) // 'hello, dragon. yeah'
 * ```
 */
export function interpolate(template: string): string
export function interpolate(template: string, context: Record<string, unknown>): string
export function interpolate(template: string, ...numricContext: string[]): string
export function interpolate(template: string, numricContext: string[]): string
export function interpolate(template: string, ...args: Array<unknown>): string {
  return baseInterpolate(undefined, template, ...args)
}

/**
 * 创建带有“全局可用函数/变量”的插值函数。
 * - 传入的 globals 会作为模板可用的全局，只在上下文未提供同名键时生效（上下文优先）。
 * - 返回的函数与 interpolate 具有相同签名。
 *
 * 示例：
 * ```ts
 * const interpolate = createInterpolate({ getUrl })
 * interpolate('url is: {{ getUrl(title) }}', { title: 'foo' })
 * ```
 */
export type Interpolator = {
  (template: string): string
  (template: string, context: Record<string, unknown>): string
  (template: string, ...numricContext: string[]): string
  (template: string, numricContext: string[]): string
}
export function createInterpolate(globals?: Record<string, unknown>): Interpolator {
  const g = globals ? { ...globals } : undefined
  const fn = (template: string, ...args: Array<unknown>) => {
    return baseInterpolate(g, template, ...args)
  }
  return fn as Interpolator
}

function baseInterpolate(
  globals: Record<string, unknown> | undefined,
  template: string,
  ...args: Array<unknown>
): string {
  if (!template) return ''

  let out = String(template)
    .replace(REG_ESCAPE_ARG_L, ESCAPE_ARG_L)
    .replace(REG_ESCAPE_ARG_R, ESCAPE_ARG_R)

  let named: Record<string, unknown> = {}
  let numrics: unknown[] = []

  if (args.length === 1 && Array.isArray(args[0])) {
    numrics = args[0] as unknown[]
  } else if (args.length === 1 && isPlainObject(args[0])) {
    named = args[0] as Record<string, unknown>
  } else if (args.length > 0) {
    numrics = args
  }

  const ctx: Record<string, unknown> = Object.create(null)
  if (numrics && numrics.length) {
    for (let i = 0; i < numrics.length; i++) {
      ctx[`$${i + 1}`] = numrics[i]
    }
  }
  if (named && Object.keys(named).length) {
    for (const k of Object.keys(named)) ctx[k] = (named as any)[k]
  }
  // 合入全局（不覆盖上下文已提供的同名键）
  if (globals && Object.keys(globals).length) {
    for (const k of Object.keys(globals)) {
      if (typeof ctx[k] === 'undefined') {
        ctx[k] = (globals as any)[k]
      }
    }
  }

  out = out.replace(/\{\{\s*([\s\S]*?)\s*\}\}/g, (_m, exprRaw: string) => {
    const expr = String(exprRaw).trim()
    if (!expr) return ''
    try {
      const value = safeEval(expr, ctx)
      if (value == null) return ''
      return String(value)
    } catch {
      return ''
    }
  })

  return out.replace(REG_RESTORE_ARG_L, '{').replace(REG_RESTORE_ARG_R, '}')
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && (v as object).constructor === Object
}

const safeEval = createEvaluator()

type Token =
  | { type: 'identifier'; value: string }
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'operator'; value: string }
  | { type: 'eof'; value: '' }

type EvalRef = {
  value: unknown
  thisArg?: unknown
}

const BUILTIN_VALUES: Record<string, unknown> = {
  Object,
  Array,
  String,
  Number,
  Boolean,
  Date,
  Math,
  JSON,
  undefined,
  null: null,
  true: true,
  false: false,
  NaN,
  Infinity,
  isNaN,
  isFinite,
  parseInt,
  parseFloat,
}

const FORBIDDEN_PROPERTY_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

function createEvaluator() {
  return (expr: string, ctx: Record<string, unknown>) => new ExpressionParser(tokenize(expr), ctx).parse()
}

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < expr.length) {
    const char = expr[i]!
    if (/\s/.test(char)) {
      i++
      continue
    }

    if (char === '"' || char === "'") {
      const quote = char
      let value = ''
      i++
      while (i < expr.length) {
        const current = expr[i++]!
        if (current === quote) break
        if (current === '\\' && i < expr.length) {
          const escaped = expr[i++]!
          value += unescapeStringChar(escaped)
        } else {
          value += current
        }
      }
      tokens.push({ type: 'string', value })
      continue
    }

    if (/\d/.test(char) || (char === '.' && /\d/.test(expr[i + 1] ?? ''))) {
      const start = i
      i++
      while (i < expr.length && /[\d_]/.test(expr[i]!)) i++
      if (expr[i] === '.') {
        i++
        while (i < expr.length && /[\d_]/.test(expr[i]!)) i++
      }
      const raw = expr.slice(start, i).replace(/_/g, '')
      tokens.push({ type: 'number', value: Number(raw) })
      continue
    }

    if (/[$A-Za-z_]/.test(char)) {
      const start = i
      i++
      while (i < expr.length && /[$\w]/.test(expr[i]!)) i++
      tokens.push({ type: 'identifier', value: expr.slice(start, i) })
      continue
    }

    const op =
      ['===', '!==', '>=', '<=', '&&', '||', '?.', '==', '!='].find((candidate) =>
        expr.startsWith(candidate, i)
      ) ?? char
    tokens.push({ type: 'operator', value: op })
    i += op.length
  }

  tokens.push({ type: 'eof', value: '' })
  return tokens
}

function unescapeStringChar(char: string): string {
  switch (char) {
    case 'n':
      return '\n'
    case 'r':
      return '\r'
    case 't':
      return '\t'
    case 'b':
      return '\b'
    case 'f':
      return '\f'
    case 'v':
      return '\v'
    case '0':
      return '\0'
    default:
      return char
  }
}

class ExpressionParser {
  private index = 0

  constructor(
    private readonly tokens: Token[],
    private readonly ctx: Record<string, unknown>
  ) {}

  parse(): unknown {
    const value = this.parseExpression()
    this.expect('eof')
    return unwrap(value)
  }

  private parseExpression(minPrecedence = 0): EvalRef {
    let left = this.parseUnary()

    while (true) {
      const op = this.peekOperator()
      const precedence = binaryPrecedence(op)
      if (!op || precedence < minPrecedence) break
      this.next()
      const right = this.parseExpression(precedence + 1)
      left = ref(applyBinary(op, unwrap(left), unwrap(right)))
    }

    if (minPrecedence === 0 && this.matchOperator('?')) {
      const consequent = this.parseExpression()
      this.expectOperator(':')
      const alternate = this.parseExpression()
      return ref(unwrap(left) ? unwrap(consequent) : unwrap(alternate))
    }

    return left
  }

  private parseUnary(): EvalRef {
    const op = this.peekOperator()
    if (op === '!' || op === '-' || op === '+') {
      this.next()
      const value = unwrap(this.parseUnary())
      if (op === '!') return ref(!value)
      if (op === '-') return ref(-Number(value))
      return ref(Number(value))
    }
    return this.parsePostfix()
  }

  private parsePostfix(): EvalRef {
    let current = this.parsePrimary()

    while (true) {
      if (this.matchOperator('.')) {
        current = this.readProperty(current, false)
        continue
      }
      if (this.matchOperator('?.')) {
        if (this.peekOperator() === '(') {
          current = this.callValue(current, true)
        } else {
          current = this.readProperty(current, true)
        }
        continue
      }
      if (this.matchOperator('[')) {
        const key = unwrap(this.parseExpression())
        this.expectOperator(']')
        current = getPropertyRef(unwrap(current), key, false)
        continue
      }
      if (this.peekOperator() === '(') {
        current = this.callValue(current, false)
        continue
      }
      break
    }

    return current
  }

  private parsePrimary(): EvalRef {
    const token = this.next()
    if (token.type === 'number' || token.type === 'string') return ref(token.value)
    if (token.type === 'identifier') return ref(this.lookup(token.value))
    if (token.type === 'operator' && token.value === '(') {
      const value = this.parseExpression()
      this.expectOperator(')')
      return value
    }
    throw new Error(`Unexpected token ${token.value || token.type}`)
  }

  private readProperty(targetRef: EvalRef, optional: boolean): EvalRef {
    const token = this.next()
    if (token.type !== 'identifier') throw new Error('Expected property name')
    return getPropertyRef(unwrap(targetRef), token.value, optional)
  }

  private callValue(calleeRef: EvalRef, optional: boolean): EvalRef {
    this.expectOperator('(')
    const args: unknown[] = []
    if (!this.matchOperator(')')) {
      do {
        args.push(unwrap(this.parseExpression()))
      } while (this.matchOperator(','))
      this.expectOperator(')')
    }

    const callee = unwrap(calleeRef)
    if (callee == null && optional) return ref(undefined)
    if (typeof callee !== 'function') return ref(undefined)
    return ref(callee.apply(calleeRef.thisArg, args))
  }

  private lookup(name: string): unknown {
    if (name in this.ctx) return this.ctx[name]
    return BUILTIN_VALUES[name]
  }

  private peek(): Token {
    return this.tokens[this.index] ?? { type: 'eof', value: '' }
  }

  private next(): Token {
    return this.tokens[this.index++] ?? { type: 'eof', value: '' }
  }

  private peekOperator(): string | null {
    const token = this.peek()
    return token.type === 'operator' ? token.value : null
  }

  private matchOperator(value: string): boolean {
    if (this.peekOperator() !== value) return false
    this.index++
    return true
  }

  private expectOperator(value: string) {
    if (!this.matchOperator(value)) throw new Error(`Expected ${value}`)
  }

  private expect(type: Token['type']) {
    const token = this.next()
    if (token.type !== type) throw new Error(`Expected ${type}`)
  }
}

function ref(value: unknown, thisArg?: unknown): EvalRef {
  return { value, thisArg }
}

function unwrap(value: EvalRef): unknown {
  return value.value
}

function getPropertyRef(target: unknown, key: unknown, optional: boolean): EvalRef {
  if (target == null) {
    if (optional) return ref(undefined)
    return ref(undefined)
  }

  const prop = String(key)
  if (FORBIDDEN_PROPERTY_KEYS.has(prop)) return ref(undefined)
  return ref((target as Record<string, unknown>)[prop], target)
}

function binaryPrecedence(op: string | null): number {
  switch (op) {
    case '||':
      return 1
    case '&&':
      return 2
    case '==':
    case '!=':
    case '===':
    case '!==':
      return 3
    case '>':
    case '>=':
    case '<':
    case '<=':
      return 4
    case '+':
    case '-':
      return 5
    case '*':
    case '/':
    case '%':
      return 6
    default:
      return -1
  }
}

function applyBinary(op: string, left: unknown, right: unknown): unknown {
  switch (op) {
    case '||':
      return left || right
    case '&&':
      return left && right
    case '==':
      return left == right
    case '!=':
      return left != right
    case '===':
      return left === right
    case '!==':
      return left !== right
    case '>':
      return (left as never) > (right as never)
    case '>=':
      return (left as never) >= (right as never)
    case '<':
      return (left as never) < (right as never)
    case '<=':
      return (left as never) <= (right as never)
    case '+':
      return (left as never) + (right as never)
    case '-':
      return Number(left) - Number(right)
    case '*':
      return Number(left) * Number(right)
    case '/':
      return Number(left) / Number(right)
    case '%':
      return Number(left) % Number(right)
    default:
      return undefined
  }
}
