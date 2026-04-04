import type { HostAuthSessionSummary } from '@plugin/types/host'

type EndWikiPageSnapshot = {
  wikiItemId: string | null
  wikiItemName: string | null
}

function makeUserInfo(session: HostAuthSessionSummary | null) {
  const fallbackName = session?.wikiProfileNickname || 'Endfield Wiki⁺ User'
  const fallbackId = Number(session?.wikiProfileUserId || 0)
  return {
    id: fallbackId,
    name: fallbackName,
    groups: [],
    rights: [],
    options: {
      language: 'zh-hans',
      minordefault: 0,
      watchcreations: 0,
      watchdefault: 0,
      watchdeletion: 0,
      watchuploads: 0,
      watchmoves: 0,
    },
  }
}

export class EndWikiMetadataService {
  public readonly siteInfo = {
    general: {
      mainpage: 'Endfield Wiki⁺',
      base: window.location.origin,
      sitename: 'Endfield Wiki⁺',
      mainpageisdomainroot: true,
      logo: '',
      generator: 'Endfield Wiki⁺ Host',
      phpversion: '',
      phpsapi: '',
      dbtype: '',
      dbversion: '',
      imagewhitelistenabled: false,
      langconversion: false,
      titleconversion: false,
      linkprefixcharset: '',
      linkprefix: '',
      linktrail: '',
      legaltitlechars: '',
      invalidusernamechars: '',
      allunicodefixes: false,
      fixarabicunicode: false,
      fixmalayalamunicode: false,
      case: 'first-letter',
      lang: 'zh-hans',
      variants: [],
      rtl: false,
      fallback8bitEncoding: 'utf-8',
      readonly: false,
      writeapi: true,
      maxarticlesize: 0,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      timeoffset: 0,
      articlepath: '/wiki/$1',
      scriptpath: '/app',
      script: '/app/index.html',
      variantarticlepath: false,
      server: window.location.origin,
      servername: window.location.hostname,
      wikiid: 'end-wikiplus',
      time: new Date().toISOString(),
      misermode: false,
      uploadsenabled: false,
      maxuploadsize: 0,
      minuploadchunksize: 0,
      galleryoptions: {
        imagesPerRow: 0,
        imageWidth: 0,
        imageHeight: 0,
        captionLength: false,
        showBytes: false,
        showDimensions: false,
        mode: 'traditional',
      },
      thumblimits: {},
      imagelimits: {},
      favicon: '',
      centralidlookupprovider: '',
      allcentralidlookupproviders: [],
      interwikimagic: false,
      magiclinks: {},
      categorycollation: 'uppercase',
      citeresponsivereferences: false,
    },
    specialpagealiases: [],
    namespacealiases: [],
    magicwords: [],
    namespaces: {
      '0': {
        id: 0,
        name: '',
        canonical: '',
        case: 'first-letter',
        content: true,
        nonincludable: false,
        subpages: false,
      },
    },
    repos: [],
  }

  public userInfo = makeUserInfo(null)

  constructor(
    public ctx: { set(key: string, value: unknown): void },
    payload: {
      session: HostAuthSessionSummary | null
      page: EndWikiPageSnapshot
    }
  ) {
    this.userInfo = makeUserInfo(payload.session)
    ctx.set('wiki', this)
    ctx.set('getUrl', this.getUrl.bind(this))
    ctx.set('getSciprtUrl', this.getSciprtUrl.bind(this))
    ctx.set('getMainpageUrl', this.getMainpageUrl.bind(this))
  }

  get general() {
    return this.siteInfo.general
  }

  get baseUrl() {
    return this.siteInfo.general.server
  }

  get landingPageUrl() {
    return this.siteInfo.general.base
  }

  get mainPageName() {
    return this.siteInfo.general.mainpage
  }

  get articlePath() {
    return this.siteInfo.general.articlepath
  }

  get articleBaseUrl() {
    return `${this.baseUrl}${this.articlePath}`
  }

  get scriptPath() {
    return this.siteInfo.general.scriptpath
  }

  get scriptBaseUrl() {
    return `${this.baseUrl}${this.scriptPath}`
  }

  getSciprtUrl(name = 'index') {
    return `${this.scriptBaseUrl}/${name.replace(/\.php$/, '')}.php`
  }

  getMainpageUrl() {
    return this.landingPageUrl
  }

  getUrl(titleOrPageId: string | number, params?: Record<string, unknown>) {
    const url = new URL(window.location.href)
    if (typeof titleOrPageId === 'number' || (typeof titleOrPageId === 'string' && titleOrPageId)) {
      url.searchParams.set('wiki', String(titleOrPageId))
    }
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value == null || value === '') return
      url.searchParams.set(key, String(value))
    })
    return url.toString()
  }

  hasRight(right: string) {
    return this.userInfo.rights.includes(right)
  }

  hasAnyRight(...rights: string[]) {
    return rights.some((right) => this.hasRight(right))
  }

  hasEveryRights(...rights: string[]) {
    return rights.every((right) => this.hasRight(right))
  }

  inGroup(name: string) {
    return this.userInfo.groups.includes(name)
  }

  inAnyGroup(...names: string[]) {
    return this.userInfo.groups.some((group) => names.includes(group))
  }
}
