import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'

import { convertEndfieldWikitextText } from '../src/utils/endfieldWikitextConverter'
import { documentFromJsonText } from '../src/utils/endfield-wikitext/jsonFormat'
import { documentFromXmlText } from '../src/utils/endfield-wikitext/xmlFormat'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://127.0.0.1/converter-smoke',
})

globalThis.window = dom.window as unknown as Window & typeof globalThis
globalThis.document = dom.window.document
globalThis.DOMParser = dom.window.DOMParser
globalThis.XMLSerializer = dom.window.XMLSerializer
globalThis.Node = dom.window.Node
globalThis.Element = dom.window.Element

const dataDir =
  process.env.ENDFIELD_WIKITEXT_DATA_DIR ||
  resolve(homedir(), 'Desktop/ArknightsEndfieldWikitext/tests/data')

const sampleJsonPath = resolve(dataDir, 'sample.json')
const sampleXmlPath = resolve(dataDir, 'sample.xml')

if (!existsSync(sampleJsonPath) || !existsSync(sampleXmlPath)) {
  throw new Error(
    `Expected Endfield Wikitext fixtures at ${dataDir}. Set ENDFIELD_WIKITEXT_DATA_DIR to override.`
  )
}

const sampleJson = readFileSync(sampleJsonPath, 'utf8')
const sampleXml = readFileSync(sampleXmlPath, 'utf8')

const [sourceJsonDocument] = documentFromJsonText(sampleJson)
const [sourceXmlDocument] = documentFromXmlText(sampleXml)

const jsonToXml = convertEndfieldWikitextText(sampleJson, 'json', 'xml')
const xmlToJson = convertEndfieldWikitextText(sampleXml, 'xml', 'json')

const [jsonRoundTripDocument] = documentFromXmlText(jsonToXml.text)
const [xmlRoundTripDocument] = documentFromJsonText(xmlToJson.text)

assert.deepEqual(jsonRoundTripDocument, sourceJsonDocument)
assert.deepEqual(xmlRoundTripDocument, sourceXmlDocument)
assert.deepEqual(jsonToXml.warnings, [])
assert.deepEqual(xmlToJson.warnings, [])

console.log(
  JSON.stringify(
    {
      ok: true,
      dataDir,
      sampleJsonBytes: Buffer.byteLength(sampleJson),
      sampleXmlBytes: Buffer.byteLength(sampleXml),
    },
    null,
    2
  )
)
