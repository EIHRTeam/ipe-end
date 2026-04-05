import { describe, expect, it } from 'vitest'

import { detectCodeLanguage } from './SyntaxHighlightedTextarea'

describe('detectCodeLanguage', () => {
  it('prefers MediaWiki content model when available', () => {
    expect(
      detectCodeLanguage('plain text', {
        contentModel: 'json',
      })
    ).toBe('json')
  })

  it('detects JSON from content', () => {
    expect(detectCodeLanguage(`{\n  "id": "Q1",\n  "label": "Amiya"\n}`)).toBe('json')
  })

  it('detects HTML from markup content', () => {
    expect(detectCodeLanguage('<section class="hero"><h1>InPageEdit</h1></section>')).toBe('html')
  })

  it('detects JavaScript from code-like content', () => {
    expect(
      detectCodeLanguage('export const save = async () => { return window.fetch("/api") }')
    ).toBe('javascript')
  })

  it('falls back to title extension when content model is not present', () => {
    expect(
      detectCodeLanguage('totally free-form content', {
        title: 'User:Example/common.js',
      })
    ).toBe('javascript')
  })

  it('keeps the previous JSON language while the user is editing incomplete JSON', () => {
    expect(
      detectCodeLanguage('{\n  "broken": true,\n', {
        previousLanguage: 'json',
      })
    ).toBe('json')
  })

  it('returns plain for regular wikitext-like text', () => {
    expect(detectCodeLanguage('== Heading ==\nThis is ordinary page text without code.')).toBe(
      'plain'
    )
  })
})
