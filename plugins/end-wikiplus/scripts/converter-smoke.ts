import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { parseSubmitJson, parseXml, submitJsonToXml, xmlToSubmitJson } from '@eihrteam/xml'

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

function normalizeConverterDocument<T>(document: T): T {
  const normalized = structuredClone(document) as any

  if (normalized.publicMeta?.name === normalized.name) {
    delete normalized.publicMeta.name
  }

  for (const key of ['associate', 'composite']) {
    if (normalized.briefExtra?.[key] === null) {
      delete normalized.briefExtra[key]
    }
  }

  for (const key of ['illustration', 'showType', 'composite']) {
    if (normalized.documentExtraInfo?.[key] === '') {
      delete normalized.documentExtraInfo[key]
    }
  }

  for (const group of normalized.chapterGroups || []) {
    for (const chapter of group.chapters || []) {
      for (const tab of chapter.tabs || []) {
        if (tab.icon === '') {
          tab.icon = null
        }
        if (tab.title === '') {
          tab.title = null
        }
      }
    }
  }

  return normalized as T
}

const sourceJsonDocument = parseSubmitJson(sampleJson)[0]
const sourceXmlDocument = parseXml(sampleXml)

const jsonToXml = submitJsonToXml(sampleJson)
const xmlToJson = xmlToSubmitJson(sampleXml)

const jsonRoundTripDocument = parseXml(jsonToXml.text)
const xmlRoundTripDocument = parseSubmitJson(xmlToJson.text)[0]

assert.deepEqual(jsonRoundTripDocument, sourceJsonDocument)
assert.deepEqual(normalizeConverterDocument(xmlRoundTripDocument), sourceXmlDocument)
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
